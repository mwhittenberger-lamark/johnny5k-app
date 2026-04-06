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

		register_rest_route( $ns, '/workout/current', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_current_session' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/history', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_recent_history_sessions' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/history/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ __CLASS__, 'update_history_session' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_history_session' ],
				'permission_callback' => $auth,
			],
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

		register_rest_route( $ns, '/workout/(?P<id>\d+)/set/(?P<set_id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'delete_set' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/set/restore', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'restore_set' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/exercise/(?P<session_exercise_id>\d+)/note', [
			'methods'             => 'PUT',
			'callback'            => [ __CLASS__, 'update_exercise_note' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/exercise/(?P<session_exercise_id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'remove_session_exercise' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/exercise/restore', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'restore_session_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/swap', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'swap_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/swap/undo', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'undo_swap_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/quick-add', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'quick_add_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/quick-add/undo', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'undo_quick_add_exercise' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/skip', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'skip_session' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );

		register_rest_route( $ns, '/workout/(?P<id>\d+)/restart', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'restart_session' ],
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
		$day_type  = self::normalize_day_type( $req->get_param( 'day_type' ) );
		$readiness = $req->get_param( 'readiness_score' ) !== null ? max( 1, min( 10, (int) $req->get_param( 'readiness_score' ) ) ) : null;
		$effective_time_tier = self::effective_time_tier( $time_tier, $readiness );

		// Prevent duplicate session for today
		global $wpdb;
		$today   = UserTime::today( $user_id );
		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s AND completed = 0 AND skip_requested = 0",
			$user_id, $today
		) );

		if ( $existing ) {
			if ( null !== $readiness ) {
				$wpdb->update( $wpdb->prefix . 'fit_workout_sessions', array_filter( [
					'readiness_score' => $readiness,
					'time_tier' => self::is_maintenance_readiness( $readiness ) ? $effective_time_tier : null,
				], fn( $value ) => null !== $value ), [ 'id' => $existing ] );
			}
			// Return the existing session instead of creating a duplicate
			$req->set_param( 'id', $existing );
			return self::get_session( $req );
		}

		$result = TrainingEngine::build_session( $user_id, $effective_time_tier, self::is_maintenance_readiness( $readiness ), $day_type );

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

	public static function get_current_session( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$session_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s AND completed = 0 AND skip_requested = 0
			 ORDER BY id DESC LIMIT 1",
			$user_id,
			UserTime::today( $user_id )
		) );

		if ( ! $session_id ) {
			return new \WP_REST_Response( [
				'session' => null,
				'exercises' => [],
				'session_mode' => 'normal',
			], 200 );
		}

		$req->set_param( 'id', $session_id );
		return self::get_session( $req );
	}

	public static function get_recent_history_sessions( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$days    = max( 1, min( 3, (int) ( $req->get_param( 'days' ) ?: 3 ) ) );
		$limit   = max( 1, min( 10, (int) ( $req->get_param( 'limit' ) ?: 10 ) ) );
		$cutoff  = UserTime::days_ago( $user_id, max( 0, $days - 1 ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT s.id, s.session_date, s.planned_day_type, s.actual_day_type, s.time_tier,
			        s.readiness_score, s.duration_minutes, s.completed_at,
			        COUNT(DISTINCT wse.id) AS exercise_count,
			        COALESCE(SUM(CASE WHEN ws.completed = 1 THEN 1 ELSE 0 END), 0) AS completed_sets
			 FROM {$p}fit_workout_sessions s
			 LEFT JOIN {$p}fit_workout_session_exercises wse ON wse.session_id = s.id
			 LEFT JOIN {$p}fit_workout_sets ws ON ws.session_exercise_id = wse.id
			 WHERE s.user_id = %d
			   AND s.completed = 1
			   AND s.skip_requested = 0
			   AND s.session_date >= %s
			 GROUP BY s.id
			 ORDER BY s.session_date DESC, s.id DESC
			 LIMIT %d",
			$user_id,
			$cutoff,
			$limit
		) );

		return new \WP_REST_Response( is_array( $rows ) ? $rows : [] );
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
			"SELECT wse.*, e.name AS exercise_name, e.primary_muscle, e.coaching_cues_json, e.equipment, e.difficulty, e.movement_pattern,
			        oe.name AS original_exercise_name
			 FROM {$p}fit_workout_session_exercises wse
			 JOIN {$p}fit_exercises e ON e.id = wse.exercise_id
			 LEFT JOIN {$p}fit_exercises oe ON oe.id = wse.original_exercise_id
			 WHERE wse.session_id = %d ORDER BY wse.sort_order",
			$sess_id
		) );
		$session_mode = self::session_mode_from_readiness( $session->readiness_score );

		foreach ( $exercises as $ex ) {
			$progression = TrainingEngine::recommended_progression( $user_id, (int) $ex->exercise_id );
			$ex->sets = $wpdb->get_results( $wpdb->prepare(
				"SELECT * FROM {$p}fit_workout_sets WHERE session_exercise_id = %d ORDER BY set_number",
				$ex->id
			) );
			$ex->recommended_weight = $progression['weight'];
			$ex->suggestion_note = 'maintenance' === $session_mode
				? 'Maintenance mode: get quality work in and stop well before grindy reps.'
				: $progression['note'];
			$ex->exercise_summary = self::build_exercise_summary( $ex );
			$ex->recent_history = self::get_recent_history( $user_id, (int) $ex->exercise_id );
			$ex->swap_options   = self::get_swap_options( $session, $ex );
		}

		return new \WP_REST_Response( [
			'session'   => $session,
			'exercises' => $exercises,
			'session_mode' => $session_mode,
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
			'completed'           => $req->get_param( 'completed' ) !== null ? (int) (bool) $req->get_param( 'completed' ) : 1,
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
			'completed'  => $req->get_param( 'completed' ) !== null ? (int) (bool) $req->get_param( 'completed' ) : null,
			'pain_flag'  => $req->get_param( 'pain_flag' ) !== null ? (int) (bool) $req->get_param( 'pain_flag' ) : null,
			'notes'      => $req->get_param( 'notes' )  !== null ? sanitize_text_field( $req->get_param( 'notes' ) ) : null,
		], fn( $v ) => $v !== null );

		if ( $update ) {
			$wpdb->update( $p . 'fit_workout_sets', $update, [ 'id' => $set_id ] );
		}

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	public static function update_exercise_note( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p                   = $wpdb->prefix;
		$user_id             = get_current_user_id();
		$sess_id             = (int) $req->get_param( 'id' );
		$session_exercise_id = (int) $req->get_param( 'session_exercise_id' );
		$notes               = sanitize_textarea_field( (string) $req->get_param( 'notes' ) );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		if ( ! self::session_contains_exercise( $sess_id, $session_exercise_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found in session.' ], 404 );
		}

		$wpdb->update(
			$p . 'fit_workout_session_exercises',
			[ 'notes' => '' !== trim( $notes ) ? $notes : null ],
			[ 'id' => $session_exercise_id, 'session_id' => $sess_id ],
			[ '%s' ],
			[ '%d', '%d' ]
		);

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	public static function delete_set( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p        = $wpdb->prefix;
		$user_id  = get_current_user_id();
		$sess_id  = (int) $req->get_param( 'id' );
		$set_id   = (int) $req->get_param( 'set_id' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$set = $wpdb->get_row( $wpdb->prepare(
			"SELECT ws.*
			 FROM {$p}fit_workout_sets ws
			 JOIN {$p}fit_workout_session_exercises wse ON wse.id = ws.session_exercise_id
			 WHERE ws.id = %d AND wse.session_id = %d",
			$set_id,
			$sess_id
		) );

		if ( ! $set ) {
			return new \WP_REST_Response( [ 'message' => 'Set not found.' ], 404 );
		}

		$wpdb->delete( $p . 'fit_workout_sets', [ 'id' => $set_id ], [ '%d' ] );
		self::resequence_set_numbers( (int) $set->session_exercise_id );

		return new \WP_REST_Response( [
			'deleted' => true,
			'set' => [
				'session_exercise_id' => (int) $set->session_exercise_id,
				'set_number' => (int) $set->set_number,
				'weight' => (float) $set->weight,
				'reps' => (int) $set->reps,
				'rir' => null !== $set->rir ? (float) $set->rir : null,
				'rpe' => null !== $set->rpe ? (float) $set->rpe : null,
				'completed' => (int) $set->completed,
				'pain_flag' => (int) $set->pain_flag,
				'notes' => $set->notes,
			],
		] );
	}

	public static function restore_set( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p                   = $wpdb->prefix;
		$user_id             = get_current_user_id();
		$sess_id             = (int) $req->get_param( 'id' );
		$session_exercise_id = (int) $req->get_param( 'session_exercise_id' );
		$set_number          = max( 1, (int) ( $req->get_param( 'set_number' ) ?: 1 ) );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		if ( ! self::session_contains_exercise( $sess_id, $session_exercise_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found in session.' ], 404 );
		}

		$wpdb->query( $wpdb->prepare(
			"UPDATE {$p}fit_workout_sets
			 SET set_number = set_number + 1
			 WHERE session_exercise_id = %d AND set_number >= %d",
			$session_exercise_id,
			$set_number
		) );

		$wpdb->insert( $p . 'fit_workout_sets', array_filter( [
			'session_exercise_id' => $session_exercise_id,
			'set_number' => $set_number,
			'weight' => (float) ( $req->get_param( 'weight' ) ?: 0 ),
			'reps' => (int) ( $req->get_param( 'reps' ) ?: 0 ),
			'rir' => $req->get_param( 'rir' ) !== null ? (float) $req->get_param( 'rir' ) : null,
			'rpe' => $req->get_param( 'rpe' ) !== null ? (float) $req->get_param( 'rpe' ) : null,
			'completed' => $req->get_param( 'completed' ) !== null ? (int) (bool) $req->get_param( 'completed' ) : 1,
			'pain_flag' => (int) (bool) $req->get_param( 'pain_flag' ),
			'notes' => sanitize_text_field( $req->get_param( 'notes' ) ?: '' ) ?: null,
		], fn( $value ) => null !== $value ) );

		self::resequence_set_numbers( $session_exercise_id );

		return new \WP_REST_Response( [ 'restored' => true, 'set_id' => (int) $wpdb->insert_id ], 201 );
	}

	public static function remove_session_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p                   = $wpdb->prefix;
		$user_id             = get_current_user_id();
		$sess_id             = (int) $req->get_param( 'id' );
		$session_exercise_id = (int) $req->get_param( 'session_exercise_id' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$exercise = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_session_exercises WHERE id = %d AND session_id = %d",
			$session_exercise_id,
			$sess_id
		) );

		if ( ! $exercise ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found in session.' ], 404 );
		}

		$sets = $wpdb->get_results( $wpdb->prepare(
			"SELECT set_number, weight, reps, rir, rpe, completed, pain_flag, notes
			 FROM {$p}fit_workout_sets
			 WHERE session_exercise_id = %d
			 ORDER BY set_number, id",
			$session_exercise_id
		) );

		$wpdb->delete( $p . 'fit_workout_sets', [ 'session_exercise_id' => $session_exercise_id ], [ '%d' ] );
		$wpdb->delete( $p . 'fit_workout_session_exercises', [ 'id' => $session_exercise_id, 'session_id' => $sess_id ], [ '%d', '%d' ] );
		self::resequence_session_sort_order( $sess_id );

		return new \WP_REST_Response( [
			'removed' => true,
			'exercise' => [
				'session_id' => (int) $exercise->session_id,
				'exercise_id' => (int) $exercise->exercise_id,
				'slot_type' => (string) $exercise->slot_type,
				'planned_rep_min' => (int) $exercise->planned_rep_min,
				'planned_rep_max' => (int) $exercise->planned_rep_max,
				'planned_sets' => (int) $exercise->planned_sets,
				'sort_order' => (int) $exercise->sort_order,
				'was_swapped' => (int) $exercise->was_swapped,
				'original_exercise_id' => null !== $exercise->original_exercise_id ? (int) $exercise->original_exercise_id : null,
				'notes' => $exercise->notes,
				'sets' => array_map( static function( $set ) {
					return [
						'set_number' => (int) $set->set_number,
						'weight' => (float) $set->weight,
						'reps' => (int) $set->reps,
						'rir' => null !== $set->rir ? (float) $set->rir : null,
						'rpe' => null !== $set->rpe ? (float) $set->rpe : null,
						'completed' => (int) $set->completed,
						'pain_flag' => (int) $set->pain_flag,
						'notes' => $set->notes,
					];
				}, is_array( $sets ) ? $sets : [] ),
			],
		] );
	}

	public static function restore_session_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p             = $wpdb->prefix;
		$user_id       = get_current_user_id();
		$sess_id       = (int) $req->get_param( 'id' );
		$sort_order    = max( 1, (int) ( $req->get_param( 'sort_order' ) ?: 1 ) );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		$wpdb->query( $wpdb->prepare(
			"UPDATE {$p}fit_workout_session_exercises
			 SET sort_order = sort_order + 1
			 WHERE session_id = %d AND sort_order >= %d",
			$sess_id,
			$sort_order
		) );

		$wpdb->insert( $p . 'fit_workout_session_exercises', array_filter( [
			'session_id' => $sess_id,
			'exercise_id' => (int) $req->get_param( 'exercise_id' ),
			'slot_type' => sanitize_text_field( $req->get_param( 'slot_type' ) ?: 'accessory' ),
			'planned_rep_min' => (int) ( $req->get_param( 'planned_rep_min' ) ?: 8 ),
			'planned_rep_max' => (int) ( $req->get_param( 'planned_rep_max' ) ?: 12 ),
			'planned_sets' => (int) ( $req->get_param( 'planned_sets' ) ?: 1 ),
			'sort_order' => $sort_order,
			'was_swapped' => $req->get_param( 'was_swapped' ) !== null ? (int) (bool) $req->get_param( 'was_swapped' ) : 0,
			'original_exercise_id' => $req->get_param( 'original_exercise_id' ) !== null ? (int) $req->get_param( 'original_exercise_id' ) : null,
			'notes' => $req->get_param( 'notes' ) !== null ? sanitize_textarea_field( (string) $req->get_param( 'notes' ) ) : null,
		], fn( $value ) => null !== $value ) );

		$restored_session_exercise_id = (int) $wpdb->insert_id;
		$sets = $req->get_param( 'sets' );
		if ( is_array( $sets ) ) {
			foreach ( $sets as $set ) {
				$wpdb->insert( $p . 'fit_workout_sets', array_filter( [
					'session_exercise_id' => $restored_session_exercise_id,
					'set_number' => max( 1, (int) ( $set['set_number'] ?? 1 ) ),
					'weight' => (float) ( $set['weight'] ?? 0 ),
					'reps' => (int) ( $set['reps'] ?? 0 ),
					'rir' => array_key_exists( 'rir', $set ) && null !== $set['rir'] ? (float) $set['rir'] : null,
					'rpe' => array_key_exists( 'rpe', $set ) && null !== $set['rpe'] ? (float) $set['rpe'] : null,
					'completed' => array_key_exists( 'completed', $set ) ? (int) (bool) $set['completed'] : 1,
					'pain_flag' => array_key_exists( 'pain_flag', $set ) ? (int) (bool) $set['pain_flag'] : 0,
					'notes' => array_key_exists( 'notes', $set ) && null !== $set['notes'] ? sanitize_text_field( (string) $set['notes'] ) : null,
				], fn( $value ) => null !== $value ) );
			}
		}

		self::resequence_session_sort_order( $sess_id );

		return new \WP_REST_Response( [ 'restored' => true, 'session_exercise_id' => $restored_session_exercise_id ], 201 );
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

		if ( $orig_ex_id === $new_ex_id ) {
			return new \WP_REST_Response( [ 'message' => 'That exercise is already active.' ], 400 );
		}

		$new_ex = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, name, primary_muscle, equipment, difficulty
			 FROM {$p}fit_exercises
			 WHERE id = %d AND active = 1",
			$new_ex_id
		) );

		if ( ! $new_ex ) {
			return new \WP_REST_Response( [ 'message' => 'Selected swap exercise is not available.' ], 404 );
		}

		$existing_original_id = $wpdb->get_var( $wpdb->prepare(
			"SELECT original_exercise_id FROM {$p}fit_workout_session_exercises WHERE id = %d AND session_id = %d",
			$ses_ex_id,
			$sess_id
		) );

		$wpdb->update( $p . 'fit_workout_session_exercises', [
			'exercise_id'           => $new_ex_id,
			'was_swapped'           => 1,
			'original_exercise_id'  => $existing_original_id ? (int) $existing_original_id : $orig_ex_id,
		], [ 'id' => $ses_ex_id ] );

		return new \WP_REST_Response( [ 'swapped' => true, 'exercise' => $new_ex ] );
	}

	public static function undo_swap_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p                         = $wpdb->prefix;
		$user_id                   = get_current_user_id();
		$sess_id                   = (int) $req->get_param( 'id' );
		$ses_ex_id                 = (int) $req->get_param( 'session_exercise_id' );
		$previous_exercise_id      = (int) $req->get_param( 'previous_exercise_id' );
		$previous_original_id      = $req->get_param( 'previous_original_exercise_id' ) !== null ? (int) $req->get_param( 'previous_original_exercise_id' ) : null;
		$previous_was_swapped      = (int) (bool) $req->get_param( 'previous_was_swapped' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		if ( ! self::session_contains_exercise( $sess_id, $ses_ex_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found in session.' ], 404 );
		}

		$update = [
			'exercise_id' => $previous_exercise_id,
			'was_swapped' => $previous_was_swapped,
		];

		if ( null === $previous_original_id ) {
			$update['original_exercise_id'] = null;
		} else {
			$update['original_exercise_id'] = $previous_original_id;
		}

		$wpdb->update( $p . 'fit_workout_session_exercises', $update, [ 'id' => $ses_ex_id, 'session_id' => $sess_id ], [ '%d', '%d', '%d' ], [ '%d', '%d' ] );

		return new \WP_REST_Response( [ 'undone' => true ] );
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

	public static function undo_quick_add_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p                     = $wpdb->prefix;
		$user_id               = get_current_user_id();
		$sess_id               = (int) $req->get_param( 'id' );
		$session_exercise_id   = (int) $req->get_param( 'session_exercise_id' );

		if ( ! self::user_owns_session( $user_id, $sess_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		if ( ! self::session_contains_exercise( $sess_id, $session_exercise_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Exercise not found in session.' ], 404 );
		}

		$wpdb->delete( $p . 'fit_workout_sets', [ 'session_exercise_id' => $session_exercise_id ], [ '%d' ] );
		$wpdb->delete( $p . 'fit_workout_session_exercises', [ 'id' => $session_exercise_id, 'session_id' => $sess_id ], [ '%d', '%d' ] );

		return new \WP_REST_Response( [ 'undone' => true ] );
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

	public static function restart_session( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$sess_id = (int) $req->get_param( 'id' );

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_sessions WHERE id = %d AND user_id = %d",
			$sess_id,
			$user_id
		) );

		if ( ! $session ) {
			return new \WP_REST_Response( [ 'message' => 'Session not found.' ], 404 );
		}

		if ( (int) $session->completed ) {
			return new \WP_REST_Response( [ 'message' => 'Completed sessions cannot be restarted.' ], 400 );
		}

		self::delete_session_records( $sess_id, $user_id );

		return new \WP_REST_Response( [ 'restarted' => true ] );
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

		if ( 'rest' === $actual_day_type ) {
			return new \WP_REST_Response( [
				'completed'        => true,
				'duration_minutes' => 0,
				'snapshots'        => [],
				'ai_summary'       => null,
				'rest_day'         => true,
			] );
		}

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

	public static function update_history_session( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$sess_id = (int) $req->get_param( 'id' );
		$session = self::get_history_session_record( $user_id, $sess_id );

		if ( ! $session ) {
			return new \WP_REST_Response( [ 'message' => 'Workout not found.' ], 404 );
		}

		if ( ! self::is_history_session_editable( $session, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Only completed workouts from the last 3 days can be edited.' ], 400 );
		}

		$update = [];
		$today  = UserTime::today( $user_id );
		$cutoff = UserTime::days_ago( $user_id, 2 );

		if ( null !== $req->get_param( 'session_date' ) ) {
			$session_date = sanitize_text_field( (string) $req->get_param( 'session_date' ) );
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $session_date ) || $session_date < $cutoff || $session_date > $today ) {
				return new \WP_REST_Response( [ 'message' => 'Workout date must stay within the last 3 days.' ], 400 );
			}
			$update['session_date'] = $session_date;
		}

		if ( null !== $req->get_param( 'actual_day_type' ) ) {
			$day_type = self::normalize_day_type( $req->get_param( 'actual_day_type' ) );
			if ( null === $day_type ) {
				return new \WP_REST_Response( [ 'message' => 'Workout type is invalid.' ], 400 );
			}
			$update['actual_day_type'] = $day_type;
		}

		if ( null !== $req->get_param( 'time_tier' ) ) {
			$time_tier = sanitize_key( (string) $req->get_param( 'time_tier' ) );
			if ( ! in_array( $time_tier, [ 'short', 'medium', 'full' ], true ) ) {
				return new \WP_REST_Response( [ 'message' => 'Workout time tier is invalid.' ], 400 );
			}
			$update['time_tier'] = $time_tier;
		}

		if ( null !== $req->get_param( 'duration_minutes' ) ) {
			$update['duration_minutes'] = max( 0, min( 600, (int) $req->get_param( 'duration_minutes' ) ) );
		}

		if ( null !== $req->get_param( 'readiness_score' ) ) {
			$raw_readiness = $req->get_param( 'readiness_score' );
			$update['readiness_score'] = '' === (string) $raw_readiness ? null : max( 1, min( 10, (int) $raw_readiness ) );
		}

		if ( $update ) {
			$wpdb->update( $p . 'fit_workout_sessions', $update, [ 'id' => $sess_id, 'user_id' => $user_id ] );
			if ( isset( $update['session_date'] ) && $update['session_date'] !== $session->session_date ) {
				self::move_session_snapshots( $sess_id, $user_id, (string) $session->session_date, (string) $update['session_date'] );
			}
		}

		$updated = self::get_history_session_summary( $user_id, $sess_id );

		return new \WP_REST_Response( $updated ?: [ 'updated' => true ] );
	}

	public static function delete_history_session( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$sess_id = (int) $req->get_param( 'id' );
		$session = self::get_history_session_record( $user_id, $sess_id );

		if ( ! $session ) {
			return new \WP_REST_Response( [ 'message' => 'Workout not found.' ], 404 );
		}

		if ( ! self::is_history_session_editable( $session, $user_id ) ) {
			return new \WP_REST_Response( [ 'message' => 'Only completed workouts from the last 3 days can be deleted.' ], 400 );
		}

		self::delete_session_snapshots( $sess_id, $user_id, (string) $session->session_date );
		self::delete_session_records( $sess_id, $user_id );

		return new \WP_REST_Response( [ 'deleted' => true ] );
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private static function user_owns_session( int $user_id, int $session_id ): bool {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT user_id FROM {$wpdb->prefix}fit_workout_sessions WHERE id = %d",
			$session_id
		) ) === $user_id;
	}

	private static function session_contains_exercise( int $session_id, int $session_exercise_id ): bool {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_session_exercises WHERE id = %d AND session_id = %d",
			$session_exercise_id,
			$session_id
		) ) > 0;
	}

	private static function get_history_session_record( int $user_id, int $session_id ): ?object {
		global $wpdb;
		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_workout_sessions WHERE id = %d AND user_id = %d",
			$session_id,
			$user_id
		) );

		return $session ?: null;
	}

	private static function is_history_session_editable( object $session, int $user_id ): bool {
		if ( ! (int) $session->completed || (int) $session->skip_requested ) {
			return false;
		}

		$cutoff = UserTime::days_ago( $user_id, 2 );
		$today  = UserTime::today( $user_id );

		return $session->session_date >= $cutoff && $session->session_date <= $today;
	}

	private static function get_history_session_summary( int $user_id, int $session_id ): ?object {
		global $wpdb;
		$p = $wpdb->prefix;

		$row = $wpdb->get_row( $wpdb->prepare(
			"SELECT s.id, s.session_date, s.planned_day_type, s.actual_day_type, s.time_tier,
			        s.readiness_score, s.duration_minutes, s.completed_at,
			        COUNT(DISTINCT wse.id) AS exercise_count,
			        COALESCE(SUM(CASE WHEN ws.completed = 1 THEN 1 ELSE 0 END), 0) AS completed_sets
			 FROM {$p}fit_workout_sessions s
			 LEFT JOIN {$p}fit_workout_session_exercises wse ON wse.session_id = s.id
			 LEFT JOIN {$p}fit_workout_sets ws ON ws.session_exercise_id = wse.id
			 WHERE s.user_id = %d AND s.id = %d
			 GROUP BY s.id",
			$user_id,
			$session_id
		) );

		return $row ?: null;
	}

	private static function delete_session_records( int $session_id, int $user_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$session_exercise_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT id FROM {$p}fit_workout_session_exercises WHERE session_id = %d",
			$session_id
		) );

		if ( ! empty( $session_exercise_ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $session_exercise_ids ), '%d' ) );
			$wpdb->query( $wpdb->prepare(
				"DELETE FROM {$p}fit_workout_sets WHERE session_exercise_id IN ($placeholders)",
				...array_map( 'intval', $session_exercise_ids )
			) );
		}

		$wpdb->delete( $p . 'fit_workout_session_exercises', [ 'session_id' => $session_id ], [ '%d' ] );
		$wpdb->delete( $p . 'fit_workout_sessions', [ 'id' => $session_id, 'user_id' => $user_id ], [ '%d', '%d' ] );
	}

	private static function move_session_snapshots( int $session_id, int $user_id, string $from_date, string $to_date ): void {
		global $wpdb;
		$p = $wpdb->prefix;
		$exercise_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT exercise_id FROM {$p}fit_workout_session_exercises WHERE session_id = %d",
			$session_id
		) );

		if ( empty( $exercise_ids ) ) {
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $exercise_ids ), '%d' ) );
		$args = array_merge( [ $to_date, $user_id, $from_date ], array_map( 'intval', $exercise_ids ) );
		$wpdb->query( $wpdb->prepare(
			"UPDATE {$p}fit_exercise_performance_snapshots
			 SET snapshot_date = %s
			 WHERE user_id = %d
			   AND snapshot_date = %s
			   AND exercise_id IN ($placeholders)",
			...$args
		) );
	}

	private static function delete_session_snapshots( int $session_id, int $user_id, string $session_date ): void {
		global $wpdb;
		$p = $wpdb->prefix;
		$exercise_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT exercise_id FROM {$p}fit_workout_session_exercises WHERE session_id = %d",
			$session_id
		) );

		if ( empty( $exercise_ids ) ) {
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $exercise_ids ), '%d' ) );
		$args = array_merge( [ $user_id, $session_date ], array_map( 'intval', $exercise_ids ) );
		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$p}fit_exercise_performance_snapshots
			 WHERE user_id = %d
			   AND snapshot_date = %s
			   AND exercise_id IN ($placeholders)",
			...$args
		) );
	}

	private static function resequence_set_numbers( int $session_exercise_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$set_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT id FROM {$p}fit_workout_sets WHERE session_exercise_id = %d ORDER BY set_number, id",
			$session_exercise_id
		) );

		if ( empty( $set_ids ) ) {
			return;
		}

		$position = 1;
		foreach ( $set_ids as $set_id ) {
			$wpdb->update( $p . 'fit_workout_sets', [ 'set_number' => $position ], [ 'id' => (int) $set_id ], [ '%d' ], [ '%d' ] );
			$position++;
		}
	}

	private static function resequence_session_sort_order( int $session_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$exercise_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT id FROM {$p}fit_workout_session_exercises WHERE session_id = %d ORDER BY sort_order, id",
			$session_id
		) );

		if ( empty( $exercise_ids ) ) {
			return;
		}

		$position = 1;
		foreach ( $exercise_ids as $exercise_id ) {
			$wpdb->update( $p . 'fit_workout_session_exercises', [ 'sort_order' => $position ], [ 'id' => (int) $exercise_id ], [ '%d' ], [ '%d' ] );
			$position++;
		}
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
			$exercise_id
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

	private static function build_exercise_summary( object $exercise ): string {
		$movement  = self::humanize_token( (string) ( $exercise->movement_pattern ?? '' ) );
		$muscle    = self::humanize_token( (string) ( $exercise->primary_muscle ?? '' ) );
		$equipment = self::humanize_token( (string) ( $exercise->equipment ?? '' ) );

		if ( $movement && $muscle ) {
			$summary = sprintf( 'A %1$s movement focused on %2$s.', strtolower( $movement ), strtolower( $muscle ) );
		} elseif ( $muscle ) {
			$summary = sprintf( 'A movement aimed at building %s.', strtolower( $muscle ) );
		} else {
			$summary = 'A controlled movement with a focus on clean reps and repeatable form.';
		}

		if ( $equipment ) {
			$summary .= ' Use ' . strtolower( $equipment ) . ' and own the full range you can control.';
		}

		return $summary;
	}

	private static function humanize_token( string $value ): string {
		if ( '' === $value ) {
			return '';
		}

		return trim( ucwords( str_replace( [ '_', '-' ], ' ', $value ) ) );
	}

	private static function is_maintenance_readiness( ?int $readiness ): bool {
		return null !== $readiness && $readiness <= 3;
	}

	private static function effective_time_tier( string $time_tier, ?int $readiness ): string {
		return self::is_maintenance_readiness( $readiness ) ? 'short' : $time_tier;
	}

	private static function session_mode_from_readiness( $readiness ): string {
		return self::is_maintenance_readiness( null !== $readiness ? (int) $readiness : null ) ? 'maintenance' : 'normal';
	}

	private static function normalize_day_type( $value ): ?string {
		if ( ! is_string( $value ) || '' === $value ) {
			return null;
		}

		$day_type = sanitize_key( $value );
		$allowed  = [ 'push', 'pull', 'legs', 'arms_shoulders', 'cardio', 'rest' ];

		return in_array( $day_type, $allowed, true ) ? $day_type : null;
	}
}
