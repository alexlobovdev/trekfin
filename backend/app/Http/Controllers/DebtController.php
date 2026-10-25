<?php

namespace App\Http\Controllers;

use App\Services\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DebtController extends Controller
{
    public function index()
    {
        return DB::table('debts')->get()->map(function ($d) {
            $d->repayments = DB::table('repayments')->where('debt_id', $d->id)->orderBy('date')->get();
            $d->paid_cents = (int) $d->repayments->sum('amount_cents');

            return $d;
        });
    }

    public function repay(Request $r, int $debt)
    {
        $v = $r->validate(['amount' => ['required', 'regex:/^\d{1,9}([.,]\d{1,2})?$/'], 'date' => 'required|date_format:Y-m-d', 'note' => 'nullable|string|max:1000']);
        DB::transaction(function () use ($debt, $r, $v) {
            $d = DB::table('debts')->where('id', $debt)->lockForUpdate()->first();
            abort_unless($d, 404);
            $amount = Money::cents($v['amount']);
            $paid = DB::table('repayments')->where('debt_id', $debt)->sum('amount_cents');
            if ($amount <= 0 || $amount > $d->amount_cents - $paid) {
                abort(422, 'Сумма превышает остаток долга.');
            }
            DB::table('repayments')->insert(['debt_id' => $debt, 'amount_cents' => $amount, 'date' => $v['date'], 'note' => $v['note'] ?? null, 'created_by' => $r->user()->id, 'created_at' => now(), 'updated_at' => now()]);
        });

        return $this->index();
    }
}
