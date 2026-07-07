<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\Token;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DoctorDashboardController extends Controller
{
    public function dashboard(int $doctor_id): JsonResponse
    {
        $doctor = Doctor::query()->findOrFail($doctor_id);

        return response()->json($this->buildDashboardPayload($doctor));
    }

    public function nextToken(int $doctor_id): JsonResponse
    {
        $doctor = Doctor::query()->findOrFail($doctor_id);

        $result = DB::transaction(function () use ($doctor) {
            $currentCalling = Token::query()
                ->where('doctor_id', $doctor->id)
                ->where('status', Token::STATUS_CALLING)
                ->lockForUpdate()
                ->orderByDesc('called_at')
                ->first();

            if ($currentCalling) {
                $currentCalling->status = Token::STATUS_COMPLETED;
                $currentCalling->save();
            }

            $nextToken = Token::query()
                ->where('doctor_id', $doctor->id)
                ->where('status', Token::STATUS_WAITING)
                ->lockForUpdate()
                ->orderBy('created_at')
                ->first();

            if ($nextToken) {
                $nextToken->status = Token::STATUS_CALLING;
                $nextToken->called_at = now();
                $nextToken->save();
            }

            return $nextToken;
        });

        // Placeholder for future broadcasting through Laravel Reverb/WebSockets.

        return response()->json([
            'message' => $result ? 'Next token is now calling.' : 'No waiting token available.',
            'dashboard' => $this->buildDashboardPayload($doctor),
        ]);
    }

    public function recall(int $token_id): JsonResponse
    {
        $token = Token::query()->with('doctor')->findOrFail($token_id);

        if ($token->status !== Token::STATUS_CALLING) {
            return response()->json([
                'message' => 'Only a CALLING token can be recalled.',
            ], 422);
        }

        $token->called_at = now();
        $token->save();

        // Placeholder for future broadcasting through Laravel Reverb/WebSockets.

        return response()->json([
            'message' => 'Token recalled successfully.',
            'dashboard' => $this->buildDashboardPayload($token->doctor),
        ]);
    }

    public function skip(int $token_id): JsonResponse
    {
        $token = Token::query()->with('doctor')->findOrFail($token_id);
        $doctor = $token->doctor;

        DB::transaction(function () use ($token, $doctor) {
            $lockedToken = Token::query()->whereKey($token->id)->lockForUpdate()->firstOrFail();

            if (! in_array($lockedToken->status, [Token::STATUS_WAITING, Token::STATUS_CALLING], true)) {
                return;
            }

            $lockedToken->status = Token::STATUS_SKIPPED;
            $lockedToken->save();

            $nextToken = Token::query()
                ->where('doctor_id', $doctor->id)
                ->where('status', Token::STATUS_WAITING)
                ->lockForUpdate()
                ->orderBy('created_at')
                ->first();

            if ($nextToken) {
                $nextToken->status = Token::STATUS_CALLING;
                $nextToken->called_at = now();
                $nextToken->save();
            }
        });

        // Placeholder for future broadcasting through Laravel Reverb/WebSockets.

        return response()->json([
            'message' => 'Token skipped and queue advanced.',
            'dashboard' => $this->buildDashboardPayload($doctor),
        ]);
    }

    private function buildDashboardPayload(Doctor $doctor): array
    {
        $currentToken = Token::query()
            ->where('doctor_id', $doctor->id)
            ->where('status', Token::STATUS_CALLING)
            ->orderByDesc('called_at')
            ->first();

        $waitingTokens = Token::query()
            ->where('doctor_id', $doctor->id)
            ->where('status', Token::STATUS_WAITING)
            ->orderBy('created_at')
            ->get(['id', 'token_number', 'created_at'])
            ->map(function (Token $token) {
                $createdAt = Carbon::parse($token->created_at);

                return [
                    'id' => $token->id,
                    'token_number' => $token->token_number,
                    'issue_time' => $createdAt->format('h:i A'),
                    'waiting_duration_minutes' => $createdAt->diffInMinutes(now()),
                    'created_at' => $createdAt->toIso8601String(),
                ];
            })
            ->values();

        $todayTokens = Token::query()
            ->where('doctor_id', $doctor->id)
            ->whereDate('created_at', today());

        return [
            'doctor' => [
                'id' => $doctor->id,
                'name' => $doctor->name,
                'cabin_number' => $doctor->cabin_number,
                'status' => $doctor->status,
            ],
            'current_token' => $currentToken ? [
                'id' => $currentToken->id,
                'token_number' => $currentToken->token_number,
                'status' => $currentToken->status,
                'called_at' => optional($currentToken->called_at)?->toIso8601String(),
            ] : null,
            'waiting_tokens' => $waitingTokens,
            'stats' => [
                'total_today' => (clone $todayTokens)->count(),
                'completed_today' => (clone $todayTokens)->where('status', Token::STATUS_COMPLETED)->count(),
                'waiting_now' => Token::query()
                    ->where('doctor_id', $doctor->id)
                    ->where('status', Token::STATUS_WAITING)
                    ->count(),
            ],
            'realtime' => [
                'channel' => "doctor.{$doctor->id}.queue",
                'events' => [
                    'queue.updated',
                    'token.called',
                    'token.recalled',
                    'token.skipped',
                ],
            ],
            'server_time' => now()->toIso8601String(),
        ];
    }
}
