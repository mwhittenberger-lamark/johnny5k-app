<?php
namespace Johnny5k\Bootstrap;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AwardEngine;
use Johnny5k\Services\CalorieEngine;
use Johnny5k\Services\CoachDeliveryService;
use Johnny5k\Services\JobLogger;
use Johnny5k\Services\PushService;
use Johnny5k\Services\SmsService;

class CronBootstrap {
	private const ACTION_SCHEDULER_GROUP = 'johnny5k';
	private const RETRY_STATE_OPTION = 'jf_background_job_retry_state';
	private const HOURLY_INTERVAL = 3600;
	private const TWICE_DAILY_INTERVAL = 43200;
	private const DEFAULT_RETRY_DELAY = 900;

	private const DAILY_SMS_REMINDERS = 'jf_daily_sms_reminders';
	private const SEND_SCHEDULED_SMS_REMINDER = 'jf_send_scheduled_sms_reminder';
	private const WEEKLY_CALORIE_ADJUST = 'jf_weekly_calorie_adjust';
	private const EVALUATE_AWARDS = 'jf_evaluate_awards';
	private const PROCESS_COACH_DELIVERIES = 'jf_process_coach_deliveries';

	private static bool $waiting_for_action_scheduler_init = false;

	public static function init(): void {
		add_filter( 'cron_schedules', [ __CLASS__, 'register_schedules' ] );

		add_action( self::DAILY_SMS_REMINDERS, [ __CLASS__, 'run_daily_sms_reminders' ] );
		add_action( self::SEND_SCHEDULED_SMS_REMINDER, [ __CLASS__, 'run_scheduled_sms_reminder' ], 10, 2 );
		add_action( self::WEEKLY_CALORIE_ADJUST, [ __CLASS__, 'run_weekly_calorie_adjust' ] );
		add_action( self::EVALUATE_AWARDS, [ __CLASS__, 'run_award_evaluation' ] );
		add_action( self::PROCESS_COACH_DELIVERIES, [ __CLASS__, 'run_coach_deliveries' ] );

		add_action( 'action_scheduler_before_execute', [ __CLASS__, 'handle_action_start' ], 10, 2 );
		add_action( 'action_scheduler_after_execute', [ __CLASS__, 'handle_action_success' ], 10, 3 );
		add_action( 'action_scheduler_failed_execution', [ __CLASS__, 'handle_failed_execution' ], 10, 3 );
		add_action( 'action_scheduler_failed_action', [ __CLASS__, 'handle_timed_out_action' ], 10, 2 );

		self::ensure_schedules();
	}

	public static function action_scheduler_group(): string {
		return self::ACTION_SCHEDULER_GROUP;
	}

	public static function registered_jobs(): array {
		return [
			self::DAILY_SMS_REMINDERS => [
				'label' => 'Daily SMS reminders',
				'interval' => self::HOURLY_INTERVAL,
				'first_run' => time() + 300,
				'retryable' => false,
			],
			self::WEEKLY_CALORIE_ADJUST => [
				'label' => 'Weekly calorie adjust',
				'interval' => WEEK_IN_SECONDS,
				'first_run' => strtotime( 'next monday 06:00:00' ),
				'retryable' => true,
			],
			self::EVALUATE_AWARDS => [
				'label' => 'Award evaluation',
				'interval' => self::TWICE_DAILY_INTERVAL,
				'first_run' => time(),
				'retryable' => true,
			],
			self::PROCESS_COACH_DELIVERIES => [
				'label' => 'Coach deliveries and push cleanup',
				'interval' => self::HOURLY_INTERVAL,
				'first_run' => time() + 300,
				'retryable' => true,
			],
		];
	}

	public static function register_schedules( array $schedules ): array {
		if ( ! isset( $schedules['weekly'] ) ) {
			$schedules['weekly'] = [
				'interval' => WEEK_IN_SECONDS,
				'display'  => 'Once Weekly',
			];
		}

		return $schedules;
	}

