<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\TrainingEngine;
use Johnny5k\Services\ExerciseLibraryService;
use Johnny5k\Services\PrebuiltWorkoutLibraryService;
use Johnny5k\Services\UserTime;
use Johnny5k\Services\AiService;
use Johnny5k\Services\AwardEngine;
use Johnny5k\Services\BehaviorAnalyticsService;
use Johnny5k\Services\WorkoutActionService;
use Johnny5k\Support\TrainingDayTypes;

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
	private const CUSTOM_WORKOUT_DRAFT_META = 'jf_custom_workout_draft';
	private const CUSTOM_WORKOUT_SESSION_TITLES_META = 'jf_custom_workout_session_titles';

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/workout/start', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'start' ],
			'permission_callback' => $auth,
			'args'                => [
				'time_tier'       => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => [ __CLASS__, 'validate_time_tier' ] ],
				'day_type'        => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => [ __CLASS__, 'validate_day_type' ] ],
				'readiness_score' => [ 'required' => false, 'type' => 'integer', 'validate_callback' => [ __CLASS__, 'validate_readiness_score' ] ],
			],
		] );

		register_rest_route( $ns, '/workout/preview', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'preview' ],
			'permission_callback' => $auth,
			'args'                => [
				'time_tier'       => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => [ __CLASS__, 'validate_time_tier' ] ],
				'day_type'        => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => [ __CLASS__, 'validate_day_type' ] ],
				'readiness_score' => [ 'required' => false, 'type' => 'integer', 'validate_callback' => [ __CLASS__, 'validate_readiness_score' ] ],
			],
		] );

		register_rest_route( $ns, '/workout/current', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_current_session' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/custom-draft', [
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'save_custom_draft' ],
				'permission_callback' => $auth,
				'args'                => [
					'time_tier' => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => [ __CLASS__, 'validate_time_tier' ] ],
				],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_custom_draft' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/workout/prebuilt-library', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_prebuilt_workout_library' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/workout/prebuilt-library/(?P<id>\d+)/queue', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'queue_prebuilt_workout' ],
			'permission_callback' => $auth,
			'args'                => [
				'id'        => [ 'required' => true, 'type' => 'integer' ],
				'time_tier' => [ 'required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'validate_callback' => [ __CLASS__, 'validate_time_tier' ] ],
			],
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

		register_rest_route( $ns, '/workout/(?P<id>\d+)/discard', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'discard_session' ],
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
		$time_tier = self::normalize_time_tier( $req->get_param( 'time_tier' ) ) ?: 'medium';
		$day_type  = self::normalize_day_type( $req->get_param( 'day_type' ) );
		$custom_workout_draft_id = sanitize_text_field( (string) ( $req->get_param( 'custom_workout_draft_id' ) ?: '' ) );
		$readiness = $req->get_param( 'readiness_score' ) !== null ? max( 1, min( 10, (int) $req->get_param( 'readiness_score' ) ) ) : null;
		$effective_time_tier = self::effective_time_tier( $time_tier, $readiness );
		$exercise_swaps = self::normalise_exercise_swaps( $req->get_param( 'exercise_swaps' ) );
		$exercise_order = self::normalise_exercise_order( $req->get_param( 'exercise_order' ) );
		$rep_adjustments = self::normalise_rep_adjustments( $req->get_param( 'rep_adjustments' ) );
		$exercise_removals = self::normalise_exercise_removals( $req->get_param( 'exercise_removals' ) );
		$exercise_additions = self::normalise_exercise_additions( $req->get_param( 'exercise_additions' ) );

		// Prevent duplicate session for today
		global $wpdb;
		$today   = UserTime::today( $user_id );
		$existing = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, planned_day_type FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s AND completed = 0 AND skip_requested = 0
			 ORDER BY id DESC LIMIT 1",
			$user_id,
			$today
		) );

		if ( $existing ) {
			$requested_prepared_plan = ! empty( $exercise_swaps ) || ! empty( $exercise_order ) || ! empty( $rep_adjustments ) || ! empty( $exercise_removals ) || ! empty( $exercise_additions ) || '' !== $custom_workout_draft_id;
			$requested_day_change    = null !== $day_type && $day_type !== (string) $existing->planned_day_type;

			if ( $requested_prepared_plan || $requested_day_change ) {
				self::delete_active_sessions_for_date( $user_id, $today );
				$existing = null;
			}
		}

		if ( $existing ) {
			$session_started_at = $wpdb->get_var( $wpdb->prepare(
				"SELECT started_at FROM {$wpdb->prefix}fit_workout_sessions WHERE id = %d",
				$existing->id
			) );

			if ( null !== $readiness ) {
				$wpdb->update( $wpdb->prefix . 'fit_workout_sessions', array_filter( [
					'readiness_score' => $readiness,
					'started_at' => $session_started_at ?: current_time( 'mysql', true ),
					'time_tier' => self::is_maintenance_readiness( $readiness ) ? $effective_time_tier : null,
				], fn( $value ) => null !== $value ), [ 'id' => $existing->id ] );
			} elseif ( ! $session_started_at ) {
				$wpdb->update( $wpdb->prefix . 'fit_workout_sessions', [
					'started_at' => current_time( 'mysql', true ),
				], [ 'id' => $existing->id ] );
			}
			BehaviorAnalyticsService::track(
				$user_id,
				'workout_start',
				'workout',
				'existing_session',
				null,
				[
					'session_id' => (int) $existing->id,
					'day_type' => (string) ( $existing->planned_day_type ?? '' ),
					'time_tier' => (string) $effective_time_tier,
					'readiness_score' => null !== $readiness ? (int) $readiness : null,
				]
			);
			// Return the existing session instead of creating a duplicate
			$req->set_param( 'id', $existing->id );
			return self::get_session( $req );
		}

		if ( '' !== $custom_workout_draft_id ) {
			$draft = self::get_custom_workout_draft( $user_id );
			if ( empty( $draft['id'] ) || $custom_workout_draft_id !== (string) $draft['id'] ) {
				return new \WP_REST_Response( [ 'message' => 'That custom workout is no longer available.' ], 404 );
			}

			$result = self::build_custom_session( $user_id, $draft, $effective_time_tier, $readiness, $exercise_order, $rep_adjustments, $exercise_removals, $exercise_additions );
		} else {
			$result = static::build_training_session( $user_id, $effective_time_tier, self::is_maintenance_readiness( $readiness ), $day_type, $exercise_swaps, $exercise_order, $rep_adjustments, $exercise_removals, $exercise_additions );
		}

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

		if ( '' !== $custom_workout_draft_id ) {
			self::store_custom_workout_session_title( $user_id, (int) $result['session_id'], (string) ( $draft['name'] ?? 'Custom workout' ) );
			self::delete_custom_workout_draft_for_user( $user_id );
		}
		BehaviorAnalyticsService::track(
			$user_id,
			'workout_start',
			'workout',
			'new_session',
			null,
			[
				'session_id' => (int) ( $result['session_id'] ?? 0 ),
				'day_type' => (string) ( $result['day_type'] ?? $day_type ?? '' ),
				'time_tier' => (string) $effective_time_tier,
				'readiness_score' => null !== $readiness ? (int) $readiness : null,
				'custom_workout' => '' !== $custom_workout_draft_id,
			]
		);

		return new \WP_REST_Response( $result, 201 );
	}

	public static function preview( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id   = get_current_user_id();
		$time_tier = self::normalize_time_tier( $req->get_param( 'time_tier' ) ) ?: 'medium';
		$day_type  = self::normalize_day_type( $req->get_param( 'day_type' ) );
		$custom_workout_draft_id = sanitize_text_field( (string) ( $req->get_param( 'custom_workout_draft_id' ) ?: '' ) );
		$readiness = $req->get_param( 'readiness_score' ) !== null ? max( 1, min( 10, (int) $req->get_param( 'readiness_score' ) ) ) : null;
		$effective_time_tier = self::effective_time_tier( $time_tier, $readiness );
		$exercise_swaps = self::normalise_exercise_swaps( $req->get_param( 'exercise_swaps' ) );
		$exercise_order = self::normalise_exercise_order( $req->get_param( 'exercise_order' ) );
		$rep_adjustments = self::normalise_rep_adjustments( $req->get_param( 'rep_adjustments' ) );
		$exercise_removals = self::normalise_exercise_removals( $req->get_param( 'exercise_removals' ) );
		$exercise_additions = self::normalise_exercise_additions( $req->get_param( 'exercise_additions' ) );

		if ( '' !== $custom_workout_draft_id ) {
			$draft = self::get_custom_workout_draft( $user_id );
			if ( empty( $draft['id'] ) || $custom_workout_draft_id !== (string) $draft['id'] ) {
				return new \WP_REST_Response( [ 'message' => 'That custom workout is no longer available.' ], 404 );
			}

			$result = self::build_custom_preview( $draft, $effective_time_tier, $readiness, $exercise_order, $rep_adjustments, $exercise_removals, $exercise_additions );
		} else {
			$result = TrainingEngine::preview_session( $user_id, $effective_time_tier, self::is_maintenance_readiness( $readiness ), $day_type, $exercise_swaps, $exercise_order, $rep_adjustments, $exercise_removals, $exercise_additions );
		}
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		$preview_day_type = (string) ( $result['day_type'] ?? $day_type ?? '' );
		$result['exercises'] = array_map( static function( array $exercise ) use ( $preview_day_type, $user_id, $custom_workout_draft_id ): array {
			if ( '' !== $custom_workout_draft_id ) {
				$exercise['swap_options'] = [];
				return $exercise;
			}
			$exercise['swap_options'] = self::get_swap_options_for_day_type( $user_id, $preview_day_type, (object) $exercise );
			return $exercise;
		}, is_array( $result['exercises'] ?? null ) ? $result['exercises'] : [] );

		return new \WP_REST_Response( $result, 200 );
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
				'custom_workout_draft' => self::get_custom_workout_draft( $user_id ),
			], 200 );
		}

		$req->set_param( 'id', $session_id );
		return self::get_session( $req );
	}

	public static function get_recent_history_sessions( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$days    = max( 1, min( 365, (int) ( $req->get_param( 'days' ) ?: 3 ) ) );
		$limit   = max( 1, min( 90, (int) ( $req->get_param( 'limit' ) ?: 10 ) ) );
		$cutoff  = UserTime::days_ago( $user_id, max( 0, $days - 1 ) );

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT s.id, s.session_date, s.planned_day_type, s.actual_day_type, s.time_tier,
			        s.readiness_score, s.duration_minutes, s.estimated_calories, s.completed_at,
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
		$session->custom_title = self::get_custom_workout_session_title( $user_id, $sess_id );

		if ( ! $session->completed && ! $session->skip_requested && empty( $session->started_at ) ) {
			$session->started_at = current_time( 'mysql', true );
			$wpdb->update( $p . 'fit_workout_sessions', [
				'started_at' => $session->started_at,
			], [ 'id' => $sess_id, 'user_id' => $user_id ] );
		}

		$exercises = $wpdb->get_results( $wpdb->prepare(
			"SELECT wse.*, e.name AS exercise_name, e.description AS exercise_description, e.primary_muscle,
			        e.secondary_muscles_json, e.coaching_cues_json, e.equipment, e.difficulty, e.movement_pattern,
			        e.day_types_json, e.slot_types_json,
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
			$is_bonus_fill = self::session_exercise_has_bonus_fill_marker( is_string( $ex->notes ?? null ) ? $ex->notes : '' );
			$ex->sets = $wpdb->get_results( $wpdb->prepare(
				"SELECT * FROM {$p}fit_workout_sets WHERE session_exercise_id = %d ORDER BY set_number",
				$ex->id
			) );
			$ex->recommended_weight = $progression['weight'];
			$ex->suggestion_note = $is_bonus_fill
				? sprintf( 'Full session bonus %s added automatically.', (string) $ex->slot_type )
				: ( 'maintenance' === $session_mode
					? 'Maintenance mode: get quality work in and stop well before grindy reps.'
					: $progression['note'] );
			$ex->is_bonus_fill = $is_bonus_fill;
			$ex->notes = self::strip_session_exercise_system_markers( is_string( $ex->notes ?? null ) ? $ex->notes : '' );
			$ex->secondary_muscles = self::decode_json_list( $ex->secondary_muscles_json ?? '' );
			$ex->coaching_cues     = self::decode_json_list( $ex->coaching_cues_json ?? '' );
			$ex->day_types         = self::decode_json_list( $ex->day_types_json ?? '' );
			$ex->slot_types        = self::decode_json_list( $ex->slot_types_json ?? '' );
			$ex->exercise_summary = self::build_exercise_summary( $ex );
			$ex->recent_history = self::get_recent_history( $user_id, (int) $ex->exercise_id );
			$ex->swap_options   = self::get_swap_options( $user_id, $session, $ex );
		}

		return new \WP_REST_Response( [
			'session'   => $session,
			'exercises' => $exercises,
			'session_mode' => $session_mode,
		] );
	}

	public static function save_custom_draft( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$result = self::save_custom_workout_draft_for_user( $user_id, $req->get_json_params() ?: $req->get_params() );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [
			'saved' => true,
			'custom_workout_draft' => $result,
		], 200 );
	}

	public static function get_prebuilt_workout_library( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( PrebuiltWorkoutLibraryService::get_library_for_user( get_current_user_id() ) );
	}

	public static function queue_prebuilt_workout( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$id      = (int) $req->get_param( 'id' );
		$workout = PrebuiltWorkoutLibraryService::get_item( $id );

		if ( empty( $workout ) ) {
			return new \WP_REST_Response( [ 'message' => 'That prebuilt workout is no longer available.' ], 404 );
		}

		$user_equipment = PrebuiltWorkoutLibraryService::get_user_equipment_selection( $user_id );
		if ( ! PrebuiltWorkoutLibraryService::matches_user_setup( $workout, $user_equipment ) ) {
			return new \WP_REST_Response( [
				'message' => sprintf(
					'%s is built for %s. Your onboarding setup is %s.',
					(string) ( $workout['title'] ?? 'That workout' ),
					(string) ( $workout['required_gym_setup'] ?? 'Full gym' ),
					implode( ', ', $user_equipment )
				),
			], 400 );
		}

		$result = self::save_custom_workout_draft_for_user(
			$user_id,
			PrebuiltWorkoutLibraryService::build_custom_draft_payload(
				$workout,
				(string) ( $req->get_param( 'time_tier' ) ?: 'medium' )
			)
		);

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 400 );
		}

		return new \WP_REST_Response( [
			'saved'               => true,
			'prebuilt_workout'    => $workout,
			'custom_workout_draft'=> $result,
		], 200 );
	}

	public static function delete_custom_draft( \WP_REST_Request $req ): \WP_REST_Response {
		self::delete_custom_workout_draft_for_user( get_current_user_id() );
		return new \WP_REST_Response( [ 'deleted' => true ], 200 );
	}

	// ── POST /workout/{id}/set ────────────────────────────────────────────────

	public static function log_set( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'log_set',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'session_exercise_id' => (int) $req->get_param( 'session_exercise_id' ),
			'set_number' => (int) ( $req->get_param( 'set_number' ) ?: 1 ),
			'weight' => (float) ( $req->get_param( 'weight' ) ?: 0 ),
			'reps' => (int) ( $req->get_param( 'reps' ) ?: 0 ),
			'rir' => $req->get_param( 'rir' ) !== null ? (float) $req->get_param( 'rir' ) : null,
			'rpe' => $req->get_param( 'rpe' ) !== null ? (float) $req->get_param( 'rpe' ) : null,
			'completed' => $req->get_param( 'completed' ) !== null ? (int) (bool) $req->get_param( 'completed' ) : 1,
			'pain_flag' => (int) (bool) $req->get_param( 'pain_flag' ),
			'notes' => sanitize_text_field( $req->get_param( 'notes' ) ?: '' ) ?: null,
		], $req, 'log_set', 201 );
	}

	// ── PUT /workout/{id}/set/{set_id} ────────────────────────────────────────

	public static function update_set( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'update_set',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'set_id' => (int) $req->get_param( 'set_id' ),
			'weight' => $req->get_param( 'weight' ) !== null ? (float) $req->get_param( 'weight' ) : null,
			'reps' => $req->get_param( 'reps' ) !== null ? (int) $req->get_param( 'reps' ) : null,
			'rir' => $req->get_param( 'rir' ) !== null ? (float) $req->get_param( 'rir' ) : null,
			'completed' => $req->get_param( 'completed' ) !== null ? (int) (bool) $req->get_param( 'completed' ) : null,
			'pain_flag' => $req->get_param( 'pain_flag' ) !== null ? (int) (bool) $req->get_param( 'pain_flag' ) : null,
			'notes' => $req->get_param( 'notes' ) !== null ? sanitize_text_field( $req->get_param( 'notes' ) ) : null,
		], $req, 'update_set' );
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

		$current_notes = $wpdb->get_var( $wpdb->prepare(
			"SELECT notes FROM {$p}fit_workout_session_exercises WHERE id = %d AND session_id = %d LIMIT 1",
			$session_exercise_id,
			$sess_id
		) );
		$has_bonus_fill = self::session_exercise_has_bonus_fill_marker( is_string( $current_notes ) ? $current_notes : '' );

		$wpdb->update(
			$p . 'fit_workout_session_exercises',
			[ 'notes' => self::compose_session_exercise_notes_payload( $has_bonus_fill, $notes ) ],
			[ 'id' => $session_exercise_id, 'session_id' => $sess_id ],
			[ '%s' ],
			[ '%d', '%d' ]
		);

		return new \WP_REST_Response( [ 'updated' => true ] );
	}

	public static function delete_set( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'delete_set',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'set_id' => (int) $req->get_param( 'set_id' ),
		], $req, 'delete_set' );
	}

	public static function restore_set( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'restore_set',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'session_exercise_id' => (int) $req->get_param( 'session_exercise_id' ),
			'set_number' => (int) ( $req->get_param( 'set_number' ) ?: 1 ),
			'weight' => (float) ( $req->get_param( 'weight' ) ?: 0 ),
			'reps' => (int) ( $req->get_param( 'reps' ) ?: 0 ),
			'rir' => $req->get_param( 'rir' ) !== null ? (float) $req->get_param( 'rir' ) : null,
			'rpe' => $req->get_param( 'rpe' ) !== null ? (float) $req->get_param( 'rpe' ) : null,
			'completed' => $req->get_param( 'completed' ) !== null ? (int) (bool) $req->get_param( 'completed' ) : 1,
			'pain_flag' => (int) (bool) $req->get_param( 'pain_flag' ),
			'notes' => sanitize_text_field( $req->get_param( 'notes' ) ?: '' ) ?: null,
		], $req, 'restore_set', 201 );
	}

	public static function remove_session_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'remove_session_exercise',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'session_exercise_id' => (int) $req->get_param( 'session_exercise_id' ),
		], $req, 'remove_session_exercise' );
	}

	public static function restore_session_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'restore_session_exercise',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'sort_order' => (int) ( $req->get_param( 'sort_order' ) ?: 1 ),
			'exercise_id' => (int) $req->get_param( 'exercise_id' ),
			'slot_type' => (string) $req->get_param( 'slot_type' ),
			'planned_rep_min' => (int) ( $req->get_param( 'planned_rep_min' ) ?: 8 ),
			'planned_rep_max' => (int) ( $req->get_param( 'planned_rep_max' ) ?: 12 ),
			'planned_sets' => (int) ( $req->get_param( 'planned_sets' ) ?: 1 ),
			'was_swapped' => $req->get_param( 'was_swapped' ) !== null ? (int) (bool) $req->get_param( 'was_swapped' ) : 0,
			'original_exercise_id' => $req->get_param( 'original_exercise_id' ) !== null ? (int) $req->get_param( 'original_exercise_id' ) : null,
			'notes' => $req->get_param( 'notes' ) !== null ? (string) $req->get_param( 'notes' ) : null,
			'sets' => $req->get_param( 'sets' ),
		], $req, 'restore_session_exercise', 201 );
	}

	// ── POST /workout/{id}/swap ───────────────────────────────────────────────

	public static function swap_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'swap_exercise',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'session_exercise_id' => (int) $req->get_param( 'session_exercise_id' ),
			'new_exercise_id' => (int) $req->get_param( 'new_exercise_id' ),
		], $req, 'swap_exercise' );
	}

	public static function undo_swap_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'undo_swap_exercise',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'session_exercise_id' => (int) $req->get_param( 'session_exercise_id' ),
			'previous_exercise_id' => (int) $req->get_param( 'previous_exercise_id' ),
			'previous_original_exercise_id' => $req->get_param( 'previous_original_exercise_id' ) !== null ? (int) $req->get_param( 'previous_original_exercise_id' ) : null,
			'previous_was_swapped' => (int) (bool) $req->get_param( 'previous_was_swapped' ),
		], $req, 'undo_swap_exercise' );
	}

	public static function quick_add_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'quick_add_exercise',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'slot_type' => (string) $req->get_param( 'slot_type' ),
			'exercise_id' => (int) ( $req->get_param( 'exercise_id' ) ?: 0 ),
		], $req, 'quick_add_exercise', 201 );
	}

	public static function undo_quick_add_exercise( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'undo_quick_add_exercise',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'session_exercise_id' => (int) $req->get_param( 'session_exercise_id' ),
		], $req, 'undo_quick_add_exercise' );
	}

	// ── POST /workout/{id}/skip ───────────────────────────────────────────────

	public static function skip_session( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'skip_session',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
		], $req, 'skip_session' );
	}

	public static function restart_session( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'restart_session',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
		], $req, 'restart_session' );
	}

	public static function discard_session( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'discard_session',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
		], $req, 'discard_session' );
	}

	// ── POST /workout/{id}/complete ───────────────────────────────────────────

	public static function complete_session( \WP_REST_Request $req ): \WP_REST_Response {
		return self::execute_workout_action( [
			'type' => 'complete_session',
			'user_id' => get_current_user_id(),
			'session_id' => (int) $req->get_param( 'id' ),
			'actual_day_type' => $req->get_param( 'actual_day_type' ) !== null ? (string) $req->get_param( 'actual_day_type' ) : null,
		], $req, 'complete_session' );
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
			$time_tier = self::normalize_time_tier( $req->get_param( 'time_tier' ) );
			if ( '' === $time_tier ) {
				return new \WP_REST_Response( [ 'message' => 'Workout time tier is invalid.' ], 400 );
			}
			$update['time_tier'] = $time_tier;
		}

		if ( null !== $req->get_param( 'duration_minutes' ) ) {
			$update['duration_minutes'] = max( 0, min( 600, (int) $req->get_param( 'duration_minutes' ) ) );
		}

		if ( null !== $req->get_param( 'estimated_calories' ) ) {
			$raw_estimated_calories = $req->get_param( 'estimated_calories' );
			$update['estimated_calories'] = '' === (string) $raw_estimated_calories
				? null
				: max( 0, min( 5000, (int) $raw_estimated_calories ) );
		}

		if ( null !== $req->get_param( 'readiness_score' ) ) {
			$raw_readiness = $req->get_param( 'readiness_score' );
			$update['readiness_score'] = '' === (string) $raw_readiness ? null : max( 1, min( 10, (int) $raw_readiness ) );
		}

		if (
			( isset( $update['duration_minutes'] ) || isset( $update['actual_day_type'] ) || isset( $update['time_tier'] ) )
			&& ! array_key_exists( 'estimated_calories', $update )
		) {
			$duration_for_estimate = isset( $update['duration_minutes'] ) ? (int) $update['duration_minutes'] : (int) ( $session->duration_minutes ?? 0 );
			$day_type_for_estimate = (string) ( $update['actual_day_type'] ?? $session->actual_day_type ?? $session->planned_day_type ?? 'push' );
			$time_tier_for_estimate = (string) ( $update['time_tier'] ?? $session->time_tier ?? 'medium' );
			$update['estimated_calories'] = \Johnny5k\Services\ExerciseCalorieService::estimate_workout_session_calories(
				$user_id,
				$duration_for_estimate,
				$day_type_for_estimate,
				$time_tier_for_estimate
			);
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

	private static function execute_workout_action( array $command, \WP_REST_Request $req, string $action_type, int $success_status = 200 ): \WP_REST_Response {
		$result = WorkoutActionService::execute( $command );

		if ( is_wp_error( $result ) ) {
			$error_data = $result->get_error_data();
			$status = (int) ( is_array( $error_data ) ? ( $error_data['status'] ?? 400 ) : 400 );
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], $status );
		}

		$data = is_array( $result ) ? $result : [ 'result' => $result ];
		$data['action'] = self::build_action_meta( $req, $action_type );

		return new \WP_REST_Response( $data, $success_status );
	}

	private static function build_action_meta( \WP_REST_Request $req, string $action_type ): array {
		$action_id = sanitize_text_field( (string) ( $req->get_param( 'action_id' ) ?: '' ) );
		if ( '' === $action_id ) {
			$action_id = function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : uniqid( 'action_', true );
		}

		$source = sanitize_key( (string) ( $req->get_param( 'action_source' ) ?: '' ) );
		if ( '' === $source ) {
			$source = 'ui';
		}

		return [
			'id' => $action_id,
			'type' => sanitize_key( $action_type ),
			'source' => $source,
			'timestamp' => current_time( 'mysql', true ),
		];
	}

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
			        s.readiness_score, s.duration_minutes, s.estimated_calories, s.completed_at,
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

	public static function save_custom_workout_draft_for_user( int $user_id, array $payload ) {
		$draft = self::normalize_custom_workout_draft_payload( $user_id, $payload );
		if ( is_wp_error( $draft ) ) {
			return $draft;
		}

		update_user_meta( $user_id, self::CUSTOM_WORKOUT_DRAFT_META, $draft );
		return $draft;
	}

	public static function delete_custom_workout_draft_for_user( int $user_id ): void {
		delete_user_meta( $user_id, self::CUSTOM_WORKOUT_DRAFT_META );
	}

	private static function get_custom_workout_draft( int $user_id ): ?array {
		$draft = get_user_meta( $user_id, self::CUSTOM_WORKOUT_DRAFT_META, true );
		if ( ! is_array( $draft ) ) {
			return null;
		}

		$id = sanitize_text_field( (string) ( $draft['id'] ?? '' ) );
		$name = sanitize_text_field( (string) ( $draft['name'] ?? '' ) );
		$day_type = self::normalize_day_type( $draft['day_type'] ?? '' ) ?: TrainingDayTypes::custom_workout_fallback();
		$coach_note = sanitize_textarea_field( (string) ( $draft['coach_note'] ?? '' ) );
		$created_at = sanitize_text_field( (string) ( $draft['created_at'] ?? '' ) );
		$items = is_array( $draft['exercises'] ?? null ) ? array_values( array_filter( array_map( static function( $item ) {
			$payload = is_array( $item ) ? $item : (array) $item;
			$plan_exercise_id = isset( $payload['plan_exercise_id'] ) ? (int) $payload['plan_exercise_id'] : 0;
			$exercise_id = isset( $payload['exercise_id'] ) ? (int) $payload['exercise_id'] : 0;
			if ( $plan_exercise_id <= 0 || $exercise_id <= 0 ) {
				return null;
			}

			return [
				'plan_exercise_id' => $plan_exercise_id,
				'exercise_id'      => $exercise_id,
				'exercise_name'    => sanitize_text_field( (string) ( $payload['exercise_name'] ?? '' ) ),
				'primary_muscle'   => sanitize_text_field( (string) ( $payload['primary_muscle'] ?? '' ) ),
				'equipment'        => sanitize_text_field( (string) ( $payload['equipment'] ?? '' ) ),
				'difficulty'       => sanitize_text_field( (string) ( $payload['difficulty'] ?? '' ) ),
				'slot_type'        => sanitize_key( (string) ( $payload['slot_type'] ?? 'accessory' ) ) ?: 'accessory',
				'rep_min'          => max( 1, (int) ( $payload['rep_min'] ?? 8 ) ),
				'rep_max'          => max( 1, (int) ( $payload['rep_max'] ?? 12 ) ),
				'sets'             => max( 1, (int) ( $payload['sets'] ?? 3 ) ),
				'was_swapped'      => false,
			];
		}, $draft['exercises'] ) ) ) : [];

		if ( '' === $id || '' === $name || empty( $items ) ) {
			return null;
		}

		return [
			'id'         => $id,
			'name'       => $name,
			'day_type'   => $day_type,
			'time_tier'  => self::normalize_time_tier( $draft['time_tier'] ?? '' ) ?: 'medium',
			'coach_note' => $coach_note,
			'source_type' => sanitize_key( (string) ( $draft['source_type'] ?? '' ) ),
			'source_id'   => isset( $draft['source_id'] ) ? (int) $draft['source_id'] : 0,
			'description' => sanitize_textarea_field( (string) ( $draft['description'] ?? '' ) ),
			'required_gym_setup' => sanitize_text_field( (string) ( $draft['required_gym_setup'] ?? '' ) ),
			'body_part_icons'    => array_values( array_filter( array_map( 'sanitize_key', is_array( $draft['body_part_icons'] ?? null ) ? $draft['body_part_icons'] : [] ) ) ),
			'created_at' => $created_at,
			'exercises'  => $items,
		];
	}

	private static function normalize_custom_workout_draft_payload( int $user_id, array $payload ) {
		$name = sanitize_text_field( (string) ( $payload['name'] ?? '' ) );
		if ( '' === $name ) {
			return new \WP_Error( 'missing_custom_workout_name', 'A workout name is required.' );
		}

		$day_type = self::normalize_day_type( $payload['day_type'] ?? '' ) ?: TrainingDayTypes::custom_workout_fallback();
		$coach_note = sanitize_textarea_field( (string) ( $payload['coach_note'] ?? '' ) );
		$raw_exercises = is_array( $payload['exercises'] ?? null ) ? $payload['exercises'] : [];
		$resolved_exercises = [];
		$used_exercise_ids = [];
		$plan_exercise_id = 1;

		foreach ( $raw_exercises as $exercise_payload ) {
			$exercise_payload = is_array( $exercise_payload ) ? $exercise_payload : (array) $exercise_payload;
			$resolved = self::resolve_custom_draft_exercise( $user_id, $exercise_payload, $day_type, $used_exercise_ids );
			if ( is_wp_error( $resolved ) ) {
				return $resolved;
			}

			if ( empty( $resolved ) ) {
				continue;
			}

			$resolved_exercises[] = array_merge( $resolved, [ 'plan_exercise_id' => $plan_exercise_id ] );
			$used_exercise_ids[] = (int) $resolved['exercise_id'];
			$plan_exercise_id++;
		}

		if ( empty( $resolved_exercises ) ) {
			return new \WP_Error( 'missing_custom_workout_exercises', 'Add at least one valid exercise to build a custom workout.' );
		}

		return [
			'id'         => sanitize_text_field( (string) ( $payload['id'] ?? 'custom_' . wp_generate_uuid4() ) ),
			'name'       => $name,
			'day_type'   => $day_type,
			'time_tier'  => self::normalize_time_tier( $payload['time_tier'] ?? '' ) ?: 'medium',
			'coach_note' => $coach_note,
			'source_type' => sanitize_key( (string) ( $payload['source_type'] ?? '' ) ),
			'source_id'   => isset( $payload['source_id'] ) ? (int) $payload['source_id'] : 0,
			'description' => sanitize_textarea_field( (string) ( $payload['description'] ?? '' ) ),
			'required_gym_setup' => sanitize_text_field( (string) ( $payload['required_gym_setup'] ?? '' ) ),
			'body_part_icons'    => array_values( array_filter( array_map( 'sanitize_key', is_array( $payload['body_part_icons'] ?? null ) ? $payload['body_part_icons'] : [] ) ) ),
			'created_at' => current_time( 'mysql', true ),
			'exercises'  => $resolved_exercises,
		];
	}

	private static function resolve_custom_draft_exercise( int $user_id, array $payload, string $day_type, array $used_exercise_ids ) {
		$exercise_id = isset( $payload['exercise_id'] ) ? (int) $payload['exercise_id'] : 0;
		$exercise_name = sanitize_text_field( (string) ( $payload['exercise_name'] ?? '' ) );

		$exercise = null;
		if ( $exercise_id > 0 ) {
			$exercise = ExerciseLibraryService::get_exercise( $user_id, $exercise_id, 'id, name, primary_muscle, equipment, difficulty, default_rep_min, default_rep_max, default_sets' );
		} elseif ( '' !== $exercise_name ) {
			$exercise = self::find_custom_workout_exercise_by_name( $user_id, $exercise_name, $day_type, $used_exercise_ids );
		}

		if ( ! $exercise ) {
			return new \WP_Error( 'custom_workout_exercise_not_found', sprintf( 'Could not find "%s" in the exercise library.', $exercise_name ?: 'that exercise' ) );
		}

		if ( in_array( (int) $exercise->id, $used_exercise_ids, true ) ) {
			return [];
		}

		return [
			'exercise_id'    => (int) $exercise->id,
			'exercise_name'  => sanitize_text_field( (string) ( $exercise->name ?? '' ) ),
			'primary_muscle' => sanitize_text_field( (string) ( $exercise->primary_muscle ?? '' ) ),
			'equipment'      => sanitize_text_field( (string) ( $exercise->equipment ?? '' ) ),
			'difficulty'     => sanitize_text_field( (string) ( $exercise->difficulty ?? '' ) ),
			'slot_type'      => sanitize_key( (string) ( $payload['slot_type'] ?? 'accessory' ) ) ?: 'accessory',
			'rep_min'        => max( 1, (int) ( $payload['rep_min'] ?? $exercise->default_rep_min ?? 8 ) ),
			'rep_max'        => max( 1, (int) ( $payload['rep_max'] ?? $exercise->default_rep_max ?? 12 ) ),
			'sets'           => max( 1, (int) ( $payload['sets'] ?? $exercise->default_sets ?? 3 ) ),
		];
	}

	private static function find_custom_workout_exercise_by_name( int $user_id, string $exercise_name, string $day_type, array $used_exercise_ids ): ?object {
		global $wpdb;
		$p = $wpdb->prefix;
		$exercise_access_where = ExerciseLibraryService::accessible_exercise_where( '', $user_id );
		$day_json = '"' . esc_sql( $day_type ) . '"';
		$like = '%' . $wpdb->esc_like( $exercise_name ) . '%';
		$slug_query = sanitize_title( $exercise_name );
		$slug_like = '%' . $wpdb->esc_like( $slug_query ) . '%';
		$excluded_sql = '';
		$params = [ $exercise_name, $slug_query, $like, $slug_like ];

		if ( ! empty( $used_exercise_ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $used_exercise_ids ), '%d' ) );
			$excluded_sql = " AND id NOT IN ({$placeholders})";
			$params = array_merge( $params, array_map( 'intval', $used_exercise_ids ) );
		}

		$params[] = $day_json;
		$params[] = $exercise_name;
		$params[] = $user_id;

		$sql = "
			SELECT id, name, primary_muscle, equipment, difficulty, default_rep_min, default_rep_max, default_sets
			FROM {$p}fit_exercises
			WHERE active = 1
			  AND {$exercise_access_where}
			  AND (LOWER(name) = LOWER(%s) OR slug = %s OR name LIKE %s OR slug LIKE %s)
			  {$excluded_sql}
			ORDER BY
			  CASE WHEN JSON_CONTAINS(day_types_json, %s) THEN 0 ELSE 1 END,
			  CASE WHEN LOWER(name) = LOWER(%s) THEN 0 ELSE 1 END,
			  CASE WHEN user_id = %d THEN 0 ELSE 1 END,
			  CHAR_LENGTH(name),
			  name
			LIMIT 1";

		return $wpdb->get_row( $wpdb->prepare( $sql, ...$params ) );
	}

	private static function build_custom_preview( array $draft, string $time_tier, ?int $readiness, array $exercise_order, array $rep_adjustments = [], array $exercise_removals = [], array $exercise_additions = [] ): array {
		$ordered_exercises = self::order_custom_draft_exercises( is_array( $draft['exercises'] ?? null ) ? $draft['exercises'] : [], $exercise_order );
		$ordered_exercises = self::apply_custom_exercise_removals_and_additions( get_current_user_id(), $ordered_exercises, $exercise_removals, $exercise_additions );
		$ordered_exercises = self::apply_rep_adjustments_to_custom_exercises( $ordered_exercises, $rep_adjustments );

		return [
			'day_type'            => (string) ( $draft['day_type'] ?? TrainingDayTypes::custom_workout_fallback() ),
			'custom_title'        => (string) ( $draft['name'] ?? 'Custom workout' ),
			'coach_note'          => (string) ( $draft['coach_note'] ?? '' ),
			'time_tier'           => $time_tier,
			'session_mode'        => self::session_mode_from_readiness( $readiness ),
			'plan_exercise_count' => count( $ordered_exercises ),
			'exercises'           => $ordered_exercises,
		];
	}

	private static function build_custom_session( int $user_id, array $draft, string $time_tier, ?int $readiness, array $exercise_order, array $rep_adjustments = [], array $exercise_removals = [], array $exercise_additions = [] ) {
		global $wpdb;
		$p = $wpdb->prefix;
		$ordered_exercises = self::order_custom_draft_exercises( is_array( $draft['exercises'] ?? null ) ? $draft['exercises'] : [], $exercise_order );
		$ordered_exercises = self::apply_custom_exercise_removals_and_additions( $user_id, $ordered_exercises, $exercise_removals, $exercise_additions );
		$ordered_exercises = self::apply_rep_adjustments_to_custom_exercises( $ordered_exercises, $rep_adjustments );

		if ( empty( $ordered_exercises ) ) {
			return new \WP_Error( 'custom_workout_empty', 'That custom workout does not have any valid exercises left.' );
		}

		$wpdb->insert( $p . 'fit_workout_sessions', [
			'user_id'             => $user_id,
			'session_date'        => UserTime::today( $user_id ),
			'planned_day_type'    => (string) ( $draft['day_type'] ?? TrainingDayTypes::custom_workout_fallback() ),
			'time_tier'           => $time_tier,
			'completed'           => 0,
			'skip_requested'      => 0,
			'is_optional_session' => 0,
		] );
		$session_id = (int) $wpdb->insert_id;

		foreach ( $ordered_exercises as $index => $exercise ) {
			$wpdb->insert( $p . 'fit_workout_session_exercises', [
				'session_id'          => $session_id,
				'exercise_id'         => (int) ( $exercise['exercise_id'] ?? 0 ),
				'slot_type'           => (string) ( $exercise['slot_type'] ?? 'accessory' ),
				'planned_rep_min'     => (int) ( $exercise['rep_min'] ?? 8 ),
				'planned_rep_max'     => (int) ( $exercise['rep_max'] ?? 12 ),
				'planned_sets'        => (int) ( $exercise['sets'] ?? 3 ),
				'sort_order'          => $index + 1,
				'was_swapped'         => 0,
				'original_exercise_id'=> null,
			] );
		}

		return [
			'session_id'   => $session_id,
			'day_type'     => (string) ( $draft['day_type'] ?? TrainingDayTypes::custom_workout_fallback() ),
			'exercises'    => $ordered_exercises,
			'skip_count'   => TrainingEngine::rolling_skip_count( $user_id ),
			'skip_warning' => TrainingEngine::rolling_skip_count( $user_id ) >= 3,
		];
	}

	private static function apply_custom_exercise_removals_and_additions( int $user_id, array $exercises, array $exercise_removals = [], array $exercise_additions = [] ): array {
		$normalized = array_values( $exercises );

		if ( ! empty( $exercise_removals ) ) {
			$remove_lookup = array_flip( array_values( array_filter( array_map( 'intval', $exercise_removals ), static fn( int $id ): bool => $id > 0 ) ) );
			$normalized = array_values( array_filter( $normalized, static function( array $exercise ) use ( $remove_lookup ): bool {
				$plan_exercise_id = (int) ( $exercise['plan_exercise_id'] ?? 0 );
				return $plan_exercise_id <= 0 || ! isset( $remove_lookup[ $plan_exercise_id ] );
			} ) );
		}

		if ( empty( $exercise_additions ) ) {
			return $normalized;
		}

		$selected_exercise_ids = array_values( array_filter( array_map( static fn( array $exercise ): int => (int) ( $exercise['exercise_id'] ?? 0 ), $normalized ) ) );
		$next_plan_exercise_id = max( 900000, ...array_map( static fn( array $exercise ): int => (int) ( $exercise['plan_exercise_id'] ?? 0 ), $normalized ) ) + 1;

		foreach ( $exercise_additions as $addition ) {
			$exercise_id = (int) ( $addition['exercise_id'] ?? 0 );
			if ( $exercise_id <= 0 || in_array( $exercise_id, $selected_exercise_ids, true ) ) {
				continue;
			}

			$exercise = ExerciseLibraryService::get_exercise(
				$user_id,
				$exercise_id,
				'id, name, primary_muscle, equipment, difficulty, default_rep_min, default_rep_max, default_sets'
			);
			if ( ! $exercise ) {
				continue;
			}

			$rep_min = max( 3, (int) ( $addition['rep_min'] ?? $exercise->default_rep_min ?? 8 ) );
			$rep_max = max( $rep_min, (int) ( $addition['rep_max'] ?? $exercise->default_rep_max ?? 12 ) );
			$sets = max( 1, (int) ( $addition['sets'] ?? $exercise->default_sets ?? 3 ) );

			$normalized[] = [
				'plan_exercise_id' => $next_plan_exercise_id,
				'exercise_id'      => (int) $exercise->id,
				'exercise_name'    => sanitize_text_field( (string) ( $exercise->name ?? '' ) ),
				'primary_muscle'   => sanitize_text_field( (string) ( $exercise->primary_muscle ?? '' ) ),
				'equipment'        => sanitize_text_field( (string) ( $exercise->equipment ?? '' ) ),
				'difficulty'       => sanitize_text_field( (string) ( $exercise->difficulty ?? '' ) ),
				'slot_type'        => sanitize_key( (string) ( $addition['slot_type'] ?? 'accessory' ) ) ?: 'accessory',
				'rep_min'          => $rep_min,
				'rep_max'          => $rep_max,
				'sets'             => $sets,
				'was_swapped'      => false,
				'is_added'         => true,
			];
			$selected_exercise_ids[] = $exercise_id;
			$next_plan_exercise_id++;
		}

		return array_values( $normalized );
	}

	private static function apply_rep_adjustments_to_custom_exercises( array $exercises, array $rep_adjustments ): array {
		if ( empty( $exercises ) || empty( $rep_adjustments ) ) {
			return array_values( $exercises );
		}

		foreach ( $exercises as &$exercise ) {
			$plan_exercise_id = (int) ( $exercise['plan_exercise_id'] ?? 0 );
			if ( $plan_exercise_id <= 0 ) {
				continue;
			}

			$rep_delta = (int) ( $rep_adjustments[ $plan_exercise_id ] ?? 0 );
			if ( 0 === $rep_delta ) {
				continue;
			}

			$base_rep_min = max( 1, (int) ( $exercise['rep_min'] ?? 8 ) );
			$base_rep_max = max( $base_rep_min, (int) ( $exercise['rep_max'] ?? 12 ) );
			$exercise['rep_min'] = max( 3, $base_rep_min + $rep_delta );
			$exercise['rep_max'] = max( (int) $exercise['rep_min'], $base_rep_max + $rep_delta );
			$exercise['rep_delta'] = $rep_delta;
		}
		unset( $exercise );

		return array_values( $exercises );
	}

	private static function order_custom_draft_exercises( array $exercises, array $exercise_order ): array {
		if ( empty( $exercise_order ) ) {
			return array_values( $exercises );
		}

		$order_index = [];
		foreach ( $exercise_order as $position => $plan_exercise_id ) {
			$plan_exercise_id = (int) $plan_exercise_id;
			if ( $plan_exercise_id > 0 ) {
				$order_index[ $plan_exercise_id ] = $position;
			}
		}

		usort( $exercises, static function( array $left, array $right ) use ( $order_index ): int {
			$left_index = $order_index[ (int) ( $left['plan_exercise_id'] ?? 0 ) ] ?? PHP_INT_MAX;
			$right_index = $order_index[ (int) ( $right['plan_exercise_id'] ?? 0 ) ] ?? PHP_INT_MAX;

			if ( $left_index === $right_index ) {
				return ( (int) ( $left['plan_exercise_id'] ?? 0 ) ) <=> ( (int) ( $right['plan_exercise_id'] ?? 0 ) );
			}

			return $left_index <=> $right_index;
		} );

		return array_values( $exercises );
	}

	private static function get_custom_workout_session_title( int $user_id, int $session_id ): string {
		$session_titles = get_user_meta( $user_id, self::CUSTOM_WORKOUT_SESSION_TITLES_META, true );
		if ( ! is_array( $session_titles ) ) {
			return '';
		}

		return sanitize_text_field( (string) ( $session_titles[ $session_id ] ?? '' ) );
	}

	private static function store_custom_workout_session_title( int $user_id, int $session_id, string $title ): void {
		$session_titles = get_user_meta( $user_id, self::CUSTOM_WORKOUT_SESSION_TITLES_META, true );
		$session_titles = is_array( $session_titles ) ? $session_titles : [];
		$session_titles[ $session_id ] = sanitize_text_field( $title );

		if ( count( $session_titles ) > 30 ) {
			$session_titles = array_slice( $session_titles, -30, null, true );
		}

		update_user_meta( $user_id, self::CUSTOM_WORKOUT_SESSION_TITLES_META, $session_titles );
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

	private static function delete_active_sessions_for_date( int $user_id, string $session_date ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$session_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT id FROM {$p}fit_workout_sessions
			 WHERE user_id = %d
			   AND session_date = %s
			   AND completed = 0
			   AND skip_requested = 0",
			$user_id,
			$session_date
		) );

		foreach ( array_map( 'intval', $session_ids ) as $session_id ) {
			if ( $session_id > 0 ) {
				self::deactivate_active_session_record( $session_id, $user_id );
				self::delete_session_records( $session_id, $user_id );
			}
		}
	}

	private static function discard_active_sessions_for_date( int $user_id, string $session_date ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$session_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT id FROM {$p}fit_workout_sessions
			 WHERE user_id = %d
			   AND session_date = %s
			   AND completed = 0
			   AND skip_requested = 0",
			$user_id,
			$session_date
		) );

		foreach ( array_map( 'intval', $session_ids ) as $session_id ) {
			if ( $session_id > 0 ) {
				self::deactivate_active_session_record( $session_id, $user_id );
			}
		}
	}

	private static function deactivate_active_session_record( int $session_id, int $user_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$wpdb->update(
			$p . 'fit_workout_sessions',
			[
				'skip_requested' => 1,
				'is_optional_session' => 1,
				'ai_summary' => null,
			],
			[
				'id' => $session_id,
				'user_id' => $user_id,
				'completed' => 0,
			],
			[ '%d', '%d', '%s' ],
			[ '%d', '%d', '%d' ]
		);
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

	private static function get_swap_options( int $user_id, object $session, object $exercise ): array {
		return self::get_swap_options_for_day_type( $user_id, (string) $session->planned_day_type, $exercise );
	}

	private static function get_swap_options_for_day_type( int $user_id, string $day_type, object $exercise ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$day_json  = '"' . esc_sql( $day_type ) . '"';
		$slot_json = '"' . esc_sql( $exercise->slot_type ) . '"';
		$exercise_access_where = ExerciseLibraryService::accessible_exercise_where( 'e', $user_id );
		$substitution_access_where = ExerciseLibraryService::accessible_substitution_where( 's', $user_id );
		$base_exercise_id = (int) ( $exercise->original_exercise_id ?? 0 );
		if ( $base_exercise_id <= 0 ) {
			$base_exercise_id = (int) $exercise->exercise_id;
		}
		$allowed_equipment = TrainingEngine::get_allowed_equipment_for_user( $user_id );
		$equipment_filter_sql = '';
		$equipment_filter_values = [];
		if ( ! in_array( '__all__', $allowed_equipment, true ) ) {
			$allowed_equipment = array_values( array_unique( array_filter( array_map( static fn( string $item ): string => sanitize_key( $item ), $allowed_equipment ) ) ) );
			if ( ! empty( $allowed_equipment ) ) {
				$placeholders = implode( ',', array_fill( 0, count( $allowed_equipment ), '%s' ) );
				$equipment_filter_sql = " AND e.equipment IN ({$placeholders})";
				$equipment_filter_values = $allowed_equipment;
			}
		}

		$options_sql = "
			SELECT e.id, e.user_id, CASE WHEN e.user_id = %d THEN 1 ELSE 0 END AS owned_by_user, e.name, e.primary_muscle, e.equipment, e.difficulty
			 FROM {$p}fit_exercise_substitutions s
			 JOIN {$p}fit_exercises e ON e.id = s.substitute_exercise_id
			 WHERE s.exercise_id = %d
			   AND {$substitution_access_where}
			   AND e.active = 1
			   AND {$exercise_access_where}
			   AND e.id != %d
			   AND JSON_CONTAINS(e.day_types_json, %s)
			   AND JSON_CONTAINS(e.slot_types_json, %s)
			   {$equipment_filter_sql}
			 ORDER BY CASE WHEN s.user_id = %d THEN 0 ELSE 1 END, s.priority, e.name
			 LIMIT 4";
		$options_params = array_merge(
			[
				$user_id,
				$base_exercise_id,
				(int) $exercise->exercise_id,
				$day_json,
				$slot_json,
			],
			$equipment_filter_values,
			[
				$user_id,
			]
		);
		$options = $wpdb->get_results( $wpdb->prepare( $options_sql, $options_params ) );

		if ( empty( $options ) ) {
			$options_sql = "
				SELECT e.id, e.user_id, CASE WHEN e.user_id = %d THEN 1 ELSE 0 END AS owned_by_user, e.name, e.primary_muscle, e.equipment, e.difficulty
				 FROM {$p}fit_exercises e
				 WHERE e.active = 1
				   AND {$exercise_access_where}
				   AND e.id != %d
				   AND e.primary_muscle = %s
				   AND JSON_CONTAINS(e.day_types_json, %s)
				   AND JSON_CONTAINS(e.slot_types_json, %s)
				   {$equipment_filter_sql}
				 ORDER BY CASE WHEN e.user_id = %d THEN 0 ELSE 1 END, e.difficulty, e.name
				 LIMIT 4";
			$options_params = array_merge(
				[
					$user_id,
					(int) $exercise->exercise_id,
					(string) $exercise->primary_muscle,
					$day_json,
					$slot_json,
				],
				$equipment_filter_values,
				[
					$user_id,
				]
			);
			$options = $wpdb->get_results( $wpdb->prepare( $options_sql, $options_params ) );
		}

		if ( empty( $options ) ) {
			$options_sql = "
				SELECT e.id, e.user_id, CASE WHEN e.user_id = %d THEN 1 ELSE 0 END AS owned_by_user, e.name, e.primary_muscle, e.equipment, e.difficulty
				 FROM {$p}fit_exercises e
				 WHERE e.active = 1
				   AND {$exercise_access_where}
				   AND e.id != %d
				   AND JSON_CONTAINS(e.day_types_json, %s)
				   AND JSON_CONTAINS(e.slot_types_json, %s)
				   {$equipment_filter_sql}
				 ORDER BY CASE WHEN e.user_id = %d THEN 0 ELSE 1 END, e.primary_muscle, e.difficulty, e.name
				 LIMIT 4";
			$options_params = array_merge(
				[
					$user_id,
					(int) $exercise->exercise_id,
					$day_json,
					$slot_json,
				],
				$equipment_filter_values,
				[
					$user_id,
				]
			);
			$options = $wpdb->get_results( $wpdb->prepare( $options_sql, $options_params ) );
		}

		foreach ( $options as $option ) {
			$option->swap_reason = self::build_swap_reason( $exercise, $option );
		}

		return is_array( $options ) ? $options : [];
	}

	private static function normalise_exercise_swaps( $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$swaps = [];
		foreach ( $value as $item ) {
			$payload = is_array( $item ) ? $item : (array) $item;
			$plan_exercise_id = isset( $payload['plan_exercise_id'] ) ? (int) $payload['plan_exercise_id'] : 0;
			$exercise_id = isset( $payload['exercise_id'] ) ? (int) $payload['exercise_id'] : ( isset( $payload['replacement_exercise_id'] ) ? (int) $payload['replacement_exercise_id'] : 0 );

			if ( $plan_exercise_id > 0 && $exercise_id > 0 ) {
				$swaps[ $plan_exercise_id ] = $exercise_id;
			}
		}

		return $swaps;
	}

	private static function normalise_exercise_order( $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$order = [];
		foreach ( $value as $plan_exercise_id ) {
			$plan_exercise_id = (int) $plan_exercise_id;
			if ( $plan_exercise_id > 0 && ! in_array( $plan_exercise_id, $order, true ) ) {
				$order[] = $plan_exercise_id;
			}
		}

		return $order;
	}

	private static function normalise_rep_adjustments( $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$adjustments = [];
		foreach ( $value as $item ) {
			$payload = is_array( $item ) ? $item : (array) $item;
			$plan_exercise_id = isset( $payload['plan_exercise_id'] ) ? (int) $payload['plan_exercise_id'] : 0;
			$rep_delta = isset( $payload['rep_delta'] ) ? (int) $payload['rep_delta'] : ( isset( $payload['delta'] ) ? (int) $payload['delta'] : 0 );

			if ( $plan_exercise_id > 0 && 0 !== $rep_delta ) {
				$adjustments[ $plan_exercise_id ] = max( -6, min( 6, $rep_delta ) );
			}
		}

		return $adjustments;
	}

	private static function normalise_exercise_removals( $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$ids = [];
		foreach ( $value as $plan_exercise_id ) {
			$plan_exercise_id = (int) $plan_exercise_id;
			if ( $plan_exercise_id > 0 && ! in_array( $plan_exercise_id, $ids, true ) ) {
				$ids[] = $plan_exercise_id;
			}
		}

		return $ids;
	}

	private static function normalise_exercise_additions( $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		$additions = [];
		$seen_ids = [];
		foreach ( $value as $item ) {
			$payload = is_array( $item ) ? $item : (array) $item;
			$exercise_id = isset( $payload['exercise_id'] ) ? (int) $payload['exercise_id'] : 0;
			if ( $exercise_id <= 0 || isset( $seen_ids[ $exercise_id ] ) ) {
				continue;
			}

			$rep_min = max( 3, (int) ( $payload['rep_min'] ?? 8 ) );
			$rep_max = max( $rep_min, (int) ( $payload['rep_max'] ?? 12 ) );
			$sets = max( 1, (int) ( $payload['sets'] ?? 3 ) );

			$additions[] = [
				'exercise_id' => $exercise_id,
				'slot_type'   => sanitize_key( (string) ( $payload['slot_type'] ?? 'accessory' ) ) ?: 'accessory',
				'rep_min'     => $rep_min,
				'rep_max'     => $rep_max,
				'sets'        => $sets,
			];
			$seen_ids[ $exercise_id ] = true;
		}

		return $additions;
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
		$description = sanitize_text_field( (string) ( $exercise->exercise_description ?? '' ) );
		if ( '' !== $description ) {
			return $description;
		}

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

	private static function decode_json_list( $value ): array {
		if ( is_array( $value ) ) {
			return array_values( array_filter( array_map( 'sanitize_text_field', $value ) ) );
		}

		if ( ! is_string( $value ) || '' === $value ) {
			return [];
		}

		$decoded = json_decode( $value, true );
		if ( ! is_array( $decoded ) ) {
			return [];
		}

		return array_values( array_filter( array_map( 'sanitize_text_field', $decoded ) ) );
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

	private static function session_exercise_bonus_fill_marker(): string {
		return TrainingEngine::bonus_fill_note_marker();
	}

	private static function session_exercise_has_bonus_fill_marker( string $notes ): bool {
		return '' !== $notes && str_starts_with( $notes, self::session_exercise_bonus_fill_marker() );
	}

	private static function strip_session_exercise_system_markers( string $notes ): ?string {
		$marker = self::session_exercise_bonus_fill_marker();
		if ( '' !== $notes && str_starts_with( $notes, $marker ) ) {
			$notes = substr( $notes, strlen( $marker ) );
		}

		$notes = ltrim( $notes );
		return '' !== trim( $notes ) ? $notes : null;
	}

	private static function compose_session_exercise_notes_payload( bool $has_bonus_fill, string $notes ): ?string {
		$clean_notes = '' !== trim( $notes ) ? $notes : '';
		if ( ! $has_bonus_fill ) {
			return '' !== $clean_notes ? $clean_notes : null;
		}

		return self::session_exercise_bonus_fill_marker() . ( '' !== $clean_notes ? ' ' . $clean_notes : '' );
	}

	private static function normalize_day_type( $value ): ?string {
		if ( ! is_string( $value ) || '' === $value ) {
			return null;
		}

		return TrainingDayTypes::normalize( $value );
	}

	private static function normalize_time_tier( $value ): string {
		$time_tier = sanitize_key( (string) $value );
		if ( 'long' === $time_tier ) {
			$time_tier = 'full';
		}

		return in_array( $time_tier, [ 'short', 'medium', 'full' ], true ) ? $time_tier : '';
	}

	public static function validate_time_tier( $value ): bool {
		return '' === (string) $value || '' !== self::normalize_time_tier( $value );
	}

	public static function validate_day_type( $value ): bool {
		return null !== self::normalize_day_type( $value ) || '' === (string) $value;
	}

	public static function validate_readiness_score( $value ): bool {
		return is_numeric( $value ) && (int) $value >= 1 && (int) $value <= 10;
	}

	protected static function build_training_session( int $user_id, string $time_tier, bool $maintenance_mode, ?string $day_type_override, array $exercise_swaps, array $exercise_order, array $rep_adjustments = [], array $exercise_removals = [], array $exercise_additions = [] ) {
		return TrainingEngine::build_session( $user_id, $time_tier, $maintenance_mode, $day_type_override, $exercise_swaps, $exercise_order, $rep_adjustments, $exercise_removals, $exercise_additions );
	}

	protected static function estimate_workout_session_calories( int $user_id, int $duration_minutes, string $day_type, string $time_tier ): int {
		return \Johnny5k\Services\ExerciseCalorieService::estimate_workout_session_calories( $user_id, $duration_minutes, $day_type, $time_tier );
	}

	protected static function record_training_snapshots( int $session_id ): array {
		return TrainingEngine::record_snapshots( $session_id );
	}

	protected static function evaluate_user_awards( int $user_id ): void {
		AwardEngine::evaluate( $user_id );
	}

	protected static function post_workout_summary( int $user_id, int $session_id ) {
		return AiService::post_workout_summary( $user_id, $session_id );
	}

	protected static function grant_award( int $user_id, string $code ): bool {
		return AwardEngine::grant( $user_id, $code );
	}

	protected static function mark_session_skipped( int $session_id, int $user_id ): int {
		return TrainingEngine::mark_skipped( $session_id, $user_id );
	}
}
