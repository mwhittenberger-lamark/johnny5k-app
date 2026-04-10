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
	private const SCHEDULED_REMINDERS_META_KEY = 'jf_scheduled_sms_reminders';
	private const MAX_SCHEDULED_REMINDERS = 20;

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

	public static function list_user_reminders( int $user_id ): array {
		$timezone = UserTime::timezone_string( $user_id );
		$reminders = self::get_scheduled_reminders( $user_id );
		$reminders = self::reconcile_scheduled_reminders( $user_id, $reminders );

		usort( $reminders, static fn( array $left, array $right ): int => strcmp( (string) ( $left['send_at_utc'] ?? '' ), (string) ( $right['send_at_utc'] ?? '' ) ) );

		$scheduled = array_values( array_filter( $reminders, static fn( array $reminder ): bool => 'scheduled' === ( $reminder['status'] ?? '' ) ) );
		$history = array_values( array_filter( $reminders, static fn( array $reminder ): bool => 'scheduled' !== ( $reminder['status'] ?? '' ) ) );
		usort( $history, static fn( array $left, array $right ): int => strcmp( (string) ( $right['send_at_utc'] ?? '' ), (string) ( $left['send_at_utc'] ?? '' ) ) );

		return [
			'timezone'        => $timezone,
			'scheduled_count' => count( $scheduled ),
			'history_count'   => count( $history ),
			'scheduled'       => array_map( [ __CLASS__, 'format_reminder_for_response' ], $scheduled ),
			'history'         => array_map( [ __CLASS__, 'format_reminder_for_response' ], array_slice( $history, 0, 8 ) ),
		];
	}

	public static function schedule_user_reminder( int $user_id, string $send_at_local, string $message ): array|\WP_Error {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) {
			return new \WP_Error( 'missing_phone', 'A phone number is required before Johnny can schedule an SMS reminder.' );
		}

		$normalized_message = self::ensure_johnny_identity( self::normalize_sms_message( $message ) );
		if ( '' === trim( $normalized_message ) ) {
			return new \WP_Error( 'missing_message', 'A reminder message is required.' );
		}

		$scheduled_for = self::parse_local_datetime( $user_id, $send_at_local );
		if ( is_wp_error( $scheduled_for ) ) {
			return $scheduled_for;
		}

		if ( $scheduled_for <= UserTime::now( $user_id ) ) {
			return new \WP_Error( 'past_datetime', 'The SMS reminder time must be in the future.' );
		}

		$timezone = UserTime::timezone_string( $user_id );
		$scheduled_for_utc = $scheduled_for->setTimezone( new \DateTimeZone( 'UTC' ) );
		$schedule_result = self::schedule_with_clicksend(
			$user_id,
			(string) $profile->phone,
			'encouragement',
			$normalized_message,
			$scheduled_for_utc->getTimestamp()
		);
		if ( is_wp_error( $schedule_result ) ) {
			return $schedule_result;
		}

		$reminders = self::get_scheduled_reminders( $user_id );
		$reminder = [
			'id'                   => wp_generate_uuid4(),
			'message'              => $normalized_message,
			'send_at_local'        => $scheduled_for->format( 'Y-m-d H:i:s' ),
			'send_at_utc'          => $scheduled_for_utc->format( 'Y-m-d H:i:s' ),
			'timezone'             => $timezone,
			'status'               => 'scheduled',
			'created_at'           => current_time( 'mysql', true ),
			'sent_at'              => '',
			'canceled_at'          => '',
			'clicksend_message_id' => (string) ( $schedule_result['message_id'] ?? '' ),
		];

		$reminders[] = $reminder;
		usort( $reminders, static fn( array $left, array $right ): int => strcmp( (string) ( $left['send_at_utc'] ?? '' ), (string) ( $right['send_at_utc'] ?? '' ) ) );
		if ( count( $reminders ) > self::MAX_SCHEDULED_REMINDERS ) {
			$reminders = array_slice( $reminders, -self::MAX_SCHEDULED_REMINDERS );
		}

		self::save_scheduled_reminders( $user_id, $reminders );

		return $reminder;
	}

	public static function cancel_user_reminder( int $user_id, string $reminder_id ): array|\WP_Error {
		$reminders = self::get_scheduled_reminders( $user_id );
		if ( empty( $reminders ) ) {
			return new \WP_Error( 'not_found', 'Reminder not found.' );
		}

		$formatted = null;
		$updated = false;
		foreach ( $reminders as &$reminder ) {
			if ( (string) ( $reminder['id'] ?? '' ) !== $reminder_id ) {
				continue;
			}

			if ( 'scheduled' !== ( $reminder['status'] ?? '' ) ) {
				return new \WP_Error( 'invalid_status', 'Only scheduled reminders can be canceled.' );
			}

			$clicksend_message_id = sanitize_text_field( (string) ( $reminder['clicksend_message_id'] ?? '' ) );
			if ( '' !== $clicksend_message_id ) {
				$canceled = self::cancel_with_clicksend( $clicksend_message_id );
				if ( is_wp_error( $canceled ) ) {
					return $canceled;
				}
			} else {
				$next_event = wp_next_scheduled( 'jf_send_scheduled_sms_reminder', [ $user_id, $reminder_id ] );
				if ( $next_event ) {
					wp_unschedule_event( $next_event, 'jf_send_scheduled_sms_reminder', [ $user_id, $reminder_id ] );
				}
			}

			$reminder['status'] = 'canceled';
			$reminder['canceled_at'] = current_time( 'mysql', true );
			$formatted = self::format_reminder_for_response( $reminder );
			$updated = true;
			break;
		}
		unset( $reminder );

		if ( ! $updated || ! is_array( $formatted ) ) {
			return new \WP_Error( 'not_found', 'Reminder not found.' );
		}

		self::save_scheduled_reminders( $user_id, $reminders );

		return $formatted;
	}

	public static function send_scheduled_reminder( int $user_id, string $reminder_id ): void {
		$reminders = self::get_scheduled_reminders( $user_id );
		if ( empty( $reminders ) ) {
			return;
		}

		$updated = false;
		foreach ( $reminders as &$reminder ) {
			if ( (string) ( $reminder['id'] ?? '' ) !== $reminder_id ) {
				continue;
			}

			if ( 'scheduled' !== ( $reminder['status'] ?? '' ) ) {
				return;
			}

			$sent = self::send_encouragement( $user_id, (string) ( $reminder['message'] ?? '' ) );
			$reminder['status'] = $sent ? 'sent' : 'failed';
			$reminder['sent_at'] = current_time( 'mysql', true );
			$updated = true;
			break;
		}
		unset( $reminder );

		if ( $updated ) {
			self::save_scheduled_reminders( $user_id, $reminders );
		}
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
					'from'    => get_option( 'jf_clicksend_sender_id', 'Johnny5k' ),
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

	private static function schedule_with_clicksend(
		int $user_id,
		string $phone,
		string $trigger_type,
		string $message,
		int $schedule_unix
	): array|\WP_Error {
		$username = get_option( 'jf_clicksend_username', '' );
		$api_key  = get_option( 'jf_clicksend_api_key', '' );

		if ( ! $username || ! $api_key ) {
			error_log( 'Johnny5k SmsService: ClickSend credentials not configured.' );
			return new \WP_Error( 'clicksend_not_configured', 'ClickSend credentials are not configured.' );
		}

		$phone = preg_replace( '/[^+\d]/', '', $phone );
		if ( strlen( $phone ) < 10 ) {
			return new \WP_Error( 'invalid_phone', 'Johnny could not schedule that reminder because the phone number is invalid.' );
		}

		$payload = wp_json_encode( [
			'messages' => [
				[
					'source'   => 'sdk',
					'body'     => $message,
					'to'       => $phone,
					'from'     => get_option( 'jf_clicksend_sender_id', 'Johnny5k' ),
					'schedule' => $schedule_unix,
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

		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'clicksend_schedule_failed', $response->get_error_message() );
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		$http = wp_remote_retrieve_response_code( $response );
		$message_data = $body['data']['messages'][0] ?? [];
		$api_status = (string) ( $message_data['status'] ?? '' );
		$message_id = sanitize_text_field( (string) ( $message_data['message_id'] ?? '' ) );
		$accepted = 200 === $http && in_array( $api_status, [ 'SUCCESS', 'QUEUED' ], true ) && '' !== $message_id;

		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'fit_sms_logs', [
			'user_id'              => $user_id ?: null,
			'phone'                => $phone,
			'trigger_type'         => $trigger_type,
			'message_preview'      => mb_substr( $message, 0, 255 ),
			'status'               => $accepted ? 'scheduled' : 'failed',
			'cost_usd'             => (float) ( $message_data['message_price'] ?? 0 ),
			'clicksend_message_id' => $message_id ?: null,
			'sent_at'              => null,
		] );

		if ( ! $accepted ) {
			$error_message = sanitize_text_field( (string) ( $message_data['status_text'] ?? '' ) );
			if ( '' === $error_message ) {
				$error_message = 'ClickSend did not accept the scheduled SMS reminder.';
			}
			return new \WP_Error( 'clicksend_schedule_failed', $error_message );
		}

		return [
			'message_id' => $message_id,
			'status'     => $api_status,
		];
	}

	private static function cancel_with_clicksend( string $message_id ): bool|\WP_Error {
		$username = get_option( 'jf_clicksend_username', '' );
		$api_key  = get_option( 'jf_clicksend_api_key', '' );

		if ( ! $username || ! $api_key ) {
			return new \WP_Error( 'clicksend_not_configured', 'ClickSend credentials are not configured.' );
		}

		$response = wp_remote_request(
			self::API_BASE . '/sms/' . rawurlencode( $message_id ) . '/cancel',
			[
				'method'  => 'PUT',
				'headers' => [
					'Content-Type'  => 'application/json',
					'Authorization' => 'Basic ' . base64_encode( $username . ':' . $api_key ),
				],
				'timeout' => 15,
			]
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'clicksend_cancel_failed', $response->get_error_message() );
		}

		$http = wp_remote_retrieve_response_code( $response );
		if ( $http < 200 || $http >= 300 ) {
			$body = json_decode( wp_remote_retrieve_body( $response ), true );
			$error_message = sanitize_text_field( (string) ( $body['response_msg'] ?? $body['message'] ?? '' ) );
			if ( '' === $error_message ) {
				$error_message = 'ClickSend could not cancel that scheduled reminder.';
			}
			return new \WP_Error( 'clicksend_cancel_failed', $error_message );
		}

		return true;
	}

	// ── Helper ────────────────────────────────────────────────────────────────

	private static function get_profile( int $user_id ): ?\stdClass {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$user_id
		) ) ?: null;
	}

	private static function get_scheduled_reminders( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::SCHEDULED_REMINDERS_META_KEY, true );
		if ( ! is_array( $stored ) ) {
			return [];
		}

		return array_values( array_filter( array_map( static function( $item ): ?array {
			if ( ! is_array( $item ) || empty( $item['id'] ) ) {
				return null;
			}

			return [
				'id'            => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
				'message'       => self::normalize_sms_message( (string) ( $item['message'] ?? '' ) ),
				'send_at_local' => sanitize_text_field( (string) ( $item['send_at_local'] ?? '' ) ),
				'send_at_utc'   => sanitize_text_field( (string) ( $item['send_at_utc'] ?? '' ) ),
				'timezone'      => sanitize_text_field( (string) ( $item['timezone'] ?? '' ) ),
				'status'        => sanitize_key( (string) ( $item['status'] ?? 'scheduled' ) ),
				'created_at'    => sanitize_text_field( (string) ( $item['created_at'] ?? '' ) ),
				'sent_at'       => sanitize_text_field( (string) ( $item['sent_at'] ?? '' ) ),
				'canceled_at'   => sanitize_text_field( (string) ( $item['canceled_at'] ?? '' ) ),
				'clicksend_message_id' => sanitize_text_field( (string) ( $item['clicksend_message_id'] ?? '' ) ),
			];
		}, $stored ) ) );
	}

	private static function save_scheduled_reminders( int $user_id, array $reminders ): void {
		if ( empty( $reminders ) ) {
			delete_user_meta( $user_id, self::SCHEDULED_REMINDERS_META_KEY );
			return;
		}

		update_user_meta( $user_id, self::SCHEDULED_REMINDERS_META_KEY, array_values( $reminders ) );
	}

	private static function parse_local_datetime( int $user_id, string $value ): \DateTimeImmutable|\WP_Error {
		$raw = trim( $value );
		if ( '' === $raw ) {
			return new \WP_Error( 'missing_datetime', 'A future local date and time is required.' );
		}

		$timezone = UserTime::timezone( $user_id );
		$formats = [ 'Y-m-d H:i:s', 'Y-m-d H:i', 'Y-m-d\TH:i:s', 'Y-m-d\TH:i' ];
		foreach ( $formats as $format ) {
			$parsed = \DateTimeImmutable::createFromFormat( $format, $raw, $timezone );
			if ( false !== $parsed ) {
				return $parsed;
			}
		}

		try {
			return new \DateTimeImmutable( $raw, $timezone );
		} catch ( \Exception $e ) {
			return new \WP_Error( 'invalid_datetime', 'Johnny could not parse that reminder time. Use a clear local time like 2026-04-07 18:30 or tomorrow 6:30pm.' );
		}
	}

	private static function format_reminder_for_response( array $reminder ): array {
		return [
			'id'            => sanitize_text_field( (string) ( $reminder['id'] ?? '' ) ),
			'message'       => self::normalize_sms_message( (string) ( $reminder['message'] ?? '' ) ),
			'send_at_local' => sanitize_text_field( (string) ( $reminder['send_at_local'] ?? '' ) ),
			'send_at_utc'   => sanitize_text_field( (string) ( $reminder['send_at_utc'] ?? '' ) ),
			'timezone'      => sanitize_text_field( (string) ( $reminder['timezone'] ?? '' ) ),
			'status'        => sanitize_key( (string) ( $reminder['status'] ?? 'scheduled' ) ),
			'created_at'    => sanitize_text_field( (string) ( $reminder['created_at'] ?? '' ) ),
			'sent_at'       => sanitize_text_field( (string) ( $reminder['sent_at'] ?? '' ) ),
			'canceled_at'   => sanitize_text_field( (string) ( $reminder['canceled_at'] ?? '' ) ),
		];
	}

	private static function reconcile_scheduled_reminders( int $user_id, array $reminders ): array {
		if ( empty( $reminders ) ) {
			return [];
		}

		$now_utc = UserTime::now( $user_id )->setTimezone( new \DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );
		$updated = false;

		foreach ( $reminders as &$reminder ) {
			if ( 'scheduled' !== ( $reminder['status'] ?? '' ) ) {
				continue;
			}

			$send_at_utc = sanitize_text_field( (string) ( $reminder['send_at_utc'] ?? '' ) );
			if ( '' !== $send_at_utc && $send_at_utc <= $now_utc ) {
				$reminder['status'] = 'queued';
				$updated = true;
			}
		}
		unset( $reminder );

		if ( $updated ) {
			self::save_scheduled_reminders( $user_id, $reminders );
		}

		return $reminders;
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
			return 'Johnny5k here. Stay on it.';
		}

		if ( preg_match( '/johnny\s*(?:5000|5k)/i', $message ) ) {
			return self::normalize_sms_message( $message );
		}

		$signature = ' - Johnny5k';
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
				"{$name}, {$weekday} is your {$day_type} day. Show up and stack the win. Johnny5k's watching your consistency.",
				"{$name}, you've got {$day_type} on deck today. Get in, do the work, keep momentum rolling. Johnny5k says stop negotiating with yourself.",
				"{$name}, today's {$day_type} session is waiting. One solid workout beats overthinking it. Johnny5k wants action, not excuses.",
			],
			'meal_reminder' => [
				"{$name}, no meals logged yet today. Get something solid in and keep the day on track. Johnny5k doesn't want you winging this.",
				"Quick check, {$name}: nothing logged yet. Start the day strong with a real meal, not guesswork. Johnny5k here.",
				"{$name}, food log is still empty today. Get the first meal in and give yourself a clean start. Johnny5k wants the basics handled.",
			],
			'sleep_reminder' => [
				"{$name}, log your sleep before the day wraps. Recovery still counts as work. Johnny5k wants the full scoreboard.",
				"Before you shut it down tonight, {$name}, get your sleep logged. Recovery drives tomorrow. Johnny5k here.",
				"{$name}, don't leave recovery untracked tonight." . ( $target_sleep ? " Shoot for {$target_sleep} hours and log it." : '' ) . ' Johnny5k wants you recovered, not fried.',
			],
			'weekly_summary' => [
				"{$name}, weekly check-in from Johnny5k: {$workouts} workouts done, about {$avg_calories} kcal/day on average." . ( $weight ? " Latest weight: {$weight} lb." : '' ) . " Keep building.",
				"New week, {$name}. Johnny5k here: {$workouts} workouts logged last week and about {$avg_calories} calories per day." . ( $weight ? " You're at {$weight} lb right now." : '' ) . " Stay steady.",
				"{$name}, Johnny5k checking in. Last week gave you {$workouts} completed workouts and roughly {$avg_calories} kcal/day." . ( $weight ? " Scale check: {$weight} lb." : '' ) . " Keep pressing forward.",
			],
			default => [ "{$name}, Johnny5k checking in. Stay consistent today." ],
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
