<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class AiMemoryService {

	private const DEFAULT_MODEL = 'gpt-4o-mini';
	private const DURABLE_MEMORY_META_KEY = 'jf_johnny_durable_memory';
	private const FOLLOW_UP_META_KEY = 'jf_johnny_follow_ups';
	private const FOLLOW_UP_HISTORY_META_KEY = 'jf_johnny_follow_up_history';
	private const MAX_PENDING_FOLLOW_UPS = 6;
	private const MAX_FOLLOW_UP_HISTORY_ITEMS = 30;
	private const MISSED_FOLLOW_UP_HOURS = 24;
	private const MAX_MEMORY_BULLETS = 8;
	private const MAX_PROFILE_ITEMS_PER_CATEGORY = 8;
	private const MEMORY_PROFILE_LABELS = [
		'preferred_workout_styles' => 'Preferred workout styles',
		'favorite_exercises'       => 'Favorite exercises',
		'disliked_exercises'       => 'Disliked exercises',
		'schedule_patterns'        => 'Schedule patterns',
		'motivation_triggers'      => 'Motivation triggers',
		'past_struggles'           => 'Past struggles',
		'milestones'               => 'Milestones',
		'personal_context'         => 'Personal context',
	];

	public static function format_durable_memory_block( int $user_id ): string {
		$memory        = self::get_durable_memory( $user_id );
		$bullets       = is_array( $memory['bullets'] ?? null ) ? $memory['bullets'] : [];
		$bullets       = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $bullets ) ) );
		$profile       = self::sanitize_memory_profile( $memory['profile'] ?? [] );
		$profile_lines = [];
		foreach ( self::MEMORY_PROFILE_LABELS as $key => $label ) {
			$items = array_slice( $profile[ $key ] ?? [], 0, 4 );
			if ( empty( $items ) ) {
				continue;
			}
			$profile_lines[] = sprintf( '%s: %s', $label, implode( ', ', $items ) );
		}

		$parts = [];
		if ( ! empty( $bullets ) ) {
			$parts[] = "Long-term coaching memory:\n- " . implode( "\n- ", array_slice( $bullets, 0, self::MAX_MEMORY_BULLETS ) );
		}
		if ( ! empty( $profile_lines ) ) {
			$parts[] = "Structured user memory:\n- " . implode( "\n- ", $profile_lines );
		}

		if ( empty( $parts ) ) {
			return '';
		}

		return "\n\n" . implode( "\n\n", $parts );
	}

	public static function format_follow_up_history_block( int $user_id ): string {
		$overview = self::get_follow_up_overview( $user_id );
		$parts    = [];

		if ( ! empty( $overview['overdue_items'] ) ) {
			$parts[] = 'Overdue commitments: ' . implode( '; ', array_map( static fn( array $item ): string => (string) ( $item['prompt'] ?? '' ), array_slice( $overview['overdue_items'], 0, 3 ) ) );
		}

		if ( ! empty( $overview['history'] ) ) {
			$history_lines = array_map( static function( array $item ): string {
				$state   = sanitize_text_field( (string) ( $item['state'] ?? '' ) );
				$prompt  = sanitize_text_field( (string) ( $item['prompt'] ?? '' ) );
				$changed = sanitize_text_field( (string) ( $item['changed_at'] ?? '' ) );
				return trim( $state . ': ' . $prompt . ( $changed ? ' (' . $changed . ')' : '' ) );
			}, array_slice( $overview['history'], 0, 4 ) );
			$history_lines = array_values( array_filter( $history_lines ) );
			if ( $history_lines ) {
				$parts[] = "Recent follow-up outcomes:\n- " . implode( "\n- ", $history_lines );
			}
		}

		if ( empty( $parts ) ) {
			return '';
		}

		return "\n\nJohnny follow-up history:\n" . implode( "\n", $parts );
	}

	public static function get_durable_memory( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::DURABLE_MEMORY_META_KEY, true );
		return self::normalize_durable_memory_payload( $stored );
	}

	public static function update_durable_memory( int $user_id, array $bullets, array $profile = [] ): array {
		$current = self::get_durable_memory( $user_id );
		$clean = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $bullets ) ) );
		$next_profile = self::merge_memory_profile(
			is_array( $current['profile'] ?? null ) ? $current['profile'] : [],
			self::sanitize_memory_profile( $profile )
		);

		$payload = [
			'bullets'    => array_slice( $clean, 0, self::MAX_MEMORY_BULLETS ),
			'profile'    => $next_profile,
			'updated_at' => current_time( 'mysql' ),
		];

		update_user_meta( $user_id, self::DURABLE_MEMORY_META_KEY, $payload );
		return $payload;
	}

	public static function get_follow_up_history( int $user_id ): array {
		$stored = get_user_meta( $user_id, self::FOLLOW_UP_HISTORY_META_KEY, true );
		$items  = is_array( $stored ) ? $stored : [];

		return array_values( array_filter( array_map( static function( $item ): array {
			if ( ! is_array( $item ) ) {
				return [];
			}

			return [
				'id'         => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
				'prompt'     => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
				'reason'     => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
				'state'      => sanitize_key( (string) ( $item['state'] ?? '' ) ),
				'changed_at' => sanitize_text_field( (string) ( $item['changed_at'] ?? '' ) ),
				'due_at'     => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
			];
		}, $items ), static fn( array $item ) => ! empty( $item['prompt'] ) && ! empty( $item['state'] ) ) );
	}

	public static function get_follow_up_overview( int $user_id ): array {
		$pending        = self::get_pending_follow_ups( $user_id );
		$history        = self::get_follow_up_history( $user_id );
		$now            = UserTime::mysql( $user_id );
		$cutoff         = UserTime::days_ago( $user_id, 13 );
		$overdue_items  = array_values( array_filter( $pending, static fn( array $item ): bool => ! empty( $item['due_at'] ) && (string) $item['due_at'] < $now ) );
		$missed_items   = array_values( array_filter( $pending, static fn( array $item ): bool => 'missed' === ( $item['status'] ?? '' ) ) );
		$recent_history = array_values( array_filter( $history, static fn( array $item ): bool => (string) ( $item['changed_at'] ?? '' ) >= $cutoff ) );
		$completed      = count( array_filter( $recent_history, static fn( array $item ): bool => 'completed' === ( $item['state'] ?? '' ) ) );
		$dismissed      = count( array_filter( $recent_history, static fn( array $item ): bool => 'dismissed' === ( $item['state'] ?? '' ) ) );
		$snoozed        = count( array_filter( $pending, static fn( array $item ): bool => 'snoozed' === ( $item['status'] ?? '' ) ) );

		usort( $history, static fn( array $left, array $right ): int => strcmp( (string) ( $right['changed_at'] ?? '' ), (string) ( $left['changed_at'] ?? '' ) ) );

		$recent_summary_parts = [];
		if ( $completed > 0 ) {
			$recent_summary_parts[] = $completed . ' completed';
		}
		if ( $dismissed > 0 ) {
			$recent_summary_parts[] = $dismissed . ' dismissed';
		}
		if ( count( $overdue_items ) > 0 ) {
			$recent_summary_parts[] = count( $overdue_items ) . ' overdue';
		}
		if ( count( $missed_items ) > 0 ) {
			$recent_summary_parts[] = count( $missed_items ) . ' missed';
		}

		return [
			'pending_count'             => count( $pending ),
			'snoozed_count'             => $snoozed,
			'overdue_count'             => count( $overdue_items ),
			'missed_count'              => count( $missed_items ),
			'completed_last_14_days'    => $completed,
			'dismissed_last_14_days'    => $dismissed,
			'recent_summary'            => implode( ', ', $recent_summary_parts ),
			'overdue_items'             => array_slice( $overdue_items, 0, 6 ),
			'missed_items'              => array_slice( $missed_items, 0, 6 ),
			'history'                   => array_slice( $history, 0, 10 ),
		];
	}

	public static function get_pending_follow_ups( int $user_id ): array {
		$stored            = get_user_meta( $user_id, self::FOLLOW_UP_META_KEY, true );
		$items             = is_array( $stored ) ? $stored : [];
		$missed_threshold  = self::get_missed_follow_up_threshold( $user_id );

		$clean = array_values( array_filter( array_map( static function( $item ) use ( $missed_threshold ): array {
			if ( ! is_array( $item ) ) {
				return [];
			}

			$status = sanitize_key( (string) ( $item['status'] ?? 'pending' ) );
			if ( in_array( $status, [ 'completed', 'dismissed' ], true ) ) {
				return [];
			}

			$due_at            = sanitize_text_field( (string) ( $item['due_at'] ?? '' ) );
			$normalized_status = in_array( $status, [ 'pending', 'snoozed' ], true ) ? $status : 'pending';
			if ( '' !== $due_at && $due_at < $missed_threshold ) {
				$normalized_status = 'missed';
			}

			return [
				'id'             => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
				'prompt'         => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
				'reason'         => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
				'next_step'      => sanitize_text_field( (string) ( $item['next_step'] ?? '' ) ),
				'starter_prompt' => sanitize_textarea_field( (string) ( $item['starter_prompt'] ?? '' ) ),
				'commitment_key' => sanitize_key( (string) ( $item['commitment_key'] ?? '' ) ),
				'source'         => sanitize_key( (string) ( $item['source'] ?? 'ai_queue' ) ),
				'trigger_type'   => sanitize_key( (string) ( $item['trigger_type'] ?? '' ) ),
				'priority'       => max( 0, (int) ( $item['priority'] ?? 0 ) ),
				'url'            => sanitize_text_field( (string) ( $item['url'] ?? '' ) ),
				'last_delivery_channel' => sanitize_key( (string) ( $item['last_delivery_channel'] ?? '' ) ),
				'last_delivery_status'  => sanitize_key( (string) ( $item['last_delivery_status'] ?? '' ) ),
				'last_delivery_at'      => sanitize_text_field( (string) ( $item['last_delivery_at'] ?? '' ) ),
				'delivered_count'       => (int) ( $item['delivered_count'] ?? 0 ),
				'due_at'         => $due_at,
				'status'         => $normalized_status,
				'created_at'     => sanitize_text_field( (string) ( $item['created_at'] ?? '' ) ),
			];
		}, $items ), static fn( array $item ) => ! empty( $item['id'] ) && ! empty( $item['prompt'] ) ) );

		usort( $clean, static function( array $left, array $right ): int {
			$left_due  = (string) ( $left['due_at'] ?? '' );
			$right_due = (string) ( $right['due_at'] ?? '' );
			if ( '' === $left_due && '' === $right_due ) {
				return strcmp( (string) ( $left['created_at'] ?? '' ), (string) ( $right['created_at'] ?? '' ) );
			}
			if ( '' === $left_due ) {
				return 1;
			}
			if ( '' === $right_due ) {
				return -1;
			}

			return strcmp( $left_due, $right_due );
		} );

		return $clean;
	}

	public static function update_follow_up_state( int $user_id, string $follow_up_id, string $state, string $due_at = '' ): ?array {
		$follow_up_id = sanitize_text_field( $follow_up_id );
		$state        = sanitize_key( $state );
		if ( '' === $follow_up_id || ! in_array( $state, [ 'pending', 'snoozed', 'completed', 'dismissed' ], true ) ) {
			return null;
		}

		$stored  = get_user_meta( $user_id, self::FOLLOW_UP_META_KEY, true );
		$current = is_array( $stored ) ? $stored : [];
		$updated = null;
		$next    = [];

		foreach ( $current as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			if ( sanitize_text_field( (string) ( $item['id'] ?? '' ) ) !== $follow_up_id ) {
				$next[] = $item;
				continue;
			}

			if ( in_array( $state, [ 'completed', 'dismissed' ], true ) ) {
				self::record_follow_up_event( $user_id, [
					'id'         => $follow_up_id,
					'prompt'     => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
					'reason'     => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
					'state'      => $state,
					'changed_at' => current_time( 'mysql' ),
					'due_at'     => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
				] );
				$updated = [ 'id' => $follow_up_id, 'status' => $state ];
				continue;
			}

			$item['status'] = $state;
			$item['due_at'] = 'snoozed' === $state ? sanitize_text_field( $due_at ) : '';
			$next[]         = $item;

			self::record_follow_up_event( $user_id, [
				'id'         => $follow_up_id,
				'prompt'     => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
				'reason'     => sanitize_text_field( (string) ( $item['reason'] ?? '' ) ),
				'state'      => $state,
				'changed_at' => current_time( 'mysql' ),
				'due_at'     => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
			] );
			$updated = [
				'id'     => $follow_up_id,
				'status' => $state,
				'due_at' => sanitize_text_field( (string) ( $item['due_at'] ?? '' ) ),
			];
		}

		update_user_meta( $user_id, self::FOLLOW_UP_META_KEY, array_values( $next ) );
		return $updated;
	}

	public static function dismiss_follow_up( int $user_id, string $follow_up_id ): bool {
		return null !== self::update_follow_up_state( $user_id, $follow_up_id, 'dismissed' );
	}

	/**
	 * @param string[]       $context_lines
	 * @param callable       $openai_caller function(array $messages, string $model): array|\WP_Error
	 */
	public static function refresh_durable_memory( int $user_id, string $thread_summary, array $context_lines, callable $openai_caller, string $model = self::DEFAULT_MODEL ): void {
		$thread_summary = trim( $thread_summary );
		if ( '' === $thread_summary ) {
			return;
		}

		$current_memory   = self::get_durable_memory( $user_id );
		$current_bullets  = is_array( $current_memory['bullets'] ?? null ) ? $current_memory['bullets'] : [];
		$current_profile  = self::sanitize_memory_profile( $current_memory['profile'] ?? [] );
		$current_lines    = array_map( static fn( $item ) => '- ' . sanitize_text_field( (string) $item ), $current_bullets );
		$profile_snapshot = self::build_profile_snapshot_lines( $current_profile );
		$prompt_messages = [
			[
				'role'    => 'system',
				'content' => 'You maintain long-term coaching memory for a fitness app. Return only valid JSON with shape {"bullets":["..."],"profile":{"preferred_workout_styles":[],"favorite_exercises":[],"disliked_exercises":[],"schedule_patterns":[],"motivation_triggers":[],"past_struggles":[],"milestones":[],"personal_context":[]}}. Keep bullets to 4-8 concise factual points. For profile categories, keep only durable, user-specific signals that remain useful across future chats. Do not invent details.',
			],
			[
				'role'    => 'user',
				'content' => "Current durable memory:\n" . implode( "\n", $current_lines ) . "\n\nCurrent structured profile memory:\n" . implode( "\n", $profile_snapshot ) . "\n\nFresh thread summary:\n" . $thread_summary . "\n\nCurrent user context:\n" . implode( "\n", $context_lines ),
			],
		];

		$result = $openai_caller( $prompt_messages, $model );
		if ( is_wp_error( $result ) ) {
			return;
		}

		$parsed  = self::decode_json_reply( (string) ( $result['reply'] ?? '' ) );
		$bullets = is_array( $parsed['bullets'] ?? null ) ? $parsed['bullets'] : [];
		$bullets = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $bullets ) ) );
		$profile = self::sanitize_memory_profile( is_array( $parsed['profile'] ?? null ) ? $parsed['profile'] : [] );
		if ( empty( $bullets ) && self::is_memory_profile_empty( $profile ) ) {
			return;
		}

		$next_profile = self::merge_memory_profile( $current_profile, $profile );
		$next_bullets = ! empty( $bullets ) ? array_slice( $bullets, 0, self::MAX_MEMORY_BULLETS ) : $current_bullets;

		update_user_meta( $user_id, self::DURABLE_MEMORY_META_KEY, [
			'bullets'    => $next_bullets,
			'profile'    => $next_profile,
			'updated_at' => current_time( 'mysql' ),
		] );
	}

	public static function store_queued_follow_ups( int $user_id, array $actions ): array {
		$current = self::get_pending_follow_ups( $user_id );
		$index   = [];
		foreach ( $current as $item ) {
			$key = strtolower( trim( (string) ( $item['prompt'] ?? '' ) ) );
			if ( '' !== $key ) {
				$index[ $key ] = $item;
			}
		}

		$created = [];
		foreach ( $actions as $action ) {
			if ( ! is_array( $action ) || 'queue_follow_up' !== ( $action['type'] ?? '' ) ) {
				continue;
			}

			$payload = is_array( $action['payload'] ?? null ) ? $action['payload'] : [];
			$prompt  = sanitize_textarea_field( (string) ( $payload['prompt'] ?? '' ) );
			$reason  = sanitize_text_field( (string) ( $payload['reason'] ?? '' ) );
			$key     = strtolower( trim( $prompt ) );
			if ( '' === $key || isset( $index[ $key ] ) ) {
				continue;
			}

			$due_at = sanitize_text_field( (string) ( $payload['due_at'] ?? '' ) );
			$item   = [
				'id'             => wp_generate_uuid4(),
				'prompt'         => $prompt,
				'reason'         => $reason,
				'next_step'      => sanitize_text_field( (string) ( $payload['next_step'] ?? '' ) ),
				'starter_prompt' => sanitize_textarea_field( (string) ( $payload['starter_prompt'] ?? '' ) ),
				'commitment_key' => sanitize_key( (string) ( $payload['commitment_key'] ?? '' ) ),
				'source'         => sanitize_key( (string) ( $payload['source'] ?? 'ai_queue' ) ) ?: 'ai_queue',
				'trigger_type'   => sanitize_key( (string) ( $payload['trigger_type'] ?? '' ) ),
				'priority'       => max( 0, (int) ( $payload['priority'] ?? 0 ) ),
				'url'            => sanitize_text_field( (string) ( $payload['url'] ?? '' ) ),
				'last_delivery_channel' => '',
				'last_delivery_status'  => '',
				'last_delivery_at'      => '',
				'delivered_count'       => 0,
				'due_at'         => $due_at,
				'status'         => '' !== $due_at ? 'snoozed' : 'pending',
				'created_at'     => current_time( 'mysql' ),
			];
			$current[]     = $item;
			$index[ $key ] = $item;
			$created[]     = $item;
		}

		if ( count( $current ) > self::MAX_PENDING_FOLLOW_UPS ) {
			$current = array_slice( $current, -self::MAX_PENDING_FOLLOW_UPS );
		}

		update_user_meta( $user_id, self::FOLLOW_UP_META_KEY, array_values( $current ) );
		return $created;
	}

	public static function queue_follow_up_item( int $user_id, array $payload ): ?array {
		$prompt = sanitize_textarea_field( (string) ( $payload['prompt'] ?? '' ) );
		if ( '' === trim( $prompt ) ) {
			return null;
		}

		$created = self::store_queued_follow_ups( $user_id, [
			[
				'type'    => 'queue_follow_up',
				'payload' => $payload,
			],
		] );

		return $created[0] ?? null;
	}

	public static function mark_follow_up_delivery( int $user_id, string $follow_up_id, string $channel, string $status ): bool {
		$follow_up_id = sanitize_text_field( $follow_up_id );
		if ( '' === $follow_up_id ) {
			return false;
		}

		$stored  = get_user_meta( $user_id, self::FOLLOW_UP_META_KEY, true );
		$current = is_array( $stored ) ? $stored : [];
		$updated = false;

		foreach ( $current as &$item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			if ( sanitize_text_field( (string) ( $item['id'] ?? '' ) ) !== $follow_up_id ) {
				continue;
			}

			$item['last_delivery_channel'] = sanitize_key( $channel );
			$item['last_delivery_status']  = sanitize_key( $status );
			$item['last_delivery_at']      = current_time( 'mysql', true );
			$item['delivered_count']       = max( 0, (int) ( $item['delivered_count'] ?? 0 ) ) + 1;
			$updated = true;
			break;
		}
		unset( $item );

		if ( $updated ) {
			update_user_meta( $user_id, self::FOLLOW_UP_META_KEY, array_values( $current ) );
		}

		return $updated;
	}

	private static function record_follow_up_event( int $user_id, array $event ): void {
		$history   = self::get_follow_up_history( $user_id );
		$history[] = [
			'id'         => sanitize_text_field( (string) ( $event['id'] ?? wp_generate_uuid4() ) ),
			'prompt'     => sanitize_textarea_field( (string) ( $event['prompt'] ?? '' ) ),
			'reason'     => sanitize_text_field( (string) ( $event['reason'] ?? '' ) ),
			'state'      => sanitize_key( (string) ( $event['state'] ?? '' ) ),
			'changed_at' => sanitize_text_field( (string) ( $event['changed_at'] ?? current_time( 'mysql' ) ) ),
			'due_at'     => sanitize_text_field( (string) ( $event['due_at'] ?? '' ) ),
		];

		usort( $history, static fn( array $left, array $right ): int => strcmp( (string) ( $right['changed_at'] ?? '' ), (string) ( $left['changed_at'] ?? '' ) ) );
		update_user_meta( $user_id, self::FOLLOW_UP_HISTORY_META_KEY, array_slice( $history, 0, self::MAX_FOLLOW_UP_HISTORY_ITEMS ) );
	}

	private static function get_missed_follow_up_threshold( int $user_id ): string {
		$hours = max( 1, self::MISSED_FOLLOW_UP_HOURS );

		try {
			$now = new \DateTimeImmutable( UserTime::mysql( $user_id ), UserTime::timezone( $user_id ) );
			return $now->modify( '-' . $hours . ' hours' )->format( 'Y-m-d H:i:s' );
		} catch ( \Exception $e ) {
			return UserTime::days_ago( $user_id, 1 );
		}
	}

	private static function decode_json_reply( string $reply ): ?array {
		$reply = trim( $reply );
		if ( '' === $reply ) {
			return null;
		}

		$parsed = json_decode( $reply, true );
		if ( is_array( $parsed ) ) {
			return $parsed;
		}

		if ( preg_match( '/```(?:json)?\s*(\{.*\}|\[.*\])\s*```/si', $reply, $matches ) ) {
			$decoded = json_decode( $matches[1], true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}

		if ( preg_match( '/(\{(?:[^{}]|(?R))*\}|\[(?:[^\[\]]|(?R))*\])/s', $reply, $matches ) ) {
			$decoded = json_decode( $matches[1], true );
			if ( is_array( $decoded ) ) {
				return $decoded;
			}
		}

		return null;
	}

	private static function normalize_durable_memory_payload( $stored ): array {
		$payload = is_array( $stored ) ? $stored : [];
		$bullets = is_array( $payload['bullets'] ?? null ) ? $payload['bullets'] : [];
		$bullets = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $bullets ) ) );

		return [
			'bullets'    => array_slice( $bullets, 0, self::MAX_MEMORY_BULLETS ),
			'profile'    => self::sanitize_memory_profile( $payload['profile'] ?? [] ),
			'updated_at' => sanitize_text_field( (string) ( $payload['updated_at'] ?? '' ) ),
		];
	}

	private static function sanitize_memory_profile( $profile ): array {
		$source = is_array( $profile ) ? $profile : [];
		$clean  = [];
		foreach ( self::MEMORY_PROFILE_LABELS as $key => $_label ) {
			$items = is_array( $source[ $key ] ?? null ) ? $source[ $key ] : [];
			$items = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $items ) ) );
			$clean[ $key ] = array_slice( array_values( array_unique( $items ) ), 0, self::MAX_PROFILE_ITEMS_PER_CATEGORY );
		}

		return $clean;
	}

	private static function merge_memory_profile( array $current, array $incoming ): array {
		$merged = [];
		foreach ( self::MEMORY_PROFILE_LABELS as $key => $_label ) {
			$current_items  = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $current[ $key ] ?? [] ) ) ) );
			$incoming_items = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $incoming[ $key ] ?? [] ) ) ) );
			$merged[ $key ] = array_slice(
				! empty( $incoming_items ) ? array_values( array_unique( $incoming_items ) ) : array_values( array_unique( $current_items ) ),
				0,
				self::MAX_PROFILE_ITEMS_PER_CATEGORY
			);
		}

		return $merged;
	}

	private static function is_memory_profile_empty( array $profile ): bool {
		foreach ( self::MEMORY_PROFILE_LABELS as $key => $_label ) {
			if ( ! empty( $profile[ $key ] ) ) {
				return false;
			}
		}

		return true;
	}

	private static function build_profile_snapshot_lines( array $profile ): array {
		$lines = [];
		foreach ( self::MEMORY_PROFILE_LABELS as $key => $label ) {
			$items = array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $profile[ $key ] ?? [] ) ) ) );
			$lines[] = sprintf( '- %s: %s', $label, ! empty( $items ) ? implode( ', ', $items ) : '(none)' );
		}

		return $lines;
	}
}
