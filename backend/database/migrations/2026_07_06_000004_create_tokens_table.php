<?php

use App\Models\Token;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('doctor_id')->constrained('doctors')->cascadeOnDelete();
            $table->string('token_number', 20);
            $table->enum('status', [
                Token::STATUS_WAITING,
                Token::STATUS_CALLING,
                Token::STATUS_COMPLETED,
                Token::STATUS_SKIPPED,
            ])->default(Token::STATUS_WAITING);
            $table->timestamp('called_at')->nullable();
            $table->timestamps();

            $table->index(['doctor_id', 'status']);
            $table->index(['doctor_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tokens');
    }
};
