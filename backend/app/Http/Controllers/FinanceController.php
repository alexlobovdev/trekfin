<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Entry;
use App\Models\MonthPlan;
use App\Models\Recurring;
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
        unset($v['amount']);
        if ($v['amount_cents'] <= 0) {
            throw ValidationException::withMessages(['amount' => 'Сумма должна быть больше нуля.']);
        }

        return $v;
    }

    public function saveEntry(Request $r, ?Entry $entry = null): Entry
    {
        $v = $this->entryData($r, $entry);

        return DB::transaction(function () use ($v, $entry, $r) {
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
            }
            $entity = $entry?->exists ? $entry : new Entry(['created_by' => $r->user()->id]);
            $entity->fill([...$v, 'updated_by' => $r->user()->id])->save();
            if ($v['state'] === 'planned') {
                MonthPlan::firstOrCreate(['month' => substr($v['date'], 0, 7)]);
            }

            return $entity->load('category', 'author');
        });
    }

    public function deleteEntry(Entry $entry): Response
    {
        $entry->delete();

        return response()->noContent();
    }

    public function export(): StreamedResponse
    {
        return response()->streamDownload(function () {
            $f = fopen('php://output', 'w');
            fwrite($f, "\xEF\xBB\xBF");
            fputcsv($f, ['Дата', 'Тип', 'План / факт', 'Описание', 'Категория', 'Автор', 'Сумма, ₽', 'Комментарий'], ';', '"', '');
            Entry::with('category', 'author')->orderBy('date')->chunk(500, function ($rows) use ($f) {
                foreach ($rows as $e) {
                    $safe = fn ($s) => preg_match('/^[=+\-@\t\r]/u', (string) $s) ? "'".$s : $s;
                    fputcsv($f, [$e->date->format('Y-m-d'), $e->kind === 'income' ? 'Доход' : 'Расход', $e->state === 'actual' ? 'Факт' : 'План', $safe($e->title), $safe($e->category->name), $safe($e->author?->name ?? 'Общие'), number_format($e->amount_cents / 100, 2, ',', ''), $safe($e->note)], ';', '"', '');
                }
            });
            fclose($f);
        }, 'trekfin-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
