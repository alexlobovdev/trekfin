<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\PushService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

    public function recipient(Request $r): array
    {
        $partner = User::where('id', '!=', $r->user()->id)->firstOrFail();

        return ['user' => $partner->only('id', 'name'), 'subscribed' => DB::table('push_subscriptions')->where('user_id', $partner->id)->exists()];
    }

    public function send(Request $r, PushService $push): array
    {
        $v = $r->validate(['message' => 'required|string|max:500'], ['message.required' => 'Напишите сообщение.', 'message.max' => 'Сообщение должно быть не длиннее 500 символов.']);
        $partner = User::where('id', '!=', $r->user()->id)->firstOrFail();
        if (! DB::table('push_subscriptions')->where('user_id', $partner->id)->exists()) {
            return ['sent' => 0, 'message' => $partner->name.' ещё не подключил(а) уведомления. Их нужно включить в настройках Trekfin на своём устройстве.'];
        }
        $sent = $push->send(['title' => $r->user()->name.' · Trekfin', 'body' => $v['message'], 'tag' => 'message-'.Str::uuid()], $partner->id);

        return ['sent' => $sent, 'message' => $sent > 0 ? 'Уведомление передано на устройства получателя: '.$sent.'.' : 'Не удалось передать уведомление. Попросите получателя проверить разрешение на уведомления или попробуйте позже.'];
    }
}
