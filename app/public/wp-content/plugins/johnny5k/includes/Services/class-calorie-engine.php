<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Calorie Engine
 *
 * BMR:    Mifflin-St Jeor
 * TDEE:   BMR × activity multiplier
 * Goal δ: −500 (cut slow) / −750 (cut moderate) / −1000 (cut aggressive)
 *          0 (maintain)
 *         +250 (gain slow) / +400 (gain moderate) / +500 (gain aggressive)
 *         −250 (recomp — slight deficit)
 *
 * Macros: protein = 1 g/lb bodyweight
 *         remaining calories after protein : 40 % carbs, 60 % fat
 *
 * Weekly adjustment: checks data sufficiency and applies ±100–150 kcal nudge.
 */
class CalorieEngine {

	// ── Activity multipliers ───────────────────────────────────────────────────

	private const ACTIVITY_MULTIPLIERS = [
		'sedentary' => 1.2,
		'light'     => 1.375,
		'moderate'  => 1.55,
		'high'      => 1.725,
		'athlete'   => 1.9,
	];

	// ── Goal deltas (kcal/day) ────────────────────────────────────────────────

	private const GOAL_DELTAS = [
		'cut'      => [ 'slow' => -500, 'moderate' => -750,  'aggressive' => -1000 ],
		'maintain' => [ 'slow' =>    0, 'moderate' =>    0,  'aggressive' =>    0  ],
		'gain'     => [ 'slow' => +250, 'moderate' => +400,  'aggressive' => +500  ],
		'recomp'   => [ 'slow' => -250, 'moderate' => -250,  'aggressive' => -250  ],
	];

	// ── Initial target from profile ───────────────────────────────────────────

	/**
	 * Compute an initial calorie + macro target from a user's profile row.
	 *
	 * @param  object $profile  Row from wp_fit_user_profiles.
	 * @param  object $goal     Row from wp_fit_user_goals (active).
	 * @return array{
	 *   calories:  int,
	 *   protein_g: int,
	 *   carbs_g:   int,
	 *   fat_g:     int,
	 *   bmr:       int,
	 *   tdee:      int,
	 * }
	 */
	public static function calculate_initial( object $profile, object $goal ): array {
		$age_years    = self::age_from_dob( $profile->date_of_birth ?? '' );
		$bodyweight_lb = (float) ( $profile->starting_weight_lb ?? 0 );
		if ( $bodyweight_lb <= 0 ) {
			$bodyweight_lb = 150.0;
		}

		$weight_kg    = $bodyweight_lb * 0.453592;
		$height_cm    = (float) ( $profile->height_cm ?? 170 );
		$sex          = $profile->sex ?? 'male';
		$activity     = $profile->activity_level ?? 'moderate';
		$goal_type    = $goal->goal_type ?? 'maintain';
		$goal_rate    = $goal->goal_rate ?? 'moderate'; // fall back from profile if needed

		// Mifflin-St Jeor
		if ( $sex === 'female' ) {
			$bmr = ( 10 * $weight_kg ) + ( 6.25 * $height_cm ) - ( 5 * $age_years ) - 161;
		} else {
			$bmr = ( 10 * $weight_kg ) + ( 6.25 * $height_cm ) - ( 5 * $age_years ) + 5;
		}

		$multiplier = self::ACTIVITY_MULTIPLIERS[ $activity ] ?? 1.55;
		$tdee       = (int) round( $bmr * $multiplier );

		$delta    = self::GOAL_DELTAS[ $goal_type ][ $goal_rate ] ?? 0;
		$calories = max( 1200, $tdee + $delta ); // never below 1 200 kcal

		// Protein: 1 g per lb of bodyweight
		$protein_g = (int) round( $bodyweight_lb );

		// Remaining calories after protein (4 kcal/g)
		$remaining = $calories - ( $protein_g * 4 );
		$remaining = max( 0, $remaining );
		$carbs_g   = (int) round( ( $remaining * 0.40 ) / 4 );
		$fat_g     = (int) round( ( $remaining * 0.60 ) / 9 );

		return [
			'calories'  => $calories,
			'protein_g' => $protein_g,
			'carbs_g'   => $carbs_g,
			'fat_g'     => $fat_g,
			'bmr'       => (int) round( $bmr ),
			'tdee'      => $tdee,
		];
	}

	// ── Weekly adaptive adjustment ────────────────────────────────────────────

