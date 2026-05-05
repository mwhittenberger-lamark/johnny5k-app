<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\IronQuestController;
use Johnny5k\Tests\Support\FakeWpdb;
use Johnny5k\Tests\Support\ServiceTestCase;

if ( ! defined( 'JF_PLUGIN_DIR' ) ) {
	define( 'JF_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
}

class IronQuestTavernDayTest extends ServiceTestCase {
	public function test_get_tavern_returns_location_tavern_and_actions(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'mage',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 25,
			'hp_current'            => 82,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 6 );
		$daily_state_row = [
			'id'                    => 14,
			'user_id'               => $user_id,
			'state_date'            => '2026-04-29',
			'meal_quest_complete'   => 0,
			'sleep_quest_complete'  => 1,
			'cardio_quest_complete' => 0,
			'steps_quest_complete'  => 1,
			'workout_quest_complete'=> 0,
			'travel_points_earned'  => 2,
			'bonus_state_json'      => wp_json_encode( [] ),
		];
		$this->queueDailyStateLookups(
			$user_id,
			$daily_state_row,
			6
		);

		$request = new \WP_REST_Request( 'GET', '/fit/v1/ironquest/tavern' );
		$request->set_param( 'state_date', '2026-04-29' );

		$response = IronQuestController::get_tavern( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'the_training_grounds', $data['location_slug'] );
		$this->assertSame( 'The First Rest', $data['tavern']['name'] );
		$this->assertSame( 'tavern_scene_the_training_grounds', $data['tavern']['art']['art_key'] );
		$this->assertSame( 'missing', $data['tavern']['art']['status'] );
		$this->assertSame( 82, $data['profile']['hp_current'] );
		$this->assertSame( 'rest', $data['available_actions'][0]['id'] );
		$this->assertSame( 'rumors', $data['available_actions'][2]['id'] );
		$this->assertFalse( $data['resolved_today'] );
	}

	public function test_resolve_tavern_action_rest_updates_hp_and_daily_state(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => true,
			'class_slug'            => 'mage',
			'motivation_slug'       => 'discipline',
			'level'                 => 2,
			'xp'                    => 180,
			'gold'                  => 25,
			'hp_current'            => 82,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];

		$this->queueProfileLookups( $user_id, $profile, 12 );
		$daily_state_row = [
			'id'                    => 14,
			'user_id'               => $user_id,
			'state_date'            => '2026-04-29',
			'meal_quest_complete'   => 0,
			'sleep_quest_complete'  => 1,
			'cardio_quest_complete' => 0,
			'steps_quest_complete'  => 1,
			'workout_quest_complete'=> 0,
			'travel_points_earned'  => 2,
			'bonus_state_json'      => wp_json_encode( [] ),
		];
		$this->queueDailyStateLookups(
			$user_id,
			$daily_state_row,
			12
		);

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/tavern/action' );
		$request->set_param( 'state_date', '2026-04-29' );
		$request->set_param( 'action_id', 'rest' );

		$response = IronQuestController::resolve_tavern_action( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['resolved'] );
		$this->assertSame( 'rest', $data['action_id'] );
		$this->assertSame( 8, $data['effects']['hp_delta'] );
		$this->assertSame( 90, $data['profile']['hp_current'] );
		$this->assertSame( 'rest', $data['state']['selected_action']['action_id'] );
		$this->assertTrue( $data['state']['resolved_today'] );
		$this->assertTrue(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_profiles',
				static fn( array $row ): bool => (int) ( $row['data']['hp_current'] ?? 0 ) === 90
			)
		);
		$this->assertTrue(
			$this->hasUpdatedRow(
				'wp_fit_ironquest_daily_state',
				static fn( array $row ): bool => str_contains( (string) ( $row['data']['bonus_state_json'] ?? '' ), '"action_id":"rest"' )
			)
		);
	}

	private function queueProfileLookups( int $user_id, array &$profile, int $times ): void {
		$db = $this->wpdb();
		$callback = static function () use ( &$profile, $db, $user_id ): ?array {
			foreach ( $db->inserted as $insert ) {
				if ( 'wp_fit_ironquest_profiles' !== $insert['table'] ) {
					continue;
				}
				if ( (int) ( $insert['data']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}

				$profile = array_merge( $profile, $insert['data'] );
			}

			foreach ( $db->updated as $update ) {
				if ( 'wp_fit_ironquest_profiles' !== $update['table'] ) {
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

	private function queueDailyStateLookups( int $user_id, array &$row, int $times ): void {
		$db = $this->wpdb();
		$callback = static function () use ( &$row, $db, $user_id ): ?array {
			foreach ( $db->updated as $update ) {
				if ( 'wp_fit_ironquest_daily_state' !== $update['table'] ) {
					continue;
				}
				if ( (int) ( $update['where']['id'] ?? 0 ) !== (int) ( $row['id'] ?? 0 ) ) {
					continue;
				}

				$row = array_merge( $row, $update['data'] );
			}

			foreach ( $db->inserted as $insert ) {
				if ( 'wp_fit_ironquest_daily_state' !== $insert['table'] ) {
					continue;
				}
				if ( (int) ( $insert['data']['user_id'] ?? 0 ) !== $user_id ) {
					continue;
				}

				$row = array_merge( $row, $insert['data'] );
			}

			return $row;
		};

		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetRow( "FROM wp_fit_ironquest_daily_state WHERE user_id = {$user_id} AND state_date = '2026-04-29'", $callback );
		}
		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetRow( 'FROM wp_fit_ironquest_daily_state WHERE user_id =', $callback );
		}
	}

	private function hasUpdatedRow( string $table, callable $matcher ): bool {
		foreach ( $this->wpdb()->updated as $row ) {
			if ( $row['table'] !== $table ) {
				continue;
			}
			if ( $matcher( $row ) ) {
				return true;
			}
		}

		return false;
	}
}
