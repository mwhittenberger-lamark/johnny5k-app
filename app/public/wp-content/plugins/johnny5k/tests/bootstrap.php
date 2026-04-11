<?php

declare(strict_types=1);

define( 'ABSPATH', dirname( __DIR__ ) . '/' );
define( 'JF_REST_NAMESPACE', 'fit/v1' );

if ( ! defined( 'JF_PLUGIN_URL' ) ) {
	define( 'JF_PLUGIN_URL', 'https://example.test/wp-content/plugins/johnny5k/' );
}

if ( ! defined( 'OBJECT' ) ) {
	define( 'OBJECT', 'OBJECT' );
}

if ( ! defined( 'ARRAY_A' ) ) {
	define( 'ARRAY_A', 'ARRAY_A' );
}

if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {
		public function __construct(
			public string $code = '',
			public string $message = '',
			public array $data = []
		) {}

		public function get_error_message(): string {
			return $this->message;
		}

		public function get_error_code(): string {
			return $this->code;
		}

		public function get_error_data(): array {
			return $this->data;
		}
	}
}

if ( ! class_exists( 'WP_User' ) ) {
	class WP_User {
		public function __construct(
			public int $ID = 0,
			public string $user_email = '',
			public string $user_login = '',
			public array $caps = [],
			public string $plain_password = ''
		) {}
	}
}

if ( ! class_exists( 'WP_REST_Request' ) ) {
	class WP_REST_Request {
		private array $params = [];

		public function __construct(
			public string $method = 'GET',
			public string $route = '/'
		) {}

		public function get_param( string $key ): mixed {
			return $this->params[ $key ] ?? null;
		}

		public function set_param( string $key, mixed $value ): void {
			$this->params[ $key ] = $value;
		}

		public function get_params(): array {
			return $this->params;
		}

		public function get_json_params(): array {
			return $this->params;
		}

		public function get_file_params(): array {
			return [];
		}
	}
}

if ( ! class_exists( 'WP_REST_Response' ) ) {
	class WP_REST_Response {
		public function __construct(
			private mixed $data = null,
			private int $status = 200
		) {}

		public function get_data(): mixed {
			return $this->data;
		}

		public function get_status(): int {
			return $this->status;
		}
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	function is_wp_error( mixed $thing ): bool {
		return $thing instanceof WP_Error;
	}
}

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( mixed $value ): string {
		return trim( strip_tags( (string) $value ) );
	}
}

if ( ! function_exists( 'sanitize_email' ) ) {
	function sanitize_email( mixed $value ): string {
		return strtolower( trim( (string) $value ) );
	}
}

if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( mixed $value ): string {
		return trim( strip_tags( (string) $value ) );
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( mixed $value ): string {
		$value = strtolower( (string) $value );
		return preg_replace( '/[^a-z0-9_\-]/', '', $value ) ?? '';
	}
}

if ( ! function_exists( 'sanitize_user' ) ) {
	function sanitize_user( mixed $value ): string {
		return preg_replace( '/[^a-z0-9_\-@.]/i', '', (string) $value ) ?? '';
	}
}

