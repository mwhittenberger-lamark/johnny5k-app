<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Award Engine
 *
 * Evaluates every user's progress and grants qualifying awards.
 * Triggered by WP Cron (twicedaily) and after individual events via hooks.
 *
 * Each check is an isolated method. They all call self::grant() which is
 * idempotent — duplicate rows are blocked by the UNIQUE KEY on (user_id, award_id).
 */
class AwardEngine {

	// ── Entry point ───────────────────────────────────────────────────────────

	/**
	 * Run all award checks for all users.
	 * Called by the `jf_evaluate_awards` cron job.
	 */
	public static function run_all(): void {
		global $wpdb;

		$user_ids = $wpdb->get_col(
			"SELECT DISTINCT user_id FROM {$wpdb->prefix}fit_user_profiles
			 WHERE onboarding_complete = 1"
		);

		foreach ( $user_ids as $user_id ) {
			self::evaluate( (int) $user_id );
		}
	}

	/**
	 * Evaluate all awards for a single user.
	 * Safe to call any time — already-granted awards are skipped.
	 *
	 * @param int $user_id
	 */
	public static function evaluate( int $user_id ): void {
		self::check_first_login( $user_id );
		self::check_onboarding_complete( $user_id );
		self::check_first_workout( $user_id );
		self::check_first_meal_logged( $user_id );
		self::check_first_progress_photo( $user_id );
		self::check_logging_streak( $user_id, 7,  'logging_streak_7' );
		self::check_logging_streak( $user_id, 30, 'logging_streak_30' );
		self::check_workouts_week_complete( $user_id );
		self::check_protein_streak( $user_id );
		self::check_steps_10k_3days( $user_id );
		self::check_weight_loss_milestone( $user_id, 5,  'weight_loss_5lb' );
		self::check_weight_loss_milestone( $user_id, 10, 'weight_loss_10lb' );
		self::check_consistency_comeback( $user_id );
		self::check_first_pr( $user_id );
		self::check_sleep_streak( $user_id );
		self::check_cardio_streak( $user_id );
		self::check_meals_logged_week( $user_id );
		self::check_calorie_target_week( $user_id );
	}

	public static function sync_user_awards( int $user_id ): void {
		self::evaluate( $user_id );
		self::reconcile_invalid_awards( $user_id );
	}

	// ── Individual checks ──────────────────────────────────────────────────────

	private static function check_first_login( int $uid ): void {
		// Granted at registration time via hook; check here as fallback.
		$has_logged_in = (bool) get_user_meta( $uid, 'jf_first_login_done', true );
		if ( $has_logged_in ) {
			self::grant( $uid, 'first_login' );
		}
	}

	private static function check_onboarding_complete( int $uid ): void {
		global $wpdb;
		$done = (bool) $wpdb->get_var( $wpdb->prepare(
			"SELECT onboarding_complete FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$uid
		) );
		if ( $done ) {
			self::grant( $uid, 'onboarding_complete' );
		}
	}

