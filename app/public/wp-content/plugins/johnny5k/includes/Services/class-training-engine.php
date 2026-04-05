<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Training Engine
 *
 * Handles:
 *  - Building a workout session from the user's training plan + progression history
 *  - Applying double-progression logic to determine working weight/reps
 *  - Rolling skip-day tracking (warns at 3, no hard block; is_optional_session exempt)
 *  - Generating the post-workout performance snapshot (personal-record detection)
 */
class TrainingEngine {

	// ── Build Today's Workout ─────────────────────────────────────────────────

	/**
	 * Create a new workout_session row and populate workout_session_exercises
	 * based on the user's next scheduled training day.
	 *
	 * @param  int    $user_id
	 * @param  string $time_tier  'short'|'medium'|'full'
	 * @return array{session_id:int, day_type:string, exercises:array, skip_count:int, skip_warning:bool}|WP_Error
	 */
	public static function build_session( int $user_id, string $time_tier = 'medium' ) {
		global $wpdb;
		$p = $wpdb->prefix;

		// ── Fetch active training plan ────────────────────────────────────────
		$plan = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );
		if ( ! $plan ) {
			return new \WP_Error( 'no_plan', 'No active training plan found.' );
		}

		// ── Determine next day_type based on last completed session ───────────
		$next_day_type = self::next_day_type( $user_id, (int) $plan->id );

		// ── Skip count check (rolling 30-day window, optional_sessions exempt) ─
		$skip_count   = self::rolling_skip_count( $user_id );
		$skip_warning = $skip_count >= 3;

		// ── Create session row ────────────────────────────────────────────────
		$wpdb->insert( $p . 'fit_workout_sessions', [
			'user_id'          => $user_id,
			'session_date'     => current_time( 'Y-m-d' ),
			'planned_day_type' => $next_day_type,
			'time_tier'        => $time_tier,
			'completed'        => 0,
			'skip_requested'   => 0,
			'is_optional_session' => 0,
		] );
		$session_id = (int) $wpdb->insert_id;