	public static function ensure_schedules(): void {
		self::clear_legacy_wp_cron();

		if ( self::action_scheduler_ready() ) {
			self::ensure_action_scheduler_jobs();
			return;
		}

		if ( self::action_scheduler_available() ) {
			if ( ! self::$waiting_for_action_scheduler_init ) {
				self::$waiting_for_action_scheduler_init = true;
				add_action( 'action_scheduler_init', [ __CLASS__, 'ensure_schedules' ], 20 );
			}

			return;
		}

		self::ensure_wp_cron_fallback();
	}

	public static function clear_schedules(): void {
		foreach ( self::all_hooks() as $hook ) {
			wp_clear_scheduled_hook( $hook );

			if ( self::action_scheduler_available() ) {
				as_unschedule_all_actions( $hook, [], self::ACTION_SCHEDULER_GROUP );
			}
		}

		self::reset_retry_state();
	}

	public static function reset_retry_state(): void {
		delete_option( self::RETRY_STATE_OPTION );
	}

	public static function queue_metrics( string $hook ): array {
		if ( ! self::action_scheduler_ready() ) {
			return [
				'pending' => 0,
				'failed' => 0,
				'running' => 0,
			];
		}

		return [
			'pending' => self::count_actions( $hook, 'pending' ),
			'failed' => self::count_actions( $hook, 'failed' ),
			'running' => self::count_actions( $hook, 'running' ),
		];
	}

	public static function handle_action_start( int $action_id, string $context = '' ): void {
		$action_data = self::get_action_data( $action_id );
		if ( ! $action_data ) {
			return;
		}

		JobLogger::record_start( $action_id, $action_data['hook'], $action_data['args'], $context );
	}

	public static function handle_action_success( int $action_id, $action, string $context = '' ): void {
		$action_data = self::get_action_data( $action_id, $action );
		if ( ! $action_data ) {
			return;
		}

		self::clear_retry_attempts( $action_data['hook'], $action_data['args'] );
		JobLogger::record_success( $action_id, $action_data['hook'], $action_data['args'], $context );
	}

	public static function handle_failed_execution( int $action_id, \Exception $exception, string $context = '' ): void {
		$action_data = self::get_action_data( $action_id );
		if ( ! $action_data ) {
			return;
		}

		JobLogger::record_failure( $action_id, $action_data['hook'], $action_data['args'], $exception->getMessage(), $context );
		self::maybe_schedule_retry( $action_data['hook'], $action_data['args'], $exception->getMessage() );
	}

	public static function handle_timed_out_action( int $action_id, int $timeout = 0 ): void {
		$action_data = self::get_action_data( $action_id );
		if ( ! $action_data ) {
			return;
		}

		$message = $timeout > 0
			? sprintf( 'Action timed out after %d seconds.', $timeout )
			: 'Action timed out before completion.';

		JobLogger::record_failure( $action_id, $action_data['hook'], $action_data['args'], $message, 'timeout' );
		self::maybe_schedule_retry( $action_data['hook'], $action_data['args'], $message );
	}

	public static function run_daily_sms_reminders(): void {
		SmsService::run_daily_reminders();
	}

	public static function run_scheduled_sms_reminder( int $user_id, string $reminder_id ): void {
		SmsService::send_scheduled_reminder( $user_id, $reminder_id );
	}

	public static function run_weekly_calorie_adjust(): void {
		CalorieEngine::run_weekly_adjustments_all_users();
	}

	public static function run_award_evaluation(): void {
		AwardEngine::run_all();
	}

	public static function run_coach_deliveries(): void {
		CoachDeliveryService::process_due_follow_ups_all_users();
		PushService::cleanup_disabled_subscriptions();
		PushService::cleanup_stale_active_subscriptions();
	}

