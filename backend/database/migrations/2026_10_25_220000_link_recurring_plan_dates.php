<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('entries', function (Blueprint $table) {
            $table->boolean('recurring_date_overridden')->default(false);
        });

        $rules = DB::table('recurrings')->get()->keyBy('id');
        DB::table('entries')->where('state', 'planned')->orderBy('id')->each(function ($entry) use ($rules) {
            $ruleId = $entry->recurring_id;
            if (! $ruleId && preg_match('/^import:\d{4}-\d{2}:base:(\d+)$/', $entry->source_key ?? '', $match)) {
                $ruleId = (int) $match[1];
            }
            if ($ruleId && $rules->has($ruleId)) {
                $date = CarbonImmutable::parse($entry->date)->startOfMonth();
                $scheduledDate = $date->day(min($rules[$ruleId]->day, $date->daysInMonth))->toDateString();
                DB::table('entries')->where('id', $entry->id)->update([
                    'recurring_id' => $ruleId,
                    'recurring_date_overridden' => $entry->date_confirmed && (! $entry->recurring_id || $entry->date !== $scheduledDate),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('entries', function (Blueprint $table) {
            $table->dropColumn('recurring_date_overridden');
        });
    }
};
