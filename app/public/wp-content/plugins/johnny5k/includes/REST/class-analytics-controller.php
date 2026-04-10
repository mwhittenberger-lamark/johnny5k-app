<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

/**
 * REST Controller: User behavior analytics tracking
 *
 * POST /fit/v1/analytics/event
 */
class AnalyticsController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/analytics/event', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'log_event' ],
			'permission_callback' => $auth,
		] );
	}

	public static function log_event( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'Authentication required.' ], 401 );
		}

		$event_name = sanitize_key( (string) $req->get_param( 'event_name' ) );
		if ( '' === $event_name ) {
			return new \WP_REST_Response( [ 'message' => 'event_name is required.' ], 400 );
		}

		$screen = sanitize_key( (string) $req->get_param( 'screen' ) );
		$context = sanitize_key( (string) $req->get_param( 'context' ) );
		$value_num = $req->get_param( 'value_num' );
		$metadata = $req->get_param( 'metadata' );

		if ( ! is_array( $metadata ) ) {
			$metadata = [];
		}

		$occurred_at = current_time( 'mysql', true );
		$data = [
			'user_id'       => $user_id,
			'event_name'    => substr( $event_name, 0, 100 ),
			'screen'        => '' !== $screen ? substr( $screen, 0, 100 ) : null,
			'context'       => '' !== $context ? substr( $context, 0, 100 ) : null,
			'value_num'     => is_numeric( $value_num ) ? (float) $value_num : null,
			'metadata_json' => ! empty( $metadata ) ? wp_json_encode( $metadata ) : null,
			'occurred_at'   => $occurred_at,
		];

		$inserted = $wpdb->insert( $wpdb->prefix . 'fit_behavior_events', $data );

		if ( false === $inserted ) {
			return new \WP_REST_Response( [ 'message' => 'Could not log analytics event.' ], 500 );
		}

		return new \WP_REST_Response( [
			'id' => (int) $wpdb->insert_id,
			'logged' => true,
		], 201 );
	}
}
