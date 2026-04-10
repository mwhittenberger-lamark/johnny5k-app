<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Server-side behavior analytics logging.
 * Non-blocking by design: write failures should never break user flows.
 */
class BehaviorAnalyticsService {

	public static function track(
		int $user_id,
		string $event_name,
		string $screen = '',
		string $context = '',
		?float $value_num = null,
		array $metadata = []
	): bool {
		if ( $user_id <= 0 ) {
			return false;
		}

		$event_name = sanitize_key( $event_name );
		if ( '' === $event_name ) {
			return false;
		}

		global $wpdb;
		$inserted = $wpdb->insert(
			$wpdb->prefix . 'fit_behavior_events',
			[
				'user_id'       => $user_id,
				'event_name'    => substr( $event_name, 0, 100 ),
				'screen'        => '' !== $screen ? substr( sanitize_key( $screen ), 0, 100 ) : null,
				'context'       => '' !== $context ? substr( sanitize_key( $context ), 0, 100 ) : null,
				'value_num'     => null !== $value_num ? (float) $value_num : null,
				'metadata_json' => ! empty( $metadata ) ? wp_json_encode( $metadata ) : null,
				'occurred_at'   => current_time( 'mysql', true ),
			]
		);

		return false !== $inserted;
	}
}
