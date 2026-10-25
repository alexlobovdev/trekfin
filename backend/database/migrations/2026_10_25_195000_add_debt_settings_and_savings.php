<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('debts', function (Blueprint $t) {
            $t->string('type', 12)->default('internal');
            $t->string('creditor', 120)->nullable();
            $t->bigInteger('initial_paid_cents')->default(0);
            $t->bigInteger('monthly_payment_cents')->default(0);
            $t->unsignedTinyInteger('payment_day')->nullable();
            $t->date('due_date')->nullable();
            $t->boolean('archived')->default(false);
        });
        Schema::table('entries', fn (Blueprint $t) => $t->foreignId('debt_id')->nullable()->constrained()->restrictOnDelete());
        Schema::table('repayments', function (Blueprint $t) {
            $t->foreignId('author_id')->nullable()->constrained('users');
            $t->softDeletes();
        });
        Schema::create('savings_goals', function (Blueprint $t) {
            $t->id();
            $t->string('title', 120);
            $t->bigInteger('target_cents');
            $t->bigInteger('opening_cents')->default(0);
            $t->string('color', 7)->default('#d3437b');
            $t->string('icon', 20)->default('sparkles');
            $t->date('due_date')->nullable();
            $t->text('note')->nullable();
            $t->boolean('archived')->default(false);
            $t->timestamps();
        });
        Schema::table('entries', fn (Blueprint $t) => $t->foreignId('savings_goal_id')->nullable()->constrained()->restrictOnDelete());
        foreach ([['Отложенное', 'expense', 'wallet'], ['Возврат из накоплений', 'income', 'wallet']] as [$name, $kind, $icon]) {
            DB::table('categories')->insertOrIgnore(['name' => $name, 'kind' => $kind, 'icon' => $icon, 'color' => '#a27eb5', 'active' => true, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::table('entries', fn (Blueprint $t) => $t->dropConstrainedForeignId('savings_goal_id'));
        Schema::dropIfExists('savings_goals');
        Schema::table('repayments', function (Blueprint $t) {
            $t->dropConstrainedForeignId('author_id');
            $t->dropSoftDeletes();
        });
        Schema::table('entries', fn (Blueprint $t) => $t->dropConstrainedForeignId('debt_id'));
        Schema::table('debts', fn (Blueprint $t) => $t->dropColumn(['type', 'creditor', 'initial_paid_cents', 'monthly_payment_cents', 'payment_day', 'due_date', 'archived']));
    }
};
