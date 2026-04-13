<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Bootstrap\CronBootstrap;
use Johnny5k\Services\JobLogger;
use Johnny5k\Tests\Support\ServiceTestCase;

class CronBootstrapActionSchedulerTest extends ServiceTestCase {
	protected function setUp(): void {
		parent::setUp();
		CronBootstrap::reset_retry_state();
	}

	public function test_ensure_schedules_moves_recurring_jobs_to_action_scheduler(): void {
		\wp_schedule_event( 1000, 'hourly', 'jf_daily_sms_reminders' );
		\wp_schedule_event( 1000, 'weekly', 'jf_weekly_calorie_adjust' );
		\wp_schedule_event( 1000, 'twicedaily', 'jf_evaluate_awards' );
		\wp_schedule_event( 1000, 'hourly', 'jf_process_coach_deliveries' );

		CronBootstrap::ensure_schedules();

		self::assertSame( [], $GLOBALS['johnny5k_test_scheduled_events'] );
		self::assertCount( 4, $GLOBALS['johnny5k_test_action_scheduler_actions'] );
	}

	public function test_failed_execution_schedules_retry_for_retryable_job(): void {
		$action_id = \as_schedule_single_action( time() + 60, 'jf_evaluate_awards', [], CronBootstrap::action_scheduler_group() );

		CronBootstrap::handle_failed_execution( $action_id, new \Exception( 'boom' ), 'WP CLI' );

		self::assertCount( 2, $GLOBALS['johnny5k_test_action_scheduler_actions'] );
		self::assertSame( 'retry_scheduled', JobLogger::list_entries( 1 )[0]['event'] ?? '' );
	}

	public function test_failed_execution_skips_retry_for_daily_sms_job(): void {
		$action_id = \as_schedule_single_action( time() + 60, 'jf_daily_sms_reminders', [], CronBootstrap::action_scheduler_group() );

		CronBootstrap::handle_failed_execution( $action_id, new \Exception( 'boom' ), 'WP CLI' );

		self::assertCount( 1, $GLOBALS['johnny5k_test_action_scheduler_actions'] );
		self::assertSame( 'retry_skipped', JobLogger::list_entries( 1 )[0]['event'] ?? '' );
	}

	public function test_queue_metrics_counts_in_progress_actions_using_running_key(): void {
		$action_id = \as_schedule_single_action( time() + 60, 'jf_evaluate_awards', [], CronBootstrap::action_scheduler_group() );
		$GLOBALS['johnny5k_test_action_scheduler_actions'][0]['status'] = 'in-progress';

		$metrics = CronBootstrap::queue_metrics( 'jf_evaluate_awards' );

		self::assertSame( $action_id, $GLOBALS['johnny5k_test_action_scheduler_actions'][0]['action_id'] );
		self::assertSame( 1, $metrics['running'] );
		self::assertSame( 0, $metrics['pending'] );
		self::assertSame( 0, $metrics['failed'] );
	}
}