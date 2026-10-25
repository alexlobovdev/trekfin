<?php

namespace App\Http\Controllers;

use App\Services\InsightService;
use Illuminate\Http\Request;

class InsightController extends Controller
{
    public function __invoke(Request $r, InsightService $insights): array
    {
        $v = $r->validate(['offset' => 'sometimes|integer|between:0,1000']);

        return [...$insights->tip((int) ($v['offset'] ?? 0)), 'rates' => $insights->rates()];
    }
}
