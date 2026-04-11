<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\TrainingDayTypes;

class CoachDeliveryService {
	private const MAX_PROACTIVE_PER_DAY = 1;
	private const MAX_PROACTIVE_PER_WEEK = 3;
	private const FOLLOW_UP_META_KEY = 'jf_johnny_follow_ups';
	private const CRON_LOCK_KEY = 'jf_process_coach_deliveries_lock';
	private const CRON_LOCK_TTL = 900;

	public static function process_due_follow_ups_all_users(): void {
		if ( get_transient( self::CRON_LOCK_KEY ) ) {
			return;
		}

		set_transient( self::CRON_LOCK_KEY, 1, self::CRON_LOCK_TTL );

		try {
			self::generate_system_follow_ups_all_users();

			foreach ( self::get_candidate_user_ids() as $user_id ) {
				self::process_due_follow_ups_for_user( $user_id );
			}
		} finally {
			delete_transient( self::CRON_LOCK_KEY );
		}
	}

	public static function process_due_follow_ups_for_user( int $user_id ): ?array {
		self::generate_system_follow_ups_for_user( $user_id );

		$follow_up = self::find_due_follow_up( $user_id );
		if ( ! $follow_up ) {
			return null;
		}

		$follow_up_id = sanitize_text_field( (string) ( $follow_up['id'] ?? '' ) );
		if ( '' === $follow_up_id ) {
			return null;
		}

		if ( self::was_follow_up_delivered_recently( $user_id, $follow_up_id ) ) {
			return null;
		}

		$decision = self::select_channel( $user_id, $follow_up );
		$title    = self::build_follow_up_title( $follow_up );
		$message  = self::build_follow_up_message( $follow_up );
		$url      = self::normalize_follow_up_url( (string) ( $follow_up['url'] ?? '/ai' ) );
		$status   = $decision['status'] ?? 'queued';
		$channel  = $decision['channel'] ?? 'in_app';

		if ( 'suppressed' === $status ) {
			self::log_delivery( $user_id, [
				'follow_up_id'    => $follow_up_id,
				'channel'         => 'in_app',
				'delivery_type'   => 'follow_up',
				'delivery_key'    => sanitize_key( (string) ( $follow_up['trigger_type'] ?? 'cooldown' ) ) ?: 'cooldown',
				'title'           => $title,
				'message_preview' => $message,
				'payload'         => [ 'follow_up' => $follow_up, 'decision' => $decision ],
				'status'          => 'suppressed',
				'error_code'      => sanitize_key( (string) ( $decision['reason'] ?? 'delivery_suppressed' ) ) ?: 'delivery_suppressed',
				'error_message'   => sanitize_text_field( (string) ( $decision['message'] ?? 'Proactive delivery suppressed.' ) ),
			] );
			AiMemoryService::mark_follow_up_delivery( $user_id, $follow_up_id, 'in_app', 'suppressed' );

			return [
				'status'  => 'suppressed',
				'channel' => 'in_app',
				'decision'=> $decision,
			];
		}

		if ( 'push' === $channel ) {
			$result = PushService::send_notification_to_user( $user_id, $title, $message, $url, [
				'type'         => 'follow_up',
				'follow_up_id' => $follow_up_id,
				'trigger_type' => sanitize_key( (string) ( $follow_up['trigger_type'] ?? '' ) ),
				'source'       => sanitize_key( (string) ( $follow_up['source'] ?? '' ) ),
			] );

			if ( is_wp_error( $result ) ) {
				self::log_delivery( $user_id, [
					'follow_up_id'    => $follow_up_id,
					'channel'         => 'push',
					'delivery_type'   => 'follow_up',
					'delivery_key'    => 'push_follow_up',
					'title'           => $title,
					'message_preview' => $message,
					'payload'         => [ 'follow_up' => $follow_up, 'decision' => $decision ],
					'status'          => 'failed',
					'error_code'      => $result->get_error_code(),
					'error_message'   => $result->get_error_message(),
				] );

				$channel = self::user_can_receive_sms( $user_id, (string) ( $follow_up['trigger_type'] ?? '' ) ) ? 'sms' : 'in_app';
			} else {
				AiMemoryService::mark_follow_up_delivery( $user_id, $follow_up_id, 'push', 'sent' );
				return [
					'status'  => 'sent',
					'channel' => 'push',
					'result'  => $result,
				];
			}
		}

		if ( 'sms' === $channel ) {
			$sent = SmsService::send_encouragement( $user_id, $message );
			self::log_delivery( $user_id, [
				'follow_up_id'    => $follow_up_id,
				'channel'         => 'sms',
				'delivery_type'   => 'follow_up',
				'delivery_key'    => 'sms_follow_up',
				'title'           => $title,
				'message_preview' => $message,
				'payload'         => [ 'follow_up' => $follow_up, 'decision' => $decision ],
				'status'          => $sent ? 'sent' : 'failed',
				'error_code'      => $sent ? '' : 'sms_send_failed',
				'error_message'   => $sent ? '' : 'SMS delivery failed or ClickSend is not configured.',
			] );
			AiMemoryService::mark_follow_up_delivery( $user_id, $follow_up_id, 'sms', $sent ? 'sent' : 'failed' );

			return [
				'status'  => $sent ? 'sent' : 'failed',
				'channel' => 'sms',
			];
		}

		self::log_delivery( $user_id, [
			'follow_up_id'    => $follow_up_id,
			'channel'         => 'in_app',
			'delivery_type'   => 'follow_up',
			'delivery_key'    => 'in_app_follow_up',
			'title'           => $title,
			'message_preview' => $message,
			'payload'         => [ 'follow_up' => $follow_up, 'decision' => $decision ],
			'status'          => 'queued',
		] );
		AiMemoryService::mark_follow_up_delivery( $user_id, $follow_up_id, 'in_app', 'queued' );

		return [
			'status'  => 'queued',
			'channel' => 'in_app',
		];
	}