if ( ! function_exists( 'is_email' ) ) {
	function is_email( mixed $value ): bool {
		return false !== filter_var( (string) $value, FILTER_VALIDATE_EMAIL );
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( string $value ): string {
		return strip_tags( $value );
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( mixed $value ): string|false {
		return json_encode( $value );
	}
}

if ( ! function_exists( 'wp_timezone_string' ) ) {
	function wp_timezone_string(): string {
		return 'UTC';
	}
}

if ( ! function_exists( 'current_time' ) ) {
	function current_time( string $type, bool $gmt = false ): string {
		return '2026-04-09 12:00:00';
	}
}

if ( ! function_exists( '__return_true' ) ) {
	function __return_true(): bool {
		return true;
	}
}

if ( ! function_exists( 'rest_sanitize_boolean' ) ) {
	function rest_sanitize_boolean( mixed $value ): bool {
		if ( is_bool( $value ) ) {
			return $value;
		}

		$normalized = strtolower( trim( (string) $value ) );
		return in_array( $normalized, [ '1', 'true', 'yes', 'on' ], true );
	}
}

if ( ! function_exists( 'register_rest_route' ) ) {
	function register_rest_route( string $namespace, string $route, array $args ): bool {
		return true;
	}
}

if ( ! function_exists( 'esc_sql' ) ) {
	function esc_sql( string $value ): string {
		return $value;
	}
}

if ( ! function_exists( 'is_ssl' ) ) {
	function is_ssl(): bool {
		return false;
	}
}

if ( ! function_exists( 'get_user_meta' ) ) {
	function get_user_meta( int $user_id, string $key, bool $single = false ): mixed {
		$store = $GLOBALS['johnny5k_test_user_meta'] ?? [];
		return $store[ $user_id ][ $key ] ?? ( $single ? '' : [] );
	}
}

if ( ! function_exists( 'update_user_meta' ) ) {
	function update_user_meta( int $user_id, string $key, mixed $value ): bool {
		$GLOBALS['johnny5k_test_user_meta'][ $user_id ][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( string $key, mixed $default = false ): mixed {
		return $GLOBALS['johnny5k_test_options'][ $key ] ?? $default;
	}
}

if ( ! function_exists( 'update_option' ) ) {
	function update_option( string $key, mixed $value ): bool {
		$GLOBALS['johnny5k_test_options'][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'delete_option' ) ) {
	function delete_option( string $key ): bool {
		unset( $GLOBALS['johnny5k_test_options'][ $key ] );
		return true;
	}
}

if ( ! function_exists( 'get_transient' ) ) {
	function get_transient( string $key ): mixed {
		return $GLOBALS['johnny5k_test_transients'][ $key ] ?? false;
	}
}

if ( ! function_exists( 'set_transient' ) ) {
	function set_transient( string $key, mixed $value, int $expiration = 0 ): bool {
		$GLOBALS['johnny5k_test_transients'][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'delete_transient' ) ) {
	function delete_transient( string $key ): bool {
		unset( $GLOBALS['johnny5k_test_transients'][ $key ] );
		return true;
	}
}

if ( ! function_exists( 'delete_user_meta' ) ) {
	function delete_user_meta( int $user_id, string $key ): bool {
		unset( $GLOBALS['johnny5k_test_user_meta'][ $user_id ][ $key ] );
		return true;
	}
}

if ( ! function_exists( 'wp_schedule_single_event' ) ) {
	function wp_schedule_single_event( int $timestamp, string $hook, array $args = [] ): bool {
		$GLOBALS['johnny5k_test_scheduled_events'][] = [
			'timestamp' => $timestamp,
			'hook' => $hook,
			'args' => $args,
		];
		return true;
	}
}

if ( ! function_exists( 'wp_next_scheduled' ) ) {
	function wp_next_scheduled( string $hook, array $args = [] ): int|false {
		foreach ( $GLOBALS['johnny5k_test_scheduled_events'] ?? [] as $event ) {
			if ( $event['hook'] === $hook && $event['args'] === $args ) {
				return (int) $event['timestamp'];
			}
		}

		return false;
	}
}

if ( ! function_exists( 'wp_unschedule_event' ) ) {
	function wp_unschedule_event( int $timestamp, string $hook, array $args = [] ): bool {
		$events = $GLOBALS['johnny5k_test_scheduled_events'] ?? [];
		foreach ( $events as $index => $event ) {
			if ( (int) $event['timestamp'] === $timestamp && $event['hook'] === $hook && $event['args'] === $args ) {
				unset( $events[ $index ] );
				$GLOBALS['johnny5k_test_scheduled_events'] = array_values( $events );
				return true;
			}
		}

		return false;
	}
}

if ( ! function_exists( 'do_action' ) ) {
	function do_action( string $hook, mixed ...$args ): void {
		$GLOBALS['johnny5k_test_actions'][] = [
			'hook' => $hook,
			'args' => $args,
		];
	}
}

if ( ! function_exists( 'get_current_user_id' ) ) {
	function get_current_user_id(): int {
		return (int) ( $GLOBALS['johnny5k_test_current_user_id'] ?? 0 );
	}
}

if ( ! function_exists( 'wp_get_current_user' ) ) {
	function wp_get_current_user(): WP_User {
		$user_id = get_current_user_id();
		$users = $GLOBALS['johnny5k_test_users'] ?? [];
		return $users[ $user_id ] ?? new WP_User();
	}
}

if ( ! function_exists( 'wp_set_current_user' ) ) {
	function wp_set_current_user( int $user_id ): void {
		$GLOBALS['johnny5k_test_current_user_id'] = $user_id;
	}
}

if ( ! function_exists( 'is_user_logged_in' ) ) {
	function is_user_logged_in(): bool {
		return get_current_user_id() > 0;
	}
}

if ( ! function_exists( 'wp_set_auth_cookie' ) ) {
	function wp_set_auth_cookie( int $user_id, bool $remember = false, bool $secure = false ): void {
		$GLOBALS['johnny5k_test_auth_cookie'] = [
			'user_id' => $user_id,
			'remember' => $remember,
			'secure' => $secure,
		];
	}
}

if ( ! function_exists( 'wp_clear_auth_cookie' ) ) {
	function wp_clear_auth_cookie(): void {
		unset( $GLOBALS['johnny5k_test_auth_cookie'] );
	}
}

if ( ! function_exists( 'wp_logout' ) ) {
	function wp_logout(): void {
		wp_set_current_user( 0 );
		wp_clear_auth_cookie();
	}
}

if ( ! function_exists( 'email_exists' ) ) {
	function email_exists( string $email ): int|false {
		foreach ( $GLOBALS['johnny5k_test_users'] ?? [] as $user ) {
			if ( strtolower( $user->user_email ) === strtolower( $email ) ) {
				return $user->ID;
			}
		}

		return false;
	}
}

if ( ! function_exists( 'wp_generate_password' ) ) {
	function wp_generate_password( int $length = 12, bool $special_chars = true ): string {
		return str_repeat( 'x', $length );
	}
}

if ( ! function_exists( 'wp_insert_user' ) ) {
	function wp_insert_user( array $userdata ): int {
		$users = $GLOBALS['johnny5k_test_users'] ?? [];
		$user_id = (int) ( $GLOBALS['johnny5k_test_next_user_id'] ?? 100 );
		$GLOBALS['johnny5k_test_next_user_id'] = $user_id + 1;

		$user = new WP_User(
			$user_id,
			(string) ( $userdata['user_email'] ?? '' ),
			(string) ( $userdata['user_login'] ?? '' ),
			( 'administrator' === ( $userdata['role'] ?? '' ) ) ? [ 'manage_options' => true ] : []
		);
		$user->plain_password = (string) ( $userdata['user_pass'] ?? '' );

		$users[ $user_id ] = $user;
		$GLOBALS['johnny5k_test_users'] = $users;

		return $user_id;
	}
}

if ( ! function_exists( 'wp_generate_uuid4' ) ) {
	function wp_generate_uuid4(): string {
		return '00000000-0000-4000-8000-000000000000';
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( string $value ): string {
		return trim( $value );
	}
}

if ( ! function_exists( 'wp_remote_post' ) ) {
	function wp_remote_post( string $url, array $args = [] ): mixed {
		$queue = &$GLOBALS['johnny5k_test_http']['post'];
		if ( empty( $queue ) ) {
			return new WP_Error( 'missing_http_stub', 'No stubbed wp_remote_post response available.' );
		}

		return array_shift( $queue );
	}
}

if ( ! function_exists( 'wp_remote_request' ) ) {
	function wp_remote_request( string $url, array $args = [] ): mixed {
		$queue = &$GLOBALS['johnny5k_test_http']['request'];
		if ( empty( $queue ) ) {
			return new WP_Error( 'missing_http_stub', 'No stubbed wp_remote_request response available.' );
		}

		return array_shift( $queue );
	}
}

if ( ! function_exists( 'wp_remote_retrieve_body' ) ) {
	function wp_remote_retrieve_body( mixed $response ): string {
		if ( is_array( $response ) ) {
			return (string) ( $response['body'] ?? '' );
		}

		if ( is_object( $response ) && isset( $response->body ) ) {
			return (string) $response->body;
		}

		return '';
	}
}

if ( ! function_exists( 'wp_remote_retrieve_response_code' ) ) {
	function wp_remote_retrieve_response_code( mixed $response ): int {
		if ( is_array( $response ) ) {
			return (int) ( $response['response']['code'] ?? 0 );
		}

		if ( is_object( $response ) && isset( $response->response['code'] ) ) {
			return (int) $response->response['code'];
		}

		return 0;
	}
}

if ( ! function_exists( 'mb_strlen' ) ) {
	function mb_strlen( string $string, ?string $encoding = null ): int {
		return strlen( $string );
	}
}

if ( ! function_exists( 'mb_substr' ) ) {
	function mb_substr( string $string, int $start, ?int $length = null, ?string $encoding = null ): string {
		return null === $length ? substr( $string, $start ) : substr( $string, $start, $length );
	}
}

if ( ! function_exists( 'mb_strtolower' ) ) {
	function mb_strtolower( string $string, ?string $encoding = null ): string {
		return strtolower( $string );
	}
}

if ( ! function_exists( 'sanitize_title' ) ) {
	function sanitize_title( string $value ): string {
		$value = strtolower( trim( $value ) );
		$value = preg_replace( '/[^a-z0-9]+/', '-', $value ) ?? '';
		return trim( $value, '-' );
	}
}

if ( ! function_exists( 'get_user_by' ) ) {
	function get_user_by( string $field, string|int $value ): WP_User|false {
		foreach ( $GLOBALS['johnny5k_test_users'] ?? [] as $user ) {
			if ( 'id' === $field && (int) $user->ID === (int) $value ) {
				return $user;
			}
			if ( 'email' === $field && strtolower( $user->user_email ) === strtolower( (string) $value ) ) {
				return $user;
			}
		}

		return false;
	}
}

if ( ! function_exists( 'wp_signon' ) ) {
	function wp_signon( array $credentials, bool $secure_cookie = false ): WP_User|WP_Error {
		$login = strtolower( (string) ( $credentials['user_login'] ?? '' ) );
		$password = (string) ( $credentials['user_password'] ?? '' );

		foreach ( $GLOBALS['johnny5k_test_users'] ?? [] as $user ) {
			if ( strtolower( $user->user_email ) === $login || strtolower( $user->user_login ) === $login ) {
				if ( ( $user->plain_password ?? '' ) === $password ) {
					return $user;
				}
			}
		}

		return new WP_Error( 'invalid_credentials', 'Invalid login.' );
	}
}

if ( ! function_exists( 'user_can' ) ) {
	function user_can( WP_User $user, string $capability ): bool {
		return ! empty( $user->caps[ $capability ] );
	}
}

if ( ! function_exists( 'wp_create_nonce' ) ) {
	function wp_create_nonce( string $action ): string {
		return 'test-nonce';
	}
}

require_once __DIR__ . '/Support/FakeWpdb.php';
require_once __DIR__ . '/Support/ServiceTestCase.php';

$GLOBALS['johnny5k_test_now'] = '2026-04-09 12:00:00';

require_once dirname( __DIR__ ) . '/includes/Auth/class-invite-codes.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-user-time.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-exercise-library-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-award-engine.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-calorie-engine.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-training-engine.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-exercise-calorie-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-ai-memory-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-support-guide-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-ai-prompt-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-ai-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-coach-delivery-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-behavior-analytics-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-workout-action-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-sms-service.php';
require_once dirname( __DIR__ ) . '/includes/Services/class-push-service.php';
require_once dirname( __DIR__ ) . '/includes/Support/class-training-day-types.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-auth-controller.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-admin-api-controller.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-onboarding-controller.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-workout-controller.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-ai-chat-controller.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-ai-controller.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-body-metrics-controller.php';
require_once dirname( __DIR__ ) . '/includes/REST/class-dashboard-controller.php';
require_once __DIR__ . '/Support/ApiIntegrationTestCase.php';
