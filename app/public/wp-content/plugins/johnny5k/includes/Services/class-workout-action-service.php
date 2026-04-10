<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Shared command/action layer for workout mutations.
 *
 * This first slice supports:
 * - swap_exercise / undo_swap_exercise
 * - quick_add_exercise / undo_quick_add_exercise
 * - remove_session_exercise / restore_session_exercise
 * - delete_set / restore_set
 * - skip_session / restart_session / discard_session / complete_session
 * - log_set / update_set
 */
class WorkoutActionService {

	public static function execute( array $command ) {
		$type = sanitize_key( (string) ( $command['type'] ?? '' ) );

		return match ( $type ) {
			'swap_exercise' => self::execute_swap_exercise( $command ),
			'undo_swap_exercise' => self::execute_undo_swap_exercise( $command ),
			'quick_add_exercise' => self::execute_quick_add_exercise( $command ),
			'undo_quick_add_exercise' => self::execute_undo_quick_add_exercise( $command ),
			'remove_session_exercise' => self::execute_remove_session_exercise( $command ),
			'restore_session_exercise' => self::execute_restore_session_exercise( $command ),
			'delete_set' => self::execute_delete_set( $command ),
			'restore_set' => self::execute_restore_set( $command ),
			'skip_session' => self::execute_skip_session( $command ),
			'restart_session' => self::execute_restart_session( $command ),
			'discard_session' => self::execute_discard_session( $command ),
			'complete_session' => self::execute_complete_session( $command ),
			'log_set' => self::execute_log_set( $command ),
			'update_set' => self::execute_update_set( $command ),
			default => new \WP_Error( 'unsupported_workout_action', 'Unsupported workout action.', [ 'status' => 400 ] ),
		};
	}