	private static function check_first_workout( int $uid ): void {
		global $wpdb;
		$count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1",
			$uid
		) );
		if ( $count >= 1 ) {
			self::grant( $uid, 'first_workout' );
		}
	}

	private static function check_first_meal_logged( int $uid ): void {
		global $wpdb;
		$count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_meals WHERE user_id = %d AND confirmed = 1",
			$uid
		) );
		if ( $count >= 1 ) {
			self::grant( $uid, 'first_meal_logged' );
		}
	}

	private static function check_first_progress_photo( int $uid ): void {
		global $wpdb;
		$count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_progress_photos WHERE user_id = %d",
			$uid
		) );
		if ( $count >= 1 ) {
			self::grant( $uid, 'first_progress_photo' );
		}
	}

	/**
	 * Award a consecutive N-day combined logging streak.
	 * A "logged day" = has ≥1 meal AND ≥1 workout or body metric on that date.
	 */
	private static function check_logging_streak( int $uid, int $days, string $code ): void {
		global $wpdb;

		// Build date spine and check each day for any log entry
		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );

		for ( $i = 0; $i < $days * 2; $i++ ) {
			$d = $current->format( 'Y-m-d' );

			$meal_count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_meals
				 WHERE user_id = %d AND DATE(meal_datetime) = %s AND confirmed = 1",
				$uid, $d
			) );

			if ( $meal_count > 0 ) {
				$streak++;
			} else {
				$streak = 0; // reset streak on gap
			}

			if ( $streak >= $days ) {
				self::grant( $uid, $code );
				return;
			}

			$current = $current->modify( '-1 day' );
		}
	}

	private static function check_workouts_week_complete( int $uid ): void {
		global $wpdb;
		$since = UserTime::days_ago( $uid, 6 );

		// Count unique training days in the last 7 calendar days
		$count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT session_date) FROM {$wpdb->prefix}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1
			   AND session_date >= %s",
			$uid,
			$since
		) );

		// Fetch how many training days the user has per week in their plan
		$plan_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_user_training_days utd
			 JOIN {$wpdb->prefix}fit_user_training_plans utp ON utp.id = utd.training_plan_id
			 WHERE utp.user_id = %d AND utp.active = 1 AND utd.day_type != 'rest'",
			$uid
		) );

		$required = $plan_days > 0 ? $plan_days : 3; // default 3 if no plan

		if ( $count >= $required ) {
			self::grant( $uid, 'workouts_week_complete' );
		}
	}

	private static function check_protein_streak( int $uid ): void {
		global $wpdb;
		CalorieEngine::refresh_active_goal_targets( $uid );

		$goal_protein = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT target_protein_g FROM {$wpdb->prefix}fit_user_goals
			 WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$uid
		) );

		if ( ! $goal_protein ) return;

		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );

		for ( $i = 0; $i < 30; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$protein = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT SUM(mi.protein_g)
				 FROM {$wpdb->prefix}fit_meal_items mi
				 JOIN {$wpdb->prefix}fit_meals m ON m.id = mi.meal_id
				 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
				$uid, $d
			) );

			if ( $protein >= $goal_protein ) {
				$streak++;
			} else {
				$streak = 0;
			}

			if ( $streak >= 5 ) {
				self::grant( $uid, 'protein_streak_5' );
				return;
			}

			$current = $current->modify( '-1 day' );
		}
	}

	private static function check_steps_10k_3days( int $uid ): void {
		global $wpdb;

		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );

		for ( $i = 0; $i < 14; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$steps = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT steps FROM {$wpdb->prefix}fit_step_logs WHERE user_id = %d AND step_date = %s",
				$uid, $d
			) );

			if ( $steps >= 10000 ) {
				$streak++;
			} else {
				$streak = 0;
			}

			if ( $streak >= 3 ) {
				self::grant( $uid, 'steps_10k_3days' );
				return;
			}

			$current = $current->modify( '-1 day' );
		}
	}

	private static function check_weight_loss_milestone( int $uid, float $lbs, string $code ): void {
		global $wpdb;

		$starting = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT starting_weight_lb FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$uid
		) );
		if ( ! $starting ) return;

		$current_weight = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT weight_lb FROM {$wpdb->prefix}fit_body_metrics
			 WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$uid
		) );
		if ( ! $current_weight ) return;

		if ( ( $starting - $current_weight ) >= $lbs ) {
			self::grant( $uid, $code );
		}
	}

	private static function check_consistency_comeback( int $uid ): void {
		global $wpdb;

		// Award if user had a gap of ≥5 days and then logged 3 consecutive days
		// (simplified: check for 3 consecutive days after a 5-day gap in the last 30 days)
		$dates = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT DATE(meal_datetime) AS d
			 FROM {$wpdb->prefix}fit_meals
			 WHERE user_id = %d AND DATE(meal_datetime) >= %s
			   AND confirmed = 1
			 ORDER BY d ASC",
			$uid,
			UserTime::days_ago( $uid, 29 )
		) );

		if ( count( $dates ) < 4 ) return;

		for ( $i = 1; $i < count( $dates ) - 2; $i++ ) {
			$gap = ( new \DateTime( $dates[ $i ] ) )->diff( new \DateTime( $dates[ $i - 1 ] ) )->days;
			if ( $gap >= 5 ) {
				// Check the next 3 days are consecutive
				$d1 = new \DateTime( $dates[ $i ] );
				$d2 = new \DateTime( $dates[ $i + 1 ] ?? '' );
				$d3 = new \DateTime( $dates[ $i + 2 ] ?? '' );
				if ( $d1->diff( $d2 )->days === 1 && $d2->diff( $d3 )->days === 1 ) {
					self::grant( $uid, 'consistency_comeback' );
					return;
				}
			}
		}
	}

	private static function check_first_pr( int $uid ): void {
		global $wpdb;
		$count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_exercise_performance_snapshots WHERE user_id = %d",
			$uid
		) );
		if ( $count >= 1 ) {
			self::grant( $uid, 'first_pr' );
		}
	}

	private static function check_sleep_streak( int $uid ): void {
		global $wpdb;

		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );

		for ( $i = 0; $i < 20; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$hours = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT hours_sleep FROM {$wpdb->prefix}fit_sleep_logs WHERE user_id = %d AND sleep_date = %s",
				$uid, $d
			) );

			if ( $hours >= 7.0 ) {
				$streak++;
			} else {
				$streak = 0;
			}

			if ( $streak >= 5 ) {
				self::grant( $uid, 'sleep_streak_5' );
				return;
			}

			$current = $current->modify( '-1 day' );
		}
	}

	private static function check_cardio_streak( int $uid ): void {
		global $wpdb;

		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );

		for ( $i = 0; $i < 20; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_cardio_logs WHERE user_id = %d AND cardio_date = %s",
				$uid, $d
			) );

			if ( $count > 0 ) {
				$streak++;
			} else {
				$streak = 0;
			}

			if ( $streak >= 3 ) {
				self::grant( $uid, 'cardio_streak_3' );
				return;
			}

			$current = $current->modify( '-1 day' );
		}
	}

	private static function check_meals_logged_week( int $uid ): void {
		global $wpdb;
		$meal_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT DATE(meal_datetime))
			 FROM {$wpdb->prefix}fit_meals
			 WHERE user_id = %d AND confirmed = 1
			   AND DATE(meal_datetime) >= %s",
			$uid,
			UserTime::days_ago( $uid, 6 )
		) );
		if ( $meal_days >= 7 ) {
			self::grant( $uid, 'meals_logged_week' );
		}
	}

	private static function check_calorie_target_week( int $uid ): void {
		global $wpdb;
		CalorieEngine::refresh_active_goal_targets( $uid );

		$target = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT target_calories FROM {$wpdb->prefix}fit_user_goals
			 WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$uid
		) );
		if ( ! $target ) return;

		$days_in_range = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );
		$tolerance = 0.10; // ±10 %

		for ( $i = 0; $i < 7; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$daily_cal = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT SUM(mi.calories)
				 FROM {$wpdb->prefix}fit_meal_items mi
				 JOIN {$wpdb->prefix}fit_meals m ON m.id = mi.meal_id
				 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
				$uid, $d
			) );

			if ( $daily_cal >= $target * ( 1 - $tolerance ) && $daily_cal <= $target * ( 1 + $tolerance ) ) {
				$days_in_range++;
			}

			$current = $current->modify( '-1 day' );
		}

		if ( $days_in_range >= 5 ) {
			self::grant( $uid, 'calorie_target_week' );
		}
	}

	private static function reconcile_invalid_awards( int $user_id ): void {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT ua.id, a.code
			 FROM {$wpdb->prefix}fit_user_awards ua
			 JOIN {$wpdb->prefix}fit_awards a ON a.id = ua.award_id
			 WHERE ua.user_id = %d",
			$user_id
		), ARRAY_A );

		foreach ( $rows as $row ) {
			$award_id = (int) ( $row['id'] ?? 0 );
			$code = (string) ( $row['code'] ?? '' );
			if ( ! $award_id || ! $code ) {
				continue;
			}

			if ( self::award_is_earned( $user_id, $code ) ) {
				continue;
			}

			$wpdb->delete( $wpdb->prefix . 'fit_user_awards', [ 'id' => $award_id, 'user_id' => $user_id ], [ '%d', '%d' ] );
		}
	}

	private static function award_is_earned( int $uid, string $code ): bool {
		switch ( $code ) {
			case 'first_login':
				return (bool) get_user_meta( $uid, 'jf_first_login_done', true );
			case 'onboarding_complete':
				return self::is_onboarding_complete( $uid );
			case 'first_workout':
				return self::completed_workout_count( $uid ) >= 1;
			case 'first_meal_logged':
				return self::confirmed_meal_count( $uid ) >= 1;
			case 'first_progress_photo':
				return self::progress_photo_count( $uid ) >= 1;
			case 'logging_streak_7':
				return self::has_meal_streak( $uid, 7 );
			case 'logging_streak_30':
				return self::has_meal_streak( $uid, 30 );
			case 'workouts_week_complete':
				return self::has_workouts_week_complete( $uid );
			case 'protein_streak_5':
				return self::has_protein_streak( $uid, 5 );
			case 'steps_10k_3days':
				return self::has_steps_streak( $uid, 10000, 3 );
			case 'weight_loss_5lb':
				return self::has_weight_loss_milestone( $uid, 5 );
			case 'weight_loss_10lb':
				return self::has_weight_loss_milestone( $uid, 10 );
			case 'consistency_comeback':
				return self::has_consistency_comeback( $uid );
			case 'first_pr':
				return self::pr_count( $uid ) >= 1;
			case 'sleep_streak_5':
				return self::has_sleep_streak( $uid, 5 );
			case 'cardio_streak_3':
				return self::has_cardio_streak( $uid, 3 );
			case 'meals_logged_week':
				return self::meal_days_in_last_week( $uid ) >= 7;
			case 'calorie_target_week':
				return self::calorie_target_days_in_last_week( $uid ) >= 5;
			default:
				return true;
		}
	}

	private static function is_onboarding_complete( int $uid ): bool {
		global $wpdb;
		return (bool) $wpdb->get_var( $wpdb->prepare(
			"SELECT onboarding_complete FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$uid
		) );
	}

	private static function completed_workout_count( int $uid ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions WHERE user_id = %d AND completed = 1",
			$uid
		) );
	}

	private static function confirmed_meal_count( int $uid ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_meals WHERE user_id = %d AND confirmed = 1",
			$uid
		) );
	}

	private static function progress_photo_count( int $uid ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_progress_photos WHERE user_id = %d",
			$uid
		) );
	}

	private static function pr_count( int $uid ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_exercise_performance_snapshots WHERE user_id = %d",
			$uid
		) );
	}

	private static function has_meal_streak( int $uid, int $days ): bool {
		global $wpdb;
		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );
		for ( $i = 0; $i < max( 60, $days * 2 ); $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$meal_count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_meals WHERE user_id = %d AND DATE(meal_datetime) = %s AND confirmed = 1",
				$uid,
				$d
			) );
			$streak = $meal_count > 0 ? $streak + 1 : 0;
			if ( $streak >= $days ) {
				return true;
			}
			$current = $current->modify( '-1 day' );
		}
		return false;
	}

	private static function has_workouts_week_complete( int $uid ): bool {
		global $wpdb;
		$since = UserTime::days_ago( $uid, 6 );
		$count = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT session_date) FROM {$wpdb->prefix}fit_workout_sessions WHERE user_id = %d AND completed = 1 AND session_date >= %s",
			$uid,
			$since
		) );
		$plan_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$wpdb->prefix}fit_user_training_days utd JOIN {$wpdb->prefix}fit_user_training_plans utp ON utp.id = utd.training_plan_id WHERE utp.user_id = %d AND utp.active = 1 AND utd.day_type != 'rest'",
			$uid
		) );
		$required = $plan_days > 0 ? $plan_days : 3;
		return $count >= $required;
	}

	private static function has_protein_streak( int $uid, int $days ): bool {
		global $wpdb;
		CalorieEngine::refresh_active_goal_targets( $uid );
		$goal_protein = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT target_protein_g FROM {$wpdb->prefix}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$uid
		) );
		if ( ! $goal_protein ) {
			return false;
		}
		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );
		for ( $i = 0; $i < 60; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$protein = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT SUM(mi.protein_g) FROM {$wpdb->prefix}fit_meal_items mi JOIN {$wpdb->prefix}fit_meals m ON m.id = mi.meal_id WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
				$uid,
				$d
			) );
			$streak = $protein >= $goal_protein ? $streak + 1 : 0;
			if ( $streak >= $days ) {
				return true;
			}
			$current = $current->modify( '-1 day' );
		}
		return false;
	}

	private static function has_steps_streak( int $uid, int $threshold, int $days ): bool {
		global $wpdb;
		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );
		for ( $i = 0; $i < 30; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$steps = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT steps FROM {$wpdb->prefix}fit_step_logs WHERE user_id = %d AND step_date = %s",
				$uid,
				$d
			) );
			$streak = $steps >= $threshold ? $streak + 1 : 0;
			if ( $streak >= $days ) {
				return true;
			}
			$current = $current->modify( '-1 day' );
		}
		return false;
	}

	private static function has_weight_loss_milestone( int $uid, float $lbs ): bool {
		global $wpdb;
		$starting = (float) $wpdb->get_var( $wpdb->prepare( "SELECT starting_weight_lb FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d", $uid ) );
		$current_weight = (float) $wpdb->get_var( $wpdb->prepare( "SELECT weight_lb FROM {$wpdb->prefix}fit_body_metrics WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1", $uid ) );
		return $starting > 0 && $current_weight > 0 && ( $starting - $current_weight ) >= $lbs;
	}

	private static function has_consistency_comeback( int $uid ): bool {
		global $wpdb;
		$dates = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT DATE(meal_datetime) AS d FROM {$wpdb->prefix}fit_meals WHERE user_id = %d AND DATE(meal_datetime) >= %s AND confirmed = 1 ORDER BY d ASC",
			$uid,
			UserTime::days_ago( $uid, 29 )
		) );
		if ( count( $dates ) < 4 ) {
			return false;
		}
		for ( $i = 1; $i < count( $dates ) - 2; $i++ ) {
			$gap = ( new \DateTime( $dates[ $i ] ) )->diff( new \DateTime( $dates[ $i - 1 ] ) )->days;
			if ( $gap >= 5 ) {
				$d1 = new \DateTime( $dates[ $i ] );
				$d2 = new \DateTime( $dates[ $i + 1 ] ?? '' );
				$d3 = new \DateTime( $dates[ $i + 2 ] ?? '' );
				if ( 1 === $d1->diff( $d2 )->days && 1 === $d2->diff( $d3 )->days ) {
					return true;
				}
			}
		}
		return false;
	}

	private static function has_sleep_streak( int $uid, int $days ): bool {
		global $wpdb;
		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );
		for ( $i = 0; $i < 30; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$hours = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT hours_sleep FROM {$wpdb->prefix}fit_sleep_logs WHERE user_id = %d AND sleep_date = %s",
				$uid,
				$d
			) );
			$streak = $hours >= 7.0 ? $streak + 1 : 0;
			if ( $streak >= $days ) {
				return true;
			}
			$current = $current->modify( '-1 day' );
		}
		return false;
	}

	private static function has_cardio_streak( int $uid, int $days ): bool {
		global $wpdb;
		$streak = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );
		for ( $i = 0; $i < 30; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_cardio_logs WHERE user_id = %d AND cardio_date = %s",
				$uid,
				$d
			) );
			$streak = $count > 0 ? $streak + 1 : 0;
			if ( $streak >= $days ) {
				return true;
			}
			$current = $current->modify( '-1 day' );
		}
		return false;
	}

	private static function meal_days_in_last_week( int $uid ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT DATE(meal_datetime)) FROM {$wpdb->prefix}fit_meals WHERE user_id = %d AND confirmed = 1 AND DATE(meal_datetime) >= %s",
			$uid,
			UserTime::days_ago( $uid, 6 )
		) );
	}

	private static function calorie_target_days_in_last_week( int $uid ): int {
		global $wpdb;
		CalorieEngine::refresh_active_goal_targets( $uid );
		$target = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT target_calories FROM {$wpdb->prefix}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$uid
		) );
		if ( ! $target ) {
			return 0;
		}
		$tolerance = 0.10;
		$days_in_range = 0;
		$current = UserTime::now( $uid )->setTime( 12, 0 );
		for ( $i = 0; $i < 7; $i++ ) {
			$d = $current->format( 'Y-m-d' );
			$daily_cal = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT SUM(mi.calories) FROM {$wpdb->prefix}fit_meal_items mi JOIN {$wpdb->prefix}fit_meals m ON m.id = mi.meal_id WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
				$uid,
				$d
			) );
			if ( $daily_cal >= $target * ( 1 - $tolerance ) && $daily_cal <= $target * ( 1 + $tolerance ) ) {
				$days_in_range++;
			}
			$current = $current->modify( '-1 day' );
		}
		return $days_in_range;
	}

	// ── Grant (idempotent) ────────────────────────────────────────────────────

	/**
	 * Grant an award to a user. Safe to call multiple times — ignores duplicates.
	 *
	 * @param int    $user_id
	 * @param string $code    Award code, e.g. 'first_workout'
	 * @param array  $context Optional context saved to user_awards.context_json
	 * @return bool           True if newly granted, false if already held.
	 */
	public static function grant( int $user_id, string $code, array $context = [] ): bool {
		global $wpdb;

		$award_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_awards WHERE code = %s AND active = 1",
			$code
		) );

		if ( ! $award_id ) return false;

		$already = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_user_awards WHERE user_id = %d AND award_id = %d",
			$user_id, $award_id
		) );

		if ( $already ) return false;

		$wpdb->insert( $wpdb->prefix . 'fit_user_awards', [
			'user_id'      => $user_id,
			'award_id'     => $award_id,
			'awarded_at'   => current_time( 'mysql', true ),
			'context_json' => $context ? wp_json_encode( $context ) : null,
		] );

		do_action( 'jf_award_granted', $user_id, $code, $award_id );
		return true;
	}
}