	private static function all_hooks(): array {
		return [
			self::DAILY_SMS_REMINDERS,
			self::SEND_SCHEDULED_SMS_REMINDER,
			self::WEEKLY_CALORIE_ADJUST,
			self::EVALUATE_AWARDS,
			self::PROCESS_COACH_DELIVERIES,
		];
	}

	private static function action_scheduler_available(): bool {
		return function_exists( 'as_schedule_recurring_action' )
			&& function_exists( 'as_schedule_single_action' )
			&& function_exists( 'as_has_scheduled_action' )
			&& function_exists( 'as_unschedule_all_actions' )
			&& function_exists( 'as_get_scheduled_actions' );
	}

	private static function action_scheduler_ready(): bool {
		if ( ! self::action_scheduler_available() ) {
			return false;
		}

		if ( did_action( 'action_scheduler_init' ) > 0 ) {
			return true;
		}

		if ( class_exists( 'ActionScheduler', false ) && method_exists( 'ActionScheduler', 'is_initialized' ) ) {
			return \ActionScheduler::is_initialized();
		}

		return false;
	}

	private static function ensure_action_scheduler_jobs(): void {
		self::$waiting_for_action_scheduler_init = false;

		foreach ( self::registered_jobs() as $hook => $job ) {
			if ( as_has_scheduled_action( $hook, [], self::ACTION_SCHEDULER_GROUP ) ) {
				continue;
			}

			as_schedule_recurring_action(
				(int) $job['first_run'],
				(int) $job['interval'],
				$hook,
				[],
				self::ACTION_SCHEDULER_GROUP,
				true
			);
		}
	}

	private static function ensure_wp_cron_fallback(): void {
		$daily_sms_event = wp_get_scheduled_event( self::DAILY_SMS_REMINDERS );
		if ( ! $daily_sms_event ) {
			wp_schedule_event( time() + 300, 'hourly', self::DAILY_SMS_REMINDERS );
		} elseif ( 'hourly' !== ( $daily_sms_event->schedule ?? '' ) ) {
			wp_unschedule_event( $daily_sms_event->timestamp, self::DAILY_SMS_REMINDERS );
			wp_schedule_event( time() + 300, 'hourly', self::DAILY_SMS_REMINDERS );
		}

		if ( ! wp_next_scheduled( self::WEEKLY_CALORIE_ADJUST ) ) {
			wp_schedule_event( strtotime( 'next monday 06:00:00' ), 'weekly', self::WEEKLY_CALORIE_ADJUST );
		}

		if ( ! wp_next_scheduled( self::EVALUATE_AWARDS ) ) {
			wp_schedule_event( time(), 'twicedaily', self::EVALUATE_AWARDS );
		}

		if ( ! wp_next_scheduled( self::PROCESS_COACH_DELIVERIES ) ) {
			wp_schedule_event( time() + 300, 'hourly', self::PROCESS_COACH_DELIVERIES );
		}
	}

	private static function clear_legacy_wp_cron(): void {
		foreach ( self::all_hooks() as $hook ) {
			wp_clear_scheduled_hook( $hook );
		}
	}

	private static function get_action_data( int $action_id, $action = null ): ?array {
		$resolved_action = $action;

		if ( ! is_object( $resolved_action ) || ! method_exists( $resolved_action, 'get_hook' ) ) {
			if ( ! class_exists( 'ActionScheduler_Store' ) || ! method_exists( 'ActionScheduler_Store', 'instance' ) ) {
				return null;
			}

			$resolved_action = \ActionScheduler_Store::instance()->fetch_action( $action_id );
		}

		if ( ! is_object( $resolved_action ) || ! method_exists( $resolved_action, 'get_hook' ) ) {
			return null;
		}

		$hook = (string) $resolved_action->get_hook();
		$group = (string) $resolved_action->get_group();

		if ( self::ACTION_SCHEDULER_GROUP !== $group || ! isset( self::registered_jobs()[ $hook ] ) ) {
			return null;
		}

		$args = $resolved_action->get_args();

		return [
			'hook' => $hook,
			'group' => $group,
			'args' => is_array( $args ) ? $args : [],
		];
	}

