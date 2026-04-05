<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * ClickSend SMS Service
 *
 * Triggers:
 *  workout_reminder  — day-before or morning-of workout reminder
 *  meal_reminder     — midday nudge if no meals logged yet
 *  sleep_reminder    — evening reminder to log sleep
 *  weekly_summary    — Monday summary of last week's stats
 *  encouragement     — ad-hoc motivational message
 *
 * Credentials are stored in wp_options:
 *   jf_clicksend_username
 *   jf_clicksend_api_key
 */
class SmsService {

	private const API_BASE = 'https://rest.clicksend.com/v3';
	private const COPY_CACHE_TTL = DAY_IN_SECONDS * 2;

	// ── Public send methods ───────────────────────────────────────────────────

	public static function send_workout_reminder( int $user_id ): bool {
		return self::send_trigger_message( $user_id, 'workout_reminder', self::workout_context( $user_id ) );
	}

	public static function send_meal_reminder( int $user_id ): bool {
		return self::send_trigger_message( $user_id, 'meal_reminder', self::meal_context( $user_id ) );
	}

	public static function send_sleep_reminder( int $user_id ): bool {
		return self::send_trigger_message( $user_id, 'sleep_reminder', self::sleep_context( $user_id ) );
	}

	public static function send_weekly_summary( int $user_id, array $stats ): bool {
		return self::send_trigger_message( $user_id, 'weekly_summary', self::weekly_summary_context( $user_id, $stats ) );
	}

	public static function send_encouragement( int $user_id, string $message ): bool {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) return false;

