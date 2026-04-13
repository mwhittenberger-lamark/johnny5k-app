<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class PushService {
	private const OPTION_KEY = 'jf_push_settings';

	public static function default_settings(): array {
		return [
			'enabled'           => 0,
			'vapid_public_key'  => '',
			'vapid_private_key' => '',
			'subject'           => 'mailto:support@johnny5k.app',
		];
	}

	public static function get_settings(): array {
		return self::sanitize_settings( get_option( self::OPTION_KEY, self::default_settings() ) );
	}

	public static function sanitize_settings( $settings ): array {
		$settings = is_array( $settings ) ? $settings : [];
		$defaults = self::default_settings();

		$public_key = preg_replace( '/\s+/', '', (string) ( $settings['vapid_public_key'] ?? '' ) );
		$private_key = preg_replace( '/\s+/', '', (string) ( $settings['vapid_private_key'] ?? '' ) );
		$subject = sanitize_text_field( (string) ( $settings['subject'] ?? $defaults['subject'] ) );

		return [
			'enabled'           => ! empty( $settings['enabled'] ) ? 1 : 0,
			'vapid_public_key'  => sanitize_text_field( $public_key ),
			'vapid_private_key' => sanitize_text_field( $private_key ),
			'subject'           => '' !== $subject ? $subject : $defaults['subject'],
		];
	}

	public static function get_public_config(): array {
		$settings = self::get_settings();

		return [
			'enabled'          => (bool) $settings['enabled'],
			'configured'       => self::is_configured( $settings ),
			'vapid_public_key' => (string) $settings['vapid_public_key'],
			'subject'          => (string) $settings['subject'],
		];
	}

	public static function is_configured( ?array $settings = null ): bool {
		$settings = is_array( $settings ) ? $settings : self::get_settings();

		return ! empty( $settings['enabled'] )
			&& '' !== trim( (string) ( $settings['vapid_public_key'] ?? '' ) )
			&& '' !== trim( (string) ( $settings['vapid_private_key'] ?? '' ) );
	}

	public static function can_deliver_to_user( int $user_id ): bool {
		return self::is_configured() && count( self::get_active_subscriptions( $user_id ) ) > 0;
	}

	public static function refresh_active_subscription_seen( int $user_id, array $payload ): bool {
		$endpoint = esc_url_raw( (string) ( $payload['endpoint'] ?? '' ) );
		if ( '' === $endpoint ) {
			return false;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'fit_push_subscriptions';

		$updated = $wpdb->update(
			$table,
			[
				'last_seen_at' => current_time( 'mysql', true ),
				'user_agent'   => self::current_user_agent(),
			],
			[
				'user_id'       => $user_id,
				'endpoint_hash' => hash( 'sha256', $endpoint ),
				'disabled_at'   => null,
			],
			[ '%s', '%s' ],
			[ '%d', '%s', '%s' ]
		);

		return false !== $updated;
	}

	public static function get_subscription_summary(): array {
		global $wpdb;
		$table = $wpdb->prefix . 'fit_push_subscriptions';

		return [
			'active_subscriptions' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE disabled_at IS NULL" ),
			'active_users' => (int) $wpdb->get_var( "SELECT COUNT(DISTINCT user_id) FROM {$table} WHERE disabled_at IS NULL" ),
			'disabled_subscriptions' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE disabled_at IS NOT NULL" ),
			'stale_active_subscriptions' => (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE disabled_at IS NULL AND last_seen_at < %s",
				gmdate( 'Y-m-d H:i:s', time() - ( 45 * DAY_IN_SECONDS ) )
			) ),
		];
	}

	public static function upsert_subscription( int $user_id, array $payload ): array|\WP_Error {
		global $wpdb;

		$subscription = self::normalize_subscription_payload( $payload );
		if ( is_wp_error( $subscription ) ) {
			return $subscription;
		}

		$table = $wpdb->prefix . 'fit_push_subscriptions';
		$now = current_time( 'mysql', true );
		$endpoint_hash = hash( 'sha256', (string) $subscription['endpoint'] );
		$conflicting_owner = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT user_id FROM {$table} WHERE endpoint_hash = %s AND user_id != %d LIMIT 1",
			$endpoint_hash,
			$user_id
		) );
		if ( $conflicting_owner > 0 ) {
			return new \WP_Error( 'push_subscription_conflict', 'This browser subscription is already linked to another account. Unsubscribe it before linking a new account.' );
		}

		$data = [
			'user_id'           => $user_id,
			'endpoint'          => (string) $subscription['endpoint'],
			'endpoint_hash'     => $endpoint_hash,
			'public_key'        => (string) $subscription['keys']['p256dh'],
			'auth_token'        => (string) $subscription['keys']['auth'],
			'content_encoding'  => sanitize_text_field( (string) ( $subscription['contentEncoding'] ?? 'aes128gcm' ) ),
			'expiration_time'   => null !== $subscription['expirationTime'] ? (int) $subscription['expirationTime'] : null,
			'user_agent'        => self::current_user_agent(),
			'subscription_json' => wp_json_encode( $subscription ),
			'last_seen_at'      => $now,
			'disabled_at'       => null,
		];

		$existing_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$table} WHERE user_id = %d AND endpoint_hash = %s LIMIT 1",
			$user_id,
			$endpoint_hash
		) );

		if ( $existing_id > 0 ) {
			$updated = $wpdb->update(
				$table,
				$data,
				[ 'id' => $existing_id ],
				[ '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s' ],
				[ '%d' ]
			);

			if ( false === $updated ) {
				return new \WP_Error( 'push_subscription_update_failed', 'Could not update the push subscription.' );
			}
		} else {
			$data['created_at'] = $now;
			$inserted = $wpdb->insert(
				$table,
				$data,
				[ '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s' ]
			);

			if ( false === $inserted ) {
				return new \WP_Error( 'push_subscription_create_failed', 'Could not save the push subscription.' );
			}
		}

		return self::find_subscription_by_endpoint_hash( $user_id, $endpoint_hash );
	}

	public static function delete_subscription( int $user_id, array $payload ): bool|\WP_Error {
		global $wpdb;

		$endpoint = esc_url_raw( (string) ( $payload['endpoint'] ?? '' ) );
		if ( '' === $endpoint ) {
			return new \WP_Error( 'missing_endpoint', 'A subscription endpoint is required.' );
		}

		$table = $wpdb->prefix . 'fit_push_subscriptions';
		$updated = $wpdb->update(
			$table,
			[
				'disabled_at'  => current_time( 'mysql', true ),
				'last_seen_at' => current_time( 'mysql', true ),
			],
			[
				'user_id'       => $user_id,
				'endpoint_hash' => hash( 'sha256', $endpoint ),
			],
			[ '%s', '%s' ],
			[ '%d', '%s' ]
		);

		if ( false === $updated ) {
			return new \WP_Error( 'push_subscription_delete_failed', 'Could not disable the push subscription.' );
		}

		return $updated > 0;
	}

	public static function list_user_subscriptions( int $user_id ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_push_subscriptions';
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, endpoint, endpoint_hash, content_encoding, user_agent, created_at, updated_at, last_seen_at, disabled_at
			 FROM {$table}
			 WHERE user_id = %d
			 ORDER BY updated_at DESC",
			$user_id
		), ARRAY_A );

		$subscriptions = array_map( [ __CLASS__, 'format_subscription_row' ], is_array( $rows ) ? $rows : [] );
		$active = array_values( array_filter( $subscriptions, static fn( array $row ): bool => empty( $row['disabled_at'] ) ) );

		return [
			'count'         => count( $subscriptions ),
			'active_count'  => count( $active ),
			'subscriptions' => $subscriptions,
		];
	}

	public static function get_active_subscriptions( int $user_id ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_push_subscriptions';
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT endpoint, public_key, auth_token, content_encoding, endpoint_hash
			 FROM {$table}
			 WHERE user_id = %d AND disabled_at IS NULL
			 ORDER BY updated_at DESC",
			$user_id
		), ARRAY_A );

		return array_values( array_filter( array_map( static function( $row ): array {
			if ( ! is_array( $row ) ) {
				return [];
			}

			$endpoint = esc_url_raw( (string) ( $row['endpoint'] ?? '' ) );
			$public_key = sanitize_text_field( (string) ( $row['public_key'] ?? '' ) );
			$auth_token = sanitize_text_field( (string) ( $row['auth_token'] ?? '' ) );
			if ( '' === $endpoint || '' === $public_key || '' === $auth_token ) {
				return [];
			}

			return [
				'endpoint'        => $endpoint,
				'contentEncoding' => sanitize_text_field( (string) ( $row['content_encoding'] ?? 'aes128gcm' ) ),
				'endpoint_hash'   => sanitize_text_field( (string) ( $row['endpoint_hash'] ?? '' ) ),
				'keys'            => [
					'p256dh' => $public_key,
					'auth'   => $auth_token,
				],
			];
		}, is_array( $rows ) ? $rows : [] ) ) );
	}

	public static function send_notification_to_user( int $user_id, string $title, string $body, string $url = '/dashboard', array $meta = [] ): array|\WP_Error {
		if ( ! self::is_configured() ) {
			return new \WP_Error( 'push_not_configured', 'Push notifications are not configured.' );
		}

		if ( ! class_exists( WebPush::class ) ) {
			return new \WP_Error( 'push_library_missing', 'The web-push library is not available in this environment.' );
		}

		$subscriptions = self::get_active_subscriptions( $user_id );
		if ( empty( $subscriptions ) ) {
			return new \WP_Error( 'push_subscription_missing', 'The user does not have an active push subscription.' );
		}

		$payload_url = self::append_tracking_query_args( $url, $meta );
		$payload = wp_json_encode( array_filter( [
			'title' => sanitize_text_field( $title ),
			'body'  => sanitize_textarea_field( $body ),
			'url'   => esc_url_raw( home_url( $payload_url ) ),
			'meta'  => is_array( $meta ) ? $meta : [],
		] ) );

		try {
			$web_push = new WebPush( [
				'VAPID' => [
					'subject'    => self::get_settings()['subject'],
					'publicKey'  => self::get_settings()['vapid_public_key'],
					'privateKey' => self::get_settings()['vapid_private_key'],
				],
			], [
				'TTL' => 300,
			], 20 );
			$web_push->setReuseVAPIDHeaders( true );
		} catch ( \Throwable $e ) {
			return new \WP_Error( 'push_init_failed', $e->getMessage() );
		}

		$reports = [];
		foreach ( $subscriptions as $subscription_data ) {
			try {
				$report = $web_push->sendOneNotification(
					Subscription::create( $subscription_data ),
					$payload,
					[ 'TTL' => 300 ]
				);
			} catch ( \Throwable $e ) {
				$report = null;
				CoachDeliveryService::log_delivery( $user_id, [
					'follow_up_id'     => sanitize_text_field( (string) ( $meta['follow_up_id'] ?? '' ) ),
					'channel'          => 'push',
					'delivery_type'    => sanitize_key( (string) ( $meta['type'] ?? 'push' ) ),
					'delivery_key'     => 'push_exception',
					'title'            => $title,
					'message_preview'  => $body,
					'payload'          => [ 'subscription' => $subscription_data, 'meta' => $meta ],
					'status'           => 'failed',
					'error_code'       => 'push_exception',
					'error_message'    => $e->getMessage(),
					'provider_message_id' => $subscription_data['endpoint_hash'] ?? '',
				] );
			}

			if ( $report ) {
				$status = $report->isSuccess() ? 'sent' : 'failed';
				if ( $report->isSubscriptionExpired() ) {
					self::disable_subscription_by_endpoint( $user_id, (string) ( $subscription_data['endpoint'] ?? '' ) );
				}

				CoachDeliveryService::log_delivery( $user_id, [
					'follow_up_id'       => sanitize_text_field( (string) ( $meta['follow_up_id'] ?? '' ) ),
					'channel'            => 'push',
					'delivery_type'      => sanitize_key( (string) ( $meta['type'] ?? 'push' ) ),
					'delivery_key'       => $report->isSubscriptionExpired() ? 'push_expired' : 'push_send',
					'title'              => $title,
					'message_preview'    => $body,
					'payload'            => [ 'meta' => $meta, 'report' => $report->jsonSerialize() ],
					'status'             => $status,
					'error_code'         => $status === 'failed' ? 'push_send_failed' : '',
					'error_message'      => $status === 'failed' ? $report->getReason() : '',
					'provider_message_id'=> $subscription_data['endpoint_hash'] ?? '',
				] );

				$reports[] = [
					'endpoint_hash' => $subscription_data['endpoint_hash'] ?? '',
					'success'       => $report->isSuccess(),
					'expired'       => $report->isSubscriptionExpired(),
					'reason'        => $report->getReason(),
				];
			}
		}

		$successes = count( array_filter( $reports, static fn( array $report ): bool => ! empty( $report['success'] ) ) );
		if ( 0 === $successes ) {
			return new \WP_Error( 'push_send_failed', 'Push send failed for all active subscriptions.' );
		}

		return [
			'user_id'        => $user_id,
			'success_count'  => $successes,
			'failure_count'  => count( $reports ) - $successes,
			'reports'        => $reports,
		];
	}

	public static function send_test_notification( int $user_id, string $title = '', string $body = '', string $url = '/dashboard' ): array|\WP_Error {
		$title = '' !== trim( $title ) ? $title : 'Johnny test push';
		$body  = '' !== trim( $body ) ? $body : 'This is a test notification from Johnny.';

		$result = self::send_notification_to_user( $user_id, $title, $body, $url, [
			'type' => 'test_push',
		] );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return [
			'user_id' => $user_id,
			'title'   => $title,
			'body'    => $body,
			'url'     => $url,
			'result'  => $result,
		];
	}

	public static function cleanup_disabled_subscriptions( int $days = 30 ): int {
		global $wpdb;

		$days = max( 1, $days );
		$threshold = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );

		return (int) $wpdb->query( $wpdb->prepare(
			"DELETE FROM {$wpdb->prefix}fit_push_subscriptions
			 WHERE disabled_at IS NOT NULL AND disabled_at < %s",
			$threshold
		) );
	}

	public static function cleanup_stale_active_subscriptions( int $days = 120 ): int {
		global $wpdb;

		$days = max( 7, $days );
		$threshold = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );

		return (int) $wpdb->query( $wpdb->prepare(
			"UPDATE {$wpdb->prefix}fit_push_subscriptions
			 SET disabled_at = %s
			 WHERE disabled_at IS NULL AND last_seen_at < %s",
			current_time( 'mysql', true ),
			$threshold
		) );
	}

	private static function normalize_subscription_payload( array $payload ): array|\WP_Error {
		$endpoint = esc_url_raw( (string) ( $payload['endpoint'] ?? '' ) );
		$keys = is_array( $payload['keys'] ?? null ) ? $payload['keys'] : [];
		$p256dh = sanitize_text_field( preg_replace( '/\s+/', '', (string) ( $keys['p256dh'] ?? '' ) ) );
		$auth = sanitize_text_field( preg_replace( '/\s+/', '', (string) ( $keys['auth'] ?? '' ) ) );

		if ( '' === $endpoint || '' === $p256dh || '' === $auth ) {
			return new \WP_Error( 'invalid_push_subscription', 'Subscription endpoint and keys are required.' );
		}

		$expiration_time = $payload['expirationTime'] ?? null;
		if ( null !== $expiration_time && ! is_numeric( $expiration_time ) ) {
			$expiration_time = null;
		}

		return [
			'endpoint'        => $endpoint,
			'expirationTime'  => null !== $expiration_time ? (int) $expiration_time : null,
			'contentEncoding' => sanitize_text_field( (string) ( $payload['contentEncoding'] ?? 'aes128gcm' ) ),
			'keys'            => [
				'p256dh' => $p256dh,
				'auth'   => $auth,
			],
		];
	}

	private static function find_subscription_by_endpoint_hash( int $user_id, string $endpoint_hash ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_push_subscriptions';
		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, endpoint, endpoint_hash, content_encoding, user_agent, created_at, updated_at, last_seen_at, disabled_at
			 FROM {$table}
			 WHERE user_id = %d AND endpoint_hash = %s
			 LIMIT 1",
			$user_id,
			$endpoint_hash
		), ARRAY_A );

		return self::format_subscription_row( is_array( $row ) ? $row : [] );
	}

	private static function format_subscription_row( array $row ): array {
		$endpoint = (string) ( $row['endpoint'] ?? '' );
		$preview = $endpoint;
		if ( strlen( $endpoint ) > 72 ) {
			$preview = substr( $endpoint, 0, 36 ) . '...' . substr( $endpoint, -24 );
		}

		return [
			'id'               => (int) ( $row['id'] ?? 0 ),
			'endpoint_hash'    => (string) ( $row['endpoint_hash'] ?? '' ),
			'endpoint_preview' => $preview,
			'content_encoding' => (string) ( $row['content_encoding'] ?? '' ),
			'user_agent'       => (string) ( $row['user_agent'] ?? '' ),
			'created_at'       => (string) ( $row['created_at'] ?? '' ),
			'updated_at'       => (string) ( $row['updated_at'] ?? '' ),
			'last_seen_at'     => (string) ( $row['last_seen_at'] ?? '' ),
			'disabled_at'      => (string) ( $row['disabled_at'] ?? '' ),
			'is_active'        => empty( $row['disabled_at'] ),
		];
	}

	private static function current_user_agent(): string {
		return isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['HTTP_USER_AGENT'] ) ) : '';
	}

	private static function disable_subscription_by_endpoint( int $user_id, string $endpoint ): void {
		if ( '' === $endpoint ) {
			return;
		}

		self::delete_subscription( $user_id, [ 'endpoint' => $endpoint ] );
	}

	private static function append_tracking_query_args( string $url, array $meta ): string {
		$path = trim( $url ) ?: '/dashboard';
		if ( ! str_starts_with( $path, '/' ) ) {
			$path = '/' . ltrim( $path, '/' );
		}

		$query = [];
		if ( ! empty( $meta['type'] ) ) {
			$query['coach_delivery'] = sanitize_key( (string) $meta['type'] );
		}
		if ( ! empty( $meta['follow_up_id'] ) ) {
			$query['follow_up_id'] = sanitize_text_field( (string) $meta['follow_up_id'] );
		}
		if ( ! empty( $meta['trigger_type'] ) ) {
			$query['trigger_type'] = sanitize_key( (string) $meta['trigger_type'] );
		}
		if ( ! empty( $meta['source'] ) ) {
			$query['coach_source'] = sanitize_key( (string) $meta['source'] );
		}

		return empty( $query ) ? $path : add_query_arg( $query, $path );
	}
}
