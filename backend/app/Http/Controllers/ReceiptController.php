<?php

namespace App\Http\Controllers;

use App\Models\Entry;
use App\Services\ReceiptService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReceiptController extends Controller
{
    public function preview(Request $r, ReceiptService $service): array
    {
        $v = $r->validate(['qr' => 'required|string|max:512']);

        return $service->preview($v['qr'], $r->user()->id);
    }

    public function refresh(Entry $entry, ReceiptService $service): array
    {
        $receipt = $entry->receipt;
        abort_unless($receipt, 404);
        $data = $service->fetch($service->parse($receipt->qr));
        abort_unless($data['status'] === 'loaded', 422, 'Товары пока недоступны. Проверьте настройку сервиса или повторите позже.');
        DB::transaction(function () use ($receipt, $data) {
            $locked = $receipt->newQuery()->lockForUpdate()->findOrFail($receipt->id);
            $locked->update(['status' => 'loaded', 'seller' => $data['seller']]);
            $locked->purchases()->delete();
            $locked->purchases()->createMany($data['purchases']);
        });

        return $receipt->fresh()->load('purchases')->toArray();
    }
}
