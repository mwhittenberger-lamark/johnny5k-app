<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\TrainingDayTypes;

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
	private const UNRESTRICTED_EQUIPMENT = '__all__';
	private const BONUS_FILL_NOTE_MARKER = '[bonus_fill]';
	private static array $equipment_profile_cache = [];

	public static function bonus_fill_note_marker(): string {
		return self::BONUS_FILL_NOTE_MARKER;
	}

	// ── Build Today's Workout ─────────────────────────────────────────────────

	/**
	 * Create a new workout_session row and populate workout_session_exercises
	 * based on the user's next scheduled training day.
	 *
	 * @param  int    $user_id
	 * @param  string $time_tier  'short'|'medium'|'full'
	* @param  bool   $maintenance_mode
	* @param  string|null $day_type_override
	 * @return array{session_id:int, day_type:string, exercises:array, skip_count:int, skip_warning:bool}|\WP_Error
	 */
	public static function build_session( int $user_id, string $time_tier = 'medium', bool $maintenance_mode = false, ?string $day_type_override = null, array $exercise_swaps = [], array $exercise_order = [], array $rep_adjustments = [], array $exercise_removals = [], array $exercise_additions = [] ) {
		global $wpdb;
		$p = $wpdb->prefix;

		$blueprint = self::build_session_blueprint( $user_id, $time_tier, $maintenance_mode, $day_type_override, $exercise_swaps, $exercise_order, $exercise_removals, $exercise_additions );
		if ( is_wp_error( $blueprint ) ) {
			return $blueprint;
		}

		$next_day_type = (string) $blueprint['day_type'];
		$skip_count = (int) $blueprint['skip_count'];
		$skip_warning = ! empty( $blueprint['skip_warning'] );
		$blueprint['exercises'] = self::apply_rep_adjustments( (array) ( $blueprint['exercises'] ?? [] ), $rep_adjustments );

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
				'notes'               => ! empty( $exercise['is_bonus_fill'] ) ? self::BONUS_FILL_NOTE_MARKER : null,
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

	public static function preview_session( int $user_id, string $time_tier = 'medium', bool $maintenance_mode = false, ?string $day_type_override = null, array $exercise_swaps = [], array $exercise_order = [], array $rep_adjustments = [], array $exercise_removals = [], array $exercise_additions = [] ) {
		$blueprint = self::build_session_blueprint( $user_id, $time_tier, $maintenance_mode, $day_type_override, $exercise_swaps, $exercise_order, $exercise_removals, $exercise_additions );
		if ( is_wp_error( $blueprint ) ) {
			return $blueprint;
		}
		$blueprint['exercises'] = self::apply_rep_adjustments( (array) ( $blueprint['exercises'] ?? [] ), $rep_adjustments );

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

	private static function build_session_blueprint( int $user_id, string $time_tier, bool $maintenance_mode, ?string $day_type_override, array $exercise_swaps, array $exercise_order, array $exercise_removals = [], array $exercise_additions = [] ) {
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
		$variation_strategy = [
			'swaps' => [],
			'order' => [],
		];
		$slot_limit = self::slot_limits_for_tier( $time_tier );
		$avoid_terms = self::get_user_exercise_avoidance_terms( $user_id );
		$allowed_equipment = self::get_allowed_equipment_for_user( $user_id );
		if ( $day ) {
				$plan_exercises = $wpdb->get_results( $wpdb->prepare(
					"SELECT ude.*, e.name AS exercise_name, e.default_rep_min, e.default_rep_max, e.default_sets,
					        e.primary_muscle, e.equipment, e.difficulty
					 FROM {$p}fit_user_training_day_exercises ude
					 JOIN {$p}fit_exercises e ON e.id = ude.exercise_id
					 WHERE ude.training_day_id = %d AND ude.active = 1
					 ORDER BY ude.sort_order",
					$day->id
				) );
				if ( empty( $plan_exercises ) && 'rest' !== $next_day_type ) {
					self::backfill_user_day_from_template(
						$user_id,
						(int) ( $plan->program_template_id ?? 0 ),
						(int) $day->id,
						$next_day_type,
						$avoid_terms,
						$allowed_equipment
					);
					$plan_exercises = $wpdb->get_results( $wpdb->prepare(
						"SELECT ude.*, e.name AS exercise_name, e.default_rep_min, e.default_rep_max, e.default_sets,
						        e.primary_muscle, e.equipment, e.difficulty
						 FROM {$p}fit_user_training_day_exercises ude
						 JOIN {$p}fit_exercises e ON e.id = ude.exercise_id
						 WHERE ude.training_day_id = %d AND ude.active = 1
						 ORDER BY ude.sort_order",
						$day->id
					) );
				}

			$selected_exercises = $maintenance_mode
				? self::select_maintenance_exercises( $plan_exercises )
				: $plan_exercises;
			$variation_strategy = self::build_day_variation_strategy( $user_id, $next_day_type, $selected_exercises, $exercise_swaps, $exercise_order );

			$slot_counts = [];
			$selected_exercise_ids = [];
			foreach ( $selected_exercises as $exercise ) {
				$slot = (string) $exercise->slot_type;
				if ( isset( $slot_limit[ $slot ] ) ) {
					$slot_counts[ $slot ] = ( $slot_counts[ $slot ] ?? 0 ) + 1;
					if ( $slot_counts[ $slot ] > $slot_limit[ $slot ] ) {
						continue;
					}
				}

				$resolved_exercise = self::resolve_session_exercise_selection(
					$user_id,
					$next_day_type,
					$exercise,
					(int) ( $exercise_swaps[ (int) $exercise->id ] ?? $variation_strategy['swaps'][ (int) $exercise->id ] ?? 0 ),
					$selected_exercise_ids,
					$avoid_terms,
					$allowed_equipment
				);
				$resolved_exercise_id = (int) ( $resolved_exercise['exercise_id'] ?? (int) $exercise->exercise_id );
				if ( ! empty( $resolved_exercise['blocked'] ) || $resolved_exercise_id <= 0 ) {
					continue;
				}
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
				$selected_exercise_ids[] = $resolved_exercise_id;
			}
		}

		$effective_exercise_order = ! empty( $exercise_order ) ? $exercise_order : (array) ( $variation_strategy['order'] ?? [] );
		$exercises = self::apply_exercise_order( $exercises, $effective_exercise_order );
		$exercises = self::apply_exercise_removals( $exercises, $exercise_removals );
		$exercises = self::append_exercise_additions( $user_id, $exercises, $exercise_additions, $maintenance_mode );
		if ( 'full' === $time_tier && ! in_array( $next_day_type, [ 'rest', 'cardio' ], true ) ) {
			$exercises = self::append_full_tier_bonus_exercises(
				$user_id,
				$next_day_type,
				$exercises,
				$slot_limit,
				$avoid_terms,
				$allowed_equipment,
				$maintenance_mode
			);
		}

		return [
			'day_type'            => $next_day_type,
			'skip_count'          => $skip_count,
			'skip_warning'        => $skip_warning,
			'plan_exercise_count' => count( $plan_exercises ),
			'exercises'           => $exercises,
		];
	}

	private static function apply_exercise_removals( array $exercises, array $exercise_removals ): array {
		if ( empty( $exercises ) || empty( $exercise_removals ) ) {
			return array_values( $exercises );
		}

		$remove_lookup = array_flip( array_values( array_filter( array_map( 'intval', $exercise_removals ), static fn( int $id ): bool => $id > 0 ) ) );
		if ( empty( $remove_lookup ) ) {
			return array_values( $exercises );
		}

		return array_values( array_filter( $exercises, static function( array $exercise ) use ( $remove_lookup ): bool {
			$plan_exercise_id = (int) ( $exercise['plan_exercise_id'] ?? 0 );
			return $plan_exercise_id <= 0 || ! isset( $remove_lookup[ $plan_exercise_id ] );
		} ) );
	}

	private static function append_exercise_additions( int $user_id, array $exercises, array $exercise_additions, bool $maintenance_mode ): array {
		if ( empty( $exercise_additions ) ) {
			return array_values( $exercises );
		}

		$selected_exercise_ids = array_values( array_filter( array_map( static fn( array $exercise ): int => (int) ( $exercise['exercise_id'] ?? 0 ), $exercises ) ) );
		$next_plan_exercise_id = max( 900000, ...array_map( static fn( array $exercise ): int => (int) ( $exercise['plan_exercise_id'] ?? 0 ), $exercises ) ) + 1;
		$normalized = array_values( $exercises );

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

			$slot_type = sanitize_key( (string) ( $addition['slot_type'] ?? 'accessory' ) ) ?: 'accessory';
			$rep_min = max( 3, (int) ( $addition['rep_min'] ?? $exercise->default_rep_min ?? 8 ) );
			$rep_max = max( $rep_min, (int) ( $addition['rep_max'] ?? $exercise->default_rep_max ?? 12 ) );
			$sets = max( 1, (int) ( $addition['sets'] ?? $exercise->default_sets ?? 3 ) );

			if ( $maintenance_mode ) {
				$rep_min = max( 5, $rep_min );
				$rep_max = max( $rep_min, min( 12, $rep_max ) );
				$sets = min( $sets, self::maintenance_set_target( $slot_type, $sets ) );
			}

			$prog = self::recommended_progression( $user_id, $exercise_id );
			$normalized[] = [
				'plan_exercise_id'       => $next_plan_exercise_id,
				'exercise_id'            => (int) $exercise->id,
				'original_exercise_id'   => (int) $exercise->id,
				'original_exercise_name' => (string) ( $exercise->name ?? '' ),
				'exercise_name'          => (string) ( $exercise->name ?? '' ),
				'primary_muscle'         => (string) ( $exercise->primary_muscle ?? '' ),
				'equipment'              => (string) ( $exercise->equipment ?? '' ),
				'difficulty'             => (string) ( $exercise->difficulty ?? '' ),
				'slot_type'              => $slot_type,
				'rep_min'                => $rep_min,
				'rep_max'                => $rep_max,
				'sets'                   => $sets,
				'suggested_weight'       => $prog['weight'] ?? null,
				'suggestion_note'        => $maintenance_mode
					? 'Maintenance mode: clean reps and leave gas in the tank.'
					: (string) ( $prog['note'] ?? 'Added as an extra movement for today.' ),
				'was_swapped'            => false,
				'is_added'               => true,
			];
			$selected_exercise_ids[] = $exercise_id;
			$next_plan_exercise_id++;
		}

		return $normalized;
	}

	private static function append_full_tier_bonus_exercises( int $user_id, string $day_type, array $exercises, array $slot_limit, array $avoid_terms, array $allowed_equipment, bool $maintenance_mode ): array {
		$normalized = array_values( $exercises );
		$selected_exercise_ids = array_values( array_filter( array_map( static fn( array $exercise ): int => (int) ( $exercise['exercise_id'] ?? 0 ), $normalized ) ) );
		$next_plan_exercise_id = max( 900000, ...array_map( static fn( array $exercise ): int => (int) ( $exercise['plan_exercise_id'] ?? 0 ), $normalized ) ) + 1;
		$bonus_slot_priority = [ 'abs', 'challenge' ];
		$slot_counts = [];
		foreach ( $normalized as $exercise ) {
			$slot_type = (string) ( $exercise['slot_type'] ?? '' );
			if ( '' === $slot_type ) {
				continue;
			}
			$slot_counts[ $slot_type ] = ( $slot_counts[ $slot_type ] ?? 0 ) + 1;
		}

		foreach ( $bonus_slot_priority as $slot_type ) {
			$target_slot_count = (int) ( $slot_limit[ $slot_type ] ?? 0 );
			$current_slot_count = (int) ( $slot_counts[ $slot_type ] ?? 0 );

			while ( $current_slot_count < $target_slot_count ) {
				$candidate = self::find_bonus_slot_exercise_candidate(
					$user_id,
					$day_type,
					$slot_type,
					$selected_exercise_ids,
					$avoid_terms,
					$allowed_equipment
				);
				if ( ! $candidate ) {
					break;
				}

				$rep_min = max( 3, (int) ( $candidate->default_rep_min ?? 8 ) );
				$rep_max = max( $rep_min, (int) ( $candidate->default_rep_max ?? 12 ) );
				$sets = max( 1, (int) ( $candidate->default_sets ?? 3 ) );

				if ( $maintenance_mode ) {
					$rep_min = max( 5, $rep_min );
					$rep_max = max( $rep_min, min( 12, $rep_max ) );
					$sets = min( $sets, self::maintenance_set_target( $slot_type, $sets ) );
				}

				$prog = self::recommended_progression( $user_id, (int) $candidate->id );
				$normalized[] = [
					'plan_exercise_id'       => $next_plan_exercise_id,
					'exercise_id'            => (int) $candidate->id,
					'original_exercise_id'   => (int) $candidate->id,
					'original_exercise_name' => (string) ( $candidate->name ?? '' ),
					'exercise_name'          => (string) ( $candidate->name ?? '' ),
					'primary_muscle'         => (string) ( $candidate->primary_muscle ?? '' ),
					'equipment'              => (string) ( $candidate->equipment ?? '' ),
					'difficulty'             => (string) ( $candidate->difficulty ?? '' ),
					'slot_type'              => $slot_type,
					'rep_min'                => $rep_min,
					'rep_max'                => $rep_max,
					'sets'                   => $sets,
					'suggested_weight'       => $prog['weight'] ?? null,
					'suggestion_note'        => $maintenance_mode
						? 'Maintenance mode: clean reps and leave gas in the tank.'
						: sprintf( 'Full session bonus %s added automatically.', $slot_type ),
					'was_swapped'            => false,
					'is_added'               => true,
					'is_bonus_fill'          => true,
				];

				$selected_exercise_ids[] = (int) $candidate->id;
				$slot_counts[ $slot_type ] = ( $slot_counts[ $slot_type ] ?? 0 ) + 1;
				$current_slot_count = (int) $slot_counts[ $slot_type ];
				$next_plan_exercise_id++;
			}
		}

		return $normalized;
	}

	private static function find_bonus_slot_exercise_candidate( int $user_id, string $day_type, string $slot_type, array $excluded_ids, array $avoid_terms, array $allowed_equipment ): ?object {
		$day_type_scopes = [ $day_type, '' ];

		foreach ( $day_type_scopes as $day_type_scope ) {
			$candidate = self::query_bonus_slot_exercise_candidate( $user_id, $day_type_scope, $slot_type, $excluded_ids, $avoid_terms, $allowed_equipment );
			if ( $candidate ) {
				return $candidate;
			}
		}

		return null;
	}

	private static function query_bonus_slot_exercise_candidate( int $user_id, string $day_type, string $slot_type, array $excluded_ids, array $avoid_terms, array $allowed_equipment ): ?object {
		global $wpdb;
		$p = $wpdb->prefix;

		$exercise_access_where = ExerciseLibraryService::accessible_exercise_where( 'e', $user_id );
		$slot_json = '"' . esc_sql( $slot_type ) . '"';
		$excluded_ids = array_values( array_unique( array_filter( array_map( 'intval', $excluded_ids ) ) ) );

		$sql = "
			SELECT e.id, e.name, e.primary_muscle, e.equipment, e.difficulty, e.default_rep_min, e.default_rep_max, e.default_sets
			FROM {$p}fit_exercises e
			WHERE e.active = 1
			  AND {$exercise_access_where}
			  AND JSON_CONTAINS(e.slot_types_json, %s)";
		$params = [ $slot_json ];

		if ( '' !== $day_type ) {
			$sql .= ' AND JSON_CONTAINS(e.day_types_json, %s)';
			$params[] = '"' . esc_sql( $day_type ) . '"';
		}

		if ( ! self::equipment_unrestricted( $allowed_equipment ) ) {
			$allowed_equipment = array_values( array_unique( array_filter( array_map( static fn( string $item ): string => sanitize_key( $item ), $allowed_equipment ) ) ) );
			if ( empty( $allowed_equipment ) ) {
				return null;
			}
			$placeholders = implode( ',', array_fill( 0, count( $allowed_equipment ), '%s' ) );
			$sql .= " AND (e.equipment IN ({$placeholders}) OR e.equipment IN ('', 'none', 'other'))";
			$params = array_merge( $params, $allowed_equipment );
		}

		if ( ! empty( $excluded_ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $excluded_ids ), '%d' ) );
			$sql .= " AND e.id NOT IN ({$placeholders})";
			$params = array_merge( $params, $excluded_ids );
		}

		$sql .= "
			ORDER BY
			  CASE WHEN e.equipment = 'bodyweight' THEN 0 ELSE 1 END,
			  CASE WHEN e.user_id = %d THEN 0 ELSE 1 END,
			  e.id ASC
			LIMIT 25";
		$params[] = $user_id;

		$candidates = $wpdb->get_results( $wpdb->prepare( $sql, $params ) );
		foreach ( $candidates as $candidate ) {
			if ( ! self::exercise_matches_avoidance( $candidate, $avoid_terms ) && self::exercise_matches_equipment( $candidate, $allowed_equipment ) ) {
				return $candidate;
			}
		}

		return null;
	}

	private static function build_day_variation_strategy( int $user_id, string $day_type, array $plan_exercises, array $exercise_swaps, array $exercise_order ): array {
		$strategy = [
			'swaps' => [],
			'order' => [],
		];

		if ( 'pull' !== $day_type || empty( $plan_exercises ) ) {
			return $strategy;
		}

		$last_session = self::get_last_completed_day_session_detail( $user_id, $day_type );
		if ( empty( $last_session['session_id'] ) ) {
			return $strategy;
		}

		$strategy['swaps'] = self::build_pull_day_variation_swaps( $user_id, $day_type, $plan_exercises, $exercise_swaps, $last_session );

		if ( empty( $exercise_order ) ) {
			$strategy['order'] = self::build_pull_day_variation_order( $plan_exercises, $last_session, $exercise_swaps, $strategy['swaps'] );
		}

		return $strategy;
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

	private static function apply_rep_adjustments( array $exercises, array $rep_adjustments ): array {
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
			$adjusted_rep_min = max( 3, $base_rep_min + $rep_delta );
			$adjusted_rep_max = max( $adjusted_rep_min, $base_rep_max + $rep_delta );

			$exercise['rep_min'] = $adjusted_rep_min;
			$exercise['rep_max'] = $adjusted_rep_max;
			$exercise['rep_delta'] = $rep_delta;
		}
		unset( $exercise );

		return array_values( $exercises );
	}

	private static function get_last_completed_day_session_detail( int $user_id, string $day_type ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT id
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d
			   AND completed = 1
			   AND COALESCE(actual_day_type, planned_day_type) = %s
			 ORDER BY COALESCE(completed_at, updated_at, created_at) DESC, id DESC
			 LIMIT 1",
			$user_id,
			$day_type
		), ARRAY_A );

		if ( ! is_array( $session ) || empty( $session['id'] ) ) {
			return [];
		}

		$exercise_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT sort_order, exercise_id, original_exercise_id, slot_type
			 FROM {$p}fit_workout_session_exercises
			 WHERE session_id = %d
			 ORDER BY sort_order ASC, id ASC",
			(int) $session['id']
		), ARRAY_A );

		return [
			'session_id' => (int) $session['id'],
			'exercises'  => is_array( $exercise_rows ) ? $exercise_rows : [],
		];
	}

	private static function build_pull_day_variation_swaps( int $user_id, string $day_type, array $plan_exercises, array $exercise_swaps, array $last_session ): array {
		$previous_exercise_ids = array_values( array_filter( array_map(
			static fn( array $row ): int => (int) ( $row['exercise_id'] ?? 0 ),
			(array) ( $last_session['exercises'] ?? [] )
		) ) );

		if ( empty( $previous_exercise_ids ) ) {
			return [];
		}

		$resolved_current_ids = [];
		foreach ( $plan_exercises as $exercise ) {
			$plan_exercise_id = (int) ( $exercise->id ?? 0 );
			$resolved_current_ids[] = (int) ( $exercise_swaps[ $plan_exercise_id ] ?? $exercise->exercise_id ?? 0 );
		}

		$candidate_slots = [ 'accessory', 'secondary', 'shoulders' ];

		foreach ( $candidate_slots as $slot_type ) {
			foreach ( $plan_exercises as $exercise ) {
				$plan_exercise_id = (int) ( $exercise->id ?? 0 );
				if ( $slot_type !== (string) ( $exercise->slot_type ?? '' ) || isset( $exercise_swaps[ $plan_exercise_id ] ) ) {
					continue;
				}

				$excluded_ids = array_values( array_unique( array_filter( array_merge(
					$previous_exercise_ids,
					$resolved_current_ids
				) ) ) );

				$alternative_id = self::find_pull_day_variation_exercise_id( $user_id, $day_type, $exercise, $excluded_ids );
				if ( $alternative_id > 0 ) {
					return [ $plan_exercise_id => $alternative_id ];
				}
			}
		}

		return [];
	}

	private static function find_pull_day_variation_exercise_id( int $user_id, string $day_type, object $plan_exercise, array $excluded_ids ): int {
		global $wpdb;
		$p = $wpdb->prefix;

		$exercise_access_where = ExerciseLibraryService::accessible_exercise_where( 'e', $user_id );
		$day_json = '"' . esc_sql( $day_type ) . '"';
		$slot_json = '"' . esc_sql( (string) ( $plan_exercise->slot_type ?? '' ) ) . '"';
		$primary_muscle = sanitize_text_field( (string) ( $plan_exercise->primary_muscle ?? '' ) );
		$equipment = sanitize_text_field( (string) ( $plan_exercise->equipment ?? '' ) );

		$sql = "
			SELECT e.id
			FROM {$p}fit_exercises e
			WHERE e.active = 1
			  AND {$exercise_access_where}
			  AND e.id != %d
			  AND JSON_CONTAINS(e.day_types_json, %s)
			  AND JSON_CONTAINS(e.slot_types_json, %s)";
		$params = [
			(int) $plan_exercise->exercise_id,
			$day_json,
			$slot_json,
		];

		if ( ! empty( $excluded_ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $excluded_ids ), '%d' ) );
			$sql .= " AND e.id NOT IN ({$placeholders})";
			$params = array_merge( $params, array_map( 'intval', $excluded_ids ) );
		}

		$sql .= "
			ORDER BY
			  CASE WHEN e.primary_muscle = %s THEN 0 ELSE 1 END,
			  CASE WHEN e.equipment = %s THEN 0 ELSE 1 END,
			  CASE WHEN e.user_id = %d THEN 0 ELSE 1 END,
			  e.id ASC
			LIMIT 1";
		$params[] = $primary_muscle;
		$params[] = $equipment;
		$params[] = $user_id;

		$alternative_id = $wpdb->get_var( $wpdb->prepare( $sql, $params ) );

		return $alternative_id ? (int) $alternative_id : 0;
	}

	private static function build_pull_day_variation_order( array $plan_exercises, array $last_session, array $manual_swaps, array $auto_swaps ): array {
		if ( count( $plan_exercises ) < 3 ) {
			return [];
		}

		$main_exercises = array_values( array_filter( $plan_exercises, static fn( $exercise ): bool => 'main' === (string) ( $exercise->slot_type ?? '' ) ) );
		$other_exercises = array_values( array_filter( $plan_exercises, static fn( $exercise ): bool => 'main' !== (string) ( $exercise->slot_type ?? '' ) ) );

		if ( count( $other_exercises ) < 2 ) {
			return [];
		}

		$offset = (int) ( ( (int) ( $last_session['session_id'] ?? 0 ) ) % count( $other_exercises ) );
		if ( 0 === $offset ) {
			$offset = 1;
		}

		$attempt = 0;
		$max_attempts = count( $other_exercises );
		$previous_actual_order = array_values( array_filter( array_map(
			static fn( array $row ): int => (int) ( $row['exercise_id'] ?? 0 ),
			(array) ( $last_session['exercises'] ?? [] )
		) ) );

		while ( $attempt < $max_attempts ) {
			$rotated = array_merge(
				array_slice( $other_exercises, $offset ),
				array_slice( $other_exercises, 0, $offset )
			);
			$ordered = array_merge( $main_exercises, $rotated );
			$predicted_actual_order = array_map(
				static fn( $exercise ): int => (int) ( $manual_swaps[ (int) $exercise->id ] ?? $auto_swaps[ (int) $exercise->id ] ?? $exercise->exercise_id ?? 0 ),
				$ordered
			);

			if ( $predicted_actual_order !== $previous_actual_order ) {
				return array_map( static fn( $exercise ): int => (int) $exercise->id, $ordered );
			}

			$offset = ( $offset % count( $other_exercises ) ) + 1;
			$attempt++;
		}

		return [];
	}

	public static function get_user_exercise_avoidance_terms( int $user_id ): array {
		global $wpdb;

		if ( $user_id <= 0 ) {
			return [];
		}

		$raw_json = $wpdb->get_var( $wpdb->prepare(
			"SELECT exercise_avoid_json FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d LIMIT 1",
			$user_id
		) );
		$decoded = json_decode( (string) $raw_json, true );
		if ( ! is_array( $decoded ) ) {
			return [];
		}

		$terms = [];
		foreach ( $decoded as $value ) {
			$normalized = self::normalize_avoidance_term( (string) $value );
			if ( '' !== $normalized ) {
				$terms[] = $normalized;
			}
		}

		return array_values( array_unique( $terms ) );
	}

	public static function resolve_day_exercise_candidate( int $user_id, string $day_type, string $slot_type, int $exercise_id, array $excluded_ids = [] ): array {
		return self::resolve_exercise_candidate(
			$user_id,
			$day_type,
			$slot_type,
			$exercise_id,
			$excluded_ids,
			self::get_user_exercise_avoidance_terms( $user_id )
		);
	}

	private static function resolve_session_exercise_selection( int $user_id, string $day_type, object $plan_exercise, int $swap_exercise_id, array $excluded_ids = [], array $avoid_terms = [], array $allowed_equipment = [] ): array {
		$selected = self::resolve_exercise_candidate(
			$user_id,
			$day_type,
			(string) $plan_exercise->slot_type,
			(int) $plan_exercise->exercise_id,
			$excluded_ids,
			$avoid_terms,
			$allowed_equipment,
			[
				'exercise_name'  => (string) $plan_exercise->exercise_name,
				'primary_muscle' => (string) ( $plan_exercise->primary_muscle ?? '' ),
				'equipment'      => (string) ( $plan_exercise->equipment ?? '' ),
				'difficulty'     => (string) ( $plan_exercise->difficulty ?? '' ),
			]
		);

		if ( $swap_exercise_id <= 0 || $swap_exercise_id === (int) $plan_exercise->exercise_id ) {
			return $selected;
		}

		$override = self::resolve_exercise_candidate(
			$user_id,
			$day_type,
			(string) $plan_exercise->slot_type,
			$swap_exercise_id,
			$excluded_ids,
			$avoid_terms,
			$allowed_equipment
		);

		if ( ! empty( $override['blocked'] ) || (int) ( $override['exercise_id'] ?? 0 ) <= 0 ) {
			return $selected;
		}

		$override['was_swapped'] = true;
		return $override;
	}

	private static function resolve_exercise_candidate( int $user_id, string $day_type, string $slot_type, int $exercise_id, array $excluded_ids = [], array $avoid_terms = [], array $allowed_equipment = [], array $fallback = [] ): array {
		$exercise = ExerciseLibraryService::get_exercise( $user_id, $exercise_id, 'id, slug, name, primary_muscle, equipment, difficulty' );
		if ( ! $exercise ) {
			return [
				'exercise_id' => 0,
				'blocked'     => true,
				'was_swapped' => false,
			];
		}

		if ( ! self::exercise_matches_avoidance( $exercise, $avoid_terms ) && self::exercise_matches_equipment( $exercise, $allowed_equipment ) ) {
			return [
				'exercise_id'    => (int) $exercise->id,
				'exercise_name'  => (string) ( $exercise->name ?? ( $fallback['exercise_name'] ?? '' ) ),
				'primary_muscle' => (string) ( $exercise->primary_muscle ?? ( $fallback['primary_muscle'] ?? '' ) ),
				'equipment'      => (string) ( $exercise->equipment ?? ( $fallback['equipment'] ?? '' ) ),
				'difficulty'     => (string) ( $exercise->difficulty ?? ( $fallback['difficulty'] ?? '' ) ),
				'was_swapped'    => false,
				'blocked'        => false,
			];
		}

		$replacement = self::find_non_avoided_exercise_candidate( $user_id, $day_type, $slot_type, $exercise, $excluded_ids, $avoid_terms, $allowed_equipment );
		if ( $replacement ) {
			return [
				'exercise_id'    => (int) $replacement->id,
				'exercise_name'  => (string) $replacement->name,
				'primary_muscle' => (string) ( $replacement->primary_muscle ?? '' ),
				'equipment'      => (string) ( $replacement->equipment ?? '' ),
				'difficulty'     => (string) ( $replacement->difficulty ?? '' ),
				'was_swapped'    => true,
				'blocked'        => false,
			];
		}

		return [
			'exercise_id'    => 0,
			'exercise_name'  => '',
			'primary_muscle' => '',
			'equipment'      => '',
			'difficulty'     => '',
			'was_swapped'    => false,
			'blocked'        => true,
		];
	}

	private static function find_non_avoided_exercise_candidate( int $user_id, string $day_type, string $slot_type, object $exercise, array $excluded_ids, array $avoid_terms, array $allowed_equipment ): ?object {
		global $wpdb;
		$p = $wpdb->prefix;

		$exercise_access_where = ExerciseLibraryService::accessible_exercise_where( 'e', $user_id );
		$day_json = '"' . esc_sql( $day_type ) . '"';
		$slot_json = '"' . esc_sql( $slot_type ) . '"';
		$primary_muscle = sanitize_text_field( (string) ( $exercise->primary_muscle ?? '' ) );
		$equipment = sanitize_text_field( (string) ( $exercise->equipment ?? '' ) );

		$sql = "
			SELECT e.id, e.slug, e.name, e.primary_muscle, e.equipment, e.difficulty
			FROM {$p}fit_exercises e
			WHERE e.active = 1
			  AND {$exercise_access_where}
			  AND e.id != %d
			  AND JSON_CONTAINS(e.day_types_json, %s)
			  AND JSON_CONTAINS(e.slot_types_json, %s)";
		$params = [
			(int) $exercise->id,
			$day_json,
			$slot_json,
		];

		if ( ! self::equipment_unrestricted( $allowed_equipment ) ) {
			$allowed_equipment = array_values( array_unique( array_filter( array_map( static fn( string $item ): string => sanitize_key( $item ), $allowed_equipment ) ) ) );
			if ( empty( $allowed_equipment ) ) {
				return null;
			}
			$placeholders = implode( ',', array_fill( 0, count( $allowed_equipment ), '%s' ) );
			$sql .= " AND e.equipment IN ({$placeholders})";
			$params = array_merge( $params, $allowed_equipment );
		}

		$excluded_ids = array_values( array_unique( array_filter( array_map( 'intval', $excluded_ids ) ) ) );
		if ( ! empty( $excluded_ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $excluded_ids ), '%d' ) );
			$sql .= " AND e.id NOT IN ({$placeholders})";
			$params = array_merge( $params, $excluded_ids );
		}

		$sql .= "
			ORDER BY
			  CASE WHEN e.primary_muscle = %s THEN 0 ELSE 1 END,
			  CASE WHEN e.equipment = %s THEN 0 ELSE 1 END,
			  CASE WHEN e.user_id = %d THEN 0 ELSE 1 END,
			  e.id ASC
			LIMIT 25";
		$params[] = $primary_muscle;
		$params[] = $equipment;
		$params[] = $user_id;

		$candidates = $wpdb->get_results( $wpdb->prepare( $sql, $params ) );
		foreach ( $candidates as $candidate ) {
			if ( ! self::exercise_matches_avoidance( $candidate, $avoid_terms ) ) {
				return $candidate;
			}
		}

		return null;
	}

	private static function exercise_matches_avoidance( object $exercise, array $avoid_terms ): bool {
		if ( empty( $avoid_terms ) ) {
			return false;
		}

		$name = self::normalize_avoidance_term( (string) ( $exercise->name ?? '' ) );
		$slug = self::normalize_avoidance_term( (string) ( $exercise->slug ?? '' ) );

		foreach ( $avoid_terms as $term ) {
			if ( '' === $term ) {
				continue;
			}

			if ( '' !== $name && ( str_contains( $name, $term ) || str_contains( $term, $name ) ) ) {
				return true;
			}

			if ( '' !== $slug && ( str_contains( $slug, $term ) || str_contains( $term, $slug ) ) ) {
				return true;
			}
		}

		return false;
	}

	private static function exercise_matches_equipment( object $exercise, array $allowed_equipment ): bool {
		if ( self::equipment_unrestricted( $allowed_equipment ) ) {
			return true;
		}

		$equipment = sanitize_key( (string) ( $exercise->equipment ?? '' ) );
		if ( in_array( $equipment, [ '', 'none', 'other' ], true ) ) {
			return true;
		}
		if ( 'dumbbells' === $equipment ) {
			$equipment = 'dumbbell';
		}

		return in_array( $equipment, $allowed_equipment, true );
	}

	private static function equipment_unrestricted( array $allowed_equipment ): bool {
		return in_array( self::UNRESTRICTED_EQUIPMENT, $allowed_equipment, true );
	}

	private static function backfill_user_day_from_template( int $user_id, int $program_template_id, int $user_day_id, string $day_type, array $avoid_terms, array $allowed_equipment ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		if ( $user_id <= 0 || $user_day_id <= 0 || '' === $day_type ) {
			return;
		}

		$active_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_user_training_day_exercises WHERE training_day_id = %d AND active = 1",
			$user_day_id
		) );
		if ( $active_count > 0 ) {
			return;
		}

		$template_day_id = 0;
		if ( $program_template_id > 0 ) {
			$template_day_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT id
				 FROM {$p}fit_program_template_days
				 WHERE program_template_id = %d AND day_type = %s
				 ORDER BY default_order ASC, id ASC
				 LIMIT 1",
				$program_template_id,
				$day_type
			) );
		}

		if ( $template_day_id <= 0 ) {
			$template_day_id = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT id
				 FROM {$p}fit_program_template_days
				 WHERE day_type = %s
				 ORDER BY default_order ASC, id ASC
				 LIMIT 1",
				$day_type
			) );
		}

		if ( $template_day_id <= 0 ) {
			return;
		}

		$template_exercises = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_template_exercises WHERE template_day_id = %d ORDER BY priority ASC, id ASC",
			$template_day_id
		) );
		if ( empty( $template_exercises ) ) {
			return;
		}

		$selected_exercise_ids = [];
		$fallback_sort_order = 1;
		foreach ( $template_exercises as $template_exercise ) {
			$resolved = self::resolve_exercise_candidate(
				$user_id,
				$day_type,
				(string) $template_exercise->slot_type,
				(int) $template_exercise->exercise_id,
				$selected_exercise_ids,
				$avoid_terms,
				$allowed_equipment
			);
			$resolved_exercise_id = (int) ( $resolved['exercise_id'] ?? 0 );
			if ( ! empty( $resolved['blocked'] ) || $resolved_exercise_id <= 0 ) {
				continue;
			}

			$wpdb->insert( $p . 'fit_user_training_day_exercises', [
				'training_day_id' => $user_day_id,
				'exercise_id'     => $resolved_exercise_id,
				'slot_type'       => sanitize_key( (string) ( $template_exercise->slot_type ?? 'accessory' ) ),
				'rep_min'         => (int) ( $template_exercise->rep_min ?? 8 ),
				'rep_max'         => (int) ( $template_exercise->rep_max ?? 12 ),
				'sets_target'     => (int) ( $template_exercise->sets_target ?? 3 ),
				'rir_target'      => isset( $template_exercise->rir_target ) ? (float) $template_exercise->rir_target : null,
				'sort_order'      => (int) ( $template_exercise->priority ?? $fallback_sort_order ),
				'active'          => 1,
			] );
			$selected_exercise_ids[] = $resolved_exercise_id;
			$fallback_sort_order++;
		}
	}

	public static function get_allowed_equipment_for_user( int $user_id ): array {
		if ( $user_id <= 0 ) {
			return [ self::UNRESTRICTED_EQUIPMENT ];
		}

		if ( isset( self::$equipment_profile_cache[ $user_id ] ) ) {
			return self::$equipment_profile_cache[ $user_id ];
		}

		global $wpdb;
		$raw_json = $wpdb->get_var( $wpdb->prepare(
			"SELECT equipment_available_json FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d LIMIT 1",
			$user_id
		) );
		$decoded = json_decode( (string) $raw_json, true );
		$options = is_array( $decoded ) ? $decoded : [];

		$normalized = array_values( array_unique( array_filter( array_map(
			static fn( $value ): string => strtolower( trim( sanitize_text_field( (string) $value ) ) ),
			$options
		) ) ) );

		if ( in_array( 'full gym', $normalized, true ) || in_array( 'full_gym', $normalized, true ) || empty( $normalized ) ) {
			self::$equipment_profile_cache[ $user_id ] = [ self::UNRESTRICTED_EQUIPMENT ];
			return self::$equipment_profile_cache[ $user_id ];
		}

		if ( in_array( 'bodyweight only', $normalized, true ) || in_array( 'bodyweight_only', $normalized, true ) ) {
			self::$equipment_profile_cache[ $user_id ] = [ 'bodyweight' ];
			return self::$equipment_profile_cache[ $user_id ];
		}

			$allowed = [ 'bodyweight' ];
			foreach ( $normalized as $option ) {
				switch ( $option ) {
					case 'dumbbells':
					case 'dumbbell':
						$allowed[] = 'dumbbell';
						break;
					case 'machines':
					case 'machine':
						$allowed[] = 'machine';
						$allowed[] = 'cable';
						break;
					case 'home gym':
					case 'home_gym':
						$allowed[] = 'dumbbell';
						$allowed[] = 'barbell';
						break;
				}
			}

		$allowed = array_values( array_unique( array_filter( array_map( static fn( string $item ): string => sanitize_key( $item ), $allowed ) ) ) );
		self::$equipment_profile_cache[ $user_id ] = ! empty( $allowed ) ? $allowed : [ self::UNRESTRICTED_EQUIPMENT ];
		return self::$equipment_profile_cache[ $user_id ];
	}

	private static function normalize_avoidance_term( string $value ): string {
		$value = strtolower( wp_strip_all_tags( $value ) );
		$value = preg_replace( '/[^a-z0-9]+/', ' ', $value );
		$value = preg_replace( '/\s+/', ' ', (string) $value );
		return trim( (string) $value );
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

		return TrainingDayTypes::normalize( $value );
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
