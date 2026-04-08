<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\UserTime;

/**
 * REST Controller: Body & Recovery Metrics
 *
 * POST /fit/v1/body/weight        — log bodyweight
 * GET  /fit/v1/body/weight        — last N weight entries
 * POST /fit/v1/body/sleep         — log sleep
 * GET  /fit/v1/body/sleep         — last N sleep entries
 * POST /fit/v1/body/steps         — log steps
 * POST /fit/v1/body/cardio        — log cardio session
 * GET  /fit/v1/body/metrics       — aggregate: weight + sleep + steps for a date range
 * POST /fit/v1/body/health-flags  — upsert a health flag
 * GET  /fit/v1/body/health-flags  — list active health flags
 */
class BodyMetricsController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/body/weight', [
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'log_weight' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_weight' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/weight/(?P<id>\d+)', [
			[ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_weight' ], 'permission_callback' => $auth ],
			[ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_weight' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/sleep', [
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'log_sleep' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_sleep' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/sleep/(?P<id>\d+)', [
			[ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_sleep' ], 'permission_callback' => $auth ],
			[ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_sleep' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/steps', [
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'log_steps' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_steps' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/steps/(?P<id>\d+)', [
			[ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_steps' ], 'permission_callback' => $auth ],
			[ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_steps' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/cardio', [
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'log_cardio' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_cardio' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/cardio/(?P<id>\d+)', [
			[ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_cardio' ], 'permission_callback' => $auth ],
			[ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_cardio' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/body/metrics', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_metrics' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/body/health-flags', [
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'save_health_flag' ], 'permission_callback' => $auth ],
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_health_flags' ], 'permission_callback' => $auth ],
		] );
	}

	// ── Weight ────────────────────────────────────────────────────────────────

	public static function log_weight( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$weight_lb  = (float) $req->get_param( 'weight_lb' );
		$date       = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );
		$waist_in   = $req->get_param( 'waist_in' )    ? (float) $req->get_param( 'waist_in' )    : null;
		$body_fat   = $req->get_param( 'body_fat_pct' ) ? (float) $req->get_param( 'body_fat_pct' ) : null;
		$notes      = sanitize_text_field( $req->get_param( 'notes' ) ?: '' );

		if ( $weight_lb <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'Invalid weight value.' ], 400 );
		}

		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'fit_body_metrics', array_filter( [
			'user_id'      => $user_id,
			'metric_date'  => $date,
			'weight_lb'    => $weight_lb,
			'waist_in'     => $waist_in,
			'body_fat_pct' => $body_fat,
			'notes'        => $notes ?: null,
		], fn( $v ) => $v !== null ) );

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'id' => $wpdb->insert_id, 'weight_lb' => $weight_lb, 'date' => $date ], 201 );
	}

	public static function get_weight( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$limit   = min( 90, (int) ( $req->get_param( 'limit' ) ?: 30 ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, metric_date, weight_lb, waist_in, body_fat_pct
			 FROM {$wpdb->prefix}fit_body_metrics
			 WHERE user_id = %d ORDER BY metric_date DESC LIMIT %d",
			$user_id, $limit
		) );

		return new \WP_REST_Response( $rows );
	}

	public static function update_weight( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id   = get_current_user_id();
		$id        = (int) $req['id'];
		$weight_lb = (float) $req->get_param( 'weight_lb' );
		$date      = self::normalize_date_input( $req->get_param( 'date' ), $user_id );

		if ( $weight_lb <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'Invalid weight value.' ], 400 );
		}

		global $wpdb;
		$updated = $wpdb->update(
			$wpdb->prefix . 'fit_body_metrics',
			[ 'weight_lb' => $weight_lb, 'metric_date' => $date ],
			[ 'id' => $id, 'user_id' => $user_id ]
		);

		if ( false === $updated ) {
			return new \WP_REST_Response( [ 'message' => 'Could not update weight log.' ], 500 );
		}

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'id' => $id, 'weight_lb' => $weight_lb, 'date' => $date, 'updated' => true ] );
	}

	public static function delete_weight( \WP_REST_Request $req ): \WP_REST_Response {
		return self::delete_owned_row( 'fit_body_metrics', (int) $req['id'] );
	}

	// ── Sleep ─────────────────────────────────────────────────────────────────

	public static function log_sleep( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$hours      = (float) $req->get_param( 'hours_sleep' );
		$date       = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );
		$quality    = sanitize_text_field( $req->get_param( 'sleep_quality' ) ?: '' );

		if ( $hours <= 0 || $hours > 24 ) {
			return new \WP_REST_Response( [ 'message' => 'Invalid hours_sleep value.' ], 400 );
		}

		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'fit_sleep_logs', array_filter( [
			'user_id'       => $user_id,
			'sleep_date'    => $date,
			'hours_sleep'   => $hours,
			'sleep_quality' => $quality ?: null,
		], fn( $v ) => $v !== null ) );

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'id' => $wpdb->insert_id, 'hours_sleep' => $hours, 'date' => $date ], 201 );
	}

	public static function get_sleep( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$limit   = min( 90, (int) ( $req->get_param( 'limit' ) ?: 30 ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, sleep_date, hours_sleep, sleep_quality
			 FROM {$wpdb->prefix}fit_sleep_logs
			 WHERE user_id = %d ORDER BY sleep_date DESC LIMIT %d",
			$user_id, $limit
		) );

		return new \WP_REST_Response( $rows );
	}

	public static function update_sleep( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$id      = (int) $req['id'];
		$hours   = (float) $req->get_param( 'hours_sleep' );
		$quality = sanitize_text_field( $req->get_param( 'sleep_quality' ) ?: '' );
		$date    = self::normalize_date_input( $req->get_param( 'date' ), $user_id );

		if ( $hours <= 0 || $hours > 24 ) {
			return new \WP_REST_Response( [ 'message' => 'Invalid hours_sleep value.' ], 400 );
		}

		global $wpdb;
		$updated = $wpdb->update(
			$wpdb->prefix . 'fit_sleep_logs',
			[ 'hours_sleep' => $hours, 'sleep_quality' => $quality ?: null, 'sleep_date' => $date ],
			[ 'id' => $id, 'user_id' => $user_id ]
		);

		if ( false === $updated ) {
			return new \WP_REST_Response( [ 'message' => 'Could not update sleep log.' ], 500 );
		}

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'id' => $id, 'hours_sleep' => $hours, 'sleep_quality' => $quality, 'date' => $date, 'updated' => true ] );
	}

	public static function delete_sleep( \WP_REST_Request $req ): \WP_REST_Response {
		return self::delete_owned_row( 'fit_sleep_logs', (int) $req['id'] );
	}

	// ── Steps ─────────────────────────────────────────────────────────────────

	public static function log_steps( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$steps   = (int) $req->get_param( 'steps' );
		$date    = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );

		if ( $steps < 0 ) {
			return new \WP_REST_Response( [ 'message' => 'Steps cannot be negative.' ], 400 );
		}

		global $wpdb;
		// Replace if same date already logged
		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_step_logs WHERE user_id = %d AND step_date = %s",
			$user_id, $date
		) );

		if ( $existing ) {
			$wpdb->update( $wpdb->prefix . 'fit_step_logs', [ 'steps' => $steps ], [ 'id' => $existing ] );
		} else {
			$wpdb->insert( $wpdb->prefix . 'fit_step_logs', [
				'user_id'   => $user_id,
				'step_date' => $date,
				'steps'     => $steps,
			] );
		}

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'date' => $date, 'steps' => $steps ], 200 );
	}

	public static function get_steps( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$limit   = min( 90, (int) ( $req->get_param( 'limit' ) ?: 30 ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, step_date, steps
			 FROM {$wpdb->prefix}fit_step_logs
			 WHERE user_id = %d ORDER BY step_date DESC LIMIT %d",
			$user_id, $limit
		) );

		return new \WP_REST_Response( $rows );
	}

	public static function update_steps( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$id      = (int) $req['id'];
		$steps   = (int) $req->get_param( 'steps' );
		$date    = self::normalize_date_input( $req->get_param( 'date' ), $user_id );

		if ( $steps < 0 ) {
			return new \WP_REST_Response( [ 'message' => 'Steps cannot be negative.' ], 400 );
		}

		global $wpdb;
		$existing_for_date = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_step_logs WHERE user_id = %d AND step_date = %s AND id != %d LIMIT 1",
			$user_id,
			$date,
			$id
		) );

		if ( $existing_for_date ) {
			$wpdb->update(
				$wpdb->prefix . 'fit_step_logs',
				[ 'steps' => $steps ],
				[ 'id' => (int) $existing_for_date, 'user_id' => $user_id ]
			);
			$wpdb->delete( $wpdb->prefix . 'fit_step_logs', [ 'id' => $id, 'user_id' => $user_id ] );

			self::sync_user_awards( $user_id );

			return new \WP_REST_Response( [ 'id' => (int) $existing_for_date, 'steps' => $steps, 'date' => $date, 'merged' => true, 'updated' => true ] );
		}

		$updated = $wpdb->update(
			$wpdb->prefix . 'fit_step_logs',
			[ 'steps' => $steps, 'step_date' => $date ],
			[ 'id' => $id, 'user_id' => $user_id ]
		);

		if ( false === $updated ) {
			return new \WP_REST_Response( [ 'message' => 'Could not update step log.' ], 500 );
		}

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'id' => $id, 'steps' => $steps, 'date' => $date, 'updated' => true ] );
	}

	public static function delete_steps( \WP_REST_Request $req ): \WP_REST_Response {
		return self::delete_owned_row( 'fit_step_logs', (int) $req['id'] );
	}

	// ── Cardio ────────────────────────────────────────────────────────────────

	public static function log_cardio( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id  = get_current_user_id();
		$type     = sanitize_text_field( $req->get_param( 'cardio_type' ) ?: 'other' );
		$duration = (int) $req->get_param( 'duration_minutes' );
		$date     = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );
		$intensity = self::normalize_cardio_intensity( $req->get_param( 'intensity' ) );

		if ( $duration <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'duration_minutes must be positive.' ], 400 );
		}

		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'fit_cardio_logs', array_filter( [
			'user_id'            => $user_id,
			'cardio_date'        => $date,
			'cardio_type'        => $type,
			'duration_minutes'   => $duration,
			'intensity'          => $intensity,
			'distance'           => $req->get_param( 'distance' ) ? (float) $req->get_param( 'distance' ) : null,
			'estimated_calories' => $req->get_param( 'estimated_calories' ) ? (int) $req->get_param( 'estimated_calories' ) : null,
			'notes'              => sanitize_text_field( $req->get_param( 'notes' ) ?: '' ) ?: null,
		], fn( $v ) => $v !== null ) );

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'id' => $wpdb->insert_id ], 201 );
	}

	public static function get_cardio( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$limit   = min( 90, (int) ( $req->get_param( 'limit' ) ?: 20 ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, cardio_date, cardio_type, duration_minutes, intensity, distance, estimated_calories, notes
			 FROM {$wpdb->prefix}fit_cardio_logs
			 WHERE user_id = %d ORDER BY cardio_date DESC, id DESC LIMIT %d",
			$user_id, $limit
		) );

		return new \WP_REST_Response( $rows );
	}

	public static function update_cardio( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id  = get_current_user_id();
		$id       = (int) $req['id'];
		$type     = sanitize_text_field( $req->get_param( 'cardio_type' ) ?: 'other' );
		$duration = (int) $req->get_param( 'duration_minutes' );
		$date     = self::normalize_date_input( $req->get_param( 'date' ), $user_id );
		$intensity = self::normalize_cardio_intensity( $req->get_param( 'intensity' ) );
		$calories = $req->get_param( 'estimated_calories' ) !== null && '' !== $req->get_param( 'estimated_calories' )
			? (int) $req->get_param( 'estimated_calories' )
			: null;
		$notes = sanitize_text_field( $req->get_param( 'notes' ) ?: '' ) ?: null;

		if ( $duration <= 0 ) {
			return new \WP_REST_Response( [ 'message' => 'duration_minutes must be positive.' ], 400 );
		}

		global $wpdb;
		$updated = $wpdb->update(
			$wpdb->prefix . 'fit_cardio_logs',
			[
				'cardio_date' => $date,
				'cardio_type' => $type,
				'duration_minutes' => $duration,
				'intensity' => $intensity,
				'estimated_calories' => $calories,
				'notes' => $notes,
			],
			[ 'id' => $id, 'user_id' => $user_id ]
		);

		if ( false === $updated ) {
			return new \WP_REST_Response( [ 'message' => 'Could not update cardio log.' ], 500 );
		}

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'id' => $id, 'date' => $date, 'updated' => true ] );
	}

	public static function delete_cardio( \WP_REST_Request $req ): \WP_REST_Response {
		return self::delete_owned_row( 'fit_cardio_logs', (int) $req['id'] );
	}

	// ── Aggregate metrics ─────────────────────────────────────────────────────

	public static function get_metrics( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$days    = min( 90, (int) ( $req->get_param( 'days' ) ?: 30 ) );
		$since   = UserTime::days_ago( $user_id, $days );

		$weight = $wpdb->get_results( $wpdb->prepare(
			"SELECT metric_date AS date, weight_lb FROM {$wpdb->prefix}fit_body_metrics
			 WHERE user_id = %d AND metric_date >= %s ORDER BY metric_date",
			$user_id, $since
		) );

		$sleep = $wpdb->get_results( $wpdb->prepare(
			"SELECT sleep_date AS date, hours_sleep FROM {$wpdb->prefix}fit_sleep_logs
			 WHERE user_id = %d AND sleep_date >= %s ORDER BY sleep_date",
			$user_id, $since
		) );

		$steps = $wpdb->get_results( $wpdb->prepare(
			"SELECT step_date AS date, steps FROM {$wpdb->prefix}fit_step_logs
			 WHERE user_id = %d AND step_date >= %s ORDER BY step_date",
			$user_id, $since
		) );

		$cardio = $wpdb->get_results( $wpdb->prepare(
			"SELECT cardio_date AS date,
			        SUM(duration_minutes) AS duration_minutes,
			        COUNT(*) AS sessions,
			        SUM(COALESCE(estimated_calories, 0)) AS estimated_calories
			 FROM {$wpdb->prefix}fit_cardio_logs
			 WHERE user_id = %d AND cardio_date >= %s
			 GROUP BY cardio_date ORDER BY cardio_date",
			$user_id, $since
		) );

		return new \WP_REST_Response( compact( 'weight', 'sleep', 'steps', 'cardio' ) );
	}

	// ── Health flags ──────────────────────────────────────────────────────────

	public static function save_health_flag( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		global $wpdb;

		$data = [
			'user_id'   => $user_id,
			'flag_type' => sanitize_text_field( $req->get_param( 'flag_type' ) ?: 'pain' ),
			'body_area' => sanitize_text_field( $req->get_param( 'body_area' ) ?: '' ),
			'severity'  => sanitize_text_field( $req->get_param( 'severity' ) ?: 'low' ),
			'notes'     => sanitize_textarea_field( $req->get_param( 'notes' ) ?: '' ),
			'active'    => (int) (bool) $req->get_param( 'active' ),
		];

		$id = $req->get_param( 'id' );
		if ( $id ) {
			$wpdb->update( $wpdb->prefix . 'fit_user_health_flags', $data, [ 'id' => (int) $id, 'user_id' => $user_id ] );
			return new \WP_REST_Response( [ 'id' => (int) $id, 'updated' => true ] );
		}

		$wpdb->insert( $wpdb->prefix . 'fit_user_health_flags', $data );
		return new \WP_REST_Response( [ 'id' => $wpdb->insert_id ], 201 );
	}

	public static function get_health_flags( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_health_flags WHERE user_id = %d AND active = 1 ORDER BY created_at DESC",
			$user_id
		) );

		return new \WP_REST_Response( $rows );
	}

	private static function delete_owned_row( string $table_suffix, int $id ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$deleted = $wpdb->delete( $wpdb->prefix . $table_suffix, [ 'id' => $id, 'user_id' => $user_id ] );

		if ( false === $deleted ) {
			return new \WP_REST_Response( [ 'message' => 'Could not delete log.' ], 500 );
		}

		if ( 0 === $deleted ) {
			return new \WP_REST_Response( [ 'message' => 'Log not found.' ], 404 );
		}

		self::sync_user_awards( $user_id );

		return new \WP_REST_Response( null, 204 );
	}

	private static function sync_user_awards( int $user_id ): void {
		\Johnny5k\Services\AwardEngine::sync_user_awards( $user_id );
	}

	private static function normalize_cardio_intensity( $value ): string {
		$intensity = sanitize_text_field( (string) ( $value ?: 'moderate' ) );

		return match ( $intensity ) {
			'low'  => 'light',
			'high', 'max' => 'hard',
			'light', 'moderate', 'hard' => $intensity,
			default => 'moderate',
		};
	}

	private static function normalize_date_input( $value, int $user_id ): string {
		$date = sanitize_text_field( (string) ( $value ?: '' ) );

		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ) {
			return $date;
		}

		return UserTime::today( $user_id );
	}
}
