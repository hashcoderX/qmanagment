<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Token extends Model
{
    use HasFactory;

    public const STATUS_WAITING = 'WAITING';
    public const STATUS_CALLING = 'CALLING';
    public const STATUS_COMPLETED = 'COMPLETED';
    public const STATUS_SKIPPED = 'SKIPPED';

    protected $fillable = [
        'doctor_id',
        'token_number',
        'status',
        'called_at',
    ];

    protected $casts = [
        'called_at' => 'datetime',
    ];

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(Doctor::class);
    }
}
