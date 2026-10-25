<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class InsightController extends Controller
{
    public function __invoke(): array
    {
        $tips = [
            ['Записывайте по горячим следам', 'Маленькие покупки легко забыть. Внесите расход сразу после оплаты — это займёт несколько секунд.'],
            ['Планируйте вместе', 'Выберите один день в неделю, чтобы спокойно обсудить расходы и планы на следующий месяц.'],
            ['Сначала обязательное', 'Перед началом месяца отметьте аренду, коммунальные услуги и платежи по кредитам в бюджете.'],
            ['Оставьте место приятному', 'Отдельная категория для личных радостей помогает видеть их место в общем бюджете.'],
            ['Проверьте подписки', 'Откройте список регулярных списаний. Есть ли среди них сервисы, которыми вы больше не пользуетесь?'],
            ['План и факт рассказывают разное', 'Сравните запланированные и фактические расходы по категориям, чтобы точнее составить следующий бюджет.'],
            ['У каждого свой вклад', 'Указывайте автора операции: так вы оба видите, кто и на что тратит общие деньги.'],
        ];
        [$title,$body] = $tips[(int) now()->format('z') % count($tips)];
        $rates = Cache::get('cbr:rates');
        if (! Cache::has('cbr:checked')) {
            Cache::put('cbr:checked', true, now()->addHours(3));
            try {
                $response = Http::timeout(4)->get('https://www.cbr.ru/scripts/XML_daily.asp')->throw();
                $xml = simplexml_load_string($response->body());
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

        return ['title' => $title, 'body' => $body, 'source' => 'Совет Trekfin', 'link' => 'https://fincult.info/', 'rates' => $rates];
    }
}
