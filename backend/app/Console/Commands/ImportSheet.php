<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Entry;
use App\Models\MonthPlan;
use App\Models\Recurring;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ImportSheet extends Command
{
    protected $signature = 'trekfin:import {path}';

    protected $description = 'Первичный идемпотентный импорт таблицы с проверкой итогов';

    private function cents(mixed $value): int
    {
        return (int) round((float) $value * 100);
    }

    private function category(string $name, string $kind = 'expense'): Category
    {
        $groups = ['Жильё' => ['квартира', 'квартплата'], 'Коммунальные услуги' => ['комуналка'], 'Интернет' => ['вайфай'], 'Транспорт' => ['бенз', 'дорога'], 'Продукты' => ['еда дома'], 'Кафе и рестораны' => ['еда где-то'], 'Кофе дома' => ['кофе дома'], 'Кофе с собой' => ['кофе где-то'], 'Спорт' => ['танцы', 'тренажерка'], 'Кредиты' => ['кредит тинек', 'кредит альфа'], 'Долги' => ['долг', 'скинуть'], 'Налоги' => ['налоги', 'налоги и коллекторы за прошлые месяцы']];
        $label = $kind === 'income' ? 'Основной доход' : 'Другое';
        foreach ($groups as $group => $names) {
            if (collect($names)->contains(fn ($pattern) => mb_stripos(trim($name), $pattern) !== false)) {
                $label = $group;
            }
        }
        $colors = ['#d3437b', '#bd8dc9', '#d5a067', '#7c9c90', '#8195cc', '#d78c9c'];
        $icons = ['Жильё' => 'home', 'Коммунальные услуги' => 'zap', 'Интернет' => 'wifi', 'Транспорт' => 'car', 'Продукты' => 'basket', 'Кафе и рестораны' => 'utensils', 'Кофе дома' => 'coffee', 'Кофе с собой' => 'coffee', 'Спорт' => 'activity', 'Кредиты' => 'credit-card', 'Долги' => 'handshake', 'Налоги' => 'receipt', 'Основной доход' => 'briefcase'];

        return Category::firstOrCreate(['name' => $label, 'kind' => $kind], ['color' => $colors[Category::count() % count($colors)], 'icon' => $icons[$label] ?? 'wallet']);
    }

    public function handle(): int
    {
        $source = json_decode(file_get_contents($this->argument('path')), true, 512, JSON_THROW_ON_ERROR);
        if (DB::table('imports')->where('checksum', $source['checksum'])->exists()) {
            $this->info('Эта таблица уже импортирована. Повторов нет.');

            return self::SUCCESS;
        }
        if (DB::table('imports')->exists()) {
            $this->error('Первичный импорт уже выполнен. Для другого файла нужна отдельная сверка.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($source) {
            $alex = User::where('email', 'alexey@trekfin.ru')->firstOrFail();
            $vika = User::where('email', 'vika@trekfin.ru')->firstOrFail();
            $cells = $source['sheets'][0]['cells'];
            $base = [];
            $names = ['квартплата' => 'Аренда · ваша доля', 'комуналка' => 'Коммунальные услуги', 'вайфай' => 'Домашний интернет', 'бенз' => 'Бензин', 'еда дома' => 'Продукты домой', 'еда где-то' => 'Кафе и рестораны', 'кофе дома' => 'Кофе дома', 'кофе где-то' => 'Кофе с собой', 'танцы' => 'Танцы', 'тренажерка' => 'Тренажёрный зал'];
            foreach ([3, 4, 6, 7, 9, 10, 11, 12] as $row) {
                $label = $cells['A'.$row];
                $amount = $row === 4 ? $this->cents($cells['C5']) : $this->cents($cells['B'.$row]);
                if ($row === 3) {
                    $amount = (int) round($amount / 2);
                }
                $base[] = Recurring::create(['title' => $names[$label] ?? $label, 'category_id' => $this->category($label)->id, 'amount_cents' => $amount, 'summer_cents' => $row === 4 ? $this->cents($cells['B5']) : null, 'day' => 1, 'kind' => 'expense', 'note' => $row === 3 ? 'В исходный итог входит половина полной аренды.' : ($row === 4 ? 'Май–сентябрь: летний тариф. Октябрь–апрель: зимний.' : null)]);
            }
            if (array_sum(array_map(fn ($r) => $r->amount_cents, $base)) !== $this->cents($cells['B14'])) {
                throw new RuntimeException('Базовые расходы не совпали с исходным итогом.');
            }
            foreach ([3, 4] as $row) {
                $label = $cells['E'.$row];
                Recurring::create(['title' => $names[$label] ?? $label, 'category_id' => $this->category($label)->id, 'author_id' => $vika->id, 'amount_cents' => $this->cents($cells['F'.$row]), 'day' => 1, 'note' => 'Личные регулярные расходы Вики. В исходный общий итог не входят.']);
            }
            $reports = [];
            foreach ([1 => 10, 2 => 11, 3 => 12] as $index => $number) {
                $sheet = $source['sheets'][$index];
                $c = $sheet['cells'];
                $month = sprintf('%d-%02d', $source['year'], $number);
                $opening = $number === 10 ? $this->cents($c['B1']) : 0;
                MonthPlan::create(['month' => $month, 'opening_cents' => $opening, 'note' => 'Из листа «'.$sheet['name'].'». Год 2026 определён по датам листа долга.']);
                $create = function (string $label, int $amount, string $key, string $kind = 'expense', ?int $category = null, ?string $note = null) use ($alex, $month): Entry {
                    return Entry::create(['title' => $label, 'category_id' => $category ?? $this->category($label, $kind)->id, 'author_id' => null, 'created_by' => $alex->id, 'kind' => $kind, 'state' => 'planned', 'amount_cents' => $amount, 'date' => $month.'-01', 'source_key' => $key, 'note' => $note ?? 'Импортированный план. Факт ещё не подтверждён.']);
                };
                if ($number !== 10) {
                    $create('Основной доход', $this->cents($c['B1']), "import:{$month}:income", 'income');
                    $create('налоги', $this->cents($c['B2']), "import:{$month}:tax");
                }
                foreach (range($number === 10 ? 4 : 7, 20) as $row) {
                    $label = trim($c['A'.$row] ?? '');
                    $value = $c['B'.$row] ?? null;
                    if ($label === '' || $value === null || ! is_numeric($value) || $this->cents($value) <= 0) {
                        continue;
                    }
                    if ($label === 'основные расходы') {
                        foreach ($base as $rule) {
                            $create($rule->title, $rule->amount_cents, "import:{$month}:base:{$rule->id}", 'expense', $rule->category_id, $rule->note);
                        }
                    } else {
                        $create($label, $this->cents($value), "import:{$month}:row:{$row}");
                    }
                }
                $income = (int) Entry::where('date', $month.'-01')->where('kind', 'income')->sum('amount_cents');
                $expense = (int) Entry::where('date', $month.'-01')->where('kind', 'expense')->sum('amount_cents');
                $remaining = $opening + $income - $expense;
                $expected = $this->cents($c['E1']);
                if (abs($remaining - $expected) > 1) {
                    throw new RuntimeException("Итог {$month} не совпал с таблицей");
                }
                $reports[] = ['month' => $month, 'income_cents' => $income, 'expense_cents' => $expense, 'opening_cents' => $opening, 'remaining_cents' => $remaining, 'source_remaining_cents' => $expected];
            }
            $c = $source['sheets'][4]['cells'];
            $debt = DB::table('debts')->insertGetId(['title' => 'Долг Алексея', 'amount_cents' => $this->cents($c['B7']), 'author_id' => $alex->id, 'note' => 'Включает исходный долг и дополнительные расходы. Возвраты внутри пары учитываются отдельно от семейных операций.', 'created_at' => now(), 'updated_at' => now()]);
            foreach (range(13, 21) as $row) {
                if (! isset($c['B'.$row]) || $this->cents($c['B'.$row]) <= 0) {
                    continue;
                }
                $date = is_numeric($c['A'.$row] ?? null) ? (new \DateTimeImmutable('1899-12-30'))->modify('+'.(int) $c['A'.$row].' days')->format('Y-m-d') : null;
                DB::table('repayments')->insert(['debt_id' => $debt, 'amount_cents' => $this->cents($c['B'.$row]), 'date' => $date, 'created_by' => $alex->id, 'note' => $date ? 'Из истории возвратов таблицы.' : 'Дата в источнике не найдена.', 'created_at' => now(), 'updated_at' => now()]);
            }
            $this->category('Основной доход', 'income');
            Category::firstOrCreate(['name' => 'Другие доходы', 'kind' => 'income'], ['icon' => 'wallet', 'color' => '#7c9c90']);
            DB::table('imports')->insert(['checksum' => $source['checksum'], 'source' => json_encode($source, JSON_UNESCAPED_UNICODE), 'report' => json_encode(['sheets' => array_column($source['sheets'], 'name'), 'months' => $reports, 'notes' => ['Бюджеты перенесены как планы. Фактические операции нужно подтвердить.', 'Год 2026 определён по датам листа долга.', 'Базовые расходы включают половину аренды и зимнюю коммуналку.', 'Дополнительная коммуналка сохранена отдельной строкой исходных бюджетов.', 'Спорт Вики сохранён в регулярных платежах, в исторические итоги не добавлен.', 'Исходные ячейки и формулы сохранены в закрытом архиве.']], JSON_UNESCAPED_UNICODE), 'created_at' => now(), 'updated_at' => now()]);
        });
        $this->info('Импортированы 5 листов. Итоги трёх месяцев сверены до копейки.');

        return self::SUCCESS;
    }
}
