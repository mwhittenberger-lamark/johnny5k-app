<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

abstract class RestController {

	protected static function auth_callback(): array {
		return [ AuthController::class, 'require_auth' ];
	}

	protected static function response( mixed $data = null, int $status = 200 ): \WP_REST_Response {
		return new \WP_REST_Response( $data, $status );
	}

	protected static function message( string $message, int $status = 400, array $data = [] ): \WP_REST_Response {
		return self::response( array_merge( [ 'message' => $message ], $data ), $status );
	}
}
