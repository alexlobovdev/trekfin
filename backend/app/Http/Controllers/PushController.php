<?php

namespace App\Http\Controllers;

use App\Services\PushService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PushController extends Controller
{
    public function subscribe(Request $r): array
    {
        $v = $r->validate(['endpoint' => 'required|url:https|max:4096', 'keys.p256dh' => 'required|string|max:300', 'keys.auth' => 'required|string|max:100']);
        $host = parse_url($v['endpoint'], PHP_URL_HOST);
        if (! preg_match('/(^|\.)(push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|notify\.windows\.com)$/i', $host)) {
            abort(422, 'Этот Push-сервис не поддерживается.');
        }
        DB::table('push_subscriptions')->updateOrInsert(['endpoint_hash' => hash('sha256', $v['endpoint'])], ['user_id' => $r->user()->id, 'endpoint' => $v['endpoint'], 'public_key' => $v['keys']['p256dh'], 'auth_token' => $v['keys']['auth'], 'content_encoding' => 'aes128gcm', 'created_at' => now(), 'updated_at' => now()]);

        return ['subscribed' => true];
    }

    public function unsubscribe(Request $r): array
    {
        $v = $r->validate(['endpoint' => 'required|string']);
        DB::table('push_subscriptions')->where('user_id', $r->user()->id)->where('endpoint_hash', hash('sha256', $v['endpoint']))->delete();

        return ['subscribed' => false];
    }

    public function preview(Request $r, PushService $push): array
    {
        return ['sent' => $push->send(['title' => 'Trekfin на связи', 'body' => 'Уведомления включены. Напомним о платежах и вечернем учёте.', 'tag' => 'preview'], $r->user()->id)];
    }
}
