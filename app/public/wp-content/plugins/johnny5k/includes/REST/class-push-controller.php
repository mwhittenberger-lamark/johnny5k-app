<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\PushService;

class PushController {
	public static function register_routes(): void {
		$ns = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/push/config', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'config' ],
			'permission_callback' => '__return_true',
		] );

		register_rest_route( $ns, '/push/subscriptions', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'list_subscriptions' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'subscribe' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/push/subscriptions/unsubscribe', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'unsubscribe' ],
			'permission_callback' => $auth,
		] );
	}

	public static function config( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'push' => PushService::get_public_config(),
		], 200 );
	}

	public static function list_subscriptions( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( PushService::list_user_subscriptions( get_current_user_id() ), 200 );
	}

	public static function subscribe( \WP_REST_Request $req ): \WP_REST_Response {
		$result = PushService::upsert_subscription( get_current_user_id(), (array) $req->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [
			'saved'        => true,
			'subscription' => $result,
		], 201 );
	}

	public static function unsubscribe( \WP_REST_Request $req ): \WP_REST_Response {
		$result = PushService::delete_subscription( get_current_user_id(), (array) $req->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [
			'disabled' => (bool) $result,
		], 200 );
	}
}
