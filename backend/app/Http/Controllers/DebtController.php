<?php

namespace App\Http\Controllers;

use App\Models\Debt;
use App\Models\Entry;
use App\Models\Repayment;
use App\Services\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DebtController extends Controller
{
    public function index()
    {
        return Debt::with(['repayments', 'entries.category', 'entries.author'])->orderBy('archived')->latest('id')->get()->each->append('paid_cents');
    }

    public function save(Request $r, ?Debt $debt = null)
    {
        $v = $r->validate([
            'title' => 'required|string|max:120', 'type' => 'required|in:loan,debt,internal', 'creditor' => 'nullable|string|max:120',
            'amount' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'initial_paid' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'],
            'monthly_payment' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'payment_day' => 'nullable|integer|between:1,31',
            'due_date' => 'nullable|date_format:Y-m-d|after_or_equal:2000-01-01|before:2100-01-01', 'author_id' => 'required|integer|exists:users,id',
            'note' => 'nullable|string|max:2000', 'archived' => 'required|boolean',
        ]);
        DB::transaction(function () use ($debt, $v) {
            $d = $debt?->exists ? Debt::lockForUpdate()->findOrFail($debt->id) : new Debt;
            $amount = Money::cents($v['amount']);
            $initial = Money::cents($v['initial_paid']);
            $history = $d->exists ? $d->paid_cents - $d->initial_paid_cents : 0;
            abort_if($amount <= 0 || $initial + $history > $amount, 422, 'Общая сумма должна быть не меньше уже погашенной.');
            if ($d->exists && ($d->type === 'internal') !== ($v['type'] === 'internal')) {
                abort_if($d->repayments->isNotEmpty() || Entry::where('debt_id', $d->id)->exists(), 422, 'У долга уже есть история. Создайте отдельную запись для другого типа расчётов.');
            }
            $d->fill(collect($v)->except(['amount', 'initial_paid', 'monthly_payment'])->all());
            $d->fill(['amount_cents' => $amount, 'initial_paid_cents' => $initial, 'monthly_payment_cents' => Money::cents($v['monthly_payment'])])->save();
        });

        return $this->index();
    }

    public function repay(Request $r, int $debt, ?Repayment $repayment = null)
    {
        $v = $r->validate(['amount' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'date' => 'required|date_format:Y-m-d|after_or_equal:2000-01-01|before:2100-01-01', 'note' => 'nullable|string|max:1000', 'author_id' => 'required|integer|exists:users,id']);
        DB::transaction(function () use ($debt, $r, $v, $repayment) {
            $d = Debt::lockForUpdate()->findOrFail($debt);
            $repayment?->exists && $repayment->refresh();
            abort_if($d->type !== 'internal', 422, 'Платёж по кредиту или внешнему долгу нужно записать как расход.');
            abort_if($d->archived, 422, 'Сначала верните долг из архива.');
            abort_if($repayment?->exists && $repayment->debt_id !== $d->id, 404);
            $amount = Money::cents($v['amount']);
            $available = $d->amount_cents - $d->paid_cents + ($repayment?->amount_cents ?? 0);
            abort_if($amount <= 0 || $amount > $available, 422, 'Сумма превышает остаток долга.');
            $payment = $repayment?->exists ? $repayment : new Repayment(['debt_id' => $d->id, 'created_by' => $r->user()->id]);
            $payment->fill(['amount_cents' => $amount, 'date' => $v['date'], 'note' => $v['note'] ?? null, 'author_id' => $v['author_id']])->save();
        });

        return $this->index();
    }

    public function removeRepayment(int $debt, Repayment $repayment)
    {
        abort_unless($repayment->debt_id === $debt, 404);
        $repayment->delete();

        return response()->noContent();
    }
}
