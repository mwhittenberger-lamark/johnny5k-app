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

	// ── Public send methods ───────────────────────────────────────────────────

	public static function send_workout_reminder( int $user_id ): bool {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) return false;

		$name  = $profile->first_name ?: 'Hey';
		$msg   = "💪 {$name}, your workout is scheduled for today. Johnny 5000 says: let's get it. You've got this!";

		return self::send( $user_id, $profile->phone, 'workout_reminder', $msg );
	}

	public static function send_meal_reminder( int $user_id ): bool {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) return false;

		$name = $profile->first_name ?: 'Hey';
		$msg  = "🥗 {$name}, haven't seen any meals logged today. Remember — food is the other half of the equation.";

		return self::send( $user_id, $profile->phone, 'meal_reminder', $msg );
	}

	public static function send_sleep_reminder( int $user_id ): bool {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) return false;

		$name = $profile->first_name ?: 'Hey';
		$msg  = "😴 {$name}, don't forget to log your sleep tonight. Recovery is where the gains happen.";

		return self::send( $user_id, $profile->phone, 'sleep_reminder', $msg );
	}

	public static function send_weekly_summary( int $user_id, array $stats ): bool {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) return false;

		$name     = $profile->first_name ?: 'Hey';
		$workouts = $stats['workouts_completed'] ?? 0;
		$cal_avg  = $stats['avg_calories'] ?? 0;
		$weight   = $stats['latest_weight_lb'] ?? null;
		$w_line   = $weight ? " Weight: {$weight} lb." : '';

		$msg = "📊 Weekly check-in, {$name}: {$workouts} workouts done, ~{$cal_avg} kcal/day avg.{$w_line} Keep stacking those wins!";

		return self::send( $user_id, (string) $profile->phone, 'weekly_summary', $msg );
	}

	public static function send_encouragement( int $user_id, string $message ): bool {
		$profile = self::get_profile( $user_id );
		if ( ! $profile || ! $profile->phone ) return false;

		return self::send( $user_id, (string) $profile->phone, 'encouragement', $message );
	}

	// ── Cron: send daily reminders to all opted-in users ─────────────────────

	/**
	 * Called by the `jf_daily_sms_reminders` cron hook.
	 * Sends reminders based on per-user preferences and what they've logged so far today.
	 */
	public static function run_daily_reminders(): void {
		global $wpdb;

		$users = $wpdb->get_results(
			"SELECT up.user_id, up.phone, up.first_name, upref.notifications_enabled
			 FROM {$wpdb->prefix}fit_user_profiles up
			 JOIN {$wpdb->prefix}fit_user_preferences upref ON upref.user_id = up.user_id
			 WHERE up.onboarding_complete = 1
			   AND upref.notifications_enabled = 1
			   AND up.phone IS NOT NULL AND up.phone != ''"
		);

		$today = current_time( 'Y-m-d' );

		foreach ( $users as $u ) {
			$uid = (int) $u->user_id;

			// Workout reminder: if a session is planned today and not yet started
			$session_today = $wpdb->get_row( $wpdb->prepare(
				"SELECT id, started_at FROM {$wpdb->prefix}fit_workout_sessions
				 WHERE user_id = %d AND session_date = %s AND completed = 0 AND skip_requested = 0",
				$uid, $today
			) );
			if ( $session_today && ! $session_today->started_at ) {
				self::send_workout_reminder( $uid );
			}

			// Meal reminder: no meals logged by midday
			$meals_today = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_meals
				 WHERE user_id = %d AND DATE(meal_datetime) = %s AND confirmed = 1",
				$uid, $today
			) );
			if ( $meals_today === 0 ) {
				self::send_meal_reminder( $uid );
			}
		}
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

	// ── Helper ────────────────────────────────────────────────────────────────

	private static function get_profile( int $user_id ): ?\stdClass {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$user_id
		) ) ?: null;
	}
}
