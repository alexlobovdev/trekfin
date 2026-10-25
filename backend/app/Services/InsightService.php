<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class InsightService
{
    private function text(string $html): string
    {
        return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(preg_replace('/<\/(?:p|li|h[1-6])>|<br\s*\/?>/iu', ' ', $html)), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
    }

    public function tip(int $offset = 0): array
    {
        try {
            $catalog = Cache::remember('fincult:catalog:v2', now()->endOfDay(), function () {
                $items = Http::withUserAgent('Trekfin/1.0 (+https://trekfin.ru)')->connectTimeout(3)->timeout(6)->get('https://fincult.info/api/v1/articles')->throw()->json('items');

                return collect($items)->filter(fn ($a) => ! empty($a['code']) && preg_match('/накоп|бюджет|сбереж|подушк|досрочн|финансов.*план|депозит|банковск.*вклад/iu', $this->text($a['name'] ?? '')))->values()->all();
            });
            if (! $catalog) {
                throw new \RuntimeException('Financial article catalog is empty.');
            }
            $article = $catalog[((int) now()->format('z') + $offset) % count($catalog)];
            $slug = $article['code'];
            if (! preg_match('/^[a-z0-9-]+$/', $slug)) {
                throw new \RuntimeException('Invalid financial article identifier.');
            }

            return Cache::remember('fincult:article:'.$slug, now()->addDay(), function () use ($slug, $article) {
                $data = Http::withUserAgent('Trekfin/1.0 (+https://trekfin.ru)')->connectTimeout(3)->timeout(6)->get('https://fincult.info/api/v1/articles/item/'.$slug)->throw()->json();
                $sections = collect($data['content'] ?? [])->filter(fn ($s) => $s['code'] === 'text' && ! empty($s['data']['text']));
                $section = $sections->first(fn ($s) => preg_match('/как|созда|план|накоп|выбра|нача/iu', $s['data']['title'] ?? '')) ?? $sections->first();
                $body = $this->text($section['data']['text'] ?? $data['description'] ?? $article['description'] ?? '');
                if (mb_strlen($body) < 80) {
                    throw new \RuntimeException('Financial article has no readable excerpt.');
                }

                return ['title' => $this->text($data['name'] ?? $article['name']), 'body' => Str::limit($body, 900), 'section' => $this->text($section['data']['title'] ?? ''), 'source' => 'Финансовая культура · Банк России', 'link' => 'https://fincult.info/article/'.$slug.'/', 'updated' => $data['dateUpdate'] ?? $data['publishDate'] ?? null, 'live' => true];
            });
        } catch (\Throwable $e) {
            report($e);

            return ['title' => 'Сколько нужно для финансовой подушки?', 'section' => 'Начните с обязательных расходов', 'body' => 'Посчитайте расходы на жильё, продукты, транспорт, здоровье и обязательные платежи за месяц. Эта сумма поможет задать размер резерва под вашу жизнь. Создайте в накоплениях отдельную цель и пополняйте её постепенно. Деньги для непредвиденных ситуаций стоит учитывать отдельно от средств на отпуск и другие покупки.', 'source' => 'По материалу «Финансовой культуры»', 'link' => 'https://fincult.info/article/finansovaya-podushka-bezopasnosti-chto-eto-takoe-i-zachem-ona-nuzhna/', 'updated' => null, 'live' => false];
        }
    }

    public function rates(): ?array
    {
        $rates = Cache::get('cbr:rates');
        if (! Cache::has('cbr:checked')) {
            Cache::put('cbr:checked', true, now()->addHours(3));
            try {
                $response = Http::connectTimeout(2)->timeout(4)->get('https://www.cbr.ru/scripts/XML_daily.asp')->throw();
                $xml = simplexml_load_string($response->body(), 'SimpleXMLElement', LIBXML_NONET);
                $values = [];
                foreach ($xml->Valute as $v) {
                    if (in_array((string) $v->CharCode, ['USD', 'EUR'], true)) {
                        $values[(string) $v->CharCode] = (float) str_replace(',', '.', (string) $v->Value) / (int) $v->Nominal;
                    }
                }
                $rates = ['date' => (string) $xml['Date'], 'values' => $values];
                Cache::put('cbr:rates', $rates, now()->addDays(7));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $rates;
    }
}
