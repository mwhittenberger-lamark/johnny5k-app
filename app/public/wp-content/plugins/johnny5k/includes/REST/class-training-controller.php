<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\TrainingEngine;
use Johnny5k\Services\UserTime;

/**
 * REST Controller: Training (plan management)
 *
 * GET  /fit/v1/training/plan              — current training plan + days
 * POST /fit/v1/training/plan              — create custom plan
 * PUT  /fit/v1/training/day/{id}          — update a training day (time_tier)
 * POST /fit/v1/training/day/{id}/exercise — add an exercise to a day
 * DELETE /fit/v1/training/day-exercise/{id} — remove an exercise
 * GET  /fit/v1/training/exercises         — exercise library (with filters)
 */
class TrainingController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/training/plan', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_plan'    ], 'permission_callback' => $auth ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_plan' ], 'permission_callback' => $auth ],
		] );

		register_rest_route( $ns, '/training/day/(?P<id>\d+)', [
			'methods'             => 'PUT',
			'callback'            => [ __CLASS__, 'update_day' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/training/day/(?P<id>\d+)/exercise', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'add_exercise_to_day' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/training/day-exercise/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'remove_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/training/exercises', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_exercises' ],
			'permission_callback' => $auth,
		] );
	}

	// ── GET /training/plan ────────────────────────────────────────────────────

	public static function get_plan( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$p       = $wpdb->prefix;

		$plan = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $plan ) {
			return new \WP_REST_Response( [ 'plan' => null, 'days' => [] ] );
		}

		$days = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_days WHERE training_plan_id = %d ORDER BY day_order",
			$plan->id
		) );

		foreach ( $days as $day ) {
			$day->weekday_label = self::weekday_label( (int) $day->day_order );
			$day->exercises = $wpdb->get_results( $wpdb->prepare(
				"SELECT ude.*, e.name AS exercise_name, e.primary_muscle, e.equipment, e.difficulty
				 FROM {$p}fit_user_training_day_exercises ude
				 JOIN {$p}fit_exercises e ON e.id = ude.exercise_id
				 WHERE ude.training_day_id = %d AND ude.active = 1 ORDER BY ude.sort_order",
				$day->id
			) );
		}

		return new \WP_REST_Response( [ 'plan' => $plan, 'days' => $days ] );
	}

	// ── POST /training/plan ───────────────────────────────────────────────────

	public static function create_plan( \WP_REST_Request $req ): \WP_REST_Response {
		// Deactivate existing plan, then create from a template_id or blank
		global $wpdb;
		$user_id     = get_current_user_id();
		$template_id = (int) ( $req->get_param( 'program_template_id' ) ?: 0 );
		$name        = sanitize_text_field( $req->get_param( 'name' ) ?: 'Custom Plan' );

		$wpdb->update( $wpdb->prefix . 'fit_user_training_plans', [ 'active' => 0 ], [ 'user_id' => $user_id ] );

		$wpdb->insert( $wpdb->prefix . 'fit_user_training_plans', [
			'user_id'             => $user_id,
			'program_template_id' => $template_id ?: null,
			'name'                => $name,
			'start_date'          => UserTime::today( $user_id ),
			'active'              => 1,
		] );

		return new \WP_REST_Response( [ 'plan_id' => $wpdb->insert_id, 'name' => $name ], 201 );
	}

	// ── PUT /training/day/{id} ────────────────────────────────────────────────

	public static function update_day( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$day_id  = (int) $req->get_param( 'id' );

		// Verify ownership
		if ( ! self::user_owns_day( $user_id, $day_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$update = [];
		if ( $req->get_param( 'time_tier' ) ) $update['time_tier'] = sanitize_text_field( $req->get_param( 'time_tier' ) );
		if ( $req->get_param( 'day_type' ) )  $update['day_type']  = sanitize_text_field( $req->get_param( 'day_type' ) );

		if ( $update ) {
			$wpdb->update( $wpdb->prefix . 'fit_user_training_days', $update, [ 'id' => $day_id ] );
		}

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	// ── POST /training/day/{id}/exercise ──────────────────────────────────────

	public static function add_exercise_to_day( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id     = get_current_user_id();
		$day_id      = (int) $req->get_param( 'id' );
		$exercise_id = (int) $req->get_param( 'exercise_id' );

		if ( ! self::user_owns_day( $user_id, $day_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$max_order = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT MAX(sort_order) FROM {$wpdb->prefix}fit_user_training_day_exercises WHERE training_day_id = %d",
			$day_id
		) );

		$wpdb->insert( $wpdb->prefix . 'fit_user_training_day_exercises', [
			'training_day_id' => $day_id,
			'exercise_id'     => $exercise_id,
			'slot_type'       => sanitize_text_field( $req->get_param( 'slot_type' ) ?: 'accessory' ),
			'rep_min'         => (int) ( $req->get_param( 'rep_min' ) ?: 8 ),
			'rep_max'         => (int) ( $req->get_param( 'rep_max' ) ?: 12 ),
			'sets_target'     => (int) ( $req->get_param( 'sets_target' ) ?: 3 ),
			'sort_order'      => $max_order + 1,
			'active'          => 1,
		] );

		return new \WP_REST_Response( [ 'id' => $wpdb->insert_id ], 201 );
	}

	// ── DELETE /training/day-exercise/{id} ────────────────────────────────────

	public static function remove_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$ex_id   = (int) $req->get_param( 'id' );

		// Verify ownership via join
		$owner = $wpdb->get_var( $wpdb->prepare(
			"SELECT utp.user_id
			 FROM {$p}fit_user_training_day_exercises ude
			 JOIN {$p}fit_user_training_days utd      ON utd.id = ude.training_day_id
			 JOIN {$p}fit_user_training_plans utp     ON utp.id = utd.training_plan_id
			 WHERE ude.id = %d",
			$ex_id
		) );

		if ( (int) $owner !== $user_id ) {
			return new \WP_REST_Response( [ 'message' => 'Not found.' ], 404 );
		}

		$wpdb->update( $p . 'fit_user_training_day_exercises', [ 'active' => 0 ], [ 'id' => $ex_id ] );

		return new \WP_REST_Response( [ 'removed' => true ] );
	}

	// ── GET /training/exercises ───────────────────────────────────────────────

	public static function get_exercises( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;

		$where  = [ '1=1' ];
		$vals   = [];

		if ( $muscle = sanitize_text_field( $req->get_param( 'muscle' ) ?: '' ) ) {
			$where[] = 'primary_muscle = %s';
			$vals[]  = $muscle;
		}
		if ( $equip = sanitize_text_field( $req->get_param( 'equipment' ) ?: '' ) ) {
			$where[] = 'equipment = %s';
			$vals[]  = $equip;
		}
		if ( $day_type = sanitize_text_field( $req->get_param( 'day_type' ) ?: '' ) ) {
			$where[] = 'JSON_CONTAINS(day_types_json, %s)';
			$vals[]  = '"' . esc_sql( $day_type ) . '"';
		}

		$where_sql = implode( ' AND ', $where );
		$sql       = "SELECT id, slug, name, primary_muscle, equipment, difficulty, default_rep_min, default_rep_max, default_sets
		              FROM {$wpdb->prefix}fit_exercises WHERE active = 1 AND $where_sql ORDER BY name";

		$rows = $vals
			? $wpdb->get_results( $wpdb->prepare( $sql, ...$vals ) )
			: $wpdb->get_results( $sql );

		return new \WP_REST_Response( $rows );
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private static function user_owns_day( int $user_id, int $day_id ): bool {
		global $wpdb;
		$owner = $wpdb->get_var( $wpdb->prepare(
			"SELECT utp.user_id
			 FROM {$wpdb->prefix}fit_user_training_days utd
			 JOIN {$wpdb->prefix}fit_user_training_plans utp ON utp.id = utd.training_plan_id
			 WHERE utd.id = %d",
			$day_id
		) );
		return (int) $owner === $user_id;
	}

	private static function weekday_label( int $day_order ): string {
		$labels = [ 1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun' ];
		return $labels[ $day_order ] ?? 'Day';
	}
}
