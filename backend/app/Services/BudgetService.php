<?php

namespace App\Services;

use App\Models\Entry;
use App\Models\MonthPlan;
use App\Models\Recurring;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class BudgetService
{
    public function month(string $month): array
    {
        $date = CarbonImmutable::createFromFormat('!Y-m', $month);
        $entries = Entry::with(['category', 'author'])->whereBetween('date', [$date->toDateString(), $date->endOfMonth()->toDateString()])->orderByDesc('date')->orderByDesc('id')->get();
        $allPayments = Entry::where('state', 'actual')->whereIn('plan_id', $entries->where('state', 'planned')->pluck('id'))->selectRaw('plan_id, SUM(amount_cents) as paid')->groupBy('plan_id')->pluck('paid', 'plan_id');
        $entries->each(function ($e) use ($allPayments) {
            $e->setAttribute('paid_cents', (int) ($allPayments[$e->id] ?? 0));
        });
        $sum = fn ($state, $kind) => (int) $entries->where('state', $state)->where('kind', $kind)->sum('amount_cents');
        $plan = MonthPlan::where('month', $month)->first();
        $income = $sum('actual', 'income');
        $expense = $sum('actual', 'expense');
        $remaining = fn ($kind) => (int) $entries->where('state', 'planned')->where('kind', $kind)->sum(fn ($e) => max(0, $e->amount_cents - $e->paid_cents));
        $history = Entry::where('state', 'actual')->where('date', '<', $date->toDateString())->selectRaw("COALESCE(SUM(CASE WHEN kind='income' THEN amount_cents ELSE -amount_cents END),0) as balance")->value('balance');

        return [
            'month' => $month, 'plan' => $plan, 'entries' => $entries,
            'totals' => ['planned_income' => $sum('planned', 'income'), 'planned_expense' => $sum('planned', 'expense'), 'income' => $income, 'expense' => $expense, 'balance' => (int) $history + $income - $expense,
                'forecast' => ($plan?->opening_cents ?? 0) + $income - $expense + $remaining('income') - $remaining('expense')],
            'by_author' => User::select('id', 'name')->get()->map(fn ($u) => [...$u->toArray(), 'income' => (int) $entries->where('state', 'actual')->where('kind', 'income')->where('author_id', $u->id)->sum('amount_cents'), 'expense' => (int) $entries->where('state', 'actual')->where('kind', 'expense')->where('author_id', $u->id)->sum('amount_cents')]),
        ];
    }

    public function generate(string $month, int $userId): void
    {
        DB::transaction(function () use ($month, $userId) {
            $plan = MonthPlan::firstOrCreate(['month' => $month]);
            MonthPlan::whereKey($plan->id)->lockForUpdate()->first();
            $d = CarbonImmutable::createFromFormat('!Y-m', $month);
            foreach (Recurring::where('active', true)->get() as $rule) {
                $amount = $rule->summer_cents !== null && in_array($d->month, [5, 6, 7, 8, 9]) ? $rule->summer_cents : $rule->amount_cents;
                Entry::firstOrCreate(['source_key' => "recurring:{$rule->id}:{$month}"], [
                    'title' => $rule->title, 'category_id' => $rule->category_id, 'author_id' => $rule->author_id, 'created_by' => $userId,
                    'kind' => $rule->kind, 'state' => 'planned', 'amount_cents' => $amount, 'date' => $d->day(min($rule->day, $d->daysInMonth))->toDateString(),
                    'recurring_id' => $rule->id, 'note' => $rule->note,
                ]);
            }
        });
    }
}
