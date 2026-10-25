<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Entry;
use App\Models\SavingsGoal;
use App\Services\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SavingsController extends Controller
{
    public function index()
    {
        return SavingsGoal::with('movements')->orderBy('archived')->latest('id')->get();
    }

    public function save(Request $r, ?SavingsGoal $goal = null)
    {
        $v = $r->validate([
            'title' => 'required|string|max:120', 'target' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'],
            'opening' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'icon' => 'required|in:shield,plane,home,gift,sparkles', 'due_date' => 'nullable|date_format:Y-m-d|after_or_equal:2000-01-01|before:2100-01-01',
            'note' => 'nullable|string|max:2000', 'archived' => 'required|boolean',
        ]);
        DB::transaction(function () use ($goal, $v) {
            $g = $goal?->exists ? SavingsGoal::lockForUpdate()->findOrFail($goal->id) : new SavingsGoal;
            $target = Money::cents($v['target']);
            $opening = Money::cents($v['opening']);
            abort_if($target <= 0, 422, 'Сумма цели должна быть больше нуля.');
            abort_if($opening + ($g->exists ? $g->saved_cents - $g->opening_cents : 0) < 0, 422, 'Начальный баланс не покрывает записанные снятия.');
            $g->fill(collect($v)->except(['target', 'opening'])->all());
            $g->fill(['target_cents' => $target, 'opening_cents' => $opening])->save();
        });

        return $this->index();
    }

    public function move(Request $r, int $goal, ?Entry $movement = null)
    {
        $v = $r->validate([
            'amount' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'kind' => 'required|in:deposit,withdraw',
            'date' => 'required|date_format:Y-m-d|after_or_equal:2000-01-01|before_or_equal:today',
            'author_id' => 'required|integer|exists:users,id', 'note' => 'nullable|string|max:1000', 'plan_id' => 'nullable|integer|exists:entries,id',
        ]);
        DB::transaction(function () use ($r, $goal, $v, $movement) {
            $m = $movement?->exists ? Entry::lockForUpdate()->findOrFail($movement->id) : new Entry(['created_by' => $r->user()->id]);
            $planId = $v['kind'] === 'deposit' ? ($v['plan_id'] ?? $m->plan_id) : null;
            $plan = $planId ? Entry::lockForUpdate()->findOrFail($planId) : null;
            $g = SavingsGoal::lockForUpdate()->findOrFail($goal);
            abort_if($g->archived, 422, 'Сначала верните цель из архива.');
            abort_if($m->exists && $m->savings_goal_id !== $g->id, 404);
            $amount = Money::cents($v['amount']);
            abort_if($amount <= 0, 422, 'Сумма должна быть больше нуля.');
            $kind = $v['kind'] === 'deposit' ? 'expense' : 'income';
            $category = Category::where('kind', $kind)->where('name', $kind === 'expense' ? 'Отложенное' : 'Возврат из накоплений')->firstOrFail();
            abort_unless($category->active || ($m->exists && $m->category_id === $category->id), 422, 'Включите категорию «'.$category->name.'» в настройках.');
            if ($plan) {
                abort_if($plan->id === $m->id || $plan->state !== 'planned' || $plan->kind !== 'expense' || $plan->category_id !== $category->id || $plan->debt_id || ($plan->savings_goal_id && $plan->savings_goal_id !== $g->id), 422, 'Выберите плановый расход «Отложенное» для этой цели.');
            }
            $g->validateMovement($amount, $kind, $m->exists ? $m : null);
            $m->fill(['title' => ($kind === 'expense' ? 'Отложено: ' : 'Из накоплений: ').$g->title, 'kind' => $kind, 'state' => 'actual', 'amount_cents' => $amount, 'category_id' => $category->id, 'date' => $v['date'], 'date_confirmed' => true, 'author_id' => $v['author_id'], 'updated_by' => $r->user()->id, 'note' => $v['note'] ?? null, 'savings_goal_id' => $g->id, 'plan_id' => $plan?->id])->save();
        });

        return $this->index();
    }

    public function removeMovement(int $goal, Entry $movement)
    {
        DB::transaction(function () use ($goal, $movement) {
            $m = Entry::lockForUpdate()->findOrFail($movement->id);
            $g = SavingsGoal::lockForUpdate()->findOrFail($goal);
            abort_unless($m->savings_goal_id === $g->id, 404);
            $g->validateMovement(0, 'expense', $m);
            $m->delete();
        });

        return response()->noContent();
    }
}
