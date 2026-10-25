<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\FinanceController;
use App\Http\Controllers\InsightController;
use App\Http\Controllers\PushController;
use App\Http\Controllers\RecurringController;
use App\Http\Controllers\SavingsController;
use App\Http\Middleware\RequirePasswordChange;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->group(function () {
    Route::get('health', function () {
        DB::select('SELECT 1');

        return ['status' => 'ok'];
    });
    Route::get('csrf', [AuthController::class, 'csrf']);
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:5,1,login:');
    Route::middleware('auth')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::put('password', [AuthController::class, 'password'])->middleware('throttle:5,1,password:');
        Route::middleware([RequirePasswordChange::class, 'throttle:120,1'])->group(function () {
            Route::get('bootstrap', [FinanceController::class, 'bootstrap']);
            Route::get('month', [FinanceController::class, 'month']);
            Route::post('month', [FinanceController::class, 'saveMonth']);
            Route::post('entries', [FinanceController::class, 'saveEntry']);
            Route::post('entries/{entry}/pay', [FinanceController::class, 'pay']);
            Route::put('entries/{entry}', [FinanceController::class, 'saveEntry']);
            Route::delete('entries/{entry}', [FinanceController::class, 'deleteEntry']);
            Route::post('categories', [CategoryController::class, 'save']);
            Route::put('categories/{category}', [CategoryController::class, 'save']);
            Route::delete('categories/{category}', [CategoryController::class, 'archive']);
            Route::post('recurrings', [RecurringController::class, 'save']);
            Route::put('recurrings/{recurring}', [RecurringController::class, 'save']);
            Route::delete('recurrings/{recurring}', [RecurringController::class, 'archive']);
            Route::get('debts', [DebtController::class, 'index']);
            Route::post('debts', [DebtController::class, 'save']);
            Route::put('debts/{debt}', [DebtController::class, 'save']);
            Route::post('debts/{debt}/repay', [DebtController::class, 'repay']);
            Route::put('debts/{debt}/repay/{repayment}', [DebtController::class, 'repay']);
            Route::delete('debts/{debt}/repay/{repayment}', [DebtController::class, 'removeRepayment']);
            Route::get('savings', [SavingsController::class, 'index']);
            Route::post('savings', [SavingsController::class, 'save']);
            Route::put('savings/{goal}', [SavingsController::class, 'save']);
            Route::post('savings/{goal}/movements', [SavingsController::class, 'move']);
            Route::put('savings/{goal}/movements/{movement}', [SavingsController::class, 'move']);
            Route::delete('savings/{goal}/movements/{movement}', [SavingsController::class, 'removeMovement']);
            Route::get('export', [FinanceController::class, 'export']);
            Route::get('import-source', function () {
                $source = DB::table('imports')->latest('id')->value('source');
                abort_unless($source, 404);

                return response($source, 200, ['Content-Type' => 'application/json; charset=utf-8', 'Content-Disposition' => 'attachment; filename=trekfin-import.json']);
            });
            Route::get('insight', InsightController::class);
            Route::post('push', [PushController::class, 'subscribe']);
            Route::delete('push', [PushController::class, 'unsubscribe']);
            Route::post('push/preview', [PushController::class, 'preview'])->middleware('throttle:3,1,push-preview:');
            Route::get('push/recipient', [PushController::class, 'recipient']);
            Route::post('push/send', [PushController::class, 'send'])->middleware('throttle:5,1,push-send:');
        });
    });
});
