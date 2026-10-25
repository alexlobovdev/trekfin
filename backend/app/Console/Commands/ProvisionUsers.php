<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ProvisionUsers extends Command
{
    protected $signature = 'trekfin:users {--output= : Закрытый файл для начальных паролей}';

    protected $description = 'Создаёт ровно два аккаунта, существующие пароли не меняет';

    public function handle(): int
    {
        $credentials = [];
        foreach (['alexey' => 'Алексей', 'vika' => 'Вика'] as $login => $name) {
            if (User::where('email', $login.'@trekfin.ru')->exists()) {
                continue;
            }
            $password = Str::random(20);
            User::create(['name' => $name, 'email' => $login.'@trekfin.ru', 'password' => Hash::make($password)]);
            $credentials[] = "$name\nЛогин: $login\nВременный пароль: $password\n";
        }
        if ($credentials) {
            $path = $this->option('output') ?: storage_path('app/private/initial-credentials.txt');
            file_put_contents($path, implode("\n", $credentials));
            chmod($path, 0600);
            $this->info('Аккаунты созданы. Пароли записаны в закрытый файл: '.$path);
        } else {
            $this->info('Оба аккаунта уже существуют.');
        }

        return self::SUCCESS;
    }
}
