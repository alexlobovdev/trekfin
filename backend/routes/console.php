<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('trekfin:remind payments')->dailyAt('09:00')->withoutOverlapping();
Schedule::command('trekfin:remind evening')->dailyAt('21:00')->withoutOverlapping();