		// ── Fetch exercises for this day_type from the plan ───────────────────
		$day = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_type = %s
			 ORDER BY day_order LIMIT 1",
			$plan->id, $next_day_type
		) );

		$exercises = [];

		if ( $day ) {
			$slot_limit = self::slot_limits_for_tier( $time_tier );

			$plan_exercises = $wpdb->get_results( $wpdb->prepare(
				"SELECT ude.*, e.name AS exercise_name, e.default_rep_min, e.default_rep_max, e.default_sets
				 FROM {$p}fit_user_training_day_exercises ude
				 JOIN {$p}fit_exercises e ON e.id = ude.exercise_id
				 WHERE ude.training_day_id = %d AND ude.active = 1
				 ORDER BY ude.sort_order",
				$day->id
			) );

			$slot_counts = [];
			foreach ( $plan_exercises as $ex ) {
				$slot = $ex->slot_type;
				if ( isset( $slot_limit[ $slot ] ) ) {
					$slot_counts[ $slot ] = ( $slot_counts[ $slot ] ?? 0 ) + 1;
					if ( $slot_counts[ $slot ] > $slot_limit[ $slot ] ) continue;
				}

				// Apply progression recommendations
				$prog = self::recommended_progression( $user_id, (int) $ex->exercise_id );

				$order = count( $exercises ) + 1;
				$wpdb->insert( $p . 'fit_workout_session_exercises', [
					'session_id'      => $session_id,
					'exercise_id'     => $ex->exercise_id,
					'slot_type'       => $slot,
					'planned_rep_min' => $ex->rep_min,
					'planned_rep_max' => $ex->rep_max,
					'planned_sets'    => $ex->sets_target,
					'sort_order'      => $order,
					'was_swapped'     => 0,
				] );

				$exercises[] = [
					'session_exercise_id' => $wpdb->insert_id,
					'exercise_id'         => (int) $ex->exercise_id,
					'exercise_name'       => $ex->exercise_name,
					'slot_type'           => $slot,
					'rep_min'             => $ex->rep_min,
					'rep_max'             => $ex->rep_max,
					'sets'                => $ex->sets_target,
					'suggested_weight'    => $prog['weight'],
					'suggestion_note'     => $prog['note'],
				];
			}
		}

		return [
			'session_id'   => $session_id,
			'day_type'     => $next_day_type,
			'exercises'    => $exercises,
			'skip_count'   => $skip_count,
			'skip_warning' => $skip_warning,
		];
	}

	// ── Skip Day ──────────────────────────────────────────────────────────────

	/**
	 * Mark a session as skipped. Returns skip_count after the skip.
	 *
	 * @param  int  $session_id
	 * @param  int  $user_id     For the rolling count query.
	 * @return int  New rolling skip count.
	 */
	public static function mark_skipped( int $session_id, int $user_id ): int {
		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'fit_workout_sessions',
			[ 'skip_requested' => 1 ],
			[ 'id' => $session_id, 'is_optional_session' => 0 ]
		);
		return self::rolling_skip_count( $user_id );
	}

	/**
	 * Rolling 30-day non-optional skip count.
	 */
	public static function rolling_skip_count( int $user_id ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d
			   AND skip_requested     = 1
			   AND is_optional_session = 0
			   AND session_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
			$user_id
		) );
	}

	// ── Post-Workout Snapshot ─────────────────────────────────────────────────

	/**
	 * After a session completes, evaluate each exercise for PRs and
	 * upsert performance snapshots.
	 *
	 * @param  int $session_id
	 * @return array<array{exercise_id:int, is_pr:bool, new_1rm:float}>
	 */
	public static function record_snapshots( int $session_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_workout_sessions WHERE id = %d",
			$session_id
		) );
		if ( ! $session ) return [];

		$results    = [];
		$user_id    = (int) $session->user_id;
		$today      = current_time( 'Y-m-d' );

		$session_exs = $wpdb->get_results( $wpdb->prepare(
			"SELECT wse.id AS ses_ex_id, wse.exercise_id
			 FROM {$p}fit_workout_session_exercises wse
			 WHERE wse.session_id = %d",
			$session_id
		) );

		foreach ( $session_exs as $sex ) {
			$sets = $wpdb->get_results( $wpdb->prepare(
				"SELECT weight, reps FROM {$p}fit_workout_sets
				 WHERE session_exercise_id = %d AND completed = 1 AND reps > 0",
				$sex->ses_ex_id
			) );

			if ( ! $sets ) continue;

			$best_weight = 0.0;
			$best_reps   = 0;
			$best_vol    = 0;
			$best_1rm    = 0.0;

			foreach ( $sets as $set ) {
				$vol  = (float) $set->weight * (int) $set->reps;
				$e1rm = (float) $set->weight * ( 1 + (int) $set->reps / 30 ); // Epley formula
				if ( $e1rm > $best_1rm ) {
					$best_1rm = $e1rm;
					$best_weight = (float) $set->weight;
					$best_reps   = (int) $set->reps;
				}
				if ( $vol > $best_vol ) $best_vol = (int) $vol;
			}

			// Check for PR
			$prev_1rm = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT MAX(estimated_1rm) FROM {$p}fit_exercise_performance_snapshots
				 WHERE user_id = %d AND exercise_id = %d",
				$user_id, $sex->exercise_id
			) );

			$is_pr = $best_1rm > $prev_1rm;

			$wpdb->replace( $p . 'fit_exercise_performance_snapshots', [
				'user_id'      => $user_id,
				'exercise_id'  => $sex->exercise_id,
				'snapshot_date'=> $today,
				'best_weight'  => $best_weight,
				'best_reps'    => $best_reps,
				'best_volume'  => $best_vol,
				'estimated_1rm'=> round( $best_1rm, 2 ),
			] );

			if ( $is_pr ) {
				AwardEngine::grant( $user_id, 'first_pr' );
			}

			$results[] = [
				'exercise_id' => (int) $sex->exercise_id,
				'is_pr'       => $is_pr,
				'new_1rm'     => round( $best_1rm, 2 ),
			];
		}

		return $results;
	}

	// ── Progression logic ─────────────────────────────────────────────────────

	/**
	 * Given a user + exercise, suggest the working weight for the next session.
	 * Uses the last 3 sessions of that exercise to apply double-progression.
	 *
	 * @return array{weight:float|null, note:string}
	 */
	private static function recommended_progression( int $user_id, int $exercise_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		// Last 3 sessions where this exercise was performed and at least 1 set completed
		$last_sets = $wpdb->get_results( $wpdb->prepare(
			"SELECT ws.weight, ws.reps, ws.rir
			 FROM {$p}fit_workout_sets ws
			 JOIN {$p}fit_workout_session_exercises wse ON wse.id = ws.session_exercise_id
			 JOIN {$p}fit_workout_sessions s ON s.id = wse.session_id
			 WHERE s.user_id = %d AND wse.exercise_id = %d AND ws.completed = 1 AND ws.reps > 0
			 ORDER BY s.session_date DESC, ws.set_number DESC
			 LIMIT 10",
			$user_id, $exercise_id
		) );

		if ( ! $last_sets ) {
			return [ 'weight' => null, 'note' => 'Start light — first time performing this exercise.' ];
		}

		// Average of recent top sets
		$weights = array_map( fn( $s ) => (float) $s->weight, $last_sets );
		$avg_w   = array_sum( $weights ) / count( $weights );
		$avg_rir = array_sum( array_map( fn( $s ) => (float) $s->rir, $last_sets ) ) / count( $last_sets );

		if ( $avg_rir <= 1.0 ) {
			// RIR ≤1 — suggest a 2.5–5 lb increase
			$new_weight = $avg_w + ( $avg_w >= 100 ? 5.0 : 2.5 );
			return [ 'weight' => $new_weight, 'note' => 'Last session was near-failure — time to add weight.' ];
		}

		// Otherwise, hold weight and aim for top of rep range
		return [ 'weight' => $avg_w, 'note' => 'Match your last session weight and aim for the top of your rep range.' ];
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	/**
	 * Determine the next day_type in the user's plan cycle.
	 */
	private static function next_day_type( int $user_id, int $plan_id ): string {
		global $wpdb;
		$p = $wpdb->prefix;

		$last_day_type = $wpdb->get_var( $wpdb->prepare(
			"SELECT planned_day_type FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1
			 ORDER BY session_date DESC LIMIT 1",
			$user_id
		) );

		$days = $wpdb->get_results( $wpdb->prepare(
			"SELECT day_type, day_order FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_type != 'rest'
			 ORDER BY day_order",
			$plan_id
		) );

		if ( ! $days ) return 'push';

		if ( ! $last_day_type ) {
			return $days[0]->day_type;
		}

		$types = array_map( fn( $d ) => $d->day_type, $days );
		$idx   = array_search( $last_day_type, $types, true );

		if ( $idx === false ) return $types[0];
		return $types[ ( $idx + 1 ) % count( $types ) ];
	}

	/**
	 * Maximum slots shown per tier to keep short sessions actually short.
	 *
	 * @return array<string, int>  slot_type => max count
	 */
	private static function slot_limits_for_tier( string $tier ): array {
		return match ( $tier ) {
			'short'  => [ 'main' => 1, 'secondary' => 1, 'shoulders' => 1, 'accessory' => 1, 'abs' => 1, 'challenge' => 0 ],
			'full'   => [ 'main' => 2, 'secondary' => 2, 'shoulders' => 2, 'accessory' => 3, 'abs' => 2, 'challenge' => 1 ],
			default  => [ 'main' => 1, 'secondary' => 2, 'shoulders' => 1, 'accessory' => 2, 'abs' => 1, 'challenge' => 1 ],
		};
	}
}
