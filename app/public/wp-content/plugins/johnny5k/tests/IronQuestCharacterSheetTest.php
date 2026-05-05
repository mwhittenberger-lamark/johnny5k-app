<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\IronQuestController;
use Johnny5k\Tests\Support\ServiceTestCase;

if ( ! defined( 'JF_PLUGIN_DIR' ) ) {
	define( 'JF_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
}

class IronQuestCharacterSheetTest extends ServiceTestCase {
	public function test_get_profile_includes_character_sheet_payload(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );
		update_user_meta(
			$user_id,
			'jf_ironquest_current_form_portrait',
			[
				'label' => 'Current Form Portrait',
				'description' => 'Seasoned Adventurer • Mage • Training Grounds Kit',
				'generated_image_id' => 'current_form_42',
				'portrait_attachment_id' => 288,
				'visual_signature' => 'outdated-signature',
				'generated_at' => '2026-04-29 13:00:00',
			]
		);

		$profile = [
			'id'                             => 7,
			'user_id'                        => $user_id,
			'enabled'                        => true,
			'class_slug'                     => 'mage',
			'motivation_slug'                => 'discipline',
			'level'                          => 7,
			'xp'                             => 920,
			'gold'                           => 54,
			'hp_current'                     => 82,
			'hp_max'                         => 100,
			'current_location_slug'          => 'the_training_grounds',
			'active_mission_slug'            => 'captain_of_the_yard',
			'starter_portrait_attachment_id' => 88,
		];
		$daily_state = [
			'id'                    => 14,
			'user_id'               => $user_id,
			'state_date'            => '2026-04-29',
			'meal_quest_complete'   => 0,
			'sleep_quest_complete'  => 1,
			'cardio_quest_complete' => 0,
			'steps_quest_complete'  => 1,
			'workout_quest_complete'=> 0,
			'travel_points_earned'  => 2,
			'bonus_state_json'      => wp_json_encode(
				[
					'tavern_day' => [
						'action_id' => 'rumors',
						'effects'   => [
							'xp_delta' => 10,
							'mission_preview' => [ 'slug' => 'captain_of_the_yard' ],
						],
					],
					'store' => [
						'consumables' => [
							[
								'id' => 'field_bandage',
								'name' => 'Field Bandage',
								'effect_summary' => 'Restore 15 HP before the next push',
								'quantity' => 2,
							],
						],
						'active_charm' => [
							'id' => 'coin_charm',
							'name' => 'Coin Charm',
							'effect_summary' => 'Small bonus gold on the next mission',
						],
					],
				]
			),
		];
		$unlock_rows = [
			[
				'id' => 11,
				'user_id' => $user_id,
				'unlock_type' => 'title',
				'unlock_key' => 'last_one_standing',
				'meta_json' => wp_json_encode( [ 'label' => 'Last One Standing', 'description' => 'Earned under pressure.' ] ),
				'source_run_id' => 33,
				'created_at' => '2026-04-29 10:00:00',
			],
			[
				'id' => 12,
				'user_id' => $user_id,
				'unlock_type' => 'relic',
				'unlock_key' => 'road_builder',
				'meta_json' => wp_json_encode( [ 'label' => 'Road Builder', 'description' => 'Long roads feel shorter now.' ] ),
				'source_run_id' => 31,
				'created_at' => '2026-04-28 10:00:00',
			],
			[
				'id' => 13,
				'user_id' => $user_id,
				'unlock_type' => 'journal_entry',
				'unlock_key' => 'first_rest_opened',
				'meta_json' => wp_json_encode( [ 'label' => 'Unlocked The First Rest', 'description' => 'Region tavern opened.' ] ),
				'source_run_id' => 30,
				'created_at' => '2026-04-27 10:00:00',
			],
			[
				'id' => 14,
				'user_id' => $user_id,
				'unlock_type' => 'portrait',
				'unlock_key' => 'level_5_portrait',
				'meta_json' => wp_json_encode(
					[
						'label' => 'Level 5 Portrait',
						'description' => 'Forged after reaching level 5.',
						'generated_image_id' => 'portrait_14',
						'portrait_attachment_id' => 188,
						'trigger' => 'level_milestone',
					]
				),
				'source_run_id' => 34,
				'created_at' => '2026-04-29 12:00:00',
			],
		];
		$activity_rows = [
			[
				'id' => 20,
				'user_id' => $user_id,
				'source_type' => 'route_progress',
				'award_type' => 'travel_points',
				'payload_json' => wp_json_encode( [ 'points' => 2 ] ),
				'created_at' => '2026-04-29 08:00:00',
			],
		];

		$this->wpdb()->expectGetVar( "SELECT timezone FROM wp_fit_user_profiles WHERE user_id = {$user_id} LIMIT 1", 'UTC' );
		$this->queueProfileLookups( $user_id, $profile, 10 );
		$this->queueDailyStateLookups( $user_id, $daily_state, 6 );
		$this->queueUnlockLookups( $user_id, $unlock_rows, 12 );
		$this->queueActivityAwardLookups( $user_id, $activity_rows, 8 );
		$this->wpdb()->expectGetRow( "FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'active'", null );
		$this->queueMissionCompletionCountLookups( $user_id, 'the_training_grounds', [], 1 );

		$response = IronQuestController::get_profile( new \WP_REST_Request( 'GET', '/fit/v1/ironquest/profile' ) );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'Last One Standing', $data['character_sheet']['identity']['display_title'] );
		$this->assertSame( 'The Training Grounds', $data['character_sheet']['campaign']['current_location_name'] );
		$this->assertSame( 'Captain of the Yard', $data['character_sheet']['campaign']['selected_mission_name'] );
		$this->assertSame( 'Quartermaster Vale', $data['character_sheet']['campaign']['store_name'] );
		$this->assertSame( 'current_form_42', $data['character_sheet']['identity']['current_form']['generated_image_id'] );
		$this->assertSame( 'Coin Charm', $data['character_sheet']['identity']['current_form']['visual_loadout']['active_charm'] );
		$this->assertSame( 'Last One Standing', $data['character_sheet']['identity']['current_form']['visual_loadout']['title'] );
		$this->assertSame( 1, $data['character_sheet']['inventory_summary']['relic_count'] );
		$this->assertSame( 1, $data['character_sheet']['inventory_summary']['active_relics'] );
		$this->assertSame( 1, $data['character_sheet']['inventory_summary']['consumable_count'] );
		$this->assertSame( 'Road Builder', $data['character_sheet']['inventory_summary']['equipped_relics'][0]['label'] );
		$this->assertSame( 'Field Bandage', $data['character_sheet']['inventory_summary']['consumables'][0]['name'] );
		$this->assertSame( 'Tavern: Rumors', $data['character_sheet']['active_effects'][0]['label'] );
		$this->assertSame( 'Coin Charm', $data['character_sheet']['active_effects'][1]['label'] );
		$this->assertSame( 'Level 5 Portrait', $data['character_sheet']['collections']['portraits'][0]['label'] );
		$this->assertSame( 'portrait_14', $data['character_sheet']['collections']['portraits'][0]['generated_image_id'] );
		$this->assertSame( 'Road Builder', $data['character_sheet']['collections']['relics'][0]['label'] );
		$this->assertContains( 'Level 5 Portrait', array_column( $data['character_sheet']['recent_history'], 'label' ) );
		$this->assertSame( 'Quartermaster Vale', $data['store']['store_name'] );
		$this->assertSame( 'coin_charm', $data['store']['recommended_purchase']['item_id'] );
		$this->assertSame( 'Coin Charm', $data['store']['inventory']['active_charm']['name'] );
	}

	public function test_generate_character_sheet_portrait_requires_headshot(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = $this->buildProfileRow( $user_id );
		$daily_state = $this->buildDailyStateRow( $user_id );

		$this->queueTimezoneLookups( $user_id, 1 );
		$this->queueProfileLookups( $user_id, $profile, 2 );
		$this->queueDailyStateLookups( $user_id, $daily_state, 1 );
		$this->queueUnlockLookups( $user_id, [], 1 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/character-sheet/portrait' );
		$response = IronQuestController::generate_character_sheet_portrait( $request );
		$data = $response->get_data();

		$this->assertSame( 409, $response->get_status() );
		$this->assertFalse( $data['generated'] );
		$this->assertSame( 'ironquest_current_form_missing_headshot', $data['reason'] );
		$recent_events = get_option( 'jf_ironquest_recent_events_v1', [] );
		$this->assertIsArray( $recent_events );
		$this->assertSame( 'current_form_portrait_failed', $recent_events[0]['event_name'] ?? '' );
		$this->assertSame( 'failure', $recent_events[0]['status'] ?? '' );
	}

	public function test_purchase_store_item_spends_gold_and_persists_inventory_state(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$initial_profile = [
			'id'                             => 7,
			'user_id'                        => $user_id,
			'enabled'                        => true,
			'class_slug'                     => 'mage',
			'motivation_slug'                => 'discipline',
			'level'                          => 7,
			'xp'                             => 920,
			'gold'                           => 54,
			'hp_current'                     => 82,
			'hp_max'                         => 100,
			'current_location_slug'          => 'the_training_grounds',
			'active_mission_slug'            => 'captain_of_the_yard',
			'starter_portrait_attachment_id' => 88,
		];
		$updated_profile = $initial_profile;
		$updated_profile['gold'] = 29;
		$daily_state = [
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
		$unlock_rows = [
			[
				'id' => 11,
				'user_id' => $user_id,
				'unlock_type' => 'title',
				'unlock_key' => 'last_one_standing',
				'meta_json' => wp_json_encode( [ 'label' => 'Last One Standing', 'description' => 'Earned under pressure.' ] ),
				'source_run_id' => 33,
				'created_at' => '2026-04-29 10:00:00',
			],
		];
		$activity_rows = [
			[
				'id' => 20,
				'user_id' => $user_id,
				'source_type' => 'route_progress',
				'award_type' => 'travel_points',
				'payload_json' => wp_json_encode( [ 'points' => 2 ] ),
				'created_at' => '2026-04-29 08:00:00',
			],
		];

		$db = $this->wpdb();
		for ( $index = 0; $index < 12; $index++ ) {
			$db->expectGetVar( "SELECT timezone FROM wp_fit_user_profiles WHERE user_id = {$user_id} LIMIT 1", 'UTC' );
		}
		for ( $index = 0; $index < 8; $index++ ) {
			$db->expectGetRow(
				"FROM wp_fit_ironquest_profiles WHERE user_id = {$user_id}",
				static function () use ( $db, $initial_profile, $updated_profile ) {
					foreach ( $db->updated as $update ) {
						if ( 'wp_fit_ironquest_profiles' === $update['table'] ) {
							return $updated_profile;
						}
					}

					return $initial_profile;
				}
			);
		}
		for ( $index = 0; $index < 8; $index++ ) {
			$db->expectGetRow(
				"FROM wp_fit_ironquest_daily_state WHERE user_id = {$user_id}",
				static function () use ( $db, $daily_state ) {
					foreach ( $db->updated as $update ) {
						if ( 'wp_fit_ironquest_daily_state' === $update['table'] ) {
							$updated_row = $daily_state;
							$updated_row['bonus_state_json'] = (string) ( $update['data']['bonus_state_json'] ?? wp_json_encode( [] ) );
							return $updated_row;
						}
					}

					return $daily_state;
				}
			);
		}
		$this->queueUnlockLookups( $user_id, $unlock_rows, 8 );
		$this->queueActivityAwardLookups( $user_id, $activity_rows, 6 );
		$db->expectGetRow( "FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'active'", null );
		$this->queueMissionCompletionCountLookups( $user_id, 'the_training_grounds', [], 1 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/store/purchase' );
		$request->set_param( 'item_id', 'coin_charm' );
		$response = IronQuestController::purchase_store_item( $request );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertTrue( $data['purchased'] );
		$this->assertSame( 25, $data['gold_spent'] );
		$this->assertSame( 29, $data['profile']['gold'] );
		$this->assertSame( 'Coin Charm', $data['store']['inventory']['active_charm']['name'] );
		$this->assertSame( 'Coin Charm', $data['character_sheet']['active_effects'][0]['label'] );
		$this->assertSame( 'wp_fit_ironquest_profiles', $db->updated[0]['table'] );
		$this->assertSame( 29, $db->updated[0]['data']['gold'] );
		$this->assertSame( 'wp_fit_ironquest_daily_state', $db->updated[1]['table'] );
		$this->assertStringContainsString( 'coin_charm', (string) $db->updated[1]['data']['bonus_state_json'] );
		$behavior_events = array_values( array_filter( $db->inserted, static fn( array $entry ): bool => 'wp_fit_behavior_events' === $entry['table'] ) );
		$this->assertNotEmpty( $behavior_events );
		$this->assertSame( 'ironquest_store_purchase_completed', $behavior_events[0]['data']['event_name'] ?? '' );
	}

	public function test_purchase_store_item_rejects_when_gold_is_too_low(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = $this->buildProfileRow( $user_id, [ 'gold' => 10 ] );
		$daily_state = $this->buildDailyStateRow( $user_id );
		$db = $this->wpdb();

		$this->queueTimezoneLookups( $user_id, 10 );
		$this->queueProfileLookups( $user_id, $profile, 8 );
		$this->queueDailyStateLookups( $user_id, $daily_state, 4 );
		$this->queueUnlockLookups( $user_id, [], 8 );
		$this->queueActivityAwardLookups( $user_id, [], 6 );
		$db->expectGetRow( "FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'active'", null );
		$this->queueMissionCompletionCountLookups( $user_id, 'the_training_grounds', [], 1 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/store/purchase' );
		$request->set_param( 'item_id', 'coin_charm' );
		$response = IronQuestController::purchase_store_item( $request );
		$data = $response->get_data();

		$this->assertSame( 409, $response->get_status() );
		$this->assertFalse( $data['purchased'] );
		$this->assertSame( 'insufficient_gold', $data['reason'] );
		$this->assertSame( 0, count( $db->updated ) );
	}

	public function test_use_store_item_consumes_bandage_and_restores_hp(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$initial_profile = $this->buildProfileRow( $user_id, [ 'hp_current' => 70 ] );
		$updated_profile = $this->buildProfileRow( $user_id, [ 'hp_current' => 85 ] );
		$initial_daily = $this->buildDailyStateRow(
			$user_id,
			[
				'store' => [
					'consumables' => [
						[
							'id' => 'field_bandage',
							'name' => 'Field Bandage',
							'effect_summary' => 'Restore 15 HP before the next push',
							'category' => 'recovery_goods',
							'quantity' => 1,
						],
					],
				],
			]
		);
		$updated_daily = $this->buildDailyStateRow( $user_id, [ 'store' => [ 'consumables' => [] ] ] );
		$db = $this->wpdb();

		$this->queueTimezoneLookups( $user_id, 12 );
		$this->queueDynamicProfileLookups( $user_id, $initial_profile, $updated_profile, 8 );
		$this->queueDynamicDailyStateLookups( $user_id, $initial_daily, $updated_daily, 8 );
		$this->queueUnlockLookups( $user_id, [], 8 );
		$this->queueActivityAwardLookups( $user_id, [], 6 );
		$db->expectGetRow( "FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'active'", null );
		$this->queueMissionCompletionCountLookups( $user_id, 'the_training_grounds', [], 1 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/store/use' );
		$request->set_param( 'item_id', 'field_bandage' );
		$response = IronQuestController::use_store_item( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['used'] );
		$this->assertSame( 15, $data['hp_restored'] );
		$this->assertSame( 85, $data['profile']['hp_current'] );
		$this->assertSame( 0, $data['character_sheet']['inventory_summary']['consumable_count'] );
		$this->assertSame( 'wp_fit_ironquest_profiles', $db->updated[0]['table'] );
		$this->assertSame( 85, $db->updated[0]['data']['hp_current'] );
		$this->assertSame( 'wp_fit_ironquest_daily_state', $db->updated[1]['table'] );
		$this->assertStringNotContainsString( 'field_bandage', (string) $db->updated[1]['data']['bonus_state_json'] );
	}

	public function test_use_store_item_activates_doc_catalog_mission_prep(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$profile = $this->buildProfileRow( $user_id );
		$initial_daily = $this->buildDailyStateRow(
			$user_id,
			[
				'store' => [
					'consumables' => [
						[
							'id' => 'basic_supplies',
							'name' => 'Basic Supplies',
							'effect_summary' => 'Basic mission prep for the next run',
							'category' => 'mission_prep',
							'quantity' => 1,
							'use_effect' => [
								'type' => 'activate_prep',
								'active_effect_summary' => 'Basic supplies are packed for the next mission.',
							],
						],
					],
				],
			]
		);
		$updated_daily = $this->buildDailyStateRow(
			$user_id,
			[
				'store' => [
					'consumables' => [],
					'active_prep' => [
						'id' => 'basic_supplies',
						'name' => 'Basic Supplies',
						'effect_summary' => 'Basic supplies are packed for the next mission.',
					],
				],
			]
		);
		$db = $this->wpdb();

		$this->queueTimezoneLookups( $user_id, 12 );
		$this->queueProfileLookups( $user_id, $profile, 8 );
		$this->queueDynamicDailyStateLookups( $user_id, $initial_daily, $updated_daily, 8 );
		$this->queueUnlockLookups( $user_id, [], 8 );
		$this->queueActivityAwardLookups( $user_id, [], 6 );
		$db->expectGetRow( "FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'active'", null );
		$this->queueMissionCompletionCountLookups( $user_id, 'the_training_grounds', [], 1 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/store/use' );
		$request->set_param( 'item_id', 'basic_supplies' );
		$response = IronQuestController::use_store_item( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['used'] );
		$this->assertSame( 'Basic Supplies', $data['active_prep']['name'] );
		$this->assertSame( 'Basic supplies are packed for the next mission.', $data['active_prep']['effect_summary'] );
		$this->assertSame( 'Basic Supplies', $data['character_sheet']['active_effects'][0]['label'] );
		$this->assertStringContainsString( 'basic_supplies', (string) $db->updated[0]['data']['bonus_state_json'] );
	}

	public function test_sell_store_item_grants_gold_and_reduces_quantity(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );
		\wp_set_current_user( $user_id );

		$initial_profile = $this->buildProfileRow( $user_id, [ 'gold' => 54 ] );
		$updated_profile = $this->buildProfileRow( $user_id, [ 'gold' => 64 ] );
		$initial_daily = $this->buildDailyStateRow(
			$user_id,
			[
				'store' => [
					'consumables' => [
						[
							'id' => 'field_bandage',
							'name' => 'Field Bandage',
							'effect_summary' => 'Restore 15 HP before the next push',
							'category' => 'recovery_goods',
							'quantity' => 2,
						],
					],
				],
			]
		);
		$updated_daily = $this->buildDailyStateRow(
			$user_id,
			[
				'store' => [
					'consumables' => [
						[
							'id' => 'field_bandage',
							'name' => 'Field Bandage',
							'effect_summary' => 'Restore 15 HP before the next push',
							'category' => 'recovery_goods',
							'quantity' => 1,
						],
					],
				],
			]
		);
		$db = $this->wpdb();

		$this->queueTimezoneLookups( $user_id, 12 );
		$this->queueDynamicProfileLookups( $user_id, $initial_profile, $updated_profile, 8 );
		$this->queueDynamicDailyStateLookups( $user_id, $initial_daily, $updated_daily, 8 );
		$this->queueUnlockLookups( $user_id, [], 8 );
		$this->queueActivityAwardLookups( $user_id, [], 6 );
		$db->expectGetRow( "FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'active'", null );
		$this->queueMissionCompletionCountLookups( $user_id, 'the_training_grounds', [], 1 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/ironquest/store/sell' );
		$request->set_param( 'item_id', 'field_bandage' );
		$response = IronQuestController::sell_store_item( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['sold'] );
		$this->assertSame( 10, $data['gold_gained'] );
		$this->assertSame( 64, $data['profile']['gold'] );
		$this->assertSame( 1, $data['store']['inventory']['sellback'][0]['quantity'] );
		$this->assertSame( 'wp_fit_ironquest_profiles', $db->updated[0]['table'] );
		$this->assertSame( 64, $db->updated[0]['data']['gold'] );
		$this->assertStringContainsString( '"quantity":1', (string) $db->updated[1]['data']['bonus_state_json'] );
	}

	private function buildProfileRow( int $user_id, array $overrides = [] ): array {
		return array_merge(
			[
				'id'                             => 7,
				'user_id'                        => $user_id,
				'enabled'                        => true,
				'class_slug'                     => 'mage',
				'motivation_slug'                => 'discipline',
				'level'                          => 7,
				'xp'                             => 920,
				'gold'                           => 54,
				'hp_current'                     => 82,
				'hp_max'                         => 100,
				'current_location_slug'          => 'the_training_grounds',
				'active_mission_slug'            => 'captain_of_the_yard',
				'starter_portrait_attachment_id' => 88,
			],
			$overrides
		);
	}

	private function buildDailyStateRow( int $user_id, array $bonus_state = [], array $overrides = [] ): array {
		return array_merge(
			[
				'id'                    => 14,
				'user_id'               => $user_id,
				'state_date'            => '2026-04-29',
				'meal_quest_complete'   => 0,
				'sleep_quest_complete'  => 1,
				'cardio_quest_complete' => 0,
				'steps_quest_complete'  => 1,
				'workout_quest_complete'=> 0,
				'travel_points_earned'  => 2,
				'bonus_state_json'      => wp_json_encode( $bonus_state ),
			],
			$overrides
		);
	}

	private function queueTimezoneLookups( int $user_id, int $times ): void {
		for ( $index = 0; $index < $times; $index++ ) {
			$this->wpdb()->expectGetVar( "SELECT timezone FROM wp_fit_user_profiles WHERE user_id = {$user_id} LIMIT 1", 'UTC' );
		}
	}

	private function queueDynamicProfileLookups( int $user_id, array $initial, array $updated, int $times ): void {
		$db = $this->wpdb();
		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetRow(
				"FROM wp_fit_ironquest_profiles WHERE user_id = {$user_id}",
				static function () use ( $db, $initial, $updated ) {
					foreach ( $db->updated as $row ) {
						if ( 'wp_fit_ironquest_profiles' === $row['table'] ) {
							return $updated;
						}
					}

					return $initial;
				}
			);
		}
	}

	private function queueDynamicDailyStateLookups( int $user_id, array $initial, array $updated, int $times ): void {
		$db = $this->wpdb();
		for ( $index = 0; $index < $times; $index++ ) {
			$db->expectGetRow(
				"FROM wp_fit_ironquest_daily_state WHERE user_id = {$user_id}",
				static function () use ( $db, $initial, $updated ) {
					foreach ( $db->updated as $row ) {
						if ( 'wp_fit_ironquest_daily_state' === $row['table'] ) {
							return $updated;
						}
					}

					return $initial;
				}
			);
		}
	}

	private function queueProfileLookups( int $user_id, array $profile, int $times ): void {
		for ( $index = 0; $index < $times; $index++ ) {
			$this->wpdb()->expectGetRow( "FROM wp_fit_ironquest_profiles WHERE user_id = {$user_id}", $profile );
		}
	}

	private function queueDailyStateLookups( int $user_id, array $row, int $times ): void {
		for ( $index = 0; $index < $times; $index++ ) {
			$this->wpdb()->expectGetRow( "FROM wp_fit_ironquest_daily_state WHERE user_id = {$user_id}", $row );
		}
	}

	private function queueUnlockLookups( int $user_id, array $rows, int $times ): void {
		for ( $index = 0; $index < $times; $index++ ) {
			$this->wpdb()->expectGetResults( "FROM wp_fit_ironquest_unlocks WHERE user_id = {$user_id}", $rows );
		}
	}

	private function queueActivityAwardLookups( int $user_id, array $rows, int $times ): void {
		for ( $index = 0; $index < $times; $index++ ) {
			$this->wpdb()->expectGetResults( "FROM wp_fit_ironquest_activity_ledger WHERE user_id = {$user_id}", $rows );
		}
	}

	private function queueMissionCompletionCountLookups( int $user_id, string $location_slug, array $rows, int $times ): void {
		for ( $index = 0; $index < $times; $index++ ) {
			$this->wpdb()->expectGetResults(
				"FROM wp_fit_ironquest_mission_runs WHERE user_id = {$user_id} AND status = 'completed' AND result_band = 'victory' AND location_slug = '{$location_slug}'",
				$rows
			);
		}
	}
}
