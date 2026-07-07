<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\Token;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class SuperAdminController extends Controller
{
    public function cabinDisplay(): JsonResponse
    {
        $doctors = Doctor::query()
            ->orderBy('cabin_number')
            ->get(['id', 'name', 'cabin_number', 'status']);

        $doctorIds = $doctors->pluck('id')->all();

        $callingByDoctor = Token::query()
            ->whereIn('doctor_id', $doctorIds)
            ->where('status', Token::STATUS_CALLING)
            ->orderByDesc('called_at')
            ->get(['id', 'doctor_id', 'token_number', 'called_at'])
            ->groupBy('doctor_id')
            ->map(fn (Collection $rows) => $rows->first());

        $waitingByDoctor = Token::query()
            ->whereIn('doctor_id', $doctorIds)
            ->where('status', Token::STATUS_WAITING)
            ->orderBy('created_at')
            ->get(['id', 'doctor_id', 'token_number', 'created_at'])
            ->groupBy('doctor_id');

        $todayByDoctor = Token::query()
            ->selectRaw('doctor_id, count(*) as total_today')
            ->whereIn('doctor_id', $doctorIds)
            ->whereDate('created_at', today())
            ->groupBy('doctor_id')
            ->pluck('total_today', 'doctor_id');

        $completedByDoctor = Token::query()
            ->selectRaw('doctor_id, count(*) as completed_today')
            ->whereIn('doctor_id', $doctorIds)
            ->whereDate('created_at', today())
            ->where('status', Token::STATUS_COMPLETED)
            ->groupBy('doctor_id')
            ->pluck('completed_today', 'doctor_id');

        $cabins = $doctors->map(function (Doctor $doctor) use ($callingByDoctor, $waitingByDoctor, $todayByDoctor, $completedByDoctor) {
            $waitingRows = $waitingByDoctor->get($doctor->id, collect());
            $currentToken = $callingByDoctor->get($doctor->id);

            return [
                'doctor' => [
                    'id' => $doctor->id,
                    'name' => $doctor->name,
                    'status' => $doctor->status,
                ],
                'cabin_number' => $doctor->cabin_number,
                'current_token' => $currentToken ? [
                    'id' => $currentToken->id,
                    'token_number' => $currentToken->token_number,
                    'called_at' => optional($currentToken->called_at)?->toIso8601String(),
                ] : null,
                'waiting_count' => $waitingRows->count(),
                'waiting_tokens' => $waitingRows
                    ->take(5)
                    ->map(fn (Token $token) => [
                        'id' => $token->id,
                        'token_number' => $token->token_number,
                    ])
                    ->values(),
                'stats' => [
                    'total_today' => (int) ($todayByDoctor[$doctor->id] ?? 0),
                    'completed_today' => (int) ($completedByDoctor[$doctor->id] ?? 0),
                ],
            ];
        })->values();

        return response()->json([
            'hospital_name' => config('app.name', 'Hospital Token System'),
            'cabins' => $cabins,
            'summary' => [
                'total_cabins' => $cabins->count(),
                'active_calls' => $cabins->filter(fn (array $cabin) => $cabin['current_token'] !== null)->count(),
                'total_waiting' => $cabins->sum('waiting_count'),
            ],
            'server_time' => now()->toIso8601String(),
            'realtime' => [
                'channel' => 'display.cabins',
                'events' => [
                    'queue.updated',
                    'doctor.updated',
                ],
            ],
        ]);
    }

    public function dashboard(): JsonResponse
    {
        $today = today();

        return response()->json([
            'stats' => [
                'total_doctors' => Doctor::query()->count(),
                'active_doctors' => Doctor::query()->where('status', 'ACTIVE')->count(),
                'today_tokens' => Token::query()->whereDate('created_at', $today)->count(),
                'waiting_tokens' => Token::query()->where('status', Token::STATUS_WAITING)->count(),
            ],
            'doctors' => Doctor::query()
                ->orderBy('cabin_number')
                ->get(['id', 'name', 'cabin_number', 'status', 'created_at'])
                ->map(function (Doctor $doctor) {
                    $liveQueue = Token::query()
                        ->where('doctor_id', $doctor->id)
                        ->where('status', Token::STATUS_WAITING)
                        ->count();

                    $currentToken = Token::query()
                        ->where('doctor_id', $doctor->id)
                        ->where('status', Token::STATUS_CALLING)
                        ->orderByDesc('called_at')
                        ->first(['id', 'token_number', 'called_at']);

                    return [
                        'id' => $doctor->id,
                        'name' => $doctor->name,
                        'cabin_number' => $doctor->cabin_number,
                        'status' => $doctor->status,
                        'created_at' => optional($doctor->created_at)?->toIso8601String(),
                        'live_queue_count' => $liveQueue,
                        'current_token' => $currentToken ? [
                            'id' => $currentToken->id,
                            'token_number' => $currentToken->token_number,
                            'called_at' => optional($currentToken->called_at)?->toIso8601String(),
                        ] : null,
                    ];
                })
                ->values(),
            'realtime' => [
                'channel' => 'admin.dashboard',
                'events' => [
                    'doctor.created',
                    'doctor.updated',
                    'queue.updated',
                ],
            ],
        ]);
    }

    public function doctors(): JsonResponse
    {
        return response()->json([
            'doctors' => Doctor::query()
                ->orderBy('created_at', 'desc')
                ->get(['id', 'name', 'cabin_number', 'status', 'created_at', 'updated_at']),
        ]);
    }

    public function storeDoctor(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'cabin_number' => ['required', 'string', 'max:50', 'unique:doctors,cabin_number'],
            'status' => ['nullable', 'in:ACTIVE,INACTIVE'],
        ]);

        $doctor = Doctor::query()->create([
            'name' => $validated['name'],
            'cabin_number' => $validated['cabin_number'],
            'status' => $validated['status'] ?? 'ACTIVE',
        ]);

        // Placeholder for future broadcasting through Laravel Reverb/WebSockets.

        return response()->json([
            'message' => 'Doctor registered successfully.',
            'doctor' => $doctor,
        ], 201);
    }

    public function updateDoctor(Request $request, int $doctor_id): JsonResponse
    {
        $doctor = Doctor::query()->findOrFail($doctor_id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'cabin_number' => [
                'required',
                'string',
                'max:50',
                Rule::unique('doctors', 'cabin_number')->ignore($doctor->id),
            ],
            'status' => ['required', 'in:ACTIVE,INACTIVE'],
        ]);

        $doctor->name = $validated['name'];
        $doctor->cabin_number = $validated['cabin_number'];
        $doctor->status = $validated['status'];
        $doctor->save();

        // Placeholder for future broadcasting through Laravel Reverb/WebSockets.

        return response()->json([
            'message' => 'Doctor updated successfully.',
            'doctor' => $doctor,
        ]);
    }

    public function deleteDoctor(int $doctor_id): JsonResponse
    {
        $doctor = Doctor::query()->findOrFail($doctor_id);

        $hasPendingQueue = Token::query()
            ->where('doctor_id', $doctor->id)
            ->whereIn('status', [Token::STATUS_WAITING, Token::STATUS_CALLING])
            ->exists();

        if ($hasPendingQueue) {
            return response()->json([
                'message' => 'Cannot delete doctor with WAITING or CALLING tokens.',
            ], 422);
        }

        $doctorName = $doctor->name;
        $doctor->delete();

        // Placeholder for future broadcasting through Laravel Reverb/WebSockets.

        return response()->json([
            'message' => "Doctor {$doctorName} deleted successfully.",
        ]);
    }
}
