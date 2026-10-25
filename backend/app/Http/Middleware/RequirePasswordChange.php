<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequirePasswordChange
{
    public function handle(Request $r, Closure $next)
    {
        if ($r->user()->must_change_password) {
            return response()->json(['message' => 'Сначала установите свой пароль.', 'password_change_required' => true], 403);
        }

        return $next($r);
    }
}
