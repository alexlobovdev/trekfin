<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Recurring;
use App\Services\Money;
use Illuminate\Http\Request;

class RecurringController extends Controller
{
    public function save(Request $r, ?Recurring $recurring = null)
    {
        $v = $r->validate(['title' => 'required|string|max:120', 'category_id' => 'required|integer|exists:categories,id', 'author_id' => 'nullable|integer|exists:users,id', 'amount' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'summer' => ['nullable', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'day' => 'required|integer|between:1,31', 'kind' => 'required|in:income,expense', 'active' => 'boolean', 'note' => 'nullable|string|max:2000']);
        $c = Category::findOrFail($v['category_id']);
        if (! $c->active || $c->kind !== $v['kind']) {
            abort(422, 'Проверьте категорию.');
        }
        $v['amount_cents'] = Money::cents($v['amount']);
        $v['summer_cents'] = isset($v['summer']) ? Money::cents((string) $v['summer']) : null;
        if ($v['amount_cents'] <= 0) {
            abort(422, 'Сумма должна быть больше нуля.');
        }
        unset($v['amount'],$v['summer']);
        $e = $recurring?->exists ? $recurring : new Recurring;
        $e->fill($v)->save();

        return $e;
    }

    public function archive(Recurring $recurring)
    {
        $recurring->update(['active' => false]);

        return response()->noContent();
    }
}
