<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\Token;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReceptionController extends Controller
{
    public function dashboard(): JsonResponse
    {
        return response()->json($this->buildDashboardPayload());
    }

    public function storeToken(): JsonResponse
    {
        $doctor = $this->pickBalancedDoctor();

        if (! $doctor) {
            return response()->json([
                'message' => 'No doctor available for token assignment.',
            ], 422);
        }

        $token = DB::transaction(function () use ($doctor) {
            $lastTokenToday = Token::query()
                ->whereDate('created_at', today())
                ->lockForUpdate()
                ->orderByDesc('id')
                ->first(['token_number']);

            $nextSequence = $this->nextSequence($lastTokenToday?->token_number);
            $tokenNumber = 'T'.str_pad((string) $nextSequence, 3, '0', STR_PAD_LEFT);

            return Token::query()->create([
                'doctor_id' => $doctor->id,
                'token_number' => $tokenNumber,
                'status' => Token::STATUS_WAITING,
            ]);
        });

        // Placeholder for future broadcasting through Laravel Reverb/WebSockets.

        return response()->json([
            'message' => 'Token created successfully.',
            'token' => [
                'id' => $token->id,
                'token_number' => $token->token_number,
                'doctor_id' => $token->doctor_id,
                'doctor_name' => $doctor->name,
                'cabin_number' => $doctor->cabin_number,
                'status' => $token->status,
                'created_at' => optional($token->created_at)?->toIso8601String(),
            ],
            'dashboard' => $this->buildDashboardPayload(),
        ], 201);
    }

    private function buildDashboardPayload(): array
    {
        $doctors = Doctor::query()
            ->orderBy('cabin_number')
            ->get(['id', 'name', 'cabin_number', 'status']);

        $doctorIds = $doctors->pluck('id')->all();

        $waitingByDoctor = Token::query()
            ->selectRaw('doctor_id, count(*) as waiting_count')
            ->whereIn('doctor_id', $doctorIds)
            ->where('status', Token::STATUS_WAITING)
            ->groupBy('doctor_id')
            ->pluck('waiting_count', 'doctor_id');

        $callingByDoctor = Token::query()
            ->whereIn('doctor_id', $doctorIds)
            ->where('status', Token::STATUS_CALLING)
            ->orderByDesc('called_at')
            ->get(['id', 'doctor_id', 'token_number', 'called_at'])
            ->groupBy('doctor_id')
            ->map(fn (Collection $rows) => $rows->first());

        $recentTokensByDoctor = Token::query()
            ->whereIn('doctor_id', $doctorIds)
            ->whereDate('created_at', today())
            ->orderByDesc('created_at')
            ->get(['id', 'doctor_id', 'token_number', 'status', 'created_at'])
            ->groupBy('doctor_id');

        $doctorItems = $doctors->map(function (Doctor $doctor) use ($waitingByDoctor, $callingByDoctor, $recentTokensByDoctor) {
            $recent = $recentTokensByDoctor
                ->get($doctor->id, collect())
                ->take(5)
                ->map(fn (Token $token) => [
                    'id' => $token->id,
                    'token_number' => $token->token_number,
                    'status' => $token->status,
                    'created_at' => optional($token->created_at)?->toIso8601String(),
                ])
                ->values();

            $calling = $callingByDoctor->get($doctor->id);

            return [
                'id' => $doctor->id,
                'name' => $doctor->name,
                'cabin_number' => $doctor->cabin_number,
                'status' => $doctor->status,
                'waiting_count' => (int) ($waitingByDoctor[$doctor->id] ?? 0),
                'current_calling_token' => $calling ? [
                    'id' => $calling->id,
                    'token_number' => $calling->token_number,
                    'called_at' => optional($calling->called_at)?->toIso8601String(),
                ] : null,
                'recent_tokens' => $recent,
            ];
        })->values();

        return [
            'summary' => [
                'total_doctors' => $doctors->count(),
                'active_calls_count' => Token::query()->where('status', Token::STATUS_CALLING)->count(),
                'total_waiting_count' => Token::query()->where('status', Token::STATUS_WAITING)->count(),
                'today_tokens_count' => Token::query()->whereDate('created_at', today())->count(),
            ],
            'doctors' => $doctorItems,
            'server_time' => now()->toIso8601String(),
            'realtime' => [
                'channel' => 'reception.dashboard',
                'events' => [
                    'token.created',
                    'queue.updated',
                    'call.updated',
                ],
            ],
        ];
    }

    private function pickBalancedDoctor(): ?Doctor
    {
        $activeDoctors = Doctor::query()
            ->where('status', 'ACTIVE')
            ->orderBy('cabin_number')
            ->get(['id', 'name', 'cabin_number', 'status']);

        if ($activeDoctors->isEmpty()) {
            $activeDoctors = Doctor::query()
                ->orderBy('cabin_number')
                ->get(['id', 'name', 'cabin_number', 'status']);
        }

        if ($activeDoctors->isEmpty()) {
            return null;
        }

        $todayCounts = Token::query()
            ->selectRaw('doctor_id, count(*) as token_count')
            ->whereIn('doctor_id', $activeDoctors->pluck('id'))
            ->whereDate('created_at', today())
            ->groupBy('doctor_id')
            ->pluck('token_count', 'doctor_id');

        return $activeDoctors
            ->sortBy(function (Doctor $doctor) use ($todayCounts) {
                return [
                    (int) ($todayCounts[$doctor->id] ?? 0),
                    $doctor->cabin_number,
                ];
            })
            ->first();
    }

    private function nextSequence(?string $tokenNumber): int
    {
        if (! $tokenNumber) {
            return 1;
        }

        preg_match('/(\d+)$/', $tokenNumber, $matches);

        if (! isset($matches[1])) {
            return 1;
        }

        return ((int) $matches[1]) + 1;
    }
}
