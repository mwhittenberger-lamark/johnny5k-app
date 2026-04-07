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
	* @param  bool   $maintenance_mode
	* @param  string|null $day_type_override
	 * @return array{session_id:int, day_type:string, exercises:array, skip_count:int, skip_warning:bool}|WP_Error
	 */
	public static function build_session( int $user_id, string $time_tier = 'medium', bool $maintenance_mode = false, ?string $day_type_override = null, array $exercise_swaps = [], array $exercise_order = [] ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$blueprint = self::build_session_blueprint( $user_id, $time_tier, $maintenance_mode, $day_type_override, $exercise_swaps, $exercise_order );
		if ( is_wp_error( $blueprint ) ) {
			return $blueprint;
		}

		$next_day_type = (string) $blueprint['day_type'];
		$skip_count = (int) $blueprint['skip_count'];
		$skip_warning = ! empty( $blueprint['skip_warning'] );

		// ── Create session row ────────────────────────────────────────────────
		$wpdb->insert( $p . 'fit_workout_sessions', [
			'user_id'          => $user_id,
			'session_date'     => UserTime::today( $user_id ),
			'planned_day_type' => $next_day_type,
			'time_tier'        => $time_tier,
			'completed'        => 0,
			'skip_requested'   => 0,
			'is_optional_session' => 0,
		] );
		$session_id = (int) $wpdb->insert_id;

		$exercises = [];

		foreach ( (array) $blueprint['exercises'] as $exercise ) {
			$order = count( $exercises ) + 1;
			$wpdb->insert( $p . 'fit_workout_session_exercises', array_filter( [
				'session_id'          => $session_id,
				'exercise_id'         => (int) ( $exercise['exercise_id'] ?? 0 ),
				'slot_type'           => (string) ( $exercise['slot_type'] ?? 'accessory' ),
				'planned_rep_min'     => (int) ( $exercise['rep_min'] ?? 8 ),
				'planned_rep_max'     => (int) ( $exercise['rep_max'] ?? 12 ),
				'planned_sets'        => (int) ( $exercise['sets'] ?? 1 ),
				'sort_order'          => $order,
				'was_swapped'         => ! empty( $exercise['was_swapped'] ) ? 1 : 0,
				'original_exercise_id'=> ! empty( $exercise['was_swapped'] ) ? (int) ( $exercise['original_exercise_id'] ?? 0 ) : null,
			], static fn( $value ): bool => null !== $value ) );

			$exercise['session_exercise_id'] = (int) $wpdb->insert_id;
			$exercises[] = $exercise;
		}

		return [
			'session_id'   => $session_id,
			'day_type'     => $next_day_type,
			'exercises'    => $exercises,
			'skip_count'   => $skip_count,
			'skip_warning' => $skip_warning,
		];
	}

	public static function preview_session( int $user_id, string $time_tier = 'medium', bool $maintenance_mode = false, ?string $day_type_override = null, array $exercise_swaps = [], array $exercise_order = [] ) {
		$blueprint = self::build_session_blueprint( $user_id, $time_tier, $maintenance_mode, $day_type_override, $exercise_swaps, $exercise_order );
		if ( is_wp_error( $blueprint ) ) {
			return $blueprint;
		}

		return [
			'day_type'           => (string) $blueprint['day_type'],
			'time_tier'          => $time_tier,
			'session_mode'       => $maintenance_mode ? 'maintenance' : 'normal',
			'plan_exercise_count'=> (int) $blueprint['plan_exercise_count'],
			'skip_count'         => (int) $blueprint['skip_count'],
			'skip_warning'       => ! empty( $blueprint['skip_warning'] ),
			'exercises'          => array_values( (array) $blueprint['exercises'] ),
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
		$since = UserTime::days_ago( $user_id, 29 );
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d
			   AND skip_requested     = 1
			   AND is_optional_session = 0
			   AND session_date >= %s",
			$user_id,
			$since
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
		$today      = UserTime::today( $user_id );

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
	public static function recommended_progression( int $user_id, int $exercise_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$equipment = (string) $wpdb->get_var( $wpdb->prepare(
			"SELECT equipment FROM {$p}fit_exercises WHERE id = %d LIMIT 1",
			$exercise_id
		) );

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
			$new_weight = self::round_training_weight( $avg_w + ( $avg_w >= 100 ? 5.0 : 2.5 ), $equipment );
			return [ 'weight' => $new_weight, 'note' => 'Last session was near-failure — time to add weight.' ];
		}

		// Otherwise, hold weight and aim for top of rep range
		return [ 'weight' => self::round_training_weight( $avg_w, $equipment ), 'note' => 'Match your last session weight and aim for the top of your rep range.' ];
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	/**
	 * Determine the next day_type in the user's plan cycle.
	 */
	private static function next_day_type( int $user_id, int $plan_id ): string {
		global $wpdb;
		$p = $wpdb->prefix;

		$weekday_order = UserTime::weekday_order_for_date( $user_id, UserTime::today( $user_id ) );
		$day_type = $wpdb->get_var( $wpdb->prepare(
			"SELECT day_type FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_order = %d
			 LIMIT 1",
			$plan_id,
			$weekday_order
		) );

		if ( $day_type ) {
			return (string) $day_type;
		}

		$first_active_day = $wpdb->get_var( $wpdb->prepare(
			"SELECT day_type FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_type != 'rest'
			 ORDER BY day_order LIMIT 1",
			$plan_id
		) );

		return $first_active_day ? (string) $first_active_day : 'rest';
	}

	private static function build_session_blueprint( int $user_id, string $time_tier, bool $maintenance_mode, ?string $day_type_override, array $exercise_swaps, array $exercise_order ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$plan = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );
		if ( ! $plan ) {
			return new \WP_Error( 'no_plan', 'No active training plan found.' );
		}

		$next_day_type = self::normalize_day_type( $day_type_override ) ?: self::next_day_type( $user_id, (int) $plan->id );
		$skip_count = self::rolling_skip_count( $user_id );
		$skip_warning = $skip_count >= 3;

		$day = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_type = %s
			 ORDER BY day_order LIMIT 1",
			$plan->id,
			$next_day_type
		) );

		$plan_exercises = [];
		$exercises = [];
		if ( $day ) {
			$slot_limit = self::slot_limits_for_tier( $time_tier );
			$plan_exercises = $wpdb->get_results( $wpdb->prepare(
				"SELECT ude.*, e.name AS exercise_name, e.default_rep_min, e.default_rep_max, e.default_sets,
				        e.primary_muscle, e.equipment, e.difficulty
				 FROM {$p}fit_user_training_day_exercises ude
				 JOIN {$p}fit_exercises e ON e.id = ude.exercise_id
				 WHERE ude.training_day_id = %d AND ude.active = 1
				 ORDER BY ude.sort_order",
				$day->id
			) );

			$selected_exercises = $maintenance_mode
				? self::select_maintenance_exercises( $plan_exercises )
				: $plan_exercises;

			$slot_counts = [];
			foreach ( $selected_exercises as $exercise ) {
				$slot = (string) $exercise->slot_type;
				if ( isset( $slot_limit[ $slot ] ) ) {
					$slot_counts[ $slot ] = ( $slot_counts[ $slot ] ?? 0 ) + 1;
					if ( $slot_counts[ $slot ] > $slot_limit[ $slot ] ) {
						continue;
					}
				}

				$resolved_exercise = self::resolve_session_exercise_selection( $next_day_type, $exercise, (int) ( $exercise_swaps[ (int) $exercise->id ] ?? 0 ) );
				$resolved_exercise_id = (int) ( $resolved_exercise['exercise_id'] ?? (int) $exercise->exercise_id );
				$prog = self::recommended_progression( $user_id, $resolved_exercise_id );

				$planned_sets = $maintenance_mode ? self::maintenance_set_target( $slot, (int) $exercise->sets_target ) : (int) $exercise->sets_target;
				$planned_rep_min = $maintenance_mode ? max( 5, (int) $exercise->rep_min ) : (int) $exercise->rep_min;
				$planned_rep_max = $maintenance_mode ? max( $planned_rep_min, min( 12, (int) $exercise->rep_max ) ) : (int) $exercise->rep_max;

				$exercises[] = [
					'plan_exercise_id'    => (int) $exercise->id,
					'exercise_id'         => $resolved_exercise_id,
					'original_exercise_id'=> (int) $exercise->exercise_id,
					'original_exercise_name' => (string) $exercise->exercise_name,
					'exercise_name'       => (string) ( $resolved_exercise['exercise_name'] ?? $exercise->exercise_name ),
					'primary_muscle'      => (string) ( $resolved_exercise['primary_muscle'] ?? $exercise->primary_muscle ?? '' ),
					'equipment'           => (string) ( $resolved_exercise['equipment'] ?? $exercise->equipment ?? '' ),
					'difficulty'          => (string) ( $resolved_exercise['difficulty'] ?? $exercise->difficulty ?? '' ),
					'slot_type'           => $slot,
					'rep_min'             => $planned_rep_min,
					'rep_max'             => $planned_rep_max,
					'sets'                => $planned_sets,
					'suggested_weight'    => $prog['weight'],
					'suggestion_note'     => $maintenance_mode ? 'Maintenance mode: clean reps and leave gas in the tank.' : $prog['note'],
					'was_swapped'         => ! empty( $resolved_exercise['was_swapped'] ),
				];
			}
		}

		$exercises = self::apply_exercise_order( $exercises, $exercise_order );

		return [
			'day_type'            => $next_day_type,
			'skip_count'          => $skip_count,
			'skip_warning'        => $skip_warning,
			'plan_exercise_count' => count( $plan_exercises ),
			'exercises'           => $exercises,
		];
	}

	private static function apply_exercise_order( array $exercises, array $exercise_order ): array {
		if ( empty( $exercises ) || empty( $exercise_order ) ) {
			return $exercises;
		}

		$order_index = [];
		foreach ( $exercise_order as $position => $plan_exercise_id ) {
			$plan_exercise_id = (int) $plan_exercise_id;
			if ( $plan_exercise_id > 0 ) {
				$order_index[ $plan_exercise_id ] = $position;
			}
		}

		if ( empty( $order_index ) ) {
			return $exercises;
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

	private static function resolve_session_exercise_selection( string $day_type, object $plan_exercise, int $swap_exercise_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$selected = [
			'exercise_id'    => (int) $plan_exercise->exercise_id,
			'exercise_name'  => (string) $plan_exercise->exercise_name,
			'primary_muscle' => (string) ( $plan_exercise->primary_muscle ?? '' ),
			'equipment'      => (string) ( $plan_exercise->equipment ?? '' ),
			'difficulty'     => (string) ( $plan_exercise->difficulty ?? '' ),
			'was_swapped'    => false,
		];

		if ( $swap_exercise_id <= 0 || $swap_exercise_id === (int) $plan_exercise->exercise_id ) {
			return $selected;
		}

		$day_json = '"' . esc_sql( $day_type ) . '"';
		$slot_json = '"' . esc_sql( (string) $plan_exercise->slot_type ) . '"';
		$override = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, name, primary_muscle, equipment, difficulty
			 FROM {$p}fit_exercises
			 WHERE id = %d
			   AND active = 1
			   AND JSON_CONTAINS(day_types_json, %s)
			   AND JSON_CONTAINS(slot_types_json, %s)
			 LIMIT 1",
			$swap_exercise_id,
			$day_json,
			$slot_json
		) );

		if ( ! $override ) {
			return $selected;
		}

		return [
			'exercise_id'    => (int) $override->id,
			'exercise_name'  => (string) $override->name,
			'primary_muscle' => (string) ( $override->primary_muscle ?? '' ),
			'equipment'      => (string) ( $override->equipment ?? '' ),
			'difficulty'     => (string) ( $override->difficulty ?? '' ),
			'was_swapped'    => true,
		];
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

	private static function select_maintenance_exercises( array $plan_exercises ): array {
		$slot_caps = [
			'main' => 1,
			'secondary' => 1,
			'shoulders' => 1,
			'accessory' => 1,
			'abs' => 0,
			'challenge' => 0,
		];
		$slot_counts = [];
		$selected = [];

		foreach ( $plan_exercises as $exercise ) {
			$slot = (string) $exercise->slot_type;
			$cap = $slot_caps[ $slot ] ?? 0;
			if ( $cap < 1 ) {
				continue;
			}

			$current_count = $slot_counts[ $slot ] ?? 0;
			if ( $current_count >= $cap ) {
				continue;
			}

			$selected[] = $exercise;
			$slot_counts[ $slot ] = $current_count + 1;

			if ( count( $selected ) >= 3 ) {
				break;
			}
		}

		return ! empty( $selected ) ? $selected : array_slice( array_values( array_filter( $plan_exercises, fn( $exercise ) => ! in_array( (string) $exercise->slot_type, [ 'abs', 'challenge' ], true ) ) ), 0, 2 );
	}

	private static function maintenance_set_target( string $slot_type, int $default_sets ): int {
		if ( in_array( $slot_type, [ 'main', 'secondary' ], true ) ) {
			return max( 1, min( 2, $default_sets ) );
		}

		return 1;
	}

	private static function normalize_day_type( ?string $value ): ?string {
		if ( ! is_string( $value ) || '' === $value ) {
			return null;
		}

		$day_type = sanitize_key( $value );
		$allowed  = [ 'push', 'pull', 'legs', 'arms_shoulders', 'cardio', 'rest' ];

		return in_array( $day_type, $allowed, true ) ? $day_type : null;
	}

	private static function round_training_weight( float $weight, string $equipment = '' ): float {
		if ( $weight <= 0 ) {
			return 0.0;
		}

		$increment = 'dumbbell' === $equipment
			? 10.0
			: ( $weight >= 100 ? 5.0 : 2.5 );

		return round( $weight / $increment ) * $increment;
	}
}
