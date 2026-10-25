<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SavingsGoal extends Model
{
    protected $guarded = ['id'];

    protected $appends = ['saved_cents'];

    protected function casts(): array
    {
        return ['target_cents' => 'integer', 'opening_cents' => 'integer', 'due_date' => 'date:Y-m-d', 'archived' => 'boolean'];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(Entry::class)->where('state', 'actual')->orderByDesc('date')->orderByDesc('id');
    }

    public function getSavedCentsAttribute(): int
    {
        return $this->opening_cents + (int) $this->movements->sum(fn ($m) => $m->kind === 'expense' ? $m->amount_cents : -$m->amount_cents);
    }

    public function validateMovement(int $amount, string $kind, ?Entry $previous = null): void
    {
        $old = $previous?->state === 'actual' ? ($previous->kind === 'expense' ? $previous->amount_cents : -$previous->amount_cents) : 0;
        $next = $kind === 'expense' ? $amount : -$amount;
        abort_if($this->saved_cents - $old + $next < 0, 422, 'Операция сделает баланс цели отрицательным. Сначала исправьте снятия или увеличьте начальную сумму.');
    }
}
