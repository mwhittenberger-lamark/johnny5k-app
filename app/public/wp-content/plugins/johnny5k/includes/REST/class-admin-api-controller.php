<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Auth\InviteCodes;
use Johnny5k\Services\CostTracker;

/**
 * REST Controller: Admin API
 *
 * All routes require is_admin (current user is WP administrator).
 *
 * GET  /fit/v1/admin/users            — list all fit users
 * GET  /fit/v1/admin/invite-codes     — list invite codes
 * POST /fit/v1/admin/invite-codes     — generate new invite code
 * DELETE /fit/v1/admin/invite-codes/{id} — delete unused code
 * GET  /fit/v1/admin/costs            — cost summary (monthly total, per-user, daily)
 * GET  /fit/v1/admin/persona          — get Johnny 5000 persona settings
 * POST /fit/v1/admin/persona          — save Johnny 5000 persona settings
 * POST /fit/v1/admin/persona/test     — test persona with a message
 * POST /fit/v1/admin/sms/test         — send a test SMS reminder to a user
 */
class AdminApiController {

	public static function register_routes(): void {
		$ns    = JF_REST_NAMESPACE;
		$admin = [ 'Johnny5k\REST\AuthController', 'require_admin' ];

		register_rest_route( $ns, '/admin/users', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'list_users' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/invite-codes', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_invite_codes' ],   'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'generate_invite_code' ],'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/invite-codes/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'delete_invite_code' ],
			'permission_callback' => $admin,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/admin/costs', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_costs' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/persona', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_persona' ],  'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_persona' ], 'permission_callback' => $admin ],
		] );

		register_rest_route( $ns, '/admin/persona/test', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'test_persona' ],
			'permission_callback' => $admin,
		] );

		register_rest_route( $ns, '/admin/sms/test', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'test_sms' ],
			'permission_callback' => $admin,
		] );
	}

	// ── GET /admin/users ──────────────────────────────────────────────────────

	public static function list_users( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT u.ID AS user_id, u.user_email, u.user_registered,
			        p.first_name, p.last_name, p.current_goal AS goal_type, p.onboarding_complete
			 FROM {$wpdb->prefix}users u
			 LEFT JOIN {$wpdb->prefix}fit_user_profiles p ON p.user_id = u.ID
			 ORDER BY u.user_registered DESC"
		);

		return new \WP_REST_Response( $rows );
	}

	// ── GET /admin/invite-codes ───────────────────────────────────────────────

	public static function list_invite_codes( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( InviteCodes::get_all() );
	}

	// ── POST /admin/invite-codes ──────────────────────────────────────────────

	public static function generate_invite_code( \WP_REST_Request $req ): \WP_REST_Response {
		$admin_id = get_current_user_id();
		$code     = InviteCodes::generate( $admin_id );

		if ( is_wp_error( $code ) ) {
			return new \WP_REST_Response( [ 'message' => $code->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [ 'code' => $code ], 201 );
	}

	// ── DELETE /admin/invite-codes/{id} ───────────────────────────────────────

	public static function delete_invite_code( \WP_REST_Request $req ): \WP_REST_Response {
		$id     = (int) $req->get_param( 'id' );
		$result = InviteCodes::delete_unused( $id );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	// ── GET /admin/costs ──────────────────────────────────────────────────────

	public static function get_costs( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'monthly_total'    => CostTracker::monthly_total(),
			'monthly_by_user'  => CostTracker::monthly_by_user(),
			'daily_last_30'    => CostTracker::daily_totals_last_30(),
		] );
	}

	// ── GET /admin/persona ────────────────────────────────────────────────────

	public static function get_persona( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'persona'       => get_option( 'jf_johnny_persona', [] ),
			'system_prompt' => get_option( 'jf_johnny_system_prompt', '' ),
		] );
	}

	// ── POST /admin/persona ───────────────────────────────────────────────────

	public static function save_persona( \WP_REST_Request $req ): \WP_REST_Response {
		$persona = $req->get_json_params();

		// Sanitize all fields recursively
		$clean = array_map( 'sanitize_textarea_field', (array) $persona );

		update_option( 'jf_johnny_persona', $clean );

		// Rebuild compiled system prompt from persona fields
		$compiled = self::compile_persona( $clean );
		update_option( 'jf_johnny_system_prompt', $compiled );

		return new \WP_REST_Response( [
			'saved'         => true,
			'system_prompt' => $compiled,
		] );
	}

	// ── POST /admin/persona/test ──────────────────────────────────────────────

	public static function test_persona( \WP_REST_Request $req ): \WP_REST_Response {
		$message    = sanitize_textarea_field( $req->get_param( 'message' ) ?: 'Hey, how are you?' );
		$admin_id   = get_current_user_id();

		// Route through AI service with admin user context
		$result = \Johnny5k\Services\AiService::chat( $admin_id, 'admin_persona_test', $message );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [
			'reply'      => $result['reply'],
			'reply_html' => self::render_reply_html( (string) $result['reply'] ),
			'sources'    => $result['sources'] ?? [],
			'used_web_search' => (bool) ( $result['used_web_search'] ?? false ),
		] );
	}

	public static function test_sms( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = (int) $req->get_param( 'user_id' );
		$trigger_type = sanitize_key( (string) $req->get_param( 'trigger_type' ) );

		if ( $user_id <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'A valid user_id is required.' ], 400 );
		}

		$result = \Johnny5k\Services\SmsService::send_test_reminder( $user_id, $trigger_type );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [
			'sent' => true,
			'result' => $result,
		] );
	}

	// ── Persona compiler ──────────────────────────────────────────────────────

	private static function compile_persona( array $p ): string {
		$name        = $p['name']        ?? 'Johnny 5000';
		$tagline     = $p['tagline']     ?? 'Your AI fitness coach and big brother.';
		$tone        = $p['tone']        ?? 'warm, encouraging, confident, occasionally funny';
		$rules       = $p['rules']       ?? '';
		$extra       = $p['extra']       ?? '';

		$compiled  = "You are {$name}. {$tagline}\n\n";
		$compiled .= "Personality & tone: {$tone}\n\n";
		$compiled .= "Core rules:\n";
		$compiled .= "- Always be honest that you are an AI.\n";
		$compiled .= "- Never shame or belittle the user.\n";
		$compiled .= "- Keep responses concise but warm.\n";
		$compiled .= "- Focus on the user's goals and progress.\n";
		if ( $rules ) {
			$compiled .= "- {$rules}\n";
		}
		if ( $extra ) {
			$compiled .= "\nAdditional instructions:\n{$extra}\n";
		}

		return $compiled;
	}

	private static function render_reply_html( string $reply ): string {
		$reply = preg_replace( '/\s(?=\d+\.\s+\*\*)/', "\n", trim( $reply ) );
		$html  = esc_html( $reply );

		// Support the most common formatting the model returns in the admin preview.
		$html = preg_replace( '/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $html );
		$html = preg_replace( '/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/s', '<em>$1</em>', $html );
		$html = preg_replace( '/`([^`]+)`/', '<code>$1</code>', $html );

		return wp_kses_post( wpautop( $html ) );
	}
}
