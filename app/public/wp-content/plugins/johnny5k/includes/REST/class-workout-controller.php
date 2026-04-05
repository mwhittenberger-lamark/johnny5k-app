<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\TrainingEngine;
use Johnny5k\Services\UserTime;
use Johnny5k\Services\AiService;
use Johnny5k\Services\AwardEngine;

/**
 * REST Controller: Workout (active session)
 *
 * POST   /fit/v1/workout/start             — build session for today
 * GET    /fit/v1/workout/{id}              — get session details
 * POST   /fit/v1/workout/{id}/set          — log a set
 * PUT    /fit/v1/workout/{id}/set/{set_id  — update a logged set
 * POST   /fit/v1/workout/{id}/swap         — swap an exercise in the session
 * POST   /fit/v1/workout/{id}/skip         — mark session skipped
 * POST   /fit/v1/workout/{id}/complete     — complete the session
 */
class WorkoutController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/workout/start', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'start' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_session' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/set', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'log_set' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/set/(?P<set_id>\d+)', [
			'methods'             => 'PUT',
			'callback'            => [ __CLASS__, 'update_set' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/swap', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'swap_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/quick-add', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'quick_add_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/skip', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'skip_session' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/complete', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'complete_session' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );
	}

	// ── POST /workout/start ───────────────────────────────────────────────────

	public static function start( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id   = get_current_user_id();
		$time_tier = sanitize_text_field( $req->get_param( 'time_tier' ) ?: 'medium' );
		$readiness = $req->get_param( 'readiness_score' ) !== null ? max( 1, min( 10, (int) $req->get_param( 'readiness_score' ) ) ) : null;

		// Prevent duplicate session for today
		global $wpdb;
		$today   = UserTime::today( $user_id );
		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s AND skip_requested = 0",
			$user_id, $today
		) );

		if ( $existing ) {
			if ( null !== $readiness ) {
				$wpdb->update(
					$wpdb->prefix . 'fit_workout_sessions',
					[ 'readiness_score' => $readiness ],
					[ 'id' => $existing ]
				);
			}
			// Return the existing session instead of creating a duplicate
			$req->set_param( 'id', $existing );
			return self::get_session( $req );
		}

		$result = TrainingEngine::build_session( $user_id, $time_tier );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		// Mark start time
		$wpdb->update(
			$wpdb->prefix . 'fit_workout_sessions',
			array_filter( [
				'started_at' => current_time( 'mysql', true ),
				'readiness_score' => $readiness,
			], fn( $value ) => $value !== null ),
			[ 'id' => $result['session_id'] ]
		);

		return new \WP_REST_Response( $result, 201 );
	}

	// ── GET /workout/{id} ─────────────────────────────────────────────────────

	public static function get_session( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p        = $wpdb->prefix;
		$user_id  = get_current_user_id();
		$sess_id  = (int) $req->get_param( 'id' );

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_sessions WHERE id = %d AND user_id = %d",
			$sess_id, $user_id
		) );

		if ( ! $session ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$exercises = $wpdb->get_results( $wpdb->prepare(
			"SELECT wse.*, e.name AS exercise_name, e.primary_muscle, e.coaching_cues_json, e.equipment, e.difficulty,
			        oe.name AS original_exercise_name
			 FROM {$p}fit_workout_session_exercises wse
			 JOIN {$p}fit_exercises e ON e.id = wse.exercise_id
			 LEFT JOIN {$p}fit_exercises oe ON oe.id = wse.original_exercise_id
			 WHERE wse.session_id = %d ORDER BY wse.sort_order",
			$sess_id
		) );

		foreach ( $exercises as $ex ) {
			$ex->sets = $wpdb->get_results( $wpdb->prepare(
				"SELECT * FROM {$p}fit_workout_sets WHERE session_exercise_id = %d ORDER BY set_number",
				$ex->id
			) );
			$ex->recent_history = self::get_recent_history( $user_id, (int) $ex->exercise_id );
			$ex->swap_options   = self::get_swap_options( $session, $ex );
		}

		return new \WP_REST_Response( [
			'session'   => $session,
			'exercises' => $exercises,
		] );
	}

	// ── POST /workout/{id}/set ────────────────────────────────────────────────

	public static function log_set( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p        = $wpdb->prefix;
		$user_id  = get_current_user_id();
		$sess_id  = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$ses_ex_id = (int) $req->get_param( 'session_exercise_id' );
		$set_num   = (int) ( $req->get_param( 'set_number' ) ?: 1 );

		$wpdb->insert( $p . 'fit_workout_sets', array_filter( [
			'session_exercise_id' => $ses_ex_id,
			'set_number'          => $set_num,
			'weight'              => (float) ( $req->get_param( 'weight' ) ?: 0 ),
			'reps'                => (int)   ( $req->get_param( 'reps' )   ?: 0 ),
			'rir'                 => $req->get_param( 'rir' ) !== null ? (float) $req->get_param( 'rir' ) : null,
			'rpe'                 => $req->get_param( 'rpe' ) !== null ? (float) $req->get_param( 'rpe' ) : null,
			'completed'           => 1,
			'pain_flag'           => (int) (bool) $req->get_param( 'pain_flag' ),
			'notes'               => sanitize_text_field( $req->get_param( 'notes' ) ?: '' ) ?: null,
		], fn( $v ) => $v !== null ) );

		return new \WP_REST_Response( [ 'set_id' => $wpdb->insert_id ], 201 );
	}

	// ── PUT /workout/{id}/set/{set_id} ────────────────────────────────────────

	public static function update_set( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p        = $wpdb->prefix;
		$user_id  = get_current_user_id();
		$sess_id  = (int) $req->get_param( 'id' );
		$set_id   = (int) $req->get_param( 'set_id' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$update = array_filter( [
			'weight'     => $req->get_param( 'weight' ) !== null ? (float) $req->get_param( 'weight' ) : null,
			'reps'       => $req->get_param( 'reps' )   !== null ? (int)   $req->get_param( 'reps' )   : null,
			'rir'        => $req->get_param( 'rir' )    !== null ? (float) $req->get_param( 'rir' )    : null,
			'pain_flag'  => $req->get_param( 'pain_flag' ) !== null ? (int) (bool) $req->get_param( 'pain_flag' ) : null,
			'notes'      => $req->get_param( 'notes' )  !== null ? sanitize_text_field( $req->get_param( 'notes' ) ) : null,
		], fn( $v ) => $v !== null );

		if ( $update ) {
			$wpdb->update( $p . 'fit_workout_sets', $update, [ 'id' => $set_id ] );
		}

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	// ── POST /workout/{id}/swap ───────────────────────────────────────────────

	public static function swap_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p             = $wpdb->prefix;
		$user_id       = get_current_user_id();
		$sess_id       = (int) $req->get_param( 'id' );
		$ses_ex_id     = (int) $req->get_param( 'session_exercise_id' );
		$new_ex_id     = (int) $req->get_param( 'new_exercise_id' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$orig_ex_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT exercise_id FROM {$p}fit_workout_session_exercises WHERE id = %d AND session_id = %d",
			$ses_ex_id, $sess_id
		) );

		if ( ! $orig_ex_id ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found in session.' ], 404 );
		}

		$wpdb->update( $p . 'fit_workout_session_exercises', [
			'exercise_id'           => $new_ex_id,
			'was_swapped'           => 1,
			'original_exercise_id'  => $orig_ex_id,
		], [ 'id' => $ses_ex_id ] );

		$new_ex = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, name FROM {$p}fit_exercises WHERE id = %d",
			$new_ex_id
		) );

		return new \WP_REST_Response( [ 'swapped' => true, 'exercise' => $new_ex ] );
	}

	public static function quick_add_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p         = $wpdb->prefix;
		$user_id   = get_current_user_id();
		$sess_id   = (int) $req->get_param( 'id' );
		$slot_type = sanitize_text_field( $req->get_param( 'slot_type' ) ?: 'accessory' );
		$exercise_id = (int) ( $req->get_param( 'exercise_id' ) ?: 0 );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_sessions WHERE id = %d",
			$sess_id
		) );

		if ( ! $session ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		if ( ! $exercise_id ) {
			$exercise_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$p}fit_exercises
				 WHERE active = 1
				   AND JSON_CONTAINS(slot_types_json, %s)
				   AND JSON_CONTAINS(day_types_json, %s)
				 ORDER BY difficulty, id DESC
				 LIMIT 1",
				'"' . esc_sql( $slot_type ) . '"',
				'"' . esc_sql( $session->planned_day_type ) . '"'
			) );
		}

		if ( ! $exercise_id ) {
			return new \WP_REST_Response( [ 'message' => 'No matching exercise found.' ], 404 );
		}

		$exercise = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, name, primary_muscle, default_rep_min, default_rep_max, default_sets
			 FROM {$p}fit_exercises WHERE id = %d AND active = 1",
			$exercise_id
		) );

		if ( ! $exercise ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found.' ], 404 );
		}

		$next_order = 1 + (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COALESCE(MAX(sort_order), 0) FROM {$p}fit_workout_session_exercises WHERE session_id = %d",
			$sess_id
		) );

		$wpdb->insert( $p . 'fit_workout_session_exercises', [
			'session_id'      => $sess_id,
			'exercise_id'     => $exercise->id,
			'slot_type'       => $slot_type,
			'planned_rep_min' => (int) $exercise->default_rep_min,
			'planned_rep_max' => (int) $exercise->default_rep_max,
			'planned_sets'    => (int) $exercise->default_sets,
			'sort_order'      => $next_order,
			'was_swapped'     => 0,
		] );

		return new \WP_REST_Response( [
			'added' => true,
			'session_exercise_id' => (int) $wpdb->insert_id,
			'exercise' => $exercise,
		] , 201 );
	}

	// ── POST /workout/{id}/skip ───────────────────────────────────────────────

	public static function skip_session( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$sess_id = (int) $req->get_param( 'id' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$skip_count = TrainingEngine::mark_skipped( $sess_id, $user_id );

		return new \WP_REST_Response( [
			'skipped'      => true,
			'skip_count'   => $skip_count,
			'skip_warning' => $skip_count >= 3,
		] );
	}

	// ── POST /workout/{id}/complete ───────────────────────────────────────────

	public static function complete_session( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p        = $wpdb->prefix;
		$user_id  = get_current_user_id();
		$sess_id  = (int) $req->get_param( 'id' );

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_sessions WHERE id = %d AND user_id = %d",
			$sess_id, $user_id
		) );

		if ( ! $session ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$actual_day_type = sanitize_text_field( $req->get_param( 'actual_day_type' ) ?: $session->planned_day_type );
		$started_at      = $session->started_at ?: current_time( 'mysql', true );
		$completed_at    = current_time( 'mysql', true );
		$started_dt      = new \DateTime( $started_at );
		$completed_dt    = new \DateTime( $completed_at );
		$duration_min    = (int) round( ( $completed_dt->getTimestamp() - $started_dt->getTimestamp() ) / 60 );

		$wpdb->update( $p . 'fit_workout_sessions', [
			'completed'       => 1,
			'actual_day_type' => $actual_day_type,
			'completed_at'    => $completed_at,
			'duration_minutes'=> $duration_min,
		], [ 'id' => $sess_id ] );

		// Generate PR snapshots + award evaluation
		$snapshots = TrainingEngine::record_snapshots( $sess_id );
		AwardEngine::evaluate( $user_id );

		// AI summary (async-friendly: non-blocking if it fails)
		$ai_summary = null;
		$summary_result = AiService::post_workout_summary( $user_id, $sess_id );
		if ( ! is_wp_error( $summary_result ) ) {
			$ai_summary = $summary_result;
		}

		AwardEngine::grant( $user_id, 'first_workout' );

		return new \WP_REST_Response( [
			'completed'      => true,
			'duration_minutes' => $duration_min,
			'snapshots'      => $snapshots,
			'ai_summary'     => $ai_summary,
		] );
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private static function user_owns_session( int $user_id, int $session_id ): bool {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT user_id FROM {$wpdb->prefix}fit_workout_sessions WHERE id = %d",
			$session_id
		) ) === $user_id;
	}

	private static function get_recent_history( int $user_id, int $exercise_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT snapshot_date, best_weight, best_reps, best_volume, estimated_1rm
			 FROM {$p}fit_exercise_performance_snapshots
			 WHERE user_id = %d AND exercise_id = %d
			 ORDER BY snapshot_date DESC
			 LIMIT 3",
			$user_id,
			exercise_id
		) );

		return is_array( $rows ) ? $rows : [];
	}

	private static function get_swap_options( object $session, object $exercise ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$day_json  = '"' . esc_sql( $session->planned_day_type ) . '"';
		$slot_json = '"' . esc_sql( $exercise->slot_type ) . '"';

		$options = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, name, primary_muscle, equipment, difficulty
			 FROM {$p}fit_exercises
			 WHERE active = 1
			   AND id != %d
			   AND primary_muscle = %s
			   AND JSON_CONTAINS(day_types_json, %s)
			   AND JSON_CONTAINS(slot_types_json, %s)
			 ORDER BY difficulty, name
			 LIMIT 4",
			(int) $exercise->exercise_id,
			(string) $exercise->primary_muscle,
			$day_json,
			$slot_json
		) );

		if ( empty( $options ) ) {
			$options = $wpdb->get_results( $wpdb->prepare(
				"SELECT id, name, primary_muscle, equipment, difficulty
				 FROM {$p}fit_exercises
				 WHERE active = 1
				   AND id != %d
				   AND JSON_CONTAINS(day_types_json, %s)
				   AND JSON_CONTAINS(slot_types_json, %s)
				 ORDER BY primary_muscle, difficulty, name
				 LIMIT 4",
				(int) $exercise->exercise_id,
				$day_json,
				$slot_json
			) );
		}

		foreach ( $options as $option ) {
			$option->swap_reason = self::build_swap_reason( $exercise, $option );
		}

		return is_array( $options ) ? $options : [];
	}

	private static function build_swap_reason( object $current, object $candidate ): string {
		$reasons = [];

		if ( ! empty( $candidate->primary_muscle ) && $candidate->primary_muscle === $current->primary_muscle ) {
			$reasons[] = 'hits the same primary muscle';
		}

		if ( ! empty( $candidate->equipment ) && ! empty( $current->equipment ) && $candidate->equipment !== $current->equipment ) {
			$reasons[] = 'changes the equipment demand';
		}

		if ( ! empty( $candidate->difficulty ) && ! empty( $current->difficulty ) && $candidate->difficulty !== $current->difficulty ) {
			$reasons[] = $candidate->difficulty === 'beginner' ? 'is easier to execute cleanly' : 'can give you a stronger progression angle';
		}

		if ( empty( $reasons ) ) {
			$reasons[] = 'fits the same session slot';
		}

		return ucfirst( implode( ' and ', array_slice( $reasons, 0, 2 ) ) ) . '.';
	}
}
