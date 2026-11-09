<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Entry;
use App\Models\Receipt;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class ReceiptService
{
    public function parse(string $raw): array
    {
        parse_str(trim($raw), $q);
        foreach (['t', 's', 'fn', 'i', 'fp', 'n'] as $key) {
            if (! isset($q[$key]) || ! is_string($q[$key])) {
                $this->invalid();
            }
        }
        if (! preg_match('/^\d{8}T\d{4}(\d{2})?$/D', $q['t']) ||
            ! preg_match('/^\d{1,9}([.]\d{1,2})?$/D', $q['s']) ||
            ! preg_match('/^\d{16}$/D', $q['fn']) ||
            ! preg_match('/^\d{1,10}$/D', $q['i']) ||
            ! preg_match('/^\d{1,10}$/D', $q['fp']) || $q['n'] !== '1') {
            $this->invalid();
        }
        try {
            $date = CarbonImmutable::createFromFormat('!'.(strlen($q['t']) === 13 ? 'Ymd\THi' : 'Ymd\THis'), $q['t']);
            if ($date->format(strlen($q['t']) === 13 ? 'Ymd\THi' : 'Ymd\THis') !== $q['t'] || $date->year < 2000 || $date->year >= 2100) {
                $this->invalid();
            }
        } catch (\Throwable) {
            $this->invalid();
        }
        $total = Money::cents($q['s']);
        if ($total <= 0) {
            $this->invalid();
        }
        $q = array_intersect_key($q, array_flip(['t', 's', 'fn', 'i', 'fp', 'n']));
        ksort($q);

        return ['qr' => http_build_query($q), 'fingerprint' => hash('sha256', $q['fn'].':'.ltrim($q['i'], '0').':'.ltrim($q['fp'], '0')), 'total_cents' => $total, 'date' => $date->toDateString(), 'seller' => null, 'status' => 'pending', 'purchases' => []];
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['qr' => 'Нужен QR-код фискального чека на покупку (t, s, fn, i, fp, n=1).']);
    }

    public function fetch(array $receipt): array
    {
        $token = config('services.receipts.token');
        if (! $token) {
            return $receipt;
        }
        parse_str($receipt['qr'], $q);
        try {
            $result = Http::asForm()->connectTimeout(5)->timeout(25)->post('https://proverkacheka.com/api/v1/check/get', [
                'token' => $token, 'fn' => $q['fn'], 'fd' => $q['i'], 'fp' => $q['fp'], 't' => $q['t'], 's' => $q['s'], 'n' => $q['n'], 'qr' => 1,
            ]);
            $json = $result->json('data.json');
            if (! $result->successful() || $result->json('code') !== 1 || ! is_array($json) || (int) ($json['totalSum'] ?? -1) !== $receipt['total_cents'] || empty($json['items']) || count($json['items']) > 1000) {
                return $receipt;
            }
            $items = [];
            foreach ($json['items'] as $item) {
                if (! is_string($item['name'] ?? null) || trim($item['name']) === '' || ! is_numeric($item['price'] ?? null) || ! is_numeric($item['sum'] ?? null) || ! is_numeric($item['quantity'] ?? null) || $item['price'] < 0 || $item['sum'] < 0 || $item['quantity'] <= 0 || $item['quantity'] > 9999999999) {
                    return $receipt;
                }
                $items[] = ['name' => mb_substr(trim($item['name']), 0, 512), 'price_cents' => (int) $item['price'], 'amount_cents' => (int) $item['sum'], 'quantity' => $item['quantity']];
            }
            if (array_sum(array_column($items, 'amount_cents')) !== $receipt['total_cents']) {
                return $receipt;
            }

            return [...$receipt, 'seller' => mb_substr(trim((string) ($json['user'] ?? $json['retailPlace'] ?? '')), 0, 255) ?: null, 'status' => 'loaded', 'purchases' => $items];
        } catch (\Throwable) {
            // Do not log HTTP exceptions: their request contains the provider token.
            return $receipt;
        }
    }

    public function preview(string $qr, int $userId): array
    {
        $receipt = $this->parse($qr);
        abort_if(Receipt::where('fingerprint', $receipt['fingerprint'])->exists(), 422, 'Этот чек уже добавлен. Найдите его в истории.');
        $receipt = $this->fetch($receipt);
        $suggestion = $receipt['seller'] ? Entry::whereHas('receipt', fn ($q) => $q->where('seller', $receipt['seller']))->whereHas('category', fn ($q) => $q->where('active', true)->where('kind', 'expense'))->latest('id')->value('category_id') : null;

        return [...$receipt, 'suggested_category' => $suggestion ? Category::find($suggestion) : null,
            'token' => Crypt::encryptString(json_encode(['receipt' => $receipt, 'user_id' => $userId, 'expires' => now()->addHours(2)->timestamp])),
            'message' => $receipt['status'] === 'loaded' ? null : (config('services.receipts.token') ? 'Товары пока недоступны. Сохраните чек и повторите загрузку позже.' : 'Загрузка товаров не настроена. Чек можно сохранить; покупки загрузятся после подключения сервиса.')];
    }

    public function decode(string $token, int $userId): array
    {
        try {
            $data = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
            if ($data['user_id'] !== $userId || $data['expires'] < now()->timestamp) {
                throw new \RuntimeException;
            }

            return $data['receipt'];
        } catch (\Throwable) {
            throw ValidationException::withMessages(['receipt_token' => 'Предпросмотр чека истёк. Отсканируйте его ещё раз.']);
        }
    }
}
