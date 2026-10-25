<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->boolean('must_change_password')->default(true);
        });
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->string('name', 80);
            $t->string('kind', 10);
            $t->string('icon', 30)->default('wallet');
            $t->string('color', 7)->default('#d3437b');
            $t->boolean('active')->default(true);
            $t->timestamps();
            $t->unique(['name', 'kind']);
        });
        Schema::create('month_plans', function (Blueprint $t) {
            $t->id();
            $t->string('month', 7)->unique();
            $t->bigInteger('opening_cents')->default(0);
            $t->text('note')->nullable();
            $t->timestamps();
        });
        Schema::create('recurrings', function (Blueprint $t) {
            $t->id();
            $t->string('title', 120);
            $t->foreignId('category_id')->constrained();
            $t->foreignId('author_id')->nullable()->constrained('users');
            $t->bigInteger('amount_cents');
            $t->bigInteger('summer_cents')->nullable();
            $t->unsignedTinyInteger('day')->default(1);
            $t->string('kind', 10)->default('expense');
            $t->boolean('active')->default(true);
            $t->text('note')->nullable();
            $t->timestamps();
        });
        Schema::create('entries', function (Blueprint $t) {
            $t->id();
            $t->string('title', 120);
            $t->foreignId('category_id')->constrained();
            $t->foreignId('author_id')->nullable()->constrained('users');
            $t->foreignId('created_by')->constrained('users');
            $t->foreignId('updated_by')->nullable()->constrained('users');
            $t->string('kind', 10);
            $t->string('state', 10);
            $t->bigInteger('amount_cents');
            $t->date('date')->index();
            $t->text('note')->nullable();
            $t->foreignId('plan_id')->nullable()->constrained('entries')->nullOnDelete();
            $t->foreignId('recurring_id')->nullable()->constrained('recurrings')->nullOnDelete();
            $t->string('source_key')->nullable()->unique();
            $t->timestamps();
            $t->index(['state', 'kind', 'date']);
        });
        Schema::create('debts', function (Blueprint $t) {
            $t->id();
            $t->string('title');
            $t->bigInteger('amount_cents');
            $t->foreignId('author_id')->constrained('users');
            $t->text('note')->nullable();
            $t->timestamps();
        });
        Schema::create('repayments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('debt_id')->constrained();
            $t->bigInteger('amount_cents');
            $t->date('date')->nullable();
            $t->foreignId('created_by')->constrained('users');
            $t->text('note')->nullable();
            $t->timestamps();
        });
        Schema::create('imports', function (Blueprint $t) {
            $t->id();
            $t->string('checksum')->unique();
            $t->json('source');
            $t->json('report');
            $t->timestamps();
        });
        Schema::create('push_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained();
            $t->text('endpoint');
            $t->string('endpoint_hash', 64)->unique();
            $t->text('public_key');
            $t->text('auth_token');
            $t->string('content_encoding')->default('aes128gcm');
            $t->timestamps();
        });
        Schema::create('notification_deliveries', function (Blueprint $t) {
            $t->id();
            $t->string('key')->unique();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['notification_deliveries', 'push_subscriptions', 'imports', 'repayments', 'debts', 'entries', 'recurrings', 'month_plans', 'categories'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('must_change_password'));
    }
};
