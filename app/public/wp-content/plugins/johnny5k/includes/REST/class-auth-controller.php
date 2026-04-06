<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Auth\InviteCodes;
use Johnny5k\Services\CalorieEngine;
use Johnny5k\Services\AwardEngine;

/**
 * REST Controller: Authentication
 *
 * POST /fit/v1/auth/login      — authenticate with WP password, sets WP auth cookies
 * POST /fit/v1/auth/register   — invite-code-gated registration
 * POST /fit/v1/auth/logout     — clear current WP session
 * GET  /fit/v1/auth/validate   — validate current cookie session
 */
class AuthController {

	public static function register_routes(): void {
		$ns = JF_REST_NAMESPACE;

		register_rest_route( $ns, '/auth/login', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'login' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'email'    => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email' ],
				'password' => [ 'required' => true, 'type' => 'string' ],
			],
		] );

		register_rest_route( $ns, '/auth/register', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'register' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'invite_code' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
				'email'       => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email' ],
				'password'    => [ 'required' => true, 'type' => 'string' ],
				'first_name'  => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
				'last_name'   => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			],
		] );

		register_rest_route( $ns, '/auth/validate', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'validate_token' ],
			'permission_callback' => [ __CLASS__, 'require_auth' ],
		] );

		register_rest_route( $ns, '/auth/logout', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'logout' ],
			'permission_callback' => '__return_true',
		] );

		register_rest_route( $ns, '/auth/password/request', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'request_password_reset' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'email' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email' ],
			],
		] );

		register_rest_route( $ns, '/auth/password/reset', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'reset_password' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'login'    => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_user' ],
				'key'      => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
				'password' => [ 'required' => true, 'type' => 'string' ],
			],
		] );
	}

	// ── POST /auth/login ─────────────────────────────────────────────────────────

	public static function login( \WP_REST_Request $req ): \WP_REST_Response {
		$email    = $req->get_param( 'email' );
		$password = $req->get_param( 'password' );

		$user = wp_signon( [
			'user_login'    => $email,
			'user_password' => $password,
			'remember'      => true,
		], is_ssl() );

		if ( is_wp_error( $user ) ) {
			return self::error( 'invalid_credentials', 'Invalid email or password.', 401 );
		}

		wp_set_current_user( $user->ID );

		return self::auth_response( $user, 200, [ 'valid' => true ] );
	}

	// ── POST /auth/register ────────────────────────────────────────────────────

	public static function register( \WP_REST_Request $req ): \WP_REST_Response {
		$code       = strtoupper( trim( $req->get_param( 'invite_code' ) ) );
		$email      = $req->get_param( 'email' );
		$password   = $req->get_param( 'password' );
		$first_name = $req->get_param( 'first_name' ) ?? '';
		$last_name  = $req->get_param( 'last_name' ) ?? '';

		// Validate invite code
		if ( ! InviteCodes::is_valid( $code ) ) {
			return self::error( 'invalid_invite_code', 'This invite code is invalid or has already been used.', 403 );
		}

		// Validate email
		if ( ! is_email( $email ) ) {
			return self::error( 'invalid_email', 'Please provide a valid email address.', 400 );
		}
		if ( email_exists( $email ) ) {
			return self::error( 'email_exists', 'That email address is already registered.', 409 );
		}

		// Validate password strength (min 8 chars)
		if ( strlen( $password ) < 8 ) {
			return self::error( 'weak_password', 'Password must be at least 8 characters.', 400 );
		}

		// Create WP user
		$user_id = wp_insert_user( [
			'user_login' => sanitize_user( explode( '@', $email )[0] . '_' . wp_generate_password( 4, false ) ),
			'user_email' => $email,
			'user_pass'  => $password,
			'first_name' => $first_name,
			'last_name'  => $last_name,
			'role'       => 'subscriber',
		] );

		if ( is_wp_error( $user_id ) ) {
			return self::error( 'registration_failed', $user_id->get_error_message(), 500 );
		}

		// Consume invite code
		InviteCodes::consume( $code, $user_id );

		// Bootstrap profile row
		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'fit_user_profiles', [
			'user_id'    => $user_id,
			'first_name' => $first_name,
			'last_name'  => $last_name,
		] );
		$wpdb->insert( $wpdb->prefix . 'fit_user_preferences', [
			'user_id' => $user_id,
		] );

		// Mark first login for awards
		update_user_meta( $user_id, 'jf_first_login_done', 1 );
		AwardEngine::grant( $user_id, 'first_login' );

		$user = get_user_by( 'id', $user_id );
		self::start_session( $user );

		return self::auth_response( $user, 201, [ 'valid' => true ] );
	}

	// ── GET /auth/validate ─────────────────────────────────────────────────────

	public static function validate_token( \WP_REST_Request $req ): \WP_REST_Response {
		$user = wp_get_current_user();
		return self::auth_response( $user, 200, [ 'valid' => true ] );
	}

	// ── POST /auth/logout ───────────────────────────────────────────────────────

	public static function logout( \WP_REST_Request $req ): \WP_REST_Response {
		if ( is_user_logged_in() ) {
			wp_logout();
		} else {
			wp_set_current_user( 0 );
			wp_clear_auth_cookie();
		}

		return new \WP_REST_Response( [ 'logged_out' => true ], 200 );
	}

	// ── POST /auth/password/request ──────────────────────────────────────────

	public static function request_password_reset( \WP_REST_Request $req ): \WP_REST_Response {
		$email = sanitize_email( (string) $req->get_param( 'email' ) );

		if ( ! is_email( $email ) ) {
			return self::error( 'invalid_email', 'Please provide a valid email address.', 400 );
		}

		$user = get_user_by( 'email', $email );
		if ( $user ) {
			$result = retrieve_password( $user->user_login );
			if ( is_wp_error( $result ) ) {
				return self::error( 'password_reset_failed', $result->get_error_message(), 500 );
			}
		}

		return new \WP_REST_Response( [
			'sent'    => true,
			'message' => 'If that email exists in Johnny5k, a reset link has been sent.',
		], 200 );
	}

	// ── POST /auth/password/reset ────────────────────────────────────────────

	public static function reset_password( \WP_REST_Request $req ): \WP_REST_Response {
		$login    = sanitize_user( (string) $req->get_param( 'login' ) );
		$key      = sanitize_text_field( (string) $req->get_param( 'key' ) );
		$password = (string) $req->get_param( 'password' );

		if ( strlen( $password ) < 8 ) {
			return self::error( 'weak_password', 'Password must be at least 8 characters.', 400 );
		}

		$user = check_password_reset_key( $key, $login );
		if ( is_wp_error( $user ) ) {
			return self::error( 'invalid_reset_link', $user->get_error_message(), 400 );
		}

		reset_password( $user, $password );

		return new \WP_REST_Response( [
			'reset'   => true,
			'message' => 'Password updated successfully.',
		], 200 );
	}

	// ── Permission callbacks ──────────────────────────────────────────────────

	/**
	 * Any authenticated WP user via cookie + REST nonce.
	 */
	public static function require_auth( \WP_REST_Request $req ): bool|\WP_Error {
		$user = wp_get_current_user();
		if ( ! $user || ! $user->ID ) {
			return new \WP_Error( 'rest_not_logged_in', 'Authentication required.', [ 'status' => 401 ] );
		}
		return true;
	}

	/**
	 * Admin-only.
	 */
	public static function require_admin( \WP_REST_Request $req ): bool|\WP_Error {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new \WP_Error( 'rest_forbidden', 'Admin access required.', [ 'status' => 403 ] );
		}
		return true;
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private static function error( string $code, string $message, int $status = 400 ): \WP_REST_Response {
		return new \WP_REST_Response( [ 'code' => $code, 'message' => $message ], $status );
	}

	private static function auth_response( \WP_User $user, int $status = 200, array $extra = [] ): \WP_REST_Response {
		return new \WP_REST_Response( array_merge( [
			'user_id'             => $user->ID,
			'email'               => $user->user_email,
			'onboarding_complete' => (bool) self::get_profile_field( $user->ID, 'onboarding_complete' ),
			'is_admin'            => user_can( $user, 'manage_options' ),
			'nonce'               => wp_create_nonce( 'wp_rest' ),
		], $extra ), $status );
	}

	private static function start_session( \WP_User $user ): void {
		wp_set_current_user( $user->ID );
		wp_set_auth_cookie( $user->ID, true, is_ssl() );
		do_action( 'wp_login', $user->user_login, $user );
	}

	private static function get_profile_field( int $user_id, string $field ) {
		global $wpdb;
		return $wpdb->get_var( $wpdb->prepare(
			"SELECT `$field` FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );
	}
}
