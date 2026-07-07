<?php

use App\Http\Controllers\Api\DoctorDashboardController;
use App\Http\Controllers\Api\ReceptionController;
use App\Http\Controllers\Api\SuperAdminController;
use Illuminate\Support\Facades\Route;

Route::prefix('doctor/{doctor_id}')->group(function () {
    Route::get('/dashboard', [DoctorDashboardController::class, 'dashboard']);
    Route::post('/next-token', [DoctorDashboardController::class, 'nextToken']);
});

Route::post('/token/{token_id}/recall', [DoctorDashboardController::class, 'recall']);
Route::post('/token/{token_id}/skip', [DoctorDashboardController::class, 'skip']);
Route::get('/display/cabins', [SuperAdminController::class, 'cabinDisplay']);

Route::prefix('admin')->group(function () {
    Route::get('/dashboard', [SuperAdminController::class, 'dashboard']);
    Route::get('/doctors', [SuperAdminController::class, 'doctors']);
    Route::post('/doctors', [SuperAdminController::class, 'storeDoctor']);
    Route::put('/doctors/{doctor_id}', [SuperAdminController::class, 'updateDoctor']);
    Route::delete('/doctors/{doctor_id}', [SuperAdminController::class, 'deleteDoctor']);
});

Route::prefix('reception')->group(function () {
    Route::get('/dashboard', [ReceptionController::class, 'dashboard']);
    Route::post('/tokens', [ReceptionController::class, 'storeToken']);
});
