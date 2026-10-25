<?php

namespace App\Services;

class Money
{
    public static function cents(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', str_replace(',', '.', $amount), 2), 2, '');

        return ((int) $whole) * 100 + (int) str_pad($fraction, 2, '0');
    }
}
