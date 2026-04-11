<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\TrainingEngine;
use Johnny5k\Services\ExerciseLibraryService;
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

		register_rest_route( $ns, '/training/exercises/personal', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_personal_exercise' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/training/exercises/personal/merge', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'merge_personal_exercises' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/training/exercises/personal/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ __CLASS__, 'update_personal_exercise' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_personal_exercise' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
		] );

		register_rest_route( $ns, '/training/substitutions/personal', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_personal_substitution' ],
			'permission_callback' => $auth,
		] );
	}

	// ── GET /training/plan ────────────────────────────────────────────────────

	public static function get_plan( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$p       = $wpdb->prefix;
		$today   = UserTime::today( $user_id );

		$plan = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $plan ) {
			return new \WP_REST_Response( [
				'plan' => null,
				'days' => [],
				'today_context' => [
					'date' => $today,
					'weekday_order' => UserTime::weekday_order_for_date( $user_id, $today ),
					'weekday_label' => UserTime::weekday_label_for_date( $user_id, $today ),
					'timezone' => UserTime::timezone_string( $user_id ),
				],
			] );
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
			$day->last_completed_session = self::get_last_completed_session_summary( $user_id, (string) $day->day_type );
		}

		return new \WP_REST_Response( [
			'plan' => $plan,
			'days' => $days,
			'today_context' => [
				'date' => $today,
				'weekday_order' => UserTime::weekday_order_for_date( $user_id, $today ),
				'weekday_label' => UserTime::weekday_label_for_date( $user_id, $today ),
				'timezone' => UserTime::timezone_string( $user_id ),
			],
		] );
	}

	// ── POST /training/plan ───────────────────────────────────────────────────

	public static function create_plan( \WP_REST_Request $req ): \WP_REST_Response {
		// Deactivate existing plan, then create from a template_id or blank
		global $wpdb;
		$user_id     = get_current_user_id();
		$template_id = (int) ( $req->get_param( 'program_template_id' ) ?: 0 );
		$template_name = sanitize_text_field( $req->get_param( 'template_name' ) ?: '' );
		$name        = sanitize_text_field( $req->get_param( 'name' ) ?: 'Custom Plan' );

		if ( $template_id <= 0 ) {
			$template_id = self::resolve_template_id( $template_name );
		}

		$wpdb->update( $wpdb->prefix . 'fit_user_training_plans', [ 'active' => 0 ], [ 'user_id' => $user_id ] );

		$wpdb->insert( $wpdb->prefix . 'fit_user_training_plans', [
			'user_id'             => $user_id,
			'program_template_id' => $template_id ?: null,
			'name'                => $name,
			'start_date'          => UserTime::today( $user_id ),
			'active'              => 1,
		] );

		$plan_id = (int) $wpdb->insert_id;
		$days_created = self::copy_template_days_to_plan( $user_id, $plan_id, $template_id );

		return new \WP_REST_Response( [
			'plan_id'             => $plan_id,
			'name'                => $name,
			'program_template_id' => $template_id,
			'days_created'        => $days_created,
		], 201 );
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

		if ( ! ExerciseLibraryService::is_exercise_accessible( $user_id, $exercise_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found.' ], 404 );
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
		$user_id     = get_current_user_id();
		$own_only    = in_array( strtolower( (string) ( $req->get_param( 'own_only' ) ?? '' ) ), [ '1', 'true', 'yes', 'on' ], true );

		$where       = [ '1=1' ];
		$vals        = [];
		$limit       = max( 1, min( 50, (int) ( $req->get_param( 'limit' ) ?: 50 ) ) );
		$order_parts = [];
		$where[]     = $own_only
			? 'user_id = %d'
			: ExerciseLibraryService::accessible_exercise_where( '', $user_id );
		if ( $own_only ) {
			$vals[] = $user_id;
		}

		if ( $query = sanitize_text_field( $req->get_param( 'q' ) ?: '' ) ) {
			$like         = '%' . $wpdb->esc_like( $query ) . '%';
			$name_prefix  = $wpdb->esc_like( $query ) . '%';
			$slug_query   = sanitize_title( $query );
			$slug_like    = '%' . $wpdb->esc_like( $slug_query ) . '%';
			$slug_prefix  = $wpdb->esc_like( $slug_query ) . '%';
			$where[] = '(name LIKE %s OR slug LIKE %s)';
			$vals[]  = $like;
			$vals[]  = $slug_like;
			$order_parts[] = $wpdb->prepare(
				'CASE
					WHEN LOWER(name) = LOWER(%s) THEN 0
					WHEN slug = %s THEN 1
					WHEN LOWER(name) LIKE LOWER(%s) THEN 2
					WHEN slug LIKE %s THEN 3
					WHEN LOWER(name) LIKE LOWER(%s) THEN 4
					WHEN slug LIKE %s THEN 5
					ELSE 6
				END, CHAR_LENGTH(name), name',
				$query,
				$slug_query,
				$name_prefix,
				$slug_prefix,
				$like,
				$slug_like
			);
		}

		if ( $preferred_muscle = sanitize_text_field( $req->get_param( 'preferred_muscle' ) ?: '' ) ) {
			$order_parts[] = $wpdb->prepare(
				'CASE WHEN primary_muscle = %s THEN 0 ELSE 1 END',
				$preferred_muscle
			);
		}

		$order_parts[] = $wpdb->prepare( 'CASE WHEN user_id = %d THEN 0 ELSE 1 END', $user_id );

		if ( $preferred_equipment = sanitize_text_field( $req->get_param( 'preferred_equipment' ) ?: '' ) ) {
			$order_parts[] = $wpdb->prepare(
				'CASE WHEN equipment = %s THEN 0 ELSE 1 END',
				$preferred_equipment
			);
		}

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
		if ( $slot_type = sanitize_key( (string) ( $req->get_param( 'slot_type' ) ?: '' ) ) ) {
			$where[] = 'JSON_CONTAINS(slot_types_json, %s)';
			$vals[]  = '"' . esc_sql( $slot_type ) . '"';
		}

		$order_parts[] = 'CHAR_LENGTH(name)';
		$order_parts[] = 'name';

		$where_sql = implode( ' AND ', $where );
		$order_sql = implode( ', ', $order_parts );
		$sql       = "SELECT id, user_id, CASE WHEN user_id = %d THEN 1 ELSE 0 END AS owned_by_user, slug, name, description, movement_pattern, primary_muscle, equipment, difficulty, default_rep_min, default_rep_max, default_sets, slot_types_json
		              FROM {$wpdb->prefix}fit_exercises WHERE active = 1 AND $where_sql ORDER BY {$order_sql} LIMIT %d";
		$vals      = array_merge( [ $user_id ], $vals, [ $limit ] );

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, ...$vals ) );

		return new \WP_REST_Response( $rows );
	}

	public static function save_personal_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$result = ExerciseLibraryService::create_personal_exercise( $user_id, $req->get_json_params() ?: $req->get_params() );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( $result, ! empty( $result['created'] ) ? 201 : 200 );
	}

	public static function update_personal_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$result = ExerciseLibraryService::update_personal_exercise(
			$user_id,
			(int) $req->get_param( 'id' ),
			$req->get_json_params() ?: $req->get_params()
		);

		if ( is_wp_error( $result ) ) {
			$status = 'exercise_not_found' === $result->get_error_code() ? 404 : 400;
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], $status );
		}

		return new \WP_REST_Response( $result );
	}

	public static function delete_personal_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$result = ExerciseLibraryService::delete_personal_exercise( $user_id, (int) $req->get_param( 'id' ) );

		if ( is_wp_error( $result ) ) {
			$status = 'exercise_not_found' === $result->get_error_code() ? 404 : 400;
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], $status );
		}

		return new \WP_REST_Response( $result );
	}

	public static function merge_personal_exercises( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$params  = $req->get_json_params() ?: $req->get_params();
		$result  = ExerciseLibraryService::merge_personal_exercises(
			$user_id,
			(int) ( $params['keep_exercise_id'] ?? 0 ),
			(array) ( $params['remove_exercise_ids'] ?? [] )
		);

		if ( is_wp_error( $result ) ) {
			$status = 'exercise_not_found' === $result->get_error_code() ? 404 : 400;
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], $status );
		}

		return new \WP_REST_Response( $result );
	}

	public static function save_personal_substitution( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$result = ExerciseLibraryService::create_personal_substitution(
			$user_id,
			(int) $req->get_param( 'exercise_id' ),
			(int) $req->get_param( 'substitute_exercise_id' ),
			(string) ( $req->get_param( 'reason_code' ) ?: 'variation' ),
			max( 1, (int) ( $req->get_param( 'priority' ) ?: 1 ) )
		);

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( $result, ! empty( $result['created'] ) ? 201 : 200 );
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private static function resolve_template_id( string $template_name = '' ): int {
		global $wpdb;
		$p = $wpdb->prefix;

		if ( '' !== $template_name ) {
			$like = '%' . $wpdb->esc_like( $template_name ) . '%';
			$match = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$p}fit_program_templates WHERE active = 1 AND name LIKE %s ORDER BY id ASC LIMIT 1",
				$like
			) );
			if ( $match ) {
				return (int) $match;
			}
		}

		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_program_templates WHERE active = 1 AND name = %s ORDER BY id ASC LIMIT 1",
			'PPL Universal'
		) );
	}

	private static function copy_template_days_to_plan( int $user_id, int $plan_id, int $template_id ): int {
		if ( $user_id <= 0 || $plan_id <= 0 || $template_id <= 0 ) {
			return 0;
		}

		global $wpdb;
		$p = $wpdb->prefix;
		$template_days = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_template_days WHERE program_template_id = %d ORDER BY default_order ASC",
			$template_id
		) );

		if ( ! $template_days ) {
			return 0;
		}

		$days_created = 0;
		foreach ( $template_days as $template_day ) {
			$wpdb->insert( $p . 'fit_user_training_days', [
				'training_plan_id' => $plan_id,
				'day_type'         => $template_day->day_type,
				'day_order'        => (int) $template_day->default_order,
				'time_tier'        => $template_day->time_tier ?: 'medium',
			] );

			$user_day_id = (int) $wpdb->insert_id;
			if ( $user_day_id <= 0 ) {
				continue;
			}

			$days_created += 1;
			self::copy_template_day_exercises( $user_id, (string) $template_day->day_type, (int) $template_day->id, $user_day_id );
		}

		return $days_created;
	}

	private static function copy_template_day_exercises( int $user_id, string $day_type, int $template_day_id, int $user_day_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$template_exercises = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_template_exercises WHERE template_day_id = %d ORDER BY priority ASC",
			$template_day_id
		) );

		$selected_exercise_ids = [];
		foreach ( $template_exercises as $exercise ) {
			$resolved = TrainingEngine::resolve_day_exercise_candidate(
				$user_id,
				$day_type,
				(string) $exercise->slot_type,
				(int) $exercise->exercise_id,
				$selected_exercise_ids
			);
			$resolved_exercise_id = (int) ( $resolved['exercise_id'] ?? 0 );
			if ( ! empty( $resolved['blocked'] ) || $resolved_exercise_id <= 0 ) {
				continue;
			}

			$wpdb->insert( $p . 'fit_user_training_day_exercises', [
				'training_day_id' => $user_day_id,
				'exercise_id'     => $resolved_exercise_id,
				'slot_type'       => $exercise->slot_type,
				'rep_min'         => (int) $exercise->rep_min,
				'rep_max'         => (int) $exercise->rep_max,
				'sets_target'     => (int) $exercise->sets_target,
				'sort_order'      => (int) $exercise->priority,
				'active'          => 1,
			] );
			$selected_exercise_ids[] = $resolved_exercise_id;
		}
	}

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

	private static function get_last_completed_session_summary( int $user_id, string $day_type ): ?array {
		global $wpdb;
		$p = $wpdb->prefix;

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, session_date, time_tier, duration_minutes, completed_at
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d
			   AND completed = 1
			   AND COALESCE(actual_day_type, planned_day_type) = %s
			 ORDER BY COALESCE(completed_at, updated_at, created_at) DESC, id DESC
			 LIMIT 1",
			$user_id,
			$day_type
		) );

		if ( ! $session ) {
			return null;
		}

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT wse.id, wse.sort_order, e.name AS exercise_name,
			        SUM(CASE WHEN ws.completed = 1 THEN 1 ELSE 0 END) AS completed_sets,
			        MAX(ws.weight) AS best_weight,
			        MAX(ws.reps) AS best_reps
			 FROM {$p}fit_workout_session_exercises wse
			 JOIN {$p}fit_exercises e ON e.id = wse.exercise_id
			 LEFT JOIN {$p}fit_workout_sets ws ON ws.session_exercise_id = wse.id
			 WHERE wse.session_id = %d
			 GROUP BY wse.id, wse.sort_order, e.name
			 ORDER BY wse.sort_order ASC, wse.id ASC",
			(int) $session->id
		) );

		$exercise_summaries   = [];
		$total_completed_sets = 0;

		foreach ( $rows as $row ) {
			$completed_sets = (int) $row->completed_sets;
			$total_completed_sets += $completed_sets;

			$exercise_summaries[] = [
				'exercise_name'   => (string) $row->exercise_name,
				'completed_sets'  => $completed_sets,
				'best_weight'     => null !== $row->best_weight ? (float) $row->best_weight : null,
				'best_reps'       => null !== $row->best_reps ? (int) $row->best_reps : null,
			];
		}

		return [
			'session_id'           => (int) $session->id,
			'day_type'             => $day_type,
			'session_date'         => (string) $session->session_date,
			'time_tier'            => (string) $session->time_tier,
			'duration_minutes'     => null !== $session->duration_minutes ? (int) $session->duration_minutes : null,
			'exercise_count'       => count( $exercise_summaries ),
			'completed_sets'       => $total_completed_sets,
			'exercises'            => array_slice( $exercise_summaries, 0, 4 ),
		];
	}

	private static function weekday_label( int $day_order ): string {
		$labels = [ 1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun' ];
		return $labels[ $day_order ] ?? 'Day';
	}
}