	public static function generate_system_follow_ups_all_users(): void {
		foreach ( self::get_candidate_user_ids() as $user_id ) {
			self::generate_system_follow_ups_for_user( $user_id );
		}
	}

	public static function generate_system_follow_ups_for_user( int $user_id ): array {
		if ( $user_id <= 0 ) {
			return [];
		}

		$candidates = array_filter( array_merge( [
			self::build_absence_trigger( $user_id ),
			self::build_reset_trigger( $user_id ),
			self::build_balance_trigger( $user_id ),
			self::build_milestone_trigger( $user_id ),
		], self::build_meal_logging_triggers( $user_id ) ) );

		$created = [];
		foreach ( $candidates as $candidate ) {
			$queued = AiMemoryService::queue_follow_up_item( $user_id, $candidate );
			if ( $queued ) {
				$created[] = $queued;
			}
		}

		return $created;
	}

	public static function get_user_delivery_preferences( int $user_id ): array {
		global $wpdb;

		$raw = $wpdb->get_var( $wpdb->prepare(
			"SELECT exercise_preferences_json FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d LIMIT 1",
			$user_id
		) );

		$decoded = json_decode( (string) $raw, true );
		return self::normalize_delivery_preferences( is_array( $decoded ) ? $decoded : [] );
	}

