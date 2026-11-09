<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Entry extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'date' => 'date:Y-m-d', 'date_confirmed' => 'boolean', 'recurring_date_overridden' => 'boolean'];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class)->withDefault(['id' => 0, 'name' => 'Без категории', 'kind' => 'expense', 'mode' => 'payment', 'icon' => 'receipt', 'color' => '#b7791f', 'active' => false]);
    }

    public function receipt(): HasOne
    {
        return $this->hasOne(Receipt::class)->with('purchases');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id')->select('id', 'name');
    }

    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class)->select('id', 'title');
    }
}
