<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->string('mode', 10)->default('payment');
        });
        DB::table('categories')->whereIn('name', [
            'Продукты', 'Кафе и рестораны', 'Кофе дома', 'Кофе с собой', 'Транспорт', 'Другое',
        ])->update(['mode' => 'limit']);
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropColumn('mode');
        });
    }
};
