<?php

namespace App\Console\Commands;

use App\Models\Entry;
use App\Services\PushService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SendReminders extends Command
{
    protected $signature = 'trekfin:remind {type : payments или evening}';

    protected $description = 'Уведомления о платежах и вечернем учёте';

    public function handle(PushService $push): int
    {
        $type = $this->argument('type');
        $key = $type.':'.now()->toDateString();
        if (DB::table('notification_deliveries')->where('key', $key)->exists()) {
            return self::SUCCESS;
        }
        if ($type === 'payments') {
            $count = Entry::where('state', 'planned')->where('kind', 'expense')->whereBetween('date', [now()->toDateString(), now()->addDay()->toDateString()])->get()->filter(fn ($e) => (int) Entry::where('plan_id', $e->id)->where('state', 'actual')->sum('amount_cents') < $e->amount_cents)->count();
            if (! $count) {
                return self::SUCCESS;
            }
            $payload = ['title' => 'Платежи на сегодня и завтра', 'body' => "Запланировано платежей: {$count}. Загляните в бюджет."];
        } else {
            $payload = ['title' => 'Как прошёл ваш день?', 'body' => 'Запишите сегодняшние расходы — вместе проще держать бюджет под контролем.'];
        }
        $sent = $push->send([...$payload, 'tag' => $type]);
        if ($sent > 0) {
            DB::table('notification_deliveries')->insertOrIgnore(['key' => $key, 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->info("Доставлено уведомлений: {$sent}");

        return self::SUCCESS;
    }
}
