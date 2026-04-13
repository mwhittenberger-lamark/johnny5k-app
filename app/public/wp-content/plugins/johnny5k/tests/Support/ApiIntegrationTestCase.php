<?php

declare(strict_types=1);

namespace Johnny5k\Tests\Support;

use Johnny5k\REST\AbstractNutritionController;
use Johnny5k\REST\WorkoutController;

class TestWorkoutController extends WorkoutController {
	public static array $build_calls = [];
	public static array $complete_calls = [];
	public static array $skip_calls = [];

	protected static function build_training_session( int $user_id, string $time_tier, bool $maintenance_mode, ?string $day_type_override, array $exercise_swaps, array $exercise_order, array $rep_adjustments = [], array $exercise_removals = [], array $exercise_additions = [] ) {
		self::$build_calls[] = [
			'user_id' => $user_id,
			'time_tier' => $time_tier,
			'maintenance_mode' => $maintenance_mode,
			'day_type_override' => $day_type_override,
		];

		return [
			'session_id' => 55,
			'day_type' => $day_type_override ?: 'push',
			'exercises' => [],
			'skip_count' => 0,
			'skip_warning' => false,
		];
	}

	protected static function estimate_workout_session_calories( int $user_id, int $duration_minutes, string $day_type, string $time_tier ): int {
		self::$complete_calls['estimate'][] = compact( 'user_id', 'duration_minutes', 'day_type', 'time_tier' );
		return 321;
	}

	protected static function record_training_snapshots( int $session_id ): array {
		self::$complete_calls['snapshots'][] = $session_id;

		return [
			[
				'exercise_id' => 201,
				'is_pr' => true,
				'new_1rm' => 233.33,
			],
		];
	}

	protected static function evaluate_user_awards( int $user_id ): void {
		self::$complete_calls['evaluate'][] = $user_id;
	}

	protected static function post_workout_summary( int $user_id, int $session_id ) {
		self::$complete_calls['summary'][] = compact( 'user_id', 'session_id' );
		return [ 'summary' => 'Strong session.' ];
	}

	protected static function grant_award( int $user_id, string $code ): bool {
		self::$complete_calls['grant'][] = compact( 'user_id', 'code' );
		return true;
	}

	protected static function mark_session_skipped( int $session_id, int $user_id ): int {
		self::$skip_calls[] = compact( 'session_id', 'user_id' );
		return 3;
	}
}

class TestAiMealController extends AbstractNutritionController {
	public static array $synced_awards = [];

	protected static function sync_user_awards( int $user_id ): void {
		self::$synced_awards[] = $user_id;
	}
}

abstract class ApiIntegrationTestCase extends ServiceTestCase {
	protected function setUp(): void {
		parent::setUp();

		TestWorkoutController::$build_calls = [];
		TestWorkoutController::$complete_calls = [];
		TestWorkoutController::$skip_calls = [];
		TestAiMealController::$synced_awards = [];

		$GLOBALS['johnny5k_test_workout_action_hooks'] = [
			'mark_session_skipped' => static function( int $session_id, int $user_id ): int {
				TestWorkoutController::$skip_calls[] = compact( 'session_id', 'user_id' );
				return 3;
			},
			'estimate_workout_session_calories' => static function( int $user_id, int $duration_minutes, string $day_type, string $time_tier ): int {
				TestWorkoutController::$complete_calls['estimate'][] = compact( 'user_id', 'duration_minutes', 'day_type', 'time_tier' );
				return 321;
			},
			'record_training_snapshots' => static function( int $session_id ): array {
				TestWorkoutController::$complete_calls['snapshots'][] = $session_id;
				return [
					[
						'exercise_id' => 201,
						'is_pr' => true,
						'new_1rm' => 233.33,
					],
				];
			},
			'evaluate_user_awards' => static function( int $user_id ): void {
				TestWorkoutController::$complete_calls['evaluate'][] = $user_id;
			},
			'post_workout_summary' => static function( int $user_id, int $session_id ): array {
				TestWorkoutController::$complete_calls['summary'][] = compact( 'user_id', 'session_id' );
				return [ 'summary' => 'Strong session.' ];
			},
			'grant_award' => static function( int $user_id, string $code ): bool {
				TestWorkoutController::$complete_calls['grant'][] = compact( 'user_id', 'code' );
				return true;
			},
		];
	}
}
