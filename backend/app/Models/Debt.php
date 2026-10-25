<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'initial_paid_cents' => 'integer', 'monthly_payment_cents' => 'integer', 'due_date' => 'date:Y-m-d', 'archived' => 'boolean'];
    }

    public function repayments(): HasMany
    {
        return $this->hasMany(Repayment::class)->orderByDesc('date')->orderByDesc('id');
    }

    public function entries(): HasMany
    {
        return $this->hasMany(Entry::class)->where('state', 'actual')->orderByDesc('date')->orderByDesc('id');
    }

    public function getPaidCentsAttribute(): int
    {
        return $this->initial_paid_cents + (int) $this->repayments->sum('amount_cents') + (int) $this->entries->sum('amount_cents');
    }
}
