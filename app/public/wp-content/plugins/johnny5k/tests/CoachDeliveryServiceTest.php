<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiMemoryService;
use Johnny5k\Services\CoachDeliveryService;
use Johnny5k\Services\UserTime;
use Johnny5k\Tests\Support\ServiceTestCase;

class CoachDeliveryServiceTest extends ServiceTestCase {
	public function test_weekly_schedule_status_ignores_days_before_user_started_this_week(): void {
		$db = $this->wpdb();
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$today = UserTime::now( 7 )->setTimezone( new \DateTimeZone( 'UTC' ) );
		$registered = $today->modify( '-1 day' )->format( 'Y-m-d 09:00:00' );
		$expected = 2;

		if ( (int) $today->format( 'N' ) < 2 ) {
			$registered = $today->format( 'Y-m-d 09:00:00' );
			$expected = 1;
		}

		$schedule = [];
		for ( $day_order = 1; $day_order <= (int) $today->format( 'N' ); $day_order++ ) {
			$label = [ 1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun' ][ $day_order ];
			$schedule[] = [
				'day' => $label,
				'day_type' => 'lift',
			];
		}

		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetRow( 'SELECT preferred_workout_days_json, created_at FROM wp_fit_user_preferences', (object) [
			'preferred_workout_days_json' => wp_json_encode( $schedule ),
			'created_at' => $registered,
		] );
		$db->expectGetVar( 'SELECT user_registered FROM wp_users WHERE ID = 7', $registered );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_workout_sessions WHERE user_id = 7 AND completed = 1', 0 );

		$result = $this->invokePrivateStatic( CoachDeliveryService::class, 'get_weekly_schedule_status', [ 7 ] );

		$this->assertSame( $expected, $result['expected_sessions_to_date'] );
		$this->assertSame( 0, $result['sessions_this_week'] );
		$this->assertSame( $expected, $result['missed_expected_sessions'] );
	}

	public function test_pending_follow_ups_exclude_stale_meal_nudges_from_previous_day(): void {
		$GLOBALS['johnny5k_test_now'] = '2026-04-11 10:00:00';

		$db = $this->wpdb();
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles', 'UTC' );

		\update_user_meta( 7, 'jf_johnny_follow_ups', [
			[
				'id' => 'meal-dinner-yesterday',
				'prompt' => 'Dinner is not logged yet.',
				'reason' => 'Dinner still missing',
				'trigger_type' => 'meal_dinner_nudge',
				'due_at' => '2026-04-10 19:00:00',
				'status' => 'pending',
				'created_at' => '2026-04-10 19:00:00',
			],
		] );

		$pending = AiMemoryService::get_pending_follow_ups( 7 );

		$this->assertSame( [], $pending );
	}
}