	private static function maybe_schedule_retry( string $hook, array $args, string $reason ): void {
		$policy = self::retry_policy( $hook );
		if ( ! $policy['retryable'] ) {
			JobLogger::record_retry_skipped( $hook, $args, 'automatic_retry_disabled' );
			return;
		}

		if ( ! self::action_scheduler_ready() ) {
			JobLogger::record_retry_skipped( $hook, $args, 'action_scheduler_not_ready' );
			return;
		}

		$state = get_option( self::RETRY_STATE_OPTION, [] );
		if ( ! is_array( $state ) ) {
			$state = [];
		}

		$fingerprint = self::retry_fingerprint( $hook, $args );
		$attempts = (int) ( $state[ $fingerprint ]['attempts'] ?? 0 );

		if ( $attempts >= $policy['max_attempts'] ) {
			JobLogger::record_retry_skipped( $hook, $args, 'max_attempts_reached' );
			return;
		}

		$delay = (int) $policy['delay'];
		as_schedule_single_action( time() + $delay, $hook, $args, self::ACTION_SCHEDULER_GROUP );

		$state[ $fingerprint ] = [
			'attempts' => $attempts + 1,
			'last_retry_at' => current_time( 'mysql', true ),
			'last_reason' => sanitize_text_field( $reason ),
		];
		update_option( self::RETRY_STATE_OPTION, $state );

		JobLogger::record_retry_scheduled( $hook, $args, $attempts + 1, $delay );
	}

	private static function clear_retry_attempts( string $hook, array $args ): void {
		$state = get_option( self::RETRY_STATE_OPTION, [] );
		if ( ! is_array( $state ) ) {
			return;
		}

		$fingerprint = self::retry_fingerprint( $hook, $args );
		if ( ! array_key_exists( $fingerprint, $state ) ) {
			return;
		}

		unset( $state[ $fingerprint ] );
		update_option( self::RETRY_STATE_OPTION, $state );
	}

	private static function retry_policy( string $hook ): array {
		return match ( $hook ) {
			self::WEEKLY_CALORIE_ADJUST => [ 'retryable' => true, 'max_attempts' => 2, 'delay' => 900 ],
			self::EVALUATE_AWARDS => [ 'retryable' => true, 'max_attempts' => 3, 'delay' => 600 ],
			self::PROCESS_COACH_DELIVERIES => [ 'retryable' => true, 'max_attempts' => 2, 'delay' => 900 ],
			default => [ 'retryable' => false, 'max_attempts' => 0, 'delay' => self::DEFAULT_RETRY_DELAY ],
		};
	}

	private static function retry_fingerprint( string $hook, array $args ): string {
		return md5( $hook . '|' . wp_json_encode( $args ) );
	}

	private static function count_actions( string $hook, string $status ): int {
		$normalized_status = self::normalize_action_status( $status );

		$actions = as_get_scheduled_actions(
			[
				'hook' => $hook,
				'group' => self::ACTION_SCHEDULER_GROUP,
				'status' => $normalized_status,
				'per_page' => 100,
			],
			'ids'
		);

		return is_array( $actions ) ? count( $actions ) : 0;
	}

	private static function normalize_action_status( string $status ): string {
		$normalized = strtolower( trim( $status ) );
		$running_status = defined( '\\ActionScheduler_Store::STATUS_RUNNING' ) ? \ActionScheduler_Store::STATUS_RUNNING : 'in-progress';
		$canceled_status = defined( '\\ActionScheduler_Store::STATUS_CANCELED' ) ? \ActionScheduler_Store::STATUS_CANCELED : 'canceled';

		return match ( $normalized ) {
			'running' => $running_status,
			'cancelled' => $canceled_status,
			default => $normalized,
		};
	}
}
