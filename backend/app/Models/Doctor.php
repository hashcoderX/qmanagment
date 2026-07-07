<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Doctor extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'cabin_number',
        'status',
    ];

    public function tokens(): HasMany
    {
        return $this->hasMany(Token::class);
    }
}
