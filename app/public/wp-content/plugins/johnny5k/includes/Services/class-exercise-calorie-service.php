<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class ExerciseCalorieService {
	public static function estimate_workout_session_calories( int $user_id, int $duration_minutes, string $day_type = 'push', string $time_tier = 'medium' ): int {
		$duration_minutes = max( 0, min( 600, $duration_minutes ) );
		if ( $duration_minutes <= 0 ) {
			return 0;
		}

		$weight_lb = self::get_latest_weight_lb( $user_id );
		if ( $weight_lb <= 0 ) {
			$weight_lb = 180.0;
		}

		$weight_kg = $weight_lb * 0.45359237;
		$met = self::get_workout_met( $day_type, $time_tier );
		$calories = $met * $weight_kg * ( $duration_minutes / 60 );

		return max( 0, (int) round( $calories ) );
	}

	public static function should_add_exercise_calories_to_target( int $user_id ): bool {
		global $wpdb;
		$prefs = $wpdb->get_row( $wpdb->prepare(
			"SELECT exercise_preferences_json FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d LIMIT 1",
			$user_id
		) );

		if ( ! $prefs ) {
			return false;
		}

		$decoded = json_decode( (string) ( $prefs->exercise_preferences_json ?? '' ), true );
		return ! empty( $decoded['add_exercise_calories_to_target'] );
	}

	public static function get_daily_exercise_calories( int $user_id, string $date ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$workout_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT actual_day_type, planned_day_type, time_tier, duration_minutes, estimated_calories
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d
			   AND session_date = %s
			   AND completed = 1
			   AND skip_requested = 0",
			$user_id,
			$date
		) );

		$workout_calories = array_reduce( is_array( $workout_rows ) ? $workout_rows : [], function( int $sum, object $row ) use ( $user_id ): int {
			$stored_calories = isset( $row->estimated_calories ) ? (int) $row->estimated_calories : 0;
			if ( $stored_calories > 0 ) {
				return $sum + $stored_calories;
			}

			$duration_minutes = isset( $row->duration_minutes ) ? (int) $row->duration_minutes : 0;
			if ( $duration_minutes <= 0 ) {
				return $sum;
			}

			$day_type = (string) ( $row->actual_day_type ?? $row->planned_day_type ?? 'push' );
			$time_tier = (string) ( $row->time_tier ?? 'medium' );
			return $sum + self::estimate_workout_session_calories( $user_id, $duration_minutes, $day_type, $time_tier );
		}, 0 );

		$cardio_calories = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COALESCE(SUM(estimated_calories), 0)
			 FROM {$p}fit_cardio_logs
			 WHERE user_id = %d
			   AND cardio_date = %s",
			$user_id,
			$date
		) );

		return [
			'workout_calories' => max( 0, $workout_calories ),
			'cardio_calories' => max( 0, $cardio_calories ),
			'total_calories' => max( 0, $workout_calories + $cardio_calories ),
		];
	}

	public static function apply_exercise_calorie_target_adjustment( int $user_id, string $date, $goal ) {
		if ( ! $goal ) {
			return $goal;
		}

		$base_target = (int) ( $goal->target_calories ?? 0 );
		$exercise = self::get_daily_exercise_calories( $user_id, $date );
		$should_add = self::should_add_exercise_calories_to_target( $user_id );
		$bonus = $should_add ? (int) $exercise['total_calories'] : 0;

		$goal->base_target_calories = $base_target;
		$goal->exercise_calories_burned = (int) $exercise['total_calories'];
		$goal->workout_calories_burned = (int) $exercise['workout_calories'];
		$goal->cardio_calories_burned = (int) $exercise['cardio_calories'];
		$goal->exercise_calorie_bonus = $bonus;
		$goal->add_exercise_calories_to_target = $should_add;
		$goal->target_calories = max( 0, $base_target + $bonus );

		return $goal;
	}

	private static function get_latest_weight_lb( int $user_id ): float {
		global $wpdb;
		$p = $wpdb->prefix;

		$weight = $wpdb->get_var( $wpdb->prepare(
			"SELECT weight_lb FROM {$p}fit_body_metrics
			 WHERE user_id = %d
			 ORDER BY metric_date DESC, id DESC
			 LIMIT 1",
			$user_id
		) );

		if ( null !== $weight && '' !== $weight ) {
			return (float) $weight;
		}

		$profile_weight = $wpdb->get_var( $wpdb->prepare(
			"SELECT starting_weight_lb FROM {$p}fit_user_profiles WHERE user_id = %d LIMIT 1",
			$user_id
		) );

		return null !== $profile_weight && '' !== $profile_weight ? (float) $profile_weight : 0.0;
	}

	private static function get_workout_met( string $day_type, string $time_tier ): float {
		$normalized_day_type = sanitize_key( $day_type );
		$normalized_tier = sanitize_key( $time_tier );

		if ( 'rest' === $normalized_day_type ) {
			return 0.0;
		}

		if ( 'cardio' === $normalized_day_type ) {
			$cardio_map = [
				'short' => 6.5,
				'medium' => 7.3,
				'full' => 8.0,
			];

			return $cardio_map[ $normalized_tier ] ?? $cardio_map['medium'];
		}

		$strength_map = [
			'short' => 4.8,
			'medium' => 5.4,
			'full' => 6.0,
		];

		return $strength_map[ $normalized_tier ] ?? $strength_map['medium'];
	}
}