	private static function execute_swap_exercise( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$session_exercise_id = (int) ( $command['session_exercise_id'] ?? 0 );
		$new_exercise_id = (int) ( $command['new_exercise_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$current = $wpdb->get_row( $wpdb->prepare(
			"SELECT exercise_id, original_exercise_id
			 FROM {$p}fit_workout_session_exercises
			 WHERE id = %d AND session_id = %d",
			$session_exercise_id,
			$session_id
		) );

		$original_exercise_id = (int) ( $current->exercise_id ?? 0 );
		if ( $original_exercise_id <= 0 ) {
			return new \WP_Error( 'workout_exercise_not_found', 'Exercise not found in session.', [ 'status' => 404 ] );
		}

		if ( $original_exercise_id === $new_exercise_id ) {
			return new \WP_Error( 'workout_swap_same_exercise', 'That exercise is already active.', [ 'status' => 400 ] );
		}

		$exercise_access_where = ExerciseLibraryService::accessible_exercise_where( '', $user_id );
		$new_exercise = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, name, primary_muscle, equipment, difficulty
			 FROM {$p}fit_exercises
			 WHERE id = %d AND active = 1 AND {$exercise_access_where}",
			$new_exercise_id
		) );
		if ( ! $new_exercise ) {
			return new \WP_Error( 'workout_swap_exercise_unavailable', 'Selected swap exercise is not available.', [ 'status' => 404 ] );
		}

		$existing_original_id = isset( $current->original_exercise_id ) ? (int) $current->original_exercise_id : 0;

		$wpdb->update(
			$p . 'fit_workout_session_exercises',
			[
				'exercise_id' => $new_exercise_id,
				'was_swapped' => 1,
				'original_exercise_id' => $existing_original_id > 0 ? $existing_original_id : $original_exercise_id,
			],
			[ 'id' => $session_exercise_id ]
		);

		return [
			'swapped' => true,
			'exercise' => $new_exercise,
		];
	}

	private static function execute_undo_swap_exercise( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$session_exercise_id = (int) ( $command['session_exercise_id'] ?? 0 );
		$previous_exercise_id = (int) ( $command['previous_exercise_id'] ?? 0 );
		$previous_original_exercise_id = $command['previous_original_exercise_id'] ?? null;
		$previous_was_swapped = (int) (bool) ( $command['previous_was_swapped'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		if ( ! self::session_contains_exercise( $session_id, $session_exercise_id ) ) {
			return new \WP_Error( 'workout_exercise_not_found', 'Exercise not found in session.', [ 'status' => 404 ] );
		}

		$update = [
			'exercise_id' => $previous_exercise_id,
			'was_swapped' => $previous_was_swapped,
			'original_exercise_id' => null === $previous_original_exercise_id ? null : (int) $previous_original_exercise_id,
		];

		$wpdb->update(
			$p . 'fit_workout_session_exercises',
			$update,
			[ 'id' => $session_exercise_id, 'session_id' => $session_id ],
			[ '%d', '%d', '%d' ],
			[ '%d', '%d' ]
		);

		return [ 'undone' => true ];
	}

	private static function execute_quick_add_exercise( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$slot_type = sanitize_text_field( (string) ( $command['slot_type'] ?? 'accessory' ) );
		if ( '' === $slot_type ) {
			$slot_type = 'accessory';
		}
		$exercise_id = (int) ( $command['exercise_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_sessions WHERE id = %d",
			$session_id
		) );
		if ( ! $session ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$exercise_access_where = ExerciseLibraryService::accessible_exercise_where( '', $user_id );
		if ( $exercise_id <= 0 ) {
			$exercise_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$p}fit_exercises
				 WHERE active = 1
				   AND {$exercise_access_where}
				   AND JSON_CONTAINS(slot_types_json, %s)
				   AND JSON_CONTAINS(day_types_json, %s)
				 ORDER BY difficulty, id DESC
				 LIMIT 1",
				'"' . esc_sql( $slot_type ) . '"',
				'"' . esc_sql( (string) ( $session->planned_day_type ?? '' ) ) . '"'
			) );
		}

		if ( $exercise_id <= 0 ) {
			return new \WP_Error( 'workout_quick_add_no_match', 'No matching exercise found.', [ 'status' => 404 ] );
		}

		$exercise = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, name, primary_muscle, default_rep_min, default_rep_max, default_sets
			 FROM {$p}fit_exercises WHERE id = %d AND active = 1 AND {$exercise_access_where}",
			$exercise_id
		) );
		if ( ! $exercise ) {
			return new \WP_Error( 'workout_quick_add_exercise_not_found', 'Exercise not found.', [ 'status' => 404 ] );
		}

		$next_order = 1 + (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COALESCE(MAX(sort_order), 0) FROM {$p}fit_workout_session_exercises WHERE session_id = %d",
			$session_id
		) );

		$wpdb->insert( $p . 'fit_workout_session_exercises', [
			'session_id' => $session_id,
			'exercise_id' => (int) $exercise->id,
			'slot_type' => $slot_type,
			'planned_rep_min' => (int) $exercise->default_rep_min,
			'planned_rep_max' => (int) $exercise->default_rep_max,
			'planned_sets' => (int) $exercise->default_sets,
			'sort_order' => $next_order,
			'was_swapped' => 0,
		] );

		return [
			'added' => true,
			'session_exercise_id' => (int) $wpdb->insert_id,
			'exercise' => $exercise,
		];
	}

	private static function execute_undo_quick_add_exercise( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$session_exercise_id = (int) ( $command['session_exercise_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		if ( ! self::session_contains_exercise( $session_id, $session_exercise_id ) ) {
			return new \WP_Error( 'workout_exercise_not_found', 'Exercise not found in session.', [ 'status' => 404 ] );
		}

		$wpdb->delete( $p . 'fit_workout_sets', [ 'session_exercise_id' => $session_exercise_id ], [ '%d' ] );
		$wpdb->delete( $p . 'fit_workout_session_exercises', [ 'id' => $session_exercise_id, 'session_id' => $session_id ], [ '%d', '%d' ] );

		return [ 'undone' => true ];
	}

	private static function execute_remove_session_exercise( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$session_exercise_id = (int) ( $command['session_exercise_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$exercise = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_session_exercises WHERE id = %d AND session_id = %d",
			$session_exercise_id,
			$session_id
		) );

		if ( ! $exercise ) {
			return new \WP_Error( 'workout_exercise_not_found', 'Exercise not found in session.', [ 'status' => 404 ] );
		}

		$sets = $wpdb->get_results( $wpdb->prepare(
			"SELECT set_number, weight, reps, rir, rpe, completed, pain_flag, notes
			 FROM {$p}fit_workout_sets
			 WHERE session_exercise_id = %d
			 ORDER BY set_number, id",
			$session_exercise_id
		) );

		$wpdb->delete( $p . 'fit_workout_sets', [ 'session_exercise_id' => $session_exercise_id ], [ '%d' ] );
		$wpdb->delete( $p . 'fit_workout_session_exercises', [ 'id' => $session_exercise_id, 'session_id' => $session_id ], [ '%d', '%d' ] );
		self::resequence_session_sort_order( $session_id );

		return [
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
		];
	}

	private static function execute_restore_session_exercise( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$sort_order = max( 1, (int) ( $command['sort_order'] ?? 1 ) );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$wpdb->query( $wpdb->prepare(
			"UPDATE {$p}fit_workout_session_exercises
			 SET sort_order = sort_order + 1
			 WHERE session_id = %d AND sort_order >= %d",
			$session_id,
			$sort_order
		) );

		$slot_type = sanitize_text_field( (string) ( $command['slot_type'] ?? 'accessory' ) );
		if ( '' === $slot_type ) {
			$slot_type = 'accessory';
		}

		$wpdb->insert( $p . 'fit_workout_session_exercises', array_filter( [
			'session_id' => $session_id,
			'exercise_id' => (int) ( $command['exercise_id'] ?? 0 ),
			'slot_type' => $slot_type,
			'planned_rep_min' => (int) ( $command['planned_rep_min'] ?? 8 ),
			'planned_rep_max' => (int) ( $command['planned_rep_max'] ?? 12 ),
			'planned_sets' => (int) ( $command['planned_sets'] ?? 1 ),
			'sort_order' => $sort_order,
			'was_swapped' => array_key_exists( 'was_swapped', $command ) ? (int) (bool) $command['was_swapped'] : 0,
			'original_exercise_id' => array_key_exists( 'original_exercise_id', $command ) && null !== $command['original_exercise_id'] ? (int) $command['original_exercise_id'] : null,
			'notes' => array_key_exists( 'notes', $command ) && null !== $command['notes'] ? sanitize_textarea_field( (string) $command['notes'] ) : null,
		], fn( $value ) => null !== $value ) );

		$restored_session_exercise_id = (int) $wpdb->insert_id;
		$sets = $command['sets'] ?? null;
		if ( is_array( $sets ) ) {
			foreach ( $sets as $set ) {
				if ( ! is_array( $set ) ) {
					continue;
				}

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

		self::resequence_session_sort_order( $session_id );

		return [ 'restored' => true, 'session_exercise_id' => $restored_session_exercise_id ];
	}

	private static function execute_delete_set( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$set_id = (int) ( $command['set_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$set = $wpdb->get_row( $wpdb->prepare(
			"SELECT ws.*
			 FROM {$p}fit_workout_sets ws
			 JOIN {$p}fit_workout_session_exercises wse ON wse.id = ws.session_exercise_id
			 WHERE ws.id = %d AND wse.session_id = %d",
			$set_id,
			$session_id
		) );

		if ( ! $set ) {
			return new \WP_Error( 'workout_set_not_found', 'Set not found.', [ 'status' => 404 ] );
		}

		$wpdb->delete( $p . 'fit_workout_sets', [ 'id' => $set_id ], [ '%d' ] );
		self::resequence_set_numbers( (int) $set->session_exercise_id );

		return [
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
		];
	}

	private static function execute_restore_set( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$session_exercise_id = (int) ( $command['session_exercise_id'] ?? 0 );
		$set_number = max( 1, (int) ( $command['set_number'] ?? 1 ) );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		if ( ! self::session_contains_exercise( $session_id, $session_exercise_id ) ) {
			return new \WP_Error( 'workout_exercise_not_found', 'Exercise not found in session.', [ 'status' => 404 ] );
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
			'weight' => (float) ( $command['weight'] ?? 0 ),
			'reps' => (int) ( $command['reps'] ?? 0 ),
			'rir' => array_key_exists( 'rir', $command ) && null !== $command['rir'] ? (float) $command['rir'] : null,
			'rpe' => array_key_exists( 'rpe', $command ) && null !== $command['rpe'] ? (float) $command['rpe'] : null,
			'completed' => array_key_exists( 'completed', $command ) ? (int) (bool) $command['completed'] : 1,
			'pain_flag' => array_key_exists( 'pain_flag', $command ) ? (int) (bool) $command['pain_flag'] : 0,
			'notes' => isset( $command['notes'] ) ? sanitize_text_field( (string) $command['notes'] ) : null,
		], fn( $value ) => null !== $value ) );

		self::resequence_set_numbers( $session_exercise_id );

		return [ 'restored' => true, 'set_id' => (int) $wpdb->insert_id ];
	}

	private static function execute_skip_session( array $command ) {
		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$skip_count = self::mark_session_skipped( $session_id, $user_id );

		return [
			'skipped' => true,
			'skip_count' => (int) $skip_count,
			'skip_warning' => (int) $skip_count >= 3,
		];
	}

	private static function execute_restart_session( array $command ) {
		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );

		$session = self::session_for_user( $user_id, $session_id );
		if ( ! $session ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		if ( (int) $session->completed ) {
			return new \WP_Error( 'workout_session_completed', 'Completed sessions cannot be restarted.', [ 'status' => 400 ] );
		}

		self::delete_active_sessions_for_date( $user_id, (string) $session->session_date );

		return [ 'restarted' => true ];
	}

	private static function execute_discard_session( array $command ) {
		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );

		$session = self::session_for_user( $user_id, $session_id );
		if ( ! $session ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		if ( (int) $session->completed ) {
			return new \WP_Error( 'workout_session_completed', 'Completed sessions cannot be discarded.', [ 'status' => 400 ] );
		}

		self::discard_active_sessions_for_date( $user_id, (string) $session->session_date );

		return [ 'discarded' => true ];
	}

	private static function execute_complete_session( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$actual_day_type_override = isset( $command['actual_day_type'] ) ? sanitize_text_field( (string) $command['actual_day_type'] ) : '';

		$session = self::session_for_user( $user_id, $session_id );
		if ( ! $session ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$actual_day_type = '' !== $actual_day_type_override ? $actual_day_type_override : (string) $session->planned_day_type;
		$started_at = $session->started_at ?: current_time( 'mysql', true );
		$completed_at = current_time( 'mysql', true );
		$started_dt = new \DateTime( $started_at );
		$completed_dt = new \DateTime( $completed_at );
		$duration_min = (int) round( ( $completed_dt->getTimestamp() - $started_dt->getTimestamp() ) / 60 );
		$estimated_calories = self::estimate_workout_session_calories(
			$user_id,
			$duration_min,
			$actual_day_type,
			(string) ( $session->time_tier ?? 'medium' )
		);

		$wpdb->update( $p . 'fit_workout_sessions', [
			'completed' => 1,
			'actual_day_type' => $actual_day_type,
			'completed_at' => $completed_at,
			'duration_minutes' => $duration_min,
			'estimated_calories' => $estimated_calories,
		], [ 'id' => $session_id ] );
		BehaviorAnalyticsService::track(
			$user_id,
			'workout_complete',
			'workout',
			'complete_session',
			(float) $duration_min,
			[
				'session_id' => $session_id,
				'planned_day_type' => (string) ( $session->planned_day_type ?? '' ),
				'actual_day_type' => (string) $actual_day_type,
				'estimated_calories' => (int) $estimated_calories,
			]
		);

		if ( 'rest' === $actual_day_type ) {
			return [
				'completed' => true,
				'duration_minutes' => 0,
				'estimated_calories' => 0,
				'snapshots' => [],
				'ai_summary' => null,
				'rest_day' => true,
			];
		}

		$snapshots = self::record_training_snapshots( $session_id );
		self::evaluate_user_awards( $user_id );

		$ai_summary = null;
		$summary_result = self::post_workout_summary( $user_id, $session_id );
		if ( ! is_wp_error( $summary_result ) ) {
			$ai_summary = $summary_result;
		}

		self::grant_award( $user_id, 'first_workout' );

		return [
			'completed' => true,
			'duration_minutes' => $duration_min,
			'estimated_calories' => $estimated_calories,
			'snapshots' => $snapshots,
			'ai_summary' => $ai_summary,
		];
	}

	private static function execute_log_set( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$wpdb->insert( $p . 'fit_workout_sets', array_filter( [
			'session_exercise_id' => (int) ( $command['session_exercise_id'] ?? 0 ),
			'set_number' => (int) ( $command['set_number'] ?? 1 ),
			'weight' => (float) ( $command['weight'] ?? 0 ),
			'reps' => (int) ( $command['reps'] ?? 0 ),
			'rir' => array_key_exists( 'rir', $command ) && null !== $command['rir'] ? (float) $command['rir'] : null,
			'rpe' => array_key_exists( 'rpe', $command ) && null !== $command['rpe'] ? (float) $command['rpe'] : null,
			'completed' => array_key_exists( 'completed', $command ) ? (int) (bool) $command['completed'] : 1,
			'pain_flag' => array_key_exists( 'pain_flag', $command ) ? (int) (bool) $command['pain_flag'] : 0,
			'notes' => isset( $command['notes'] ) ? sanitize_text_field( (string) $command['notes'] ) : null,
		], fn( $value ) => null !== $value ) );

		return [ 'set_id' => (int) $wpdb->insert_id ];
	}

	private static function execute_update_set( array $command ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$user_id = (int) ( $command['user_id'] ?? 0 );
		$session_id = (int) ( $command['session_id'] ?? 0 );
		$set_id = (int) ( $command['set_id'] ?? 0 );

		if ( ! self::user_owns_session( $user_id, $session_id ) ) {
			return new \WP_Error( 'workout_session_not_found', 'Session not found.', [ 'status' => 404 ] );
		}

		$update = array_filter( [
			'weight' => array_key_exists( 'weight', $command ) && null !== $command['weight'] ? (float) $command['weight'] : null,
			'reps' => array_key_exists( 'reps', $command ) && null !== $command['reps'] ? (int) $command['reps'] : null,
			'rir' => array_key_exists( 'rir', $command ) && null !== $command['rir'] ? (float) $command['rir'] : null,
			'completed' => array_key_exists( 'completed', $command ) && null !== $command['completed'] ? (int) (bool) $command['completed'] : null,
			'pain_flag' => array_key_exists( 'pain_flag', $command ) && null !== $command['pain_flag'] ? (int) (bool) $command['pain_flag'] : null,
			'notes' => array_key_exists( 'notes', $command ) && null !== $command['notes'] ? sanitize_text_field( (string) $command['notes'] ) : null,
		], fn( $value ) => null !== $value );

		if ( $update ) {
			$wpdb->update( $p . 'fit_workout_sets', $update, [ 'id' => $set_id ] );
		}

		return [ 'updated' => true ];
	}

	private static function user_owns_session( int $user_id, int $session_id ): bool {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT user_id FROM {$wpdb->prefix}fit_workout_sessions WHERE id = %d",
			$session_id
		) ) === $user_id;
	}

	private static function session_for_user( int $user_id, int $session_id ): ?object {
		global $wpdb;
		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_workout_sessions WHERE id = %d AND user_id = %d",
			$session_id,
			$user_id
		) );
		return $session ?: null;
	}

	private static function session_contains_exercise( int $session_id, int $session_exercise_id ): bool {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_session_exercises WHERE id = %d AND session_id = %d",
			$session_exercise_id,
			$session_id
		) ) > 0;
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

	private static function mark_session_skipped( int $session_id, int $user_id ): int {
		$hook = self::test_hook( 'mark_session_skipped' );
		if ( $hook ) {
			return (int) $hook( $session_id, $user_id );
		}

		return TrainingEngine::mark_skipped( $session_id, $user_id );
	}

	private static function estimate_workout_session_calories( int $user_id, int $duration_minutes, string $day_type, string $time_tier ): int {
		$hook = self::test_hook( 'estimate_workout_session_calories' );
		if ( $hook ) {
			return (int) $hook( $user_id, $duration_minutes, $day_type, $time_tier );
		}

		return ExerciseCalorieService::estimate_workout_session_calories( $user_id, $duration_minutes, $day_type, $time_tier );
	}

	private static function record_training_snapshots( int $session_id ): array {
		$hook = self::test_hook( 'record_training_snapshots' );
		if ( $hook ) {
			$value = $hook( $session_id );
			return is_array( $value ) ? $value : [];
		}

		return TrainingEngine::record_snapshots( $session_id );
	}

	private static function evaluate_user_awards( int $user_id ): void {
		$hook = self::test_hook( 'evaluate_user_awards' );
		if ( $hook ) {
			$hook( $user_id );
			return;
		}

		AwardEngine::evaluate( $user_id );
	}

	private static function post_workout_summary( int $user_id, int $session_id ) {
		$hook = self::test_hook( 'post_workout_summary' );
		if ( $hook ) {
			return $hook( $user_id, $session_id );
		}

		return AiService::post_workout_summary( $user_id, $session_id );
	}

	private static function grant_award( int $user_id, string $code ): bool {
		$hook = self::test_hook( 'grant_award' );
		if ( $hook ) {
			return (bool) $hook( $user_id, $code );
		}

		return AwardEngine::grant( $user_id, $code );
	}

	private static function test_hook( string $name ): ?callable {
		$hooks = $GLOBALS['johnny5k_test_workout_action_hooks'] ?? null;
		if ( ! is_array( $hooks ) ) {
			return null;
		}

		$hook = $hooks[ $name ] ?? null;
		return is_callable( $hook ) ? $hook : null;
	}
}
