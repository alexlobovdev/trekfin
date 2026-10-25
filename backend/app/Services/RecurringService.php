<?php

namespace App\Services;

use App\Models\Entry;
use App\Models\Recurring;
use Illuminate\Support\Facades\DB;

class RecurringService
{
    public function save(Recurring $rule, array $data): Recurring
    {
        return DB::transaction(function () use ($rule, $data) {
            if ($rule->exists) {
                $rule = Recurring::lockForUpdate()->findOrFail($rule->id);
            }
            $rule->fill($data)->save();

            $entries = Entry::where('recurring_id', $rule->id)->where('state', 'planned')
                ->where('date', '>=', now()->startOfMonth()->toDateString())
                ->where('recurring_date_overridden', false)->orderBy('id')->lockForUpdate()->get();
            foreach ($entries as $entry) {
                if (Entry::where('plan_id', $entry->id)->where('state', 'actual')->exists()) {
                    continue;
                }
                $date = $entry->date->copy()->startOfMonth();
                $entry->update(['date' => $date->day(min($rule->day, $date->daysInMonth))->toDateString(), 'date_confirmed' => true]);
            }

            return $rule;
        });
    }
}
