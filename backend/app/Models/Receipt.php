<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Receipt extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['fingerprint'];

    protected function casts(): array
    {
        return ['total_cents' => 'integer', 'date' => 'date:Y-m-d'];
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class)->orderBy('id');
    }
}
