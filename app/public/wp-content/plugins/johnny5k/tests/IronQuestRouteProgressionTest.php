<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\IronQuestController;
use Johnny5k\Tests\Support\FakeWpdb;
use Johnny5k\Tests\Support\ServiceTestCase;

if ( ! defined( 'JF_PLUGIN_DIR' ) ) {
	define( 'JF_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
}

class IronQuestRouteProgressionTest extends ServiceTestCase {
	public function test_build_route_state_reports_total_travel_and_next_unlock(): void {
		$user_id = 42;
		$profile = [
			'user_id'               => $user_id,
			'enabled'               => true,
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 25,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueUnlockLookups(
			$user_id,
			[
				$this->rawUnlockRow( 11, $user_id, 'location_arc', 'the_training_grounds' ),
			],
			6
		);
		$this->queueActivityAwardLookups(
			$user_id,
			[
				$this->rawLedgerRow( 21, $user_id, 'route_progress', 'steps_2026-04-08', 'travel_points', [ 'points' => 2 ] ),
			],
			6
		);

		$route_state = $this->invokePrivateStatic( IronQuestController::class, 'build_route_state', [ $user_id, $profile ] );

		$this->assertSame( 2, $route_state['total_travel_points'] );
		$this->assertSame( [ 'movement' => 2, 'fast_travel' => 0, 'total' => 2 ], $route_state['travel_points_breakdown'] );
		$this->assertContains( 'the_training_grounds', $route_state['unlocked_locations'] );
		$this->assertContains( 'the_training_grounds', $route_state['cleared_locations'] );
		$this->assertSame( 'grim_hollow_village', $route_state['next_unlocks'][0]['location_slug'] );
		$this->assertSame( 1, $route_state['next_unlocks'][0]['travel_remaining'] );
		$this->assertTrue( $route_state['next_unlocks'][0]['requirements_met'] );
	}

	public function test_build_route_state_reports_fast_travel_breakdown_and_caps(): void {
		$user_id = 42;
		$profile = [
			'user_id'               => $user_id,
			'enabled'               => true,
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 50,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueUnlockLookups(
			$user_id,
			[
				$this->rawUnlockRow( 11, $user_id, 'location_arc', 'the_training_grounds' ),
			],
			8
		);
		$this->queueActivityAwardLookups(
			$user_id,
			[
				$this->rawLedgerRow( 21, $user_id, 'route_progress', 'steps_2026-04-08', 'travel_points', [ 'points' => 2 ] ),
				$this->rawLedgerRow( 22, $user_id, 'route_progress', 'fast_travel_grim_hollow_village', 'travel_points', [ 'points' => 1, 'fast_travel' => true, 'location_slug' => 'grim_hollow_village' ] ),
			],
			8
		);

		$route_state = $this->invokePrivateStatic( IronQuestController::class, 'build_route_state', [ $user_id, $profile ] );
		$grim_hollow_unlock = array_values(
			array_filter(
				$route_state['next_unlocks'],
				static fn( array $unlock ): bool => ( $unlock['location_slug'] ?? '' ) === 'grim_hollow_village'
			)
		)[0] ?? null;

		$this->assertSame( [ 'movement' => 2, 'fast_travel' => 1, 'total' => 3 ], $route_state['travel_points_breakdown'] );
		$this->assertSame( 3, $route_state['total_travel_points'] );
		$this->assertNotNull( $grim_hollow_unlock );
		$this->assertSame( 1, $grim_hollow_unlock['fast_travel_points_cap'] );
		$this->assertSame( 1, $grim_hollow_unlock['fast_travel_points_used'] );
	}

	public function test_fast_travel_endpoint_spends_gold_updates_breakdown_and_unlocks_route(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'warrior',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 40,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 14 );
		$this->queueUnlockLookups(
			$user_id,
			[
				$this->rawUnlockRow( 11, $user_id, 'location_arc', 'the_training_grounds' ),
			],
			18
		);
		$this->queueActivityAwardLookups(
			$user_id,
			[
				$this->rawLedgerRow( 21, $user_id, 'route_progress', 'steps_2026-04-08', 'travel_points', [ 'points' => 2 ] ),
			],
			30
		);
		$this->queueUnlockIdChecks( $user_id, 6 );
		$this->queueLedgerDuplicateChecks( $user_id, 6 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/route/fast-travel' );
		$request->set_param( 'location_slug', 'grim_hollow_village' );
		$request->set_param( 'travel_points', 1 );

		$response = IronQuestController::fast_travel( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['applied'] );
		$this->assertSame( 10, $data['gold_spent'] );
		$this->assertSame( 1, $data['travel_points'] );
		$this->assertSame( 30, $data['profile']['gold'] );
		$this->assertSame( [ 'movement' => 2, 'fast_travel' => 1, 'total' => 3 ], $data['route_state']['travel_points_breakdown'] );
		$this->assertContains( 'grim_hollow_village', $data['route_changes']['newly_unlocked_locations'] );
		$this->assertTrue(
			$this->hasInsertedRow(
				'wp_fit_ironquest_activity_ledger',
				static fn( array $row ): bool => ( $row['source_key'] ?? '' ) === 'fast_travel_grim_hollow_village'
					&& ( $row['award_type'] ?? '' ) === 'travel_points'
			)
		);
	}

	public function test_fast_travel_endpoint_rejects_when_user_lacks_gold(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'warrior',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 5,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 6 );
		$this->queueUnlockLookups(
			$user_id,
			[
				$this->rawUnlockRow( 11, $user_id, 'location_arc', 'the_training_grounds' ),
			],
			12
		);
		$this->queueActivityAwardLookups(
			$user_id,
			[
				$this->rawLedgerRow( 21, $user_id, 'route_progress', 'steps_2026-04-08', 'travel_points', [ 'points' => 2 ] ),
			],
			18
		);

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/route/fast-travel' );
		$request->set_param( 'location_slug', 'grim_hollow_village' );
		$request->set_param( 'travel_points', 1 );

		$response = IronQuestController::fast_travel( $request );
		$data = $response->get_data();

		$this->assertSame( 409, $response->get_status() );
		$this->assertFalse( $data['applied'] );
		$this->assertSame( 'insufficient_gold', $data['reason'] );
		$this->assertSame( 'You need 5 more gold to buy 1 travel point.', $data['message'] );
		$this->assertSame( 10, $data['gold_required'] );
		$this->assertSame( 5, $data['gold_available'] );
		$this->assertSame( 5, $data['gold_shortfall'] );
		$this->assertSame( [ 'movement' => 2, 'fast_travel' => 0, 'total' => 2 ], $data['route_state']['travel_points_breakdown'] );
		$this->assertFalse(
			$this->hasInsertedRow(
				'wp_fit_ironquest_activity_ledger',
				static fn( array $row ): bool => ( $row['source_key'] ?? '' ) === 'fast_travel_grim_hollow_village'
			)
		);
	}

	public function test_travel_to_location_endpoint_switches_to_unlocked_region_and_sets_default_mission(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'warrior',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 25,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 16 );
		$this->queueUnlockLookups(
			$user_id,
			[
				$this->rawUnlockRow( 11, $user_id, 'location_arc', 'the_training_grounds' ),
				$this->rawUnlockRow( 12, $user_id, 'location', 'grim_hollow_village' ),
			],
			24
		);
		$this->queueActivityAwardLookups(
			$user_id,
			[
				$this->rawLedgerRow( 21, $user_id, 'route_progress', 'steps_2026-04-08', 'travel_points', [ 'points' => 3 ] ),
			],
			36
		);
		$this->wpdb()->expectGetVar( "SELECT timezone FROM wp_fit_user_profiles WHERE user_id = {$user_id} LIMIT 1", 'America/New_York' );
		$daily_state_callback = function () use ( $user_id ) {
			foreach ( $this->wpdb()->inserted as $insert ) {
				if ( $insert['table'] !== 'wp_fit_ironquest_daily_state' ) {
					continue;
				}
				if ( (int) ( $insert['data']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}
				if ( ( $insert['data']['state_date'] ?? '' ) !== '2026-04-09' ) {
					continue;
				}

				return array_merge(
					[
						'id'         => 1,
						'created_at' => '2026-04-09 12:00:00',
						'updated_at' => '2026-04-09 12:00:00',
					],
					$insert['data']
				);
			}

			return null;
		};
		for ( $index = 0; $index < 6; $index++ ) {
			$this->wpdb()->expectGetRow( "FROM wp_fit_ironquest_daily_state WHERE user_id = {$user_id} AND state_date = '2026-04-09'", $daily_state_callback );
		}
		$this->wpdb()->expectGetRow( "FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'active'", null );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/route/travel' );
		$request->set_param( 'location_slug', 'grim_hollow_village' );

		$response = IronQuestController::travel_to_location( $request );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['traveled'] );
		$this->assertSame( 'grim_hollow_village', $data['location_slug'] );
		$this->assertSame( 'grim_hollow_village', $data['profile']['current_location_slug'] );
		$this->assertSame( 'shadows_in_the_streets', $data['profile']['active_mission_slug'] );
		$this->assertSame( 'Grim Hollow Village', $data['location']['name'] );
		$this->assertTrue(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_profiles',
				static fn( array $row ): bool => ( $row['current_location_slug'] ?? '' ) === 'grim_hollow_village'
					&& ( $row['active_mission_slug'] ?? '' ) === 'shadows_in_the_streets'
			)
		);
	}

	public function test_travel_to_location_endpoint_rejects_locked_region(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'warrior',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 25,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 8 );
		$this->queueUnlockLookups(
			$user_id,
			[
				$this->rawUnlockRow( 11, $user_id, 'location_arc', 'the_training_grounds' ),
			],
			12
		);
		$this->queueActivityAwardLookups(
			$user_id,
			[
				$this->rawLedgerRow( 21, $user_id, 'route_progress', 'steps_2026-04-08', 'travel_points', [ 'points' => 1 ] ),
			],
			18
		);

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/route/travel' );
		$request->set_param( 'location_slug', 'grim_hollow_village' );

		$response = IronQuestController::travel_to_location( $request );

		$this->assertSame( 409, $response->get_status() );
		$this->assertSame( 'That region is not unlocked yet.', $response->get_data()['message'] ?? '' );
		$this->assertFalse(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_profiles',
				static fn( array $row ): bool => array_key_exists( 'current_location_slug', $row )
					&& 'grim_hollow_village' === ( $row['current_location_slug'] ?? '' )
			)
		);
	}

	public function test_restart_onboarding_endpoint_clears_identity_and_disables_mode(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = [
			'id'                            => 7,
			'user_id'                       => $user_id,
			'enabled'                       => true,
			'class_slug'                    => 'warrior',
			'motivation_slug'               => 'discipline',
			'level'                         => 2,
			'xp'                            => 180,
			'gold'                          => 25,
			'hp_current'                    => 100,
			'hp_max'                        => 100,
			'current_location_slug'         => 'the_training_grounds',
			'active_mission_slug'           => 'captain_of_the_yard',
			'starter_portrait_attachment_id' => 88,
		];

		$this->queueProfileLookups( $user_id, $profile, 4 );

		$request  = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/restart' );
		$response = IronQuestController::restart_onboarding( $request );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['restarted'] );
		$this->assertFalse( $data['profile']['enabled'] );
		$this->assertSame( '', $data['profile']['class_slug'] );
		$this->assertSame( '', $data['profile']['motivation_slug'] );
		$this->assertSame( 0, $data['profile']['starter_portrait_attachment_id'] );
		$this->assertSame( 180, $data['profile']['xp'] );
		$this->assertSame( 25, $data['profile']['gold'] );
		$this->assertTrue(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_profiles',
				static fn( array $row ): bool => array_key_exists( 'enabled', $row )
					&& array_key_exists( 'class_slug', $row )
					&& array_key_exists( 'motivation_slug', $row )
					&& array_key_exists( 'starter_portrait_attachment_id', $row )
					&& 0 === (int) $row['enabled']
					&& '' === $row['class_slug']
					&& '' === $row['motivation_slug']
					&& 0 === (int) $row['starter_portrait_attachment_id']
			)
		);
	}

	public function test_sync_route_progression_unlocks_next_location_and_advances_profile(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'warrior',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 25,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 10 );
		$this->queueUnlockLookups(
			$user_id,
			[
				$this->rawUnlockRow( 11, $user_id, 'location_arc', 'the_training_grounds' ),
			],
			12
		);
		$this->queueActivityAwardLookups(
			$user_id,
			[
				$this->rawLedgerRow( 21, $user_id, 'route_progress', 'steps_2026-04-08', 'travel_points', [ 'points' => 3 ] ),
			],
			24
		);
		$this->queueUnlockIdChecks( $user_id, 4 );

		$result = $this->invokePrivateStatic( IronQuestController::class, 'sync_route_progression', [ $user_id, [] ] );

		$this->assertSame( [ 'grim_hollow_village' ], $result['route_changes']['newly_unlocked_locations'] );
		$this->assertTrue( $result['route_changes']['active_location_changed'] );
		$this->assertSame( 'grim_hollow_village', $result['route_state']['current_location_slug'] );
		$this->assertContains( 'grim_hollow_village', $result['route_state']['unlocked_locations'] );

		$this->assertTrue(
			$this->hasInsertedRow(
				'wp_fit_ironquest_unlocks',
				static fn( array $row ): bool => ( $row['unlock_type'] ?? '' ) === 'location'
					&& ( $row['unlock_key'] ?? '' ) === 'grim_hollow_village'
			)
		);
		$this->assertTrue(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_profiles',
				static fn( array $row ): bool => ( $row['current_location_slug'] ?? '' ) === 'grim_hollow_village'
					&& ( $row['active_mission_slug'] ?? '' ) === 'shadows_in_the_streets'
			)
		);
	}

	public function test_clear_location_arc_grants_unlock_and_full_clear_bonus(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'warrior',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 190,
			'gold'                  => 10,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 8 );
		$this->queueUnlockIdChecks( $user_id, 4 );
		$this->queueLedgerDuplicateChecks( $user_id, 4 );

		$this->invokePrivateStatic( IronQuestController::class, 'clear_location_arc', [ $user_id, 'the_training_grounds', 88 ] );

		$this->assertTrue(
			$this->hasInsertedRow(
				'wp_fit_ironquest_unlocks',
				static fn( array $row ): bool => ( $row['unlock_type'] ?? '' ) === 'location_arc'
					&& ( $row['unlock_key'] ?? '' ) === 'the_training_grounds'
			)
		);
		$this->assertTrue(
			$this->hasInsertedRow(
				'wp_fit_ironquest_activity_ledger',
				static fn( array $row ): bool => ( $row['source_type'] ?? '' ) === 'location_arc'
					&& ( $row['source_key'] ?? '' ) === 'the_training_grounds'
					&& ( $row['award_type'] ?? '' ) === 'full_clear_bonus'
			)
		);
		$this->assertTrue(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_profiles',
				static fn( array $row ): bool => (int) ( $row['xp'] ?? 0 ) === 220
					&& (int) ( $row['gold'] ?? 0 ) === 25
					&& (int) ( $row['level'] ?? 0 ) === 3
			)
		);
	}

	public function test_clear_location_arc_does_not_apply_bonus_twice_when_ledger_exists(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'warrior',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 190,
			'gold'                  => 10,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 4 );
		$this->queueUnlockIdChecks( $user_id, 4, 501 );
		$this->queueLedgerDuplicateChecks( $user_id, 4, 601 );

		$this->invokePrivateStatic( IronQuestController::class, 'clear_location_arc', [ $user_id, 'the_training_grounds', 88 ] );

		$this->assertFalse(
			$this->hasInsertedRow(
				'wp_fit_ironquest_activity_ledger',
				static fn( array $row ): bool => ( $row['source_type'] ?? '' ) === 'location_arc'
					&& ( $row['source_key'] ?? '' ) === 'the_training_grounds'
					&& ( $row['award_type'] ?? '' ) === 'full_clear_bonus'
			)
		);
		$this->assertFalse(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_profiles',
				static fn( array $row ): bool => array_key_exists( 'xp', $row ) || array_key_exists( 'gold', $row ) || array_key_exists( 'level', $row )
			)
		);
	}

	public function test_resolve_awards_for_run_applies_runner_task_effects(): void {
		$awards = $this->invokePrivateStatic(
			IronQuestController::class,
			'resolve_awards_for_run',
			[
				[
					'location_slug' => 'the_training_grounds',
					'mission_slug'  => 'marker_run',
				],
				'victory',
				0,
				0,
			]
		);

		$this->assertSame( 76, $awards['xp'] );
		$this->assertSame( 12, $awards['gold'] );
		$this->assertSame( 'seed_standard_rewards', $awards['source'] );
		$this->assertSame( 1, $awards['travel_points_bonus'] );
		$this->assertSame( [ 'travel_bonus', 'grind' ], $awards['effect_tags'] );
	}

	public function test_build_mission_board_assigns_roles_without_reordering_seeded_missions(): void {
		$missions = \Johnny5k\Services\IronQuestRegistryService::get_location_missions( 'the_training_grounds' );
		$board    = $this->invokePrivateStatic(
			IronQuestController::class,
			'build_mission_board',
			[
				[
					'active_mission_slug' => 'cadence_yard',
				],
				$missions,
				[
					'cardio_quest_complete'  => false,
					'workout_quest_complete' => false,
				],
				[
					'mission_slug' => 'captain_of_the_yard',
				],
			]
		);

		$this->assertSame( 'form_check', $board[0]['slug'] );
		$this->assertSame( 'recovery_safe', $board[0]['board_role'] );
		$this->assertSame( 'marker_run', $board[1]['slug'] );
		$this->assertSame( 'recommended', $board[1]['board_role'] );
		$this->assertSame( 'first_steel', $board[2]['slug'] );
		$this->assertSame( 'optional', $board[2]['board_role'] );
		$this->assertSame( 'cadence_yard', $board[3]['slug'] );
		$this->assertSame( 'optional', $board[3]['board_role'] );
		$this->assertSame( 'captain_of_the_yard', $board[4]['slug'] );
		$this->assertSame( 'active', $board[4]['board_role'] );

		$roles_by_slug = [];
		$selected_flags = [];
		foreach ( $board as $mission ) {
			$roles_by_slug[ $mission['slug'] ] = $mission['board_role'];
			$selected_flags[ $mission['slug'] ] = ! empty( $mission['is_selected'] );
		}

		$this->assertSame( 'recovery_safe', $roles_by_slug['form_check'] ?? null );
		$this->assertSame( 'optional', $roles_by_slug['first_steel'] ?? null );
		$this->assertSame( 'optional', $roles_by_slug['cadence_yard'] ?? null );
		$this->assertSame( 'active', $roles_by_slug['captain_of_the_yard'] ?? null );
		$this->assertTrue( $selected_flags['cadence_yard'] ?? false );
	}

	private function queueProfileLookups( int $user_id, array &$profile, int $times ): void {
		$db = $this->wpdb();
		$callback = static function () use ( &$profile, $db, $user_id ): array {
			foreach ( $db->updated as $update ) {
				if ( $update['table'] !== 'wp_fit_ironquest_profiles' ) {
					continue;
				}
				if ( (int) ( $update['where']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}
				$profile = array_merge( $profile, $update['data'] );
			}

			return $profile;
		};

		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetRow( "FROM wp_fit_ironquest_profiles WHERE user_id = {$user_id}", $callback );
		}
	}

	private function queueUnlockLookups( int $user_id, array $base_rows, int $times ): void {
		$db = $this->wpdb();
		$callback = static function ( string $query ) use ( $db, $base_rows, $user_id ): array {
			$rows = $base_rows;
			foreach ( $db->inserted as $index => $insert ) {
				if ( $insert['table'] !== 'wp_fit_ironquest_unlocks' ) {
					continue;
				}
				if ( (int) ( $insert['data']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}
				$rows[] = [
					'id' => 900 + $index,
					'created_at' => '2026-04-09 12:00:00',
					...$insert['data'],
				];
			}

			$unlock_type = str_contains( $query, "unlock_type = 'location_arc'" )
				? 'location_arc'
				: ( str_contains( $query, "unlock_type = 'location'" ) ? 'location' : '' );

			return array_values(
				array_filter(
					$rows,
					static fn( array $row ): bool => '' === $unlock_type || ( $row['unlock_type'] ?? '' ) === $unlock_type
				)
			);
		};

		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetResults( "FROM wp_fit_ironquest_unlocks WHERE user_id = {$user_id}", $callback );
		}
	}

	private function queueActivityAwardLookups( int $user_id, array $base_rows, int $times ): void {
		$db = $this->wpdb();
		$callback = static function ( string $query ) use ( $db, $base_rows, $user_id ): array {
			$rows = $base_rows;
			foreach ( $db->inserted as $index => $insert ) {
				if ( $insert['table'] !== 'wp_fit_ironquest_activity_ledger' ) {
					continue;
				}
				if ( (int) ( $insert['data']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}
				$rows[] = [
					'id' => 700 + $index,
					'created_at' => '2026-04-09 12:00:00',
					...$insert['data'],
				];
			}
			foreach ( $db->updated as $update ) {
				if ( $update['table'] !== 'wp_fit_ironquest_activity_ledger' ) {
					continue;
				}
				foreach ( $rows as &$row ) {
					if ( (int) ( $row['id'] ?? 0 ) === (int) ( $update['where']['id'] ?? 0 ) ) {
						$row = array_merge( $row, $update['data'] );
					}
				}
				unset( $row );
			}

			$is_route_progress = str_contains( $query, "source_type = 'route_progress'" ) && str_contains( $query, "award_type = 'travel_points'" );

			return array_values(
				array_filter(
					$rows,
					static fn( array $row ): bool => ! $is_route_progress
						|| (
							( $row['source_type'] ?? '' ) === 'route_progress'
							&& ( $row['award_type'] ?? '' ) === 'travel_points'
						)
				)
			);
		};

		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetResults( "FROM wp_fit_ironquest_activity_ledger WHERE user_id = {$user_id}", $callback );
		}
	}

	private function queueUnlockIdChecks( int $user_id, int $times, int $existing_id = 0 ): void {
		$db = $this->wpdb();
		$callback = static function ( string $query ) use ( $db, $user_id, $existing_id ): int {
			if ( $existing_id > 0 ) {
				return $existing_id;
			}

			foreach ( $db->inserted as $index => $insert ) {
				if ( $insert['table'] !== 'wp_fit_ironquest_unlocks' ) {
					continue;
				}
				if ( (int) ( $insert['data']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}
				if ( ! preg_match( "/unlock_type = '([^']+)'/", $query, $type_match ) ) {
					continue;
				}
				if ( ! preg_match( "/unlock_key = '([^']+)'/", $query, $key_match ) ) {
					continue;
				}
				if ( ( $insert['data']['unlock_type'] ?? '' ) === $type_match[1] && ( $insert['data']['unlock_key'] ?? '' ) === $key_match[1] ) {
					return 900 + $index;
				}
			}

			return 0;
		};

		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetVar( "FROM wp_fit_ironquest_unlocks WHERE user_id = {$user_id}", $callback );
		}
	}

	private function queueLedgerDuplicateChecks( int $user_id, int $times, int $existing_id = 0 ): void {
		$db = $this->wpdb();
		$callback = static function ( string $query ) use ( $db, $user_id, $existing_id ): int {
			if ( $existing_id > 0 ) {
				return $existing_id;
			}

			foreach ( $db->inserted as $index => $insert ) {
				if ( $insert['table'] !== 'wp_fit_ironquest_activity_ledger' ) {
					continue;
				}
				if ( (int) ( $insert['data']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}
				if ( ! preg_match( "/source_type = '([^']+)'/", $query, $source_match ) ) {
					continue;
				}
				if ( ! preg_match( "/source_key = '([^']+)'/", $query, $key_match ) ) {
					continue;
				}
				if ( ! preg_match( "/award_type = '([^']+)'/", $query, $award_match ) ) {
					continue;
				}
				if (
					( $insert['data']['source_type'] ?? '' ) === $source_match[1]
					&& ( $insert['data']['source_key'] ?? '' ) === $key_match[1]
					&& ( $insert['data']['award_type'] ?? '' ) === $award_match[1]
				) {
					return 700 + $index;
				}
			}

			return 0;
		};

		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetVar( "FROM wp_fit_ironquest_activity_ledger WHERE user_id = {$user_id}", $callback );
		}
	}

	private function hasInsertedRow( string $table, callable $predicate ): bool {
		foreach ( $this->wpdb()->inserted as $insert ) {
			if ( $insert['table'] !== $table ) {
				continue;
			}
			if ( $predicate( $insert['data'] ) ) {
				return true;
			}
		}

		return false;
	}

	private function hasUpdatedRow( string $table, callable $predicate ): bool {
		foreach ( $this->wpdb()->updated as $update ) {
			if ( $update['table'] !== $table ) {
				continue;
			}
			if ( $predicate( $update['data'] ) ) {
				return true;
			}
		}

		return false;
	}

	private function rawUnlockRow( int $id, int $user_id, string $unlock_type, string $unlock_key ): array {
		return [
			'id' => $id,
			'user_id' => $user_id,
			'unlock_type' => $unlock_type,
			'unlock_key' => $unlock_key,
			'source_run_id' => 0,
			'meta_json' => wp_json_encode( [] ),
			'created_at' => '2026-04-09 12:00:00',
		];
	}

	private function rawLedgerRow( int $id, int $user_id, string $source_type, string $source_key, string $award_type, array $payload ): array {
		return [
			'id' => $id,
			'user_id' => $user_id,
			'source_type' => $source_type,
			'source_key' => $source_key,
			'award_type' => $award_type,
			'payload_json' => wp_json_encode( $payload ),
			'created_at' => '2026-04-09 12:00:00',
		];
	}
}
