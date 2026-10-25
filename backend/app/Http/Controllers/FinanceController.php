<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Debt;
use App\Models\Entry;
use App\Models\MonthPlan;
use App\Models\Recurring;
use App\Models\SavingsGoal;
use App\Models\User;
use App\Services\BudgetService;
use App\Services\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceController extends Controller
{
    public function bootstrap(): array
    {
        return ['users' => User::select('id', 'name')->get(), 'categories' => Category::orderBy('id')->get(),
            'recurrings' => Recurring::orderBy('id')->get(), 'months' => MonthPlan::orderBy('month')->get(),
            'debts' => Debt::with(['repayments', 'entries.category', 'entries.author'])->get()->each->append('paid_cents'), 'savings' => SavingsGoal::with('movements')->get(),
            'push_key' => config('services.webpush.public_key'), 'import' => DB::table('imports')->latest('id')->value('report') ? json_decode(DB::table('imports')->latest('id')->value('report'), true) : null];
    }

    public function month(Request $r, BudgetService $budget): array
    {
        $v = $r->validate(['month' => ['required', 'date_format:Y-m']]);

        return $budget->month($v['month']);
    }

    public function saveMonth(Request $r, BudgetService $budget): array
    {
        $v = $r->validate(['month' => 'required|date_format:Y-m', 'generate' => 'boolean', 'opening' => ['nullable', 'regex:/^\d{1,9}([.,]\d{1,2})?$/']]);
        if ($v['generate'] ?? false) {
            $budget->generate($v['month'], $r->user()->id);
        }
        if (isset($v['opening'])) {
            MonthPlan::updateOrCreate(['month' => $v['month']], ['opening_cents' => Money::cents((string) $v['opening'])]);
        }

        return $budget->month($v['month']);
    }

    private function entryData(Request $r, ?Entry $entry): array
    {
        $v = $r->validate([
            'title' => 'required|string|max:120', 'category_id' => ['required', 'integer', Rule::exists('categories', 'id')],
            'author_id' => ['nullable', 'integer', Rule::exists('users', 'id')], 'kind' => 'required|in:income,expense', 'state' => 'required|in:planned,actual',
            'amount' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'date' => 'required|date_format:Y-m-d|after_or_equal:2000-01-01|before:2100-01-01',
            'note' => 'nullable|string|max:2000', 'plan_id' => 'nullable|integer|exists:entries,id',
            'date_confirmed' => 'sometimes|boolean',
            'debt_id' => 'nullable|integer|exists:debts,id',
            'savings_goal_id' => 'nullable|integer|exists:savings_goals,id',
        ]);
        if ($v['state'] === 'actual' && empty($v['author_id'])) {
            throw ValidationException::withMessages(['author_id' => 'Укажите, кто совершил операцию.']);
        }
        $category = Category::findOrFail($v['category_id']);
        $existingCategory = $entry?->exists && (int) $entry->category_id === (int) $category->id;
        $linkedCategory = ! empty($v['plan_id']) && (int) Entry::whereKey($v['plan_id'])->value('category_id') === (int) $category->id;
        if ((! $category->active && ! $existingCategory && ! $linkedCategory) || $category->kind !== $v['kind']) {
            throw ValidationException::withMessages(['category_id' => 'Выберите активную категорию нужного типа.']);
        }
        $v['amount_cents'] = Money::cents($v['amount']);
        $v['date_confirmed'] = $v['state'] === 'actual' || ($v['date_confirmed'] ?? ($entry?->exists && $entry->date->format('Y-m-d') === $v['date'] ? $entry->date_confirmed : true));
        unset($v['amount']);
        $v['debt_id'] = array_key_exists('debt_id', $v) ? $v['debt_id'] : $entry?->debt_id;
        $v['savings_goal_id'] = array_key_exists('savings_goal_id', $v) ? $v['savings_goal_id'] : $entry?->savings_goal_id;
        if ($v['amount_cents'] <= 0) {
            throw ValidationException::withMessages(['amount' => 'Сумма должна быть больше нуля.']);
        }

        return $v;
    }

    public function saveEntry(Request $r, ?Entry $entry = null): Entry
    {
        $v = $this->entryData($r, $entry);

        return DB::transaction(function () use ($v, $entry, $r) {
            if ($entry?->exists) {
                $entry = Entry::lockForUpdate()->findOrFail($entry->id);
            }
            if ($entry?->exists && $entry->state !== $v['state']) {
                throw ValidationException::withMessages(['state' => 'Тип существующей записи менять нельзя.']);
            }
            if (! empty($v['plan_id'])) {
                $plan = Entry::lockForUpdate()->findOrFail($v['plan_id']);
                if ($v['state'] !== 'actual' || $plan->state !== 'planned' || $plan->kind !== $v['kind'] || $plan->id === $entry?->id) {
                    abort(422, 'Некорректная связь с планом.');
                }
                if ((int) $plan->category_id !== (int) $v['category_id']) {
                    abort(422, 'Категория должна совпадать с планом.');
                }
                if ($plan->debt_id) {
                    abort_if($v['debt_id'] && (int) $v['debt_id'] !== $plan->debt_id, 422, 'Долг должен совпадать с плановым платежом.');
                    $v['debt_id'] = $plan->debt_id;
                }
                if ($plan->savings_goal_id) {
                    abort_if($v['savings_goal_id'] && (int) $v['savings_goal_id'] !== $plan->savings_goal_id, 422, 'Цель должна совпадать с плановым платежом.');
                    $v['savings_goal_id'] = $plan->savings_goal_id;
                }
            }
            if ($entry?->savings_goal_id && $entry->state === 'actual') {
                abort_if((int) $v['savings_goal_id'] !== $entry->savings_goal_id, 422, 'Нельзя менять цель у существующего пополнения.');
            }
            if ($v['savings_goal_id']) {
                $goal = SavingsGoal::lockForUpdate()->findOrFail($v['savings_goal_id']);
                abort_if($v['debt_id'], 422, 'Операция не может одновременно погашать долг и пополнять цель.');
                abort_if($goal->archived && $entry?->savings_goal_id !== $goal->id, 422, 'Цель находится в архиве.');
                $expected = $v['kind'] === 'expense' ? 'Отложенное' : 'Возврат из накоплений';
                abort_unless(Category::whereKey($v['category_id'])->where('name', $expected)->exists(), 422, 'Для накоплений выберите категорию «'.$expected.'».');
                $goal->validateMovement($v['state'] === 'actual' ? $v['amount_cents'] : 0, $v['kind'], $entry?->savings_goal_id === $goal->id ? $entry : null);
            }
            if ($v['debt_id']) {
                $debt = Debt::lockForUpdate()->findOrFail($v['debt_id']);
                abort_if($v['kind'] !== 'expense' || $debt->type === 'internal', 422, 'Связать с расходом можно только кредит или внешний долг.');
                abort_if($debt->archived && $entry?->debt_id !== $debt->id, 422, 'Этот долг находится в архиве.');
                $previous = $entry?->exists && $entry->state === 'actual' && $entry->debt_id === $debt->id ? $entry->amount_cents : 0;
                abort_if($v['state'] === 'actual' && $v['amount_cents'] > $debt->amount_cents - $debt->paid_cents + $previous, 422, 'Платёж превышает остаток долга. При необходимости измените общую сумму долга.');
            }
            $entity = $entry?->exists ? $entry : new Entry(['created_by' => $r->user()->id]);
            if ($entity->recurring_id && ($entity->date->toDateString() !== $v['date'] || $entity->date_confirmed !== $v['date_confirmed'])) {
                $v['recurring_date_overridden'] = true;
            }
            $entity->fill([...$v, 'updated_by' => $r->user()->id])->save();
            if ($v['state'] === 'planned') {
                MonthPlan::firstOrCreate(['month' => substr($v['date'], 0, 7)]);
            }

            return $entity->load('category', 'author', 'debt');
        });
    }

    public function deleteEntry(Entry $entry): Response
    {
        DB::transaction(function () use ($entry) {
            $entry = Entry::lockForUpdate()->findOrFail($entry->id);
            if ($entry->savings_goal_id) {
                SavingsGoal::lockForUpdate()->findOrFail($entry->savings_goal_id)->validateMovement(0, 'expense', $entry);
            }
            $entry->delete();
        });

        return response()->noContent();
    }

    public function export(): StreamedResponse
    {
        return response()->streamDownload(function () {
            $f = fopen('php://output', 'w');
            fwrite($f, "\xEF\xBB\xBF");
            fputcsv($f, ['Дата', 'Тип', 'План / факт', 'Описание', 'Категория', 'Автор', 'Сумма, ₽', 'Комментарий', 'Долг / кредит'], ';', '"', '');
            Entry::with('category', 'author', 'debt')->orderBy('date')->chunk(500, function ($rows) use ($f) {
                foreach ($rows as $e) {
                    $safe = fn ($s) => preg_match('/^[=+\-@\t\r]/u', (string) $s) ? "'".$s : $s;
                    fputcsv($f, [$e->date->format($e->date_confirmed ? 'Y-m-d' : 'Y-m'), $e->kind === 'income' ? 'Доход' : 'Расход', $e->state === 'actual' ? 'Факт' : 'План', $safe($e->title), $safe($e->category->name), $safe($e->author?->name ?? 'Общие'), number_format($e->amount_cents / 100, 2, ',', ''), $safe($e->note), $safe($e->debt?->title)], ';', '"', '');
                }
            });
            fclose($f);
        }, 'trekfin-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