	public static function get_user_delivery_diagnostics( int $user_id ): array {
		global $wpdb;

		$preferences = self::get_user_delivery_preferences( $user_id );
		$push_status = PushService::list_user_subscriptions( $user_id );
		$follow_up_overview = AiMemoryService::get_follow_up_overview( $user_id );
		$local_now = UserTime::now( $user_id );
		$recent = $wpdb->get_results( $wpdb->prepare(
			"SELECT channel, status, delivery_key, title, created_at, error_message
			 FROM {$wpdb->prefix}fit_coach_delivery_logs
			 WHERE user_id = %d
			 ORDER BY created_at DESC
			 LIMIT 8",
			$user_id
		), ARRAY_A );

		$counts = [
			'sent_last_24h' => (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_coach_delivery_logs WHERE user_id = %d AND status = 'sent' AND created_at >= %s",
				$user_id,
				gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS )
			) ),
			'sent_last_7d' => (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_coach_delivery_logs WHERE user_id = %d AND status = 'sent' AND created_at >= %s",
				$user_id,
				gmdate( 'Y-m-d H:i:s', time() - ( 7 * DAY_IN_SECONDS ) )
			) ),
			'dismissed_follow_ups_last_14d' => (int) ( $follow_up_overview['dismissed_last_14_days'] ?? 0 ),
		];

		return [
			'preferences' => $preferences,
			'push' => [
				'configured' => PushService::is_configured(),
				'active_count' => (int) ( $push_status['active_count'] ?? 0 ),
				'subscriptions' => $push_status['subscriptions'] ?? [],
			],
			'follow_up_overview' => $follow_up_overview,
			'local_time' => [
				'timezone' => UserTime::timezone_string( $user_id ),
				'now' => $local_now->format( 'Y-m-d H:i:s' ),
				'hour' => (int) $local_now->format( 'G' ),
				'in_quiet_hours' => self::is_within_quiet_hours( $local_now, $preferences ),
			],
			'recent_deliveries' => array_values( is_array( $recent ) ? $recent : [] ),
			'counts' => $counts,
		];
	}

	public static function log_delivery( int $user_id, array $payload ): void {
		global $wpdb;

		$wpdb->insert( $wpdb->prefix . 'fit_coach_delivery_logs', [
			'user_id'            => $user_id,
			'follow_up_id'       => sanitize_text_field( (string) ( $payload['follow_up_id'] ?? '' ) ) ?: null,
			'channel'            => self::sanitize_channel( (string) ( $payload['channel'] ?? 'in_app' ) ),
			'delivery_type'      => sanitize_key( (string) ( $payload['delivery_type'] ?? 'follow_up' ) ) ?: 'follow_up',
			'delivery_key'       => sanitize_key( (string) ( $payload['delivery_key'] ?? '' ) ) ?: null,
			'title'              => sanitize_text_field( (string) ( $payload['title'] ?? '' ) ) ?: null,
			'message_preview'    => mb_substr( sanitize_textarea_field( (string) ( $payload['message_preview'] ?? '' ) ), 0, 255 ) ?: null,
			'payload_json'       => wp_json_encode( $payload['payload'] ?? [] ),
			'status'             => self::sanitize_status( (string) ( $payload['status'] ?? 'queued' ) ),
			'error_code'         => sanitize_key( (string) ( $payload['error_code'] ?? '' ) ) ?: null,
			'error_message'      => sanitize_textarea_field( (string) ( $payload['error_message'] ?? '' ) ) ?: null,
			'provider_message_id'=> sanitize_text_field( (string) ( $payload['provider_message_id'] ?? '' ) ) ?: null,
			'sent_at'            => in_array( (string) ( $payload['status'] ?? '' ), [ 'sent' ], true ) ? current_time( 'mysql', true ) : null,
		], [
			'%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s',
		] );
	}

	public static function default_delivery_preferences(): array {
		return [
			'meal_reminder_enabled' => true,
			'push_enabled' => true,
			'push_absence_nudges' => true,
			'push_milestones' => true,
			'push_winback' => true,
			'push_accountability' => true,
			'quiet_hours_start' => 21,
			'quiet_hours_end' => 7,
		];
	}

	private static function get_candidate_user_ids(): array {
		global $wpdb;

		$user_ids = $wpdb->get_col(
			"SELECT DISTINCT user_id FROM {$wpdb->prefix}fit_user_profiles WHERE user_id > 0"
		);
		$follow_up_user_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT user_id FROM {$wpdb->usermeta} WHERE meta_key = %s",
			self::FOLLOW_UP_META_KEY
		) );

		$merged = array_unique( array_merge( array_map( 'intval', is_array( $user_ids ) ? $user_ids : [] ), array_map( 'intval', is_array( $follow_up_user_ids ) ? $follow_up_user_ids : [] ) ) );
		return array_values( array_filter( $merged, static fn( int $user_id ): bool => $user_id > 0 ) );
	}

	private static function find_due_follow_up( int $user_id ): ?array {
		$pending = AiMemoryService::get_pending_follow_ups( $user_id );
		if ( empty( $pending ) ) {
			return null;
		}

		$now = UserTime::mysql( $user_id );
		usort( $pending, static function( array $left, array $right ): int {
			$left_priority = (int) ( $left['priority'] ?? 0 );
			$right_priority = (int) ( $right['priority'] ?? 0 );
			if ( $left_priority !== $right_priority ) {
				return $right_priority <=> $left_priority;
			}

			return strcmp( (string) ( $left['due_at'] ?? '' ), (string) ( $right['due_at'] ?? '' ) );
		} );

		foreach ( $pending as $item ) {
			$status = sanitize_key( (string) ( $item['status'] ?? '' ) );
			$due_at = sanitize_text_field( (string) ( $item['due_at'] ?? '' ) );
			if ( 'missed' === $status ) {
				return $item;
			}
			if ( '' === $due_at || $due_at <= $now ) {
				return $item;
			}
		}

		return null;
	}

	private static function was_follow_up_delivered_recently( int $user_id, string $follow_up_id ): bool {
		global $wpdb;

		$sent_at = $wpdb->get_var( $wpdb->prepare(
			"SELECT created_at
			 FROM {$wpdb->prefix}fit_coach_delivery_logs
			 WHERE user_id = %d AND follow_up_id = %s AND status IN ('sent','queued')
			 ORDER BY created_at DESC LIMIT 1",
			$user_id,
			$follow_up_id
		) );

		if ( ! $sent_at ) {
			return false;
		}

		try {
			$previous = new \DateTimeImmutable( (string) $sent_at, new \DateTimeZone( 'UTC' ) );
			$cutoff = new \DateTimeImmutable( 'now', new \DateTimeZone( 'UTC' ) );
			return $previous >= $cutoff->modify( '-24 hours' );
		} catch ( \Exception $e ) {
			return false;
		}
	}

	private static function has_exceeded_delivery_limits( int $user_id ): bool {
		global $wpdb;

		$today = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );
		$week  = gmdate( 'Y-m-d H:i:s', time() - ( 7 * DAY_IN_SECONDS ) );

		$daily_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*)
			 FROM {$wpdb->prefix}fit_coach_delivery_logs
			 WHERE user_id = %d AND status = 'sent' AND channel IN ('push','sms') AND created_at >= %s",
			$user_id,
			$today
		) );

		$weekly_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*)
			 FROM {$wpdb->prefix}fit_coach_delivery_logs
			 WHERE user_id = %d AND status = 'sent' AND channel IN ('push','sms') AND created_at >= %s",
			$user_id,
			$week
		) );

		return $daily_count >= self::MAX_PROACTIVE_PER_DAY || $weekly_count >= self::MAX_PROACTIVE_PER_WEEK;
	}

	private static function select_channel( int $user_id, array $follow_up ): array {
		$preferences = self::get_user_delivery_preferences( $user_id );
		$trigger_type = sanitize_key( (string) ( $follow_up['trigger_type'] ?? '' ) );
		$local_now = UserTime::now( $user_id );
		$recent_summary = self::get_recent_delivery_summary( $user_id );
		$dismissed_recently = (int) ( AiMemoryService::get_follow_up_overview( $user_id )['dismissed_last_14_days'] ?? 0 );

		if ( self::has_exceeded_delivery_limits( $user_id ) ) {
			return [
				'channel' => 'in_app',
				'status' => 'suppressed',
				'reason' => 'delivery_cooldown',
				'message' => 'Proactive delivery suppressed by per-user frequency guardrails.',
			];
		}

		if ( self::is_within_quiet_hours( $local_now, $preferences ) ) {
			return [
				'channel' => 'in_app',
				'status' => 'suppressed',
				'reason' => 'quiet_hours',
				'message' => 'Proactive delivery suppressed because the user is inside quiet hours.',
			];
		}

		if ( $dismissed_recently >= 4 ) {
			return [
				'channel' => 'in_app',
				'status' => 'suppressed',
				'reason' => 'dismissal_suppression',
				'message' => 'Proactive delivery suppressed because the user has recently dismissed multiple follow-ups.',
			];
		}

		$push_score = 0;
		$sms_score = 0;
		$in_app_score = 10;

		if ( PushService::can_deliver_to_user( $user_id ) && ! empty( $preferences['push_enabled'] ) ) {
			$push_score += 40;
		}
		if ( self::user_can_receive_sms( $user_id, $trigger_type ) ) {
			$sms_score += 25;
		}
		if ( ! empty( $recent_summary['push_failures'] ) ) {
			$push_score -= 25;
		}
		if ( ! empty( $recent_summary['sms_failures'] ) ) {
			$sms_score -= 15;
		}
		if ( ! empty( $recent_summary['push_sent_last_24h'] ) ) {
			$push_score -= 10;
		}
		if ( ! empty( $recent_summary['sms_sent_last_24h'] ) ) {
			$sms_score -= 8;
		}

		if ( in_array( $trigger_type, [ 'absence_nudge', 'milestone' ], true ) ) {
			$push_score += 15;
		}
		if ( in_array( $trigger_type, [ 'reset_offer', 'balance_prompt' ], true ) ) {
			$sms_score += 6;
		}
		if ( str_starts_with( $trigger_type, 'meal_' ) ) {
			$push_score += 18;
			$sms_score += 10;
		}

		if ( ! self::is_push_trigger_enabled( $preferences, $trigger_type ) ) {
			$push_score = -999;
		}

		if ( $push_score >= $sms_score && $push_score > $in_app_score ) {
			return [ 'channel' => 'push', 'status' => 'ready', 'reason' => 'push_best_score' ];
		}
		if ( $sms_score > $in_app_score ) {
			return [ 'channel' => 'sms', 'status' => 'ready', 'reason' => 'sms_best_score' ];
		}

		return [ 'channel' => 'in_app', 'status' => 'ready', 'reason' => 'in_app_fallback' ];
	}

	private static function user_can_receive_sms( int $user_id, string $trigger_type = '' ): bool {
		global $wpdb;

		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT up.phone, pref.notifications_enabled
			 FROM {$wpdb->prefix}fit_user_profiles up
			 LEFT JOIN {$wpdb->prefix}fit_user_preferences pref ON pref.user_id = up.user_id
			 WHERE up.user_id = %d
			 LIMIT 1",
			$user_id
		) );

		if ( empty( $profile->phone ) || empty( $profile->notifications_enabled ) ) {
			return false;
		}

		return ! in_array( $trigger_type, [ 'milestone' ], true );
	}

	private static function normalize_delivery_preferences( array $raw ): array {
		$defaults = self::default_delivery_preferences();

		return [
			'meal_reminder_enabled' => array_key_exists( 'meal_reminder_enabled', $raw ) ? (bool) $raw['meal_reminder_enabled'] : $defaults['meal_reminder_enabled'],
			'push_enabled' => array_key_exists( 'push_enabled', $raw ) ? (bool) $raw['push_enabled'] : $defaults['push_enabled'],
			'push_absence_nudges' => array_key_exists( 'push_absence_nudges', $raw ) ? (bool) $raw['push_absence_nudges'] : $defaults['push_absence_nudges'],
			'push_milestones' => array_key_exists( 'push_milestones', $raw ) ? (bool) $raw['push_milestones'] : $defaults['push_milestones'],
			'push_winback' => array_key_exists( 'push_winback', $raw ) ? (bool) $raw['push_winback'] : $defaults['push_winback'],
			'push_accountability' => array_key_exists( 'push_accountability', $raw ) ? (bool) $raw['push_accountability'] : $defaults['push_accountability'],
			'quiet_hours_start' => self::normalize_hour( $raw['push_quiet_hours_start'] ?? $raw['quiet_hours_start'] ?? $defaults['quiet_hours_start'], $defaults['quiet_hours_start'] ),
			'quiet_hours_end' => self::normalize_hour( $raw['push_quiet_hours_end'] ?? $raw['quiet_hours_end'] ?? $defaults['quiet_hours_end'], $defaults['quiet_hours_end'] ),
		];
	}

	private static function is_push_trigger_enabled( array $preferences, string $trigger_type ): bool {
		return match ( $trigger_type ) {
			'absence_nudge' => ! empty( $preferences['push_absence_nudges'] ),
			'milestone' => ! empty( $preferences['push_milestones'] ),
			'reset_offer' => ! empty( $preferences['push_winback'] ),
			'balance_prompt' => ! empty( $preferences['push_accountability'] ),
			default => ! empty( $preferences['push_enabled'] ),
		};
	}

	private static function is_within_quiet_hours( \DateTimeImmutable $local_now, array $preferences ): bool {
		$start = (int) ( $preferences['quiet_hours_start'] ?? 21 );
		$end = (int) ( $preferences['quiet_hours_end'] ?? 7 );
		$hour = (int) $local_now->format( 'G' );

		if ( $start === $end ) {
			return false;
		}
		if ( $start < $end ) {
			return $hour >= $start && $hour < $end;
		}

		return $hour >= $start || $hour < $end;
	}

	private static function get_recent_delivery_summary( int $user_id ): array {
		global $wpdb;

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT channel, status, COUNT(*) AS total
			 FROM {$wpdb->prefix}fit_coach_delivery_logs
			 WHERE user_id = %d AND created_at >= %s
			 GROUP BY channel, status",
			$user_id,
			gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS )
		), ARRAY_A );

		$summary = [
			'push_sent_last_24h' => 0,
			'sms_sent_last_24h' => 0,
			'push_failures' => 0,
			'sms_failures' => 0,
		];

		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$channel = (string) ( $row['channel'] ?? '' );
			$status = (string) ( $row['status'] ?? '' );
			$total = (int) ( $row['total'] ?? 0 );
			if ( 'push' === $channel && 'sent' === $status ) {
				$summary['push_sent_last_24h'] += $total;
			} elseif ( 'sms' === $channel && 'sent' === $status ) {
				$summary['sms_sent_last_24h'] += $total;
			} elseif ( 'push' === $channel && 'failed' === $status ) {
				$summary['push_failures'] += $total;
			} elseif ( 'sms' === $channel && 'failed' === $status ) {
				$summary['sms_failures'] += $total;
			}
		}

		return $summary;
	}

	private static function build_absence_trigger( int $user_id ): ?array {
		$local_now = UserTime::now( $user_id );
		if ( (int) $local_now->format( 'G' ) < 16 ) {
			return null;
		}

		$today = $local_now->format( 'Y-m-d' );
		$weekday = $local_now->format( 'D' );
		if ( self::completed_workout_on_date( $user_id, $today ) ) {
			return null;
		}

		$typical_days = self::get_typical_training_days( $user_id );
		if ( ! in_array( $weekday, $typical_days, true ) ) {
			return null;
		}

		$memory = AiMemoryService::get_durable_memory( $user_id );
		$styles = implode( ', ', array_slice( (array) ( $memory['profile']['preferred_workout_styles'] ?? [] ), 0, 2 ) );
		$favorite = (string) ( ( $memory['profile']['favorite_exercises'][0] ?? '' ) );
		$prompt = 'You usually train on ' . $weekday . '. Want a short session to keep the rhythm?';
		if ( '' !== $styles ) {
			$prompt .= ' I can keep it in your preferred style: ' . $styles . '.';
		}
		if ( '' !== $favorite ) {
			$prompt .= ' I can even anchor it around ' . $favorite . '.';
		}

		return [
			'prompt' => $prompt,
			'reason' => 'Usual training day missed',
			'next_step' => 'Start a 20- to 25-minute reset session.',
			'starter_prompt' => 'Build me a short workout that fits today and keeps me on track.',
			'commitment_key' => 'absence_' . $today,
			'source' => 'system_trigger',
			'trigger_type' => 'absence_nudge',
			'priority' => 90,
			'url' => '/workout?coach_prompt=absence',
			'due_at' => $local_now->format( 'Y-m-d H:i:s' ),
		];
	}

	private static function build_meal_logging_triggers( int $user_id ): array {
		$preferences = self::get_user_delivery_preferences( $user_id );
		if ( empty( $preferences['meal_reminder_enabled'] ) ) {
			return [];
		}

		$local_now = UserTime::now( $user_id );
		$local_date = $local_now->format( 'Y-m-d' );
		$current_hour = (int) $local_now->format( 'G' );
		$triggers = [];

		foreach ( self::meal_follow_up_schedule() as $slot ) {
			if ( $current_hour < (int) $slot['hour'] ) {
				continue;
			}
			if ( self::has_logged_meal_type_today( $user_id, (string) $slot['meal_type'], $local_date ) ) {
				continue;
			}

			$trigger = self::build_meal_logging_trigger( $user_id, $local_date, $slot, $local_now );
			if ( $trigger ) {
				$triggers[] = $trigger;
			}
		}

		return $triggers;
	}

	private static function build_reset_trigger( int $user_id ): ?array {
		$week = self::get_weekly_schedule_status( $user_id );
		if ( (int) ( $week['missed_expected_sessions'] ?? 0 ) < 2 ) {
			return null;
		}

		$week_key = (string) ( $week['week_key'] ?? gmdate( 'o-W' ) );
		return [
			'prompt' => 'You missed two expected sessions this week. Want me to build a reset workout that gets momentum back without overdoing it?',
			'reason' => 'Reset offer',
			'next_step' => 'Run a reset session instead of trying to cram the full split back in.',
			'starter_prompt' => 'Build me a reset workout for this week based on what I missed.',
			'commitment_key' => 'reset_' . $week_key,
			'source' => 'system_trigger',
			'trigger_type' => 'reset_offer',
			'priority' => 80,
			'url' => '/workout?coach_prompt=reset',
			'due_at' => UserTime::mysql( $user_id ),
		];
	}

	private static function build_meal_logging_trigger( int $user_id, string $local_date, array $slot, \DateTimeImmutable $local_now ): ?array {
		$meal_type = sanitize_key( (string) ( $slot['meal_type'] ?? '' ) );
		if ( '' === $meal_type ) {
			return null;
		}

		$meal_label = sanitize_text_field( (string) ( $slot['label'] ?? ucfirst( $meal_type ) ) );
		$reason = sanitize_text_field( (string) ( $slot['reason'] ?? ( $meal_label . ' still missing' ) ) );
		$prompt = sanitize_textarea_field( (string) ( $slot['prompt'] ?? '' ) );
		$next_step = sanitize_text_field( (string) ( $slot['next_step'] ?? '' ) );
		$starter_prompt = sanitize_textarea_field( (string) ( $slot['starter_prompt'] ?? '' ) );
		$hour = max( 0, min( 23, (int) ( $slot['hour'] ?? (int) $local_now->format( 'G' ) ) ) );
		$due_at = sprintf( '%s %02d:00:00', $local_date, $hour );

		return [
			'prompt' => $prompt,
			'reason' => $reason,
			'next_step' => $next_step,
			'starter_prompt' => $starter_prompt,
			'commitment_key' => 'meal_' . $meal_type . '_' . $local_date,
			'queue_scope' => 'chat_drawer_latest',
			'source' => 'system_trigger',
			'trigger_type' => 'meal_' . $meal_type . '_nudge',
			'priority' => max( 0, (int) ( $slot['priority'] ?? 75 ) ),
			'url' => '/nutrition',
			'due_at' => $due_at,
		];
	}

	private static function build_balance_trigger( int $user_id ): ?array {
		$balance = self::get_recent_training_balance( $user_id );
		if ( empty( $balance['over_indexed'] ) || empty( $balance['under_indexed'] ) ) {
			return null;
		}

		$over = str_replace( '_', ' ', (string) $balance['over_indexed'] );
		$under = str_replace( '_', ' ', (string) $balance['under_indexed'] );
		return [
			'prompt' => 'You have leaned hard into ' . $over . ' lately. Want me to balance the week with a cleaner ' . $under . ' session?',
			'reason' => 'Training balance prompt',
			'next_step' => 'Shift the next session toward the underused pattern.',
			'starter_prompt' => 'Adjust my next workout to balance out what I have trained this week.',
			'commitment_key' => 'balance_' . gmdate( 'o-W' ) . '_' . sanitize_key( (string) $balance['under_indexed'] ),
			'source' => 'system_trigger',
			'trigger_type' => 'balance_prompt',
			'priority' => 65,
			'url' => '/workout?coach_prompt=balance',
			'due_at' => UserTime::mysql( $user_id ),
		];
	}

	private static function build_milestone_trigger( int $user_id ): ?array {
		$streak = self::count_workout_streak( $user_id );
		$week = self::get_weekly_schedule_status( $user_id );
		if ( $streak < 3 && (int) ( $week['sessions_this_week'] ?? 0 ) < 3 ) {
			return null;
		}

		$label = $streak >= 3 ? $streak . '-day workout streak' : (int) $week['sessions_this_week'] . ' sessions this week';
		return [
			'prompt' => 'You hit a real milestone: ' . $label . '. Want to build on that with the next session while the momentum is live?',
			'reason' => 'Milestone noticed',
			'next_step' => 'Keep the streak going with your next scheduled training block.',
			'starter_prompt' => 'Use my recent momentum and build the right next session.',
			'commitment_key' => 'milestone_' . gmdate( 'o-W' ),
			'source' => 'system_trigger',
			'trigger_type' => 'milestone',
			'priority' => 55,
			'url' => '/dashboard?coach_prompt=milestone',
			'due_at' => UserTime::mysql( $user_id ),
		];
	}

	private static function meal_follow_up_schedule(): array {
		return [
			[
				'meal_type' => 'breakfast',
				'label' => 'Breakfast',
				'hour' => 10,
				'priority' => 88,
				'reason' => 'Breakfast still missing',
				'prompt' => 'You have not logged breakfast yet. Want to get it in now before the day starts running away from you?',
				'next_step' => 'Open Nutrition and log breakfast in under a minute.',
				'starter_prompt' => 'Help me log breakfast fast and close the morning nutrition gap.',
			],
			[
				'meal_type' => 'lunch',
				'label' => 'Lunch',
				'hour' => 14,
				'priority' => 86,
				'reason' => 'Lunch still missing',
				'prompt' => 'No lunch is logged yet. Want to get lunch tracked before the afternoon slips by?',
				'next_step' => 'Open Nutrition and log lunch so the rest of today is easier to steer.',
				'starter_prompt' => 'Help me log lunch and tell me what gap is left for today.',
			],
			[
				'meal_type' => 'dinner',
				'label' => 'Dinner',
				'hour' => 19,
				'priority' => 84,
				'reason' => 'Dinner still missing',
				'prompt' => 'Dinner is not logged yet. Want to get it tracked now so tonight does not turn into guesswork?',
				'next_step' => 'Open Nutrition and lock dinner in while the details are still fresh.',
				'starter_prompt' => 'Help me log dinner and tighten up the rest of tonight.',
			],
		];
	}

	private static function get_typical_training_days( int $user_id ): array {
		global $wpdb;

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT DATE_FORMAT(session_date, '%%a') AS weekday_label, COUNT(*) AS total
			 FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1 AND session_date >= %s
			 GROUP BY weekday_label",
			$user_id,
			UserTime::days_ago( $user_id, 28 )
		), ARRAY_A );

		$days = [];
		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			if ( (int) ( $row['total'] ?? 0 ) >= 2 ) {
				$days[] = (string) ( $row['weekday_label'] ?? '' );
			}
		}

		return array_values( array_filter( $days ) );
	}

	private static function has_logged_meal_type_today( int $user_id, string $meal_type, string $local_date ): bool {
		global $wpdb;

		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*)
			 FROM {$wpdb->prefix}fit_meals
			 WHERE user_id = %d AND confirmed = 1 AND meal_type = %s AND DATE(meal_datetime) = %s",
			$user_id,
			$meal_type,
			$local_date
		) ) > 0;
	}

	private static function get_weekly_schedule_status( int $user_id ): array {
		global $wpdb;

		$today = UserTime::now( $user_id );
		$week_start = $today->modify( 'monday this week' )->format( 'Y-m-d' );
		$week_end = $today->modify( 'sunday this week' )->format( 'Y-m-d' );
		$weekday_index = (int) $today->format( 'N' );

		$raw_schedule = $wpdb->get_var( $wpdb->prepare(
			"SELECT preferred_workout_days_json FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d LIMIT 1",
			$user_id
		) );
		$schedule = json_decode( (string) $raw_schedule, true );
		$expected = 0;
		foreach ( is_array( $schedule ) ? $schedule : [] as $entry ) {
			$day_type = sanitize_key( (string) ( $entry['day_type'] ?? 'rest' ) );
			$day = sanitize_text_field( (string) ( $entry['day'] ?? '' ) );
			$day_order = [ 'Mon' => 1, 'Tue' => 2, 'Wed' => 3, 'Thu' => 4, 'Fri' => 5, 'Sat' => 6, 'Sun' => 7 ][ $day ] ?? 0;
			if ( $day_order > 0 && $day_order <= $weekday_index && 'rest' !== $day_type ) {
				$expected += 1;
			}
		}

		$sessions_this_week = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions WHERE user_id = %d AND completed = 1 AND session_date BETWEEN %s AND %s",
			$user_id,
			$week_start,
			$week_end
		) );

		return [
			'week_key' => $today->format( 'o-W' ),
			'expected_sessions_to_date' => $expected,
			'sessions_this_week' => $sessions_this_week,
			'missed_expected_sessions' => max( 0, $expected - $sessions_this_week ),
		];
	}

	private static function get_recent_training_balance( int $user_id ): array {
		global $wpdb;

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT COALESCE(NULLIF(actual_day_type, ''), planned_day_type) AS day_type, COUNT(*) AS total
			 FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1 AND session_date >= %s
			 GROUP BY day_type",
			$user_id,
			UserTime::days_ago( $user_id, 7 )
		), ARRAY_A );

		$counts = [];
		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$day_type = sanitize_key( (string) ( $row['day_type'] ?? '' ) );
			if ( '' !== $day_type && 'rest' !== $day_type ) {
				$counts[ $day_type ] = (int) ( $row['total'] ?? 0 );
			}
		}

		if ( empty( $counts ) ) {
			return [];
		}

		arsort( $counts );
		$over = array_key_first( $counts );
		$under = null;
		$candidate_day_types = self::get_training_balance_candidates( $user_id, array_keys( $counts ) );
		foreach ( $candidate_day_types as $candidate ) {
			if ( ! isset( $counts[ $candidate ] ) ) {
				$under = $candidate;
				break;
			}
		}
		if ( ! $under ) {
			$min = min( $counts );
			foreach ( $counts as $candidate => $total ) {
				if ( $total === $min ) {
					$under = $candidate;
					break;
				}
			}
		}

		if ( ! $over || ! $under || (int) ( $counts[ $over ] ?? 0 ) < 2 || $over === $under ) {
			return [];
		}

		return [
			'over_indexed' => $over,
			'under_indexed' => $under,
			'counts' => $counts,
		];
	}

	private static function get_training_balance_candidates( int $user_id, array $observed_day_types ): array {
		global $wpdb;

		$rows = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT utd.day_type
			 FROM {$wpdb->prefix}fit_user_training_days utd
			 JOIN {$wpdb->prefix}fit_user_training_plans utp ON utp.id = utd.training_plan_id
			 WHERE utp.user_id = %d
			   AND utp.active = 1
			   AND utd.day_type != 'rest'
			 ORDER BY utd.day_order ASC, utd.id ASC",
			$user_id
		) );

		$candidates = array_values( array_filter( array_map(
			static fn( $value ) => TrainingDayTypes::normalize( $value ),
			is_array( $rows ) ? $rows : []
		) ) );

		if ( empty( $candidates ) ) {
			$candidates = array_values( array_filter( array_map(
				static fn( string $value ): ?string => TrainingDayTypes::normalize( $value ),
				$observed_day_types
			) ) );
		}

		return ! empty( $candidates ) ? array_values( array_unique( $candidates ) ) : TrainingDayTypes::active();
	}

	private static function completed_workout_on_date( int $user_id, string $date ): bool {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions WHERE user_id = %d AND completed = 1 AND session_date = %s",
			$user_id,
			$date
		) ) > 0;
	}

	private static function count_workout_streak( int $user_id ): int {
		global $wpdb;
		$dates = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT session_date FROM {$wpdb->prefix}fit_workout_sessions WHERE user_id = %d AND completed = 1 ORDER BY session_date DESC LIMIT 21",
			$user_id
		) );

		$streak = 0;
		$cursor = UserTime::now( $user_id );
		$completed_dates = array_fill_keys( array_map( 'strval', is_array( $dates ) ? $dates : [] ), true );

		while ( $streak < 21 ) {
			$date_key = $cursor->format( 'Y-m-d' );
			if ( empty( $completed_dates[ $date_key ] ) ) {
				break;
			}
			$streak += 1;
			$cursor = $cursor->modify( '-1 day' );
		}

		return $streak;
	}

	private static function build_follow_up_title( array $follow_up ): string {
		$reason = sanitize_text_field( (string) ( $follow_up['reason'] ?? '' ) );
		return '' !== $reason ? 'Johnny: ' . $reason : 'Johnny checked in';
	}

	private static function build_follow_up_message( array $follow_up ): string {
		$prompt = trim( sanitize_textarea_field( (string) ( $follow_up['prompt'] ?? '' ) ) );
		$next_step = trim( sanitize_text_field( (string) ( $follow_up['next_step'] ?? '' ) ) );

		if ( '' !== $prompt && '' !== $next_step ) {
			return trim( $prompt . ' ' . $next_step );
		}

		return '' !== $prompt ? $prompt : ( $next_step ?: 'Johnny has a follow-up for you.' );
	}

	private static function normalize_follow_up_url( string $url ): string {
		$url = trim( $url );
		if ( '' === $url ) {
			$url = '/ai';
		}
		if ( ! str_starts_with( $url, '/' ) ) {
			$url = '/' . ltrim( $url, '/' );
		}

		return $url;
	}

	private static function normalize_hour( $value, int $fallback ): int {
		$hour = (int) $value;
		if ( $hour < 0 || $hour > 23 ) {
			return $fallback;
		}

		return $hour;
	}

	private static function sanitize_channel( string $channel ): string {
		return in_array( $channel, [ 'in_app', 'push', 'sms' ], true ) ? $channel : 'in_app';
	}

	private static function sanitize_status( string $status ): string {
		return in_array( $status, [ 'queued', 'sent', 'failed', 'suppressed', 'skipped' ], true ) ? $status : 'queued';
	}
}