		return self::send( $user_id, (string) $profile->phone, 'encouragement', self::ensure_johnny_identity( self::normalize_sms_message( $message ) ) );
	}

	// ── Cron: send daily reminders to all opted-in users ─────────────────────

	/**
	 * Called by the `jf_daily_sms_reminders` cron hook.
	 * Runs hourly and sends reminders in user-local morning, midday, evening, and Monday summary windows.
	 */
	public static function run_daily_reminders(): void {
		global $wpdb;

		$users = $wpdb->get_results(
			"SELECT up.user_id, up.phone, up.first_name, upref.notifications_enabled, upref.exercise_preferences_json
			 FROM {$wpdb->prefix}fit_user_profiles up
			 JOIN {$wpdb->prefix}fit_user_preferences upref ON upref.user_id = up.user_id
			 WHERE up.onboarding_complete = 1
			   AND upref.notifications_enabled = 1
			   AND up.phone IS NOT NULL AND up.phone != ''"
		);

		foreach ( $users as $u ) {
			$uid = (int) $u->user_id;
			$today = UserTime::today( $uid );
			$now = UserTime::now( $uid );
			$local_hour = (int) $now->format( 'G' );
			$weekday = (int) $now->format( 'N' );
			$preferences = self::reminder_preferences( $u->exercise_preferences_json ?? '' );
			$workout_enabled = self::reminder_enabled( $preferences, 'workout_reminder_enabled', true );
			$workout_hour = self::reminder_hour( $preferences, 'workout_reminder_hour', 8 );
			$meal_enabled = self::reminder_enabled( $preferences, 'meal_reminder_enabled', true );
			$meal_hour = self::reminder_hour( $preferences, 'meal_reminder_hour', 12 );
			$sleep_enabled = self::reminder_enabled( $preferences, 'sleep_reminder_enabled', true );
			$sleep_hour = self::reminder_hour( $preferences, 'sleep_reminder_hour', 20 );
			$weekly_summary_enabled = self::reminder_enabled( $preferences, 'weekly_summary_enabled', true );
			$weekly_summary_hour = self::reminder_hour( $preferences, 'weekly_summary_hour', 9 );

			// Workout reminder: if a session is planned today and not yet started
			$session_today = $wpdb->get_row( $wpdb->prepare(
				"SELECT id, started_at FROM {$wpdb->prefix}fit_workout_sessions
				 WHERE user_id = %d AND session_date = %s AND completed = 0 AND skip_requested = 0",
				$uid, $today
			) );
			if ( $workout_enabled && $workout_hour === $local_hour && $session_today && ! $session_today->started_at && ! self::was_sent_on_local_date( $uid, 'workout_reminder', $today ) ) {
				self::send_workout_reminder( $uid );
			}

			// Meal reminder: no meals logged by midday
			$meals_today = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_meals
				 WHERE user_id = %d AND DATE(meal_datetime) = %s AND confirmed = 1",
				$uid, $today
			) );
			if ( $meal_enabled && $meal_hour === $local_hour && 0 === $meals_today && ! self::was_sent_on_local_date( $uid, 'meal_reminder', $today ) ) {
				self::send_meal_reminder( $uid );
			}

			$sleep_today = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_body_metrics
				 WHERE user_id = %d AND metric_date = %s AND sleep_hours IS NOT NULL",
				$uid,
				$today
			) );
			if ( $sleep_enabled && $sleep_hour === $local_hour && 0 === $sleep_today && ! self::was_sent_on_local_date( $uid, 'sleep_reminder', $today ) ) {
				self::send_sleep_reminder( $uid );
			}

			if ( $weekly_summary_enabled && $weekly_summary_hour === $local_hour && 1 === $weekday && ! self::was_sent_on_local_date( $uid, 'weekly_summary', $today ) ) {
				self::send_weekly_summary( $uid, self::compile_weekly_summary_stats( $uid ) );
			}
		}
	}

	public static function send_test_reminder( int $user_id, string $trigger_type ): array|
	\WP_Error {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) {
			return new \WP_Error( 'missing_phone', 'User does not have a phone number configured.' );
		}

		$preferences = self::reminder_preferences( self::get_preference_json( $user_id ) );
		$timezone = UserTime::timezone_string( $user_id );
		$local_now = UserTime::now( $user_id );
		$context = match ( $trigger_type ) {
			'workout_reminder' => self::workout_context( $user_id ),
			'meal_reminder' => self::meal_context( $user_id ),
			'sleep_reminder' => self::sleep_context( $user_id ),
			'weekly_summary' => self::weekly_summary_context( $user_id, self::compile_weekly_summary_stats( $user_id ) ),
			default => null,
		};

		if ( null === $context ) {
			return new \WP_Error( 'invalid_trigger_type', 'Unsupported reminder type.' );
		}

		$message = self::compose_trigger_message( $user_id, $trigger_type, $context );

		$sent = match ( $trigger_type ) {
			'workout_reminder', 'meal_reminder', 'sleep_reminder', 'weekly_summary' => self::send( $user_id, (string) $profile->phone, $trigger_type, $message ),
			default => null,
		};

		if ( null === $sent ) {
			return new \WP_Error( 'invalid_trigger_type', 'Unsupported reminder type.' );
		}

		if ( ! $sent ) {
			return new \WP_Error( 'send_failed', 'SMS send failed. Check ClickSend credentials and the user phone number.' );
		}

		return [
			'user_id' => $user_id,
			'phone' => (string) $profile->phone,
			'trigger_type' => $trigger_type,
			'timezone' => $timezone,
			'local_now' => $local_now->format( 'Y-m-d H:i' ),
			'enabled' => self::reminder_enabled( $preferences, self::enabled_key( $trigger_type ), true ),
			'scheduled_hour' => self::reminder_hour( $preferences, self::hour_key( $trigger_type ), self::default_hour( $trigger_type ) ),
			'message_preview' => $message,
		];
	}

	// ── Core send ─────────────────────────────────────────────────────────────

	private static function send(
		int $user_id,
		string $phone,
		string $trigger_type,
		string $message
	): bool {
		$username = get_option( 'jf_clicksend_username', '' );
		$api_key  = get_option( 'jf_clicksend_api_key', '' );

		if ( ! $username || ! $api_key ) {
			error_log( 'Johnny5k SmsService: ClickSend credentials not configured.' );
			return false;
		}

		// Sanitise phone — ensure E.164 format (very basic)
		$phone = preg_replace( '/[^+\d]/', '', $phone );
		if ( strlen( $phone ) < 10 ) {
			return false;
		}

		$payload = wp_json_encode( [
			'messages' => [
				[
					'source'  => 'sdk',
					'body'    => $message,
					'to'      => $phone,
					'from'    => get_option( 'jf_clicksend_sender_id', 'Johnny5000' ),
				],
			],
		] );

		$response = wp_remote_post(
			self::API_BASE . '/sms/send',
			[
				'headers' => [
					'Content-Type'  => 'application/json',
					'Authorization' => 'Basic ' . base64_encode( $username . ':' . $api_key ),
				],
				'body'    => $payload,
				'timeout' => 15,
			]
		);

		$status   = 'failed';
		$cost_usd = 0.0;
		$ext_id   = null;

		if ( ! is_wp_error( $response ) ) {
			$body = json_decode( wp_remote_retrieve_body( $response ), true );
			$http = wp_remote_retrieve_response_code( $response );

			if ( $http === 200 && isset( $body['data']['messages'][0]['status'] ) ) {
				$api_status = $body['data']['messages'][0]['status'];
				$status     = in_array( $api_status, [ 'SUCCESS', 'QUEUED' ], true ) ? 'sent' : 'failed';
				$cost_usd   = (float) ( $body['data']['messages'][0]['message_price'] ?? 0 );
				$ext_id     = $body['data']['messages'][0]['message_id'] ?? null;
			}
		}

		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'fit_sms_logs', [
			'user_id'              => $user_id ?: null,
			'phone'                => $phone,
			'trigger_type'         => $trigger_type,
			'message_preview'      => mb_substr( $message, 0, 255 ),
			'status'               => $status,
			'cost_usd'             => $cost_usd,
			'clicksend_message_id' => $ext_id,
			'sent_at'              => $status === 'sent' ? current_time( 'mysql', true ) : null,
		] );

		if ( $cost_usd > 0 ) {
			CostTracker::log_clicksend( $user_id, $cost_usd, [ 'trigger' => $trigger_type ] );
		}

		return $status === 'sent';
	}

	// ── Helper ────────────────────────────────────────────────────────────────

	private static function get_profile( int $user_id ): ?\stdClass {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$user_id
		) ) ?: null;
	}

	private static function send_trigger_message( int $user_id, string $trigger_type, array $context = [] ): bool {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) {
			return false;
		}

		$message = self::compose_trigger_message( $user_id, $trigger_type, $context );

		return self::send( $user_id, (string) $profile->phone, $trigger_type, $message );
	}

	private static function compose_trigger_message( int $user_id, string $trigger_type, array $context = [] ): string {
		$cache_key = self::copy_cache_key( $user_id, $trigger_type, $context );
		$cached = get_transient( $cache_key );
		if ( is_string( $cached ) && '' !== $cached ) {
			return $cached;
		}

		$context['recent_messages'] = self::recent_message_previews( $user_id, $trigger_type );
		$fallback = self::fallback_message( $user_id, $trigger_type, $context );
		$generated = AiService::generate_sms_copy( $user_id, $trigger_type, $context );

		$message = $fallback;
		if ( ! is_wp_error( $generated ) ) {
			$candidate = self::normalize_sms_message( $generated );
			if ( '' !== $candidate && ! self::matches_recent_message( $candidate, (array) $context['recent_messages'] ) ) {
				$message = $candidate;
			}
		}

		$message = self::ensure_johnny_identity( $message );

		set_transient( $cache_key, $message, self::COPY_CACHE_TTL );

		return $message;
	}

	private static function copy_cache_key( int $user_id, string $trigger_type, array $context ): string {
		$local_date = UserTime::today( $user_id );
		$context_hash = md5( wp_json_encode( array_diff_key( $context, [ 'recent_messages' => true ] ) ) ?: '' );

		return 'jf_sms_copy_' . md5( $user_id . '|' . $trigger_type . '|' . $local_date . '|' . $context_hash );
	}

	private static function normalize_sms_message( string $message ): string {
		$message = trim( wp_strip_all_tags( preg_replace( '/\s+/', ' ', $message ) ) );
		$message = trim( $message, " \t\n\r\0\x0B\"'" );

		if ( mb_strlen( $message ) > 220 ) {
			$message = rtrim( mb_substr( $message, 0, 217 ) ) . '...';
		}

		return $message;
	}

	private static function ensure_johnny_identity( string $message ): string {
		if ( '' === $message ) {
			return 'Johnny 5000 here. Stay on it.';
		}

		if ( preg_match( '/johnny\s*5000/i', $message ) ) {
			return self::normalize_sms_message( $message );
		}

		$signature = ' - Johnny 5000';
		$available = 220 - mb_strlen( $signature );
		$base = $message;
		if ( mb_strlen( $base ) > $available ) {
			$base = rtrim( mb_substr( $base, 0, max( 0, $available - 3 ) ) ) . '...';
		}

		return self::normalize_sms_message( $base . $signature );
	}

	private static function matches_recent_message( string $message, array $recent_messages ): bool {
		$normalized = mb_strtolower( trim( $message ) );
		foreach ( $recent_messages as $recent ) {
			if ( $normalized === mb_strtolower( trim( (string) $recent ) ) ) {
				return true;
			}
		}

		return false;
	}

	private static function recent_message_previews( int $user_id, string $trigger_type ): array {
		global $wpdb;

		$messages = $wpdb->get_col( $wpdb->prepare(
			"SELECT message_preview FROM {$wpdb->prefix}fit_sms_logs
			 WHERE user_id = %d AND trigger_type = %s AND status = 'sent'
			 ORDER BY created_at DESC LIMIT 5",
			$user_id,
			$trigger_type
		) );

		return array_values( array_filter( array_map( 'strval', $messages ) ) );
	}

	private static function fallback_message( int $user_id, string $trigger_type, array $context = [] ): string {
		$profile = self::get_profile( $user_id );
		$name = $profile->first_name ?: 'Hey';
		$weekday = $context['weekday_label'] ?? UserTime::weekday_label_for_date( $user_id, UserTime::today( $user_id ) );
		$day_type = $context['day_type_label'] ?? 'training';
		$workouts = (int) ( $context['workouts_completed'] ?? 0 );
		$avg_calories = (int) ( $context['avg_calories'] ?? 0 );
		$weight = $context['latest_weight_lb'] ?? null;
		$target_sleep = $context['target_sleep_hours'] ?? null;

		$templates = match ( $trigger_type ) {
			'workout_reminder' => [
				"{$name}, {$weekday} is your {$day_type} day. Show up and stack the win. Johnny 5000's watching your consistency.",
				"{$name}, you've got {$day_type} on deck today. Get in, do the work, keep momentum rolling. Johnny 5000 says stop negotiating with yourself.",
				"{$name}, today's {$day_type} session is waiting. One solid workout beats overthinking it. Johnny 5000 wants action, not excuses.",
			],
			'meal_reminder' => [
				"{$name}, no meals logged yet today. Get something solid in and keep the day on track. Johnny 5000 doesn't want you winging this.",
				"Quick check, {$name}: nothing logged yet. Start the day strong with a real meal, not guesswork. Johnny 5000 here.",
				"{$name}, food log is still empty today. Get the first meal in and give yourself a clean start. Johnny 5000 wants the basics handled.",
			],
			'sleep_reminder' => [
				"{$name}, log your sleep before the day wraps. Recovery still counts as work. Johnny 5000 wants the full scoreboard.",
				"Before you shut it down tonight, {$name}, get your sleep logged. Recovery drives tomorrow. Johnny 5000 here.",
				"{$name}, don't leave recovery untracked tonight." . ( $target_sleep ? " Shoot for {$target_sleep} hours and log it." : '' ) . ' Johnny 5000 wants you recovered, not fried.',
			],
			'weekly_summary' => [
				"{$name}, weekly check-in from Johnny 5000: {$workouts} workouts done, about {$avg_calories} kcal/day on average." . ( $weight ? " Latest weight: {$weight} lb." : '' ) . " Keep building.",
				"New week, {$name}. Johnny 5000 here: {$workouts} workouts logged last week and about {$avg_calories} calories per day." . ( $weight ? " You're at {$weight} lb right now." : '' ) . " Stay steady.",
				"{$name}, Johnny 5000 checking in. Last week gave you {$workouts} completed workouts and roughly {$avg_calories} kcal/day." . ( $weight ? " Scale check: {$weight} lb." : '' ) . " Keep pressing forward.",
			],
			default => [ "{$name}, Johnny 5000 checking in. Stay consistent today." ],
		};

		$index = abs( crc32( $user_id . '|' . $trigger_type . '|' . UserTime::today( $user_id ) ) ) % count( $templates );

		return self::normalize_sms_message( $templates[ $index ] );
	}

	private static function workout_context( int $user_id ): array {
		global $wpdb;

		$today = UserTime::today( $user_id );
		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT planned_day_type, actual_day_type FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s
			 ORDER BY id DESC LIMIT 1",
			$user_id,
			$today
		) );

		$day_type = $session->actual_day_type ?? $session->planned_day_type ?? '';

		return [
			'weekday_label' => UserTime::weekday_label_for_date( $user_id, $today ),
			'day_type_label' => self::humanize_day_type( (string) $day_type ),
			'local_date' => $today,
		];
	}

	private static function meal_context( int $user_id ): array {
		$goal = self::active_goal( $user_id );

		return [
			'weekday_label' => UserTime::weekday_label_for_date( $user_id, UserTime::today( $user_id ) ),
			'target_calories' => $goal->target_calories ?? null,
			'target_protein_g' => $goal->target_protein_g ?? null,
		];
	}

	private static function sleep_context( int $user_id ): array {
		$goal = self::active_goal( $user_id );

		return [
			'weekday_label' => UserTime::weekday_label_for_date( $user_id, UserTime::today( $user_id ) ),
			'target_sleep_hours' => $goal->target_sleep_hours ?? null,
		];
	}

	private static function weekly_summary_context( int $user_id, array $stats ): array {
		return [
			'weekday_label' => UserTime::weekday_label_for_date( $user_id, UserTime::today( $user_id ) ),
			'workouts_completed' => $stats['workouts_completed'] ?? 0,
			'avg_calories' => $stats['avg_calories'] ?? 0,
			'latest_weight_lb' => $stats['latest_weight_lb'] ?? null,
		];
	}

	private static function active_goal( int $user_id ): ?\stdClass {
		global $wpdb;

		return $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) ) ?: null;
	}

	private static function humanize_day_type( string $day_type ): string {
		if ( '' === $day_type ) {
			return 'training';
		}

		return strtolower( str_replace( '_', ' ', $day_type ) );
	}

	private static function was_sent_on_local_date( int $user_id, string $trigger_type, string $local_date ): bool {
		global $wpdb;

		$sent_at = $wpdb->get_var( $wpdb->prepare(
			"SELECT sent_at FROM {$wpdb->prefix}fit_sms_logs
			 WHERE user_id = %d AND trigger_type = %s AND status = 'sent'
			 ORDER BY sent_at DESC LIMIT 1",
			$user_id,
			$trigger_type
		) );

		if ( ! $sent_at ) {
			return false;
		}

		$timestamp = new \DateTimeImmutable( (string) $sent_at, new \DateTimeZone( 'UTC' ) );
		$local_sent_date = $timestamp->setTimezone( UserTime::timezone( $user_id ) )->format( 'Y-m-d' );

		return $local_sent_date === $local_date;
	}

	private static function compile_weekly_summary_stats( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$since = UserTime::days_ago( $user_id, 6 );

		$workouts = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1 AND session_date >= %s",
			$user_id,
			$since
		) );

		$avg_calories = (int) round( (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT AVG(daily_cal) FROM (
			   SELECT DATE(m.meal_datetime) AS d, SUM(mi.calories) AS daily_cal
			   FROM {$p}fit_meal_items mi
			   JOIN {$p}fit_meals m ON m.id = mi.meal_id
			   WHERE m.user_id = %d AND m.confirmed = 1 AND DATE(m.meal_datetime) >= %s
			   GROUP BY DATE(m.meal_datetime)
			 ) summary",
			$user_id,
			$since
		) ) );

		$latest_weight = $wpdb->get_var( $wpdb->prepare(
			"SELECT weight_lb FROM {$p}fit_body_metrics WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );

		return [
			'workouts_completed' => $workouts,
			'avg_calories' => $avg_calories,
			'latest_weight_lb' => $latest_weight ? (float) $latest_weight : null,
		];
	}

	private static function reminder_preferences( string $raw_preferences ): array {
		$preferences = json_decode( $raw_preferences, true );

		return is_array( $preferences ) ? $preferences : [];
	}

	private static function reminder_hour( array $preferences, string $key, int $fallback ): int {
		$value = isset( $preferences[ $key ] ) ? (int) $preferences[ $key ] : $fallback;

		return max( 0, min( 23, $value ) );
	}

	private static function reminder_enabled( array $preferences, string $key, bool $fallback ): bool {
		if ( ! array_key_exists( $key, $preferences ) ) {
			return $fallback;
		}

		$value = $preferences[ $key ];
		if ( is_string( $value ) ) {
			$value = strtolower( trim( $value ) );
			return ! in_array( $value, [ '0', 'false', 'off', 'no' ], true );
		}

		return (bool) $value;
	}

	private static function get_preference_json( int $user_id ): string {
		global $wpdb;

		return (string) $wpdb->get_var( $wpdb->prepare(
			"SELECT exercise_preferences_json FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d",
			$user_id
		) );
	}

	private static function enabled_key( string $trigger_type ): string {
		return match ( $trigger_type ) {
			'workout_reminder' => 'workout_reminder_enabled',
			'meal_reminder' => 'meal_reminder_enabled',
			'sleep_reminder' => 'sleep_reminder_enabled',
			'weekly_summary' => 'weekly_summary_enabled',
			default => 'workout_reminder_enabled',
		};
	}

	private static function hour_key( string $trigger_type ): string {
		return match ( $trigger_type ) {
			'workout_reminder' => 'workout_reminder_hour',
			'meal_reminder' => 'meal_reminder_hour',
			'sleep_reminder' => 'sleep_reminder_hour',
			'weekly_summary' => 'weekly_summary_hour',
			default => 'workout_reminder_hour',
		};
	}

	private static function default_hour( string $trigger_type ): int {
		return match ( $trigger_type ) {
			'workout_reminder' => 8,
			'meal_reminder' => 12,
			'sleep_reminder' => 20,
			'weekly_summary' => 9,
			default => 8,
		};
	}
}