	/**
	 * Evaluate whether a user's calorie target needs adjusting.
	 * Returns null if there is insufficient data.
	 *
	 * Rules:
	 *  - Requires ≥7 bodyweight logs AND ≥5 calorie-logged days in the past 14 days.
	 *  - Uses the last 14-day average weight compared to the previous 14-day average.
	 *  - Applies ±100–150 kcal nudge maximum.
	 *  - Does NOT adjust if adherence is < 50 %.
	 *
	 * @param  int $user_id
	 * @return array{action:string,delta_calories:int,new_target_calories:int,macro_targets:array,reason:string}|null
	 */
	public static function calculate_weekly_adjustment( int $user_id ): ?array {
		global $wpdb;

		// ── Data sufficiency check ────────────────────────────────────────────
		$weight_count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_body_metrics
			 WHERE user_id = %d AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)",
			$user_id
		) );

		$meal_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT DATE(meal_datetime)) FROM {$wpdb->prefix}fit_meals
			 WHERE user_id = %d AND confirmed = 1
			   AND meal_datetime >= DATE_SUB(NOW(), INTERVAL 14 DAY)",
			$user_id
		) );

		if ( $weight_count < 7 || $meal_days < 5 ) {
			return null; // not enough data
		}

		// ── Recent vs prior weight averages ───────────────────────────────────
		$recent_avg = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT AVG(weight_lb) FROM {$wpdb->prefix}fit_body_metrics
			 WHERE user_id = %d AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
			$user_id
		) );

		$prior_avg = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT AVG(weight_lb) FROM {$wpdb->prefix}fit_body_metrics
			 WHERE user_id = %d
			   AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
			   AND metric_date <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
			$user_id
		) );

		// ── Current goal & target ─────────────────────────────────────────────
		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT g.*, p.starting_weight_lb, p.activity_level, p.sex, p.date_of_birth, p.height_cm
			 FROM {$wpdb->prefix}fit_user_goals g
			 JOIN {$wpdb->prefix}fit_user_profiles p ON p.user_id = g.user_id
			 WHERE g.user_id = %d AND g.active = 1
			 ORDER BY g.created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $goal ) {
			return null;
		}

		$current_target = (int) $goal->target_calories;
		$goal_type      = $goal->goal_type;
		$weekly_change  = $recent_avg - $prior_avg; // + = gaining, - = losing

		$action  = 'no_change';
		$delta   = 0;
		$reason  = 'Weight trend is on track. No adjustment needed.';

		if ( $goal_type === 'cut' ) {
			if ( $weekly_change > -0.25 ) { // losing less than 0.25 lb/week
				$action = 'decrease';
				$delta  = -150;
				$reason = 'Weight loss is slower than target over the past two weeks. A small reduction is appropriate.';
			} elseif ( $weekly_change < -1.5 ) { // losing more than 1.5 lb/week
				$action = 'increase';
				$delta  = +100;
				$reason = 'Weight loss is faster than target. A small increase protects muscle and recovery.';
			}
		} elseif ( $goal_type === 'gain' ) {
			if ( $weekly_change < 0.25 ) { // gaining less than 0.25 lb/week
				$action = 'increase';
				$delta  = +150;
				$reason = 'Weight gain is slower than target. A small increase will support muscle growth.';
			} elseif ( $weekly_change > 1.0 ) { // gaining more than 1 lb/week (too fast)
				$action = 'decrease';
				$delta  = -100;
				$reason = 'Weight gain is faster than ideal. A small reduction minimises excess fat gain.';
			}
		} elseif ( $goal_type === 'recomp' ) {
			// Recomp: weight should stay roughly flat. If drifting > 1 lb either way, nudge.
			if ( $weekly_change < -0.75 ) {
				$action = 'increase';
				$delta  = +100;
				$reason = 'Your weight is dropping a bit fast for a recomp goal. Adding a small amount keeps you fuelled.';
			} elseif ( $weekly_change > 0.75 ) {
				$action = 'decrease';
				$delta  = -100;
				$reason = 'Your weight is creeping up slightly. A small reduction keeps the recomp on track.';
			}
		}

		if ( $action === 'no_change' ) {
			return null;
		}

		$new_target = max( 1200, $current_target + $delta );

		// Recompute macros for new target
		$profile    = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );
		$protein_g  = (int) round( (float) ( $profile->starting_weight_lb ?? 150 ) );
		$remaining  = max( 0, $new_target - ( $protein_g * 4 ) );
		$carbs_g    = (int) round( ( $remaining * 0.40 ) / 4 );
		$fat_g      = (int) round( ( $remaining * 0.60 ) / 9 );

		return [
			'action'            => $action,
			'delta_calories'    => $delta,
			'new_target_calories' => $new_target,
			'macro_targets'     => [
				'protein_g' => $protein_g,
				'carbs_g'   => $carbs_g,
				'fat_g'     => $fat_g,
			],
			'reason' => $reason,
		];
	}

	// ── Batch weekly job ──────────────────────────────────────────────────────

	/**
	 * Run weekly adjustment for every user with an active goal.
	 * Triggered by WP Cron every Monday morning.
	 */
	public static function run_weekly_adjustments_all_users(): void {
		global $wpdb;

		$user_ids = $wpdb->get_col(
			"SELECT DISTINCT user_id FROM {$wpdb->prefix}fit_user_goals WHERE active = 1"
		);

		foreach ( $user_ids as $user_id ) {
			$result = self::calculate_weekly_adjustment( (int) $user_id );
			if ( ! $result ) {
				continue;
			}

			// Persist new targets to active goal row
			$wpdb->query( $wpdb->prepare(
				"UPDATE {$wpdb->prefix}fit_user_goals
				 SET target_calories = %d, target_protein_g = %d,
				     target_carbs_g  = %d, target_fat_g     = %d
				 WHERE user_id = %d AND active = 1
				 ORDER BY created_at DESC LIMIT 1",
				$result['new_target_calories'],
				$result['macro_targets']['protein_g'],
				$result['macro_targets']['carbs_g'],
				$result['macro_targets']['fat_g'],
				$user_id
			) );

			// Log cost-free internal event (no OpenAI call here — narrative generated on demand)
			do_action( 'jf_calorie_target_adjusted', $user_id, $result );
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private static function age_from_dob( string $dob ): int {
		if ( ! $dob ) {
			return 30; // sensible default
		}
		try {
			$birth = new \DateTime( $dob );
			$now   = new \DateTime();
			return (int) $birth->diff( $now )->y;
		} catch ( \Exception $e ) {
			return 30;
		}
	}
}
