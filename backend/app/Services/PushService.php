<?php

namespace App\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class PushService
{
    public function send(array $payload, ?int $userId = null): int
    {
        if (! config('services.webpush.private_key')) {
            return 0;
        }
        $webpush = new WebPush(['VAPID' => ['subject' => config('services.webpush.subject'), 'publicKey' => config('services.webpush.public_key'), 'privateKey' => config('services.webpush.private_key')]], ['TTL' => 3600], client: new Client(['timeout' => 15, 'connect_timeout' => 5]));
        $subscriptions = DB::table('push_subscriptions')->when($userId, fn ($q) => $q->where('user_id', $userId))->get();
        foreach ($subscriptions as $s) {
            $webpush->queueNotification(Subscription::create(['endpoint' => $s->endpoint, 'publicKey' => $s->public_key, 'authToken' => $s->auth_token, 'contentEncoding' => $s->content_encoding]), json_encode($payload, JSON_UNESCAPED_UNICODE));
        }
        $sent = 0;
        foreach ($webpush->flush() as $report) {
            if ($report->isSuccess()) {
                $sent++;
            } elseif ($report->isSubscriptionExpired()) {
                DB::table('push_subscriptions')->where('endpoint_hash', hash('sha256', (string) $report->getRequest()->getUri()))->delete();
            } else {
                Log::warning('Web Push delivery failed', ['status' => $report->getResponse()?->getStatusCode()]);
            }
        }

        return $sent;
    }
}
