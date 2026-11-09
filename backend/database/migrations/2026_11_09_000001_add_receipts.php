<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entries', fn (Blueprint $t) => $t->foreignId('category_id')->nullable()->change());
        Schema::create('receipts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('entry_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('fingerprint', 64)->unique();
            $t->string('qr', 512);
            $t->string('seller')->nullable();
            $t->bigInteger('total_cents');
            $t->date('date');
            $t->string('status', 16);
            $t->timestamps();
        });
        Schema::create('purchases', function (Blueprint $t) {
            $t->id();
            $t->foreignId('receipt_id')->constrained()->cascadeOnDelete();
            $t->string('name', 512);
            $t->bigInteger('price_cents');
            $t->decimal('quantity', 16, 6);
            $t->bigInteger('amount_cents');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('receipts');
        // Uncategorised expenses must be categorised before rolling back.
        Schema::table('entries', fn (Blueprint $t) => $t->foreignId('category_id')->nullable(false)->change());
    }
};
