<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function csrf()
    {
        return response()->json(['token' => csrf_token()]);
    }

    public function login(Request $r)
    {
        $v = $r->validate(['login' => 'required|string|max:100', 'password' => 'required|string|max:200']);
        $email = match (mb_strtolower(trim($v['login']))) {
            'алексей','alexey','alex' => 'alexey@trekfin.ru', 'вика','vika' => 'vika@trekfin.ru', default => mb_strtolower(trim($v['login']))
        };
        if (! Auth::attempt(['email' => $email, 'password' => $v['password']], true)) {
            throw ValidationException::withMessages(['login' => 'Не удалось войти. Проверьте логин и пароль.']);
        }
        $r->session()->regenerate();

        return $this->me($r);
    }

    public function me(Request $r)
    {
        return response()->json(['user' => $r->user()->only('id', 'name', 'email', 'must_change_password')]);
    }

    public function logout(Request $r)
    {
        Auth::logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->noContent();
    }

    public function password(Request $r)
    {
        $v = $r->validate(['current_password' => 'required|current_password', 'password' => ['required', 'confirmed', Password::min(12)]]);
        $r->user()->forceFill(['password' => Hash::make($v['password']), 'must_change_password' => false])->save();
        $r->session()->regenerate();

        return $this->me($r);
    }
}
