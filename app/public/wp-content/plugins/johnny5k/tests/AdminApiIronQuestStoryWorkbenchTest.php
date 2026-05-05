<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\AdminApiController;
use Johnny5k\Services\IronQuestRegistryService;
use Johnny5k\Tests\Support\ServiceTestCase;

if ( ! defined( 'JF_PLUGIN_DIR' ) ) {
	define( 'JF_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
}

class AdminApiIronQuestStoryWorkbenchTest extends ServiceTestCase {
	protected function tearDown(): void {
		remove_all_filters( 'johnny5k_ironquest_ai_response' );
		parent::tearDown();
	}

	public function test_story_workbench_preview_returns_candidate_batch_for_pilot_mission(): void {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-preview' );
		$request->set_param( 'mission_slug', 'captain_of_the_yard' );
		$request->set_param( 'encounter_seed_slug', 'trial_lane' );
		$request->set_param( 'slot', 'set_progression' );
		$request->set_param( 'set_result', 'target_met' );
		$request->set_param( 'stance', 'steady' );
		$request->set_param( 'count', 2 );

		$response = AdminApiController::preview_ironquest_story_workbench( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'captain_of_the_yard', $data['mission']['slug'] );
		$this->assertSame( 'pressure_fantasy', $data['promptContext']['storyProfile']['genre'] );
		$this->assertSame( 'trial_lane', $data['promptContext']['encounterSeed']['slug'] );
		$this->assertSame( 3, $data['selectionDiagnostics']['slot_template_count'] );
		$this->assertContains( 'captain_progression_control_01', $data['selectionDiagnostics']['matching_template_ids'] );
		$this->assertSame( 'captain_progression_control_01', $data['coverageReport']['rows'][0]['cells'][0]['template_id'] );
		$this->assertCount( 1, $data['candidateSession']['candidates'] );
		$this->assertSame( 'authored_template', $data['candidateSession']['candidates'][0]['source'] );
		$this->assertSame( 'captain_progression_control_01', $data['candidateSession']['candidates'][0]['template_id'] );
		$this->assertStringContainsString( 'begin taking control of the exchange', strtolower( $data['candidateSession']['candidates'][0]['draft']['summary'] ) );
	}

	public function test_story_workbench_review_and_export_promote_approved_candidate(): void {
		$preview_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-preview' );
		$preview_request->set_param( 'mission_slug', 'captain_of_the_yard' );
		$preview_request->set_param( 'encounter_seed_slug', 'trial_lane' );
		$preview_request->set_param( 'slot', 'set_progression' );
		$preview_request->set_param( 'set_result', 'target_met' );
		$preview_request->set_param( 'stance', 'steady' );

		$preview_response = AdminApiController::preview_ironquest_story_workbench( $preview_request );
		$preview = $preview_response->get_data();

		$review_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-review' );
		$review_request->set_param( 'session_id', $preview['candidateSession']['session_id'] );
		$review_request->set_param( 'candidate_id', $preview['candidateSession']['candidates'][0]['candidate_id'] );
		$review_request->set_param( 'approved', true );

		$review_response = AdminApiController::review_ironquest_story_workbench_candidate( $review_request );
		$review = $review_response->get_data();

		$this->assertSame( 200, $review_response->get_status() );
		$this->assertSame( 'Candidate approved for export.', $review['message'] );
		$this->assertSame( 'approved', $review['candidateSession']['candidates'][0]['status'] );
		$this->assertCount( 1, $review['approvedCandidates'] );

		$export_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-export' );
		$export_request->set_param( 'mission_slug', 'captain_of_the_yard' );
		$export_request->set_param( 'slot', 'set_progression' );

		$export_response = AdminApiController::export_ironquest_story_workbench( $export_request );
		$export = $export_response->get_data();

		$this->assertSame( 200, $export_response->get_status() );
		$this->assertSame( 1, $export['approved_count'] );
		$this->assertSame( 'captain_of_the_yard', $export['export']['mission_slug'] );
		$this->assertSame( 'set_progression', $export['export']['beat_templates'][0]['slot'] );
		$this->assertStringContainsString( 'begin taking control of the exchange', strtolower( $export['export']['beat_templates'][0]['skeleton']['summary'] ) );
	}

	public function test_story_workbench_apply_updates_missions_config_for_slot(): void {
		$missions_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		$original_json = is_string( $missions_path ) ? file_get_contents( $missions_path ) : false;
		$this->assertIsString( $original_json );

		$preview_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-preview' );
		$preview_request->set_param( 'mission_slug', 'captain_of_the_yard' );
		$preview_request->set_param( 'encounter_seed_slug', 'trial_lane' );
		$preview_request->set_param( 'slot', 'set_progression' );
		$preview_request->set_param( 'set_result', 'target_met' );
		$preview_request->set_param( 'stance', 'steady' );

		$preview_response = AdminApiController::preview_ironquest_story_workbench( $preview_request );
		$preview = $preview_response->get_data();

		$review_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-review' );
		$review_request->set_param( 'session_id', $preview['candidateSession']['session_id'] );
		$review_request->set_param( 'candidate_id', $preview['candidateSession']['candidates'][0]['candidate_id'] );
		$review_request->set_param( 'approved', true );
		AdminApiController::review_ironquest_story_workbench_candidate( $review_request );

		try {
			$apply_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-apply' );
			$apply_request->set_param( 'mission_slug', 'captain_of_the_yard' );
			$apply_request->set_param( 'slot', 'set_progression' );

			$apply_response = AdminApiController::apply_ironquest_story_workbench_export( $apply_request );
			$applied = $apply_response->get_data();

			$this->assertSame( 200, $apply_response->get_status() );
			$this->assertSame( 1, $applied['applied_count'] );

			$updated_json = file_get_contents( $missions_path );
			$this->assertIsString( $updated_json );
			$this->assertStringContainsString( 'captain_of_the_yard_set_progression_trial_lane_01', $updated_json );
		} finally {
			file_put_contents( $missions_path, $original_json );
			IronQuestRegistryService::reset_cache();
		}
	}

	public function test_story_workbench_preview_requires_mission_and_slot(): void {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-preview' );

		$response = AdminApiController::preview_ironquest_story_workbench( $request );
		$data = $response->get_data();

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'mission_slug and slot are required.', $data['message'] );
	}

	public function test_story_workbench_bootstrap_upgrades_unsupported_mission_for_preview(): void {
		$missions_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		$original_json = is_string( $missions_path ) ? file_get_contents( $missions_path ) : false;
		$this->assertIsString( $original_json );

		try {
			$bootstrap_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-bootstrap' );
			$bootstrap_request->set_param( 'mission_slug', 'shadows_in_the_streets' );

			$bootstrap_response = AdminApiController::bootstrap_ironquest_story_workbench_mission( $bootstrap_request );
			$bootstrap = $bootstrap_response->get_data();

			$this->assertSame( 200, $bootstrap_response->get_status() );
			$this->assertSame( 'shadows_in_the_streets', $bootstrap['mission_slug'] );
			$this->assertGreaterThanOrEqual( 2, (int) $bootstrap['story_slot_count'] );
			$this->assertGreaterThanOrEqual( 5, (int) $bootstrap['beat_template_count'] );

			$preview_request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-preview' );
			$preview_request->set_param( 'mission_slug', 'shadows_in_the_streets' );
			$preview_request->set_param( 'encounter_seed_slug', 'market_crossroad' );
			$preview_request->set_param( 'slot', 'set_progression' );
			$preview_request->set_param( 'set_result', 'target_met' );
			$preview_request->set_param( 'stance', 'steady' );

			$preview_response = AdminApiController::preview_ironquest_story_workbench( $preview_request );
			$preview = $preview_response->get_data();

			$this->assertSame( 200, $preview_response->get_status() );
			$this->assertSame( 'shadows_in_the_streets', $preview['mission']['slug'] );
			$this->assertNotEmpty( $preview['selectionDiagnostics']['matching_template_ids'] );
			$this->assertCount( 1, $preview['candidateSession']['candidates'] );
		} finally {
			file_put_contents( $missions_path, $original_json );
			IronQuestRegistryService::reset_cache();
		}
	}

	public function test_story_workbench_scene_save_updates_only_scene_brief_fields(): void {
		$missions_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		$original_json = is_string( $missions_path ) ? file_get_contents( $missions_path ) : false;
		$this->assertIsString( $original_json );

		try {
			$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-scene' );
			$request->set_param( 'mission_slug', 'captain_of_the_yard' );
			$request->set_param( 'encounter_seed_slug', 'trial_lane' );
			$request->set_param( 'scene', [
				'scene_brief' => 'The captain drags the whole opening exchange into the trial lane and dares you to break his first read.',
				'player_goal' => 'keep the first exchange from turning into public control for the captain',
				'opponent_pressure' => 'he keeps circling the same weakness and makes the whole yard watch for it',
				'failure_cost' => 'if he exposes you here, everyone sees the road close before you can claim it',
				'setting_detail' => 'banner cloth cracks overhead while the lane empties of every stray sound',
			] );

			$response = AdminApiController::save_ironquest_story_workbench_scene( $request );
			$data = $response->get_data();

			$this->assertSame( 200, $response->get_status() );
			$this->assertSame( 'Scene brief saved to missions.json.', $data['message'] );
			$this->assertSame( 'keep the first exchange from turning into public control for the captain', $data['scene']['player_goal'] );

			$updated_json = file_get_contents( $missions_path );
			$this->assertIsString( $updated_json );
			$this->assertStringContainsString( 'The captain drags the whole opening exchange into the trial lane and dares you to break his first read.', $updated_json );
			$this->assertStringContainsString( 'keep the first exchange from turning into public control for the captain', $updated_json );
		} finally {
			file_put_contents( $missions_path, $original_json );
			IronQuestRegistryService::reset_cache();
		}
	}

	public function test_story_workbench_scene_suggest_returns_ai_fields(): void {
		$captured_payload = null;
		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type ) {
			if ( 'story_workbench_scene_fields' !== $prompt_type ) {
				return $response;
			}

			return [
				'scene_brief' => 'The captain drags the opening exchange into the trial lane and makes the whole yard watch for your first mistake.',
				'player_goal' => 'survive the opening exchange without letting the captain define the pace',
				'opponent_pressure' => 'he keeps pressing the same weakness and forces you to answer it in public',
				'failure_cost' => 'if he breaks you here, the road feels closed before the real push even starts',
				'setting_detail' => 'banner cloth cracks overhead while every voice around the lane drops away',
			];
		}, 10, 2 );

		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type, array $payload ) use ( &$captured_payload ) {
			if ( 'story_workbench_scene_fields' === $prompt_type ) {
				$captured_payload = $payload;
			}

			return $response;
		}, 20, 3 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-scene-suggest' );
		$request->set_param( 'mission_slug', 'captain_of_the_yard' );
		$request->set_param( 'encounter_seed_slug', 'trial_lane' );

		$response = AdminApiController::suggest_ironquest_story_workbench_scene( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'captain_of_the_yard', $data['mission_slug'] );
		$this->assertSame( 'trial_lane', $data['encounter_seed_slug'] );
		$this->assertSame( 'survive the opening exchange without letting the captain define the pace', $data['scene']['player_goal'] );
		$this->assertIsArray( $captured_payload );
		$this->assertSame( 'The Training Grounds', $captured_payload['location']['name'] ?? null );
		$this->assertSame( 'Encouraging, disciplined, lightly heroic', $captured_payload['location']['tone'] ?? null );
		$this->assertSame( 'Pass the first real confidence test and earn the road forward', $captured_payload['mission']['goal'] ?? null );
	}

	public function test_story_workbench_location_save_updates_locations_config(): void {
		$locations_path = IronQuestRegistryService::get_config_file_path( 'locations.json' );
		$original_json = is_string( $locations_path ) ? file_get_contents( $locations_path ) : false;
		$this->assertIsString( $original_json );

		try {
			$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-location' );
			$request->set_param( 'location_slug', 'the_training_grounds' );
			$request->set_param( 'location', [
				'theme' => 'Disciplined beginnings under public scrutiny',
				'tone' => 'Encouraging pressure with visible consequences',
				'story_context' => 'This is where recruits learn that small failures are witnessed and remembered. The training yard should feel like the first place confidence gets tested in public.',
				'ai_theme' => 'open training yard, banners, timber rails, young adventurers under watch',
				'ai_tone' => 'hopeful but exacting',
				'enemy_types' => [ 'drill captains', 'favored trainees', 'training constructs' ],
			] );

			$response = AdminApiController::save_ironquest_story_workbench_location( $request );
			$data = $response->get_data();

			$this->assertSame( 200, $response->get_status() );
			$this->assertSame( 'Location foundation saved to locations.json.', $data['message'] );

			$updated_json = file_get_contents( $locations_path );
			$this->assertIsString( $updated_json );
			$this->assertStringContainsString( 'Disciplined beginnings under public scrutiny', $updated_json );
			$this->assertStringContainsString( 'The training yard should feel like the first place confidence gets tested in public.', $updated_json );
		} finally {
			file_put_contents( $locations_path, $original_json );
			IronQuestRegistryService::reset_cache();
		}
	}

	public function test_story_workbench_location_suggest_returns_ai_fields(): void {
		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type ) {
			if ( 'story_workbench_location_foundation' !== $prompt_type ) {
				return $response;
			}

			return [
				'theme' => 'Disciplined rookie trials in a public yard',
				'tone' => 'Hopeful but exacting',
				'story_context' => 'This location tests confidence where everyone can see it. Early victories should feel earned through discipline rather than chaos.',
				'ai_theme' => 'training banners, chalk lanes, timber rails, early gear',
				'ai_tone' => 'heroic beginnings under scrutiny',
				'enemy_types' => [ 'drill captains', 'sparring partners', 'training constructs' ],
			];
		}, 10, 2 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-location-suggest' );
		$request->set_param( 'location_slug', 'the_training_grounds' );
		$request->set_param( 'mission_slug', 'captain_of_the_yard' );

		$response = AdminApiController::suggest_ironquest_story_workbench_location( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'the_training_grounds', $data['location_slug'] );
		$this->assertSame( 'captain_of_the_yard', $data['mission_slug'] );
		$this->assertSame( 'Disciplined rookie trials in a public yard', $data['location']['theme'] );
		$this->assertSame( [ 'drill captains', 'sparring partners', 'training constructs' ], $data['location']['enemy_types'] );
	}

	public function test_story_workbench_mission_save_updates_missions_config(): void {
		$missions_path = IronQuestRegistryService::get_config_file_path( 'missions.json' );
		$original_json = is_string( $missions_path ) ? file_get_contents( $missions_path ) : false;
		$this->assertIsString( $original_json );

		try {
			$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-mission' );
			$request->set_param( 'mission_slug', 'captain_of_the_yard' );
			$request->set_param( 'mission', [
				'goal' => 'Prove you can hold command when the yard turns fully against you',
				'threat' => 'A captain who turns every hesitation into public proof',
				'narrative' => 'The captain is not trying to beat you quickly. He is trying to show the whole yard exactly where your early confidence breaks.',
				'workout_feel' => 'Short, demanding full-body test under scrutiny',
				'story_profile' => [
					'genre' => 'pressure_trial',
					'voice' => 'clean_direct',
					'pacing' => 'tightening_pressure',
				],
			] );

			$response = AdminApiController::save_ironquest_story_workbench_mission( $request );
			$data = $response->get_data();

			$this->assertSame( 200, $response->get_status() );
			$this->assertSame( 'Mission foundation saved to missions.json.', $data['message'] );

			$updated_json = file_get_contents( $missions_path );
			$this->assertIsString( $updated_json );
			$this->assertStringContainsString( 'Prove you can hold command when the yard turns fully against you', $updated_json );
			$this->assertStringContainsString( 'tightening_pressure', $updated_json );
		} finally {
			file_put_contents( $missions_path, $original_json );
			IronQuestRegistryService::reset_cache();
		}
	}

	public function test_story_workbench_mission_suggest_returns_ai_fields(): void {
		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type ) {
			if ( 'story_workbench_mission_foundation' !== $prompt_type ) {
				return $response;
			}

			return [
				'goal' => 'Hold command long enough to earn the road beyond the yard',
				'threat' => 'A captain who wants your weakness to become public memory',
				'narrative' => 'This mission is a public confidence test, not a private drill. The captain wants the whole yard to see whether you can answer once pressure strips the easy certainty away.',
				'workout_feel' => 'Short, intense test under watch',
				'genre' => 'pressure_trial',
				'voice' => 'clean_direct',
				'pacing' => 'tightening_pressure',
			];
		}, 10, 2 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-mission-suggest' );
		$request->set_param( 'mission_slug', 'captain_of_the_yard' );

		$response = AdminApiController::suggest_ironquest_story_workbench_mission( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'captain_of_the_yard', $data['mission_slug'] );
		$this->assertSame( 'Hold command long enough to earn the road beyond the yard', $data['mission']['goal'] );
		$this->assertSame( 'tightening_pressure', $data['mission']['story_profile']['pacing'] );
	}

	public function test_story_workbench_preview_can_use_scene_brief_ai_generation(): void {
		$captured_payload = null;
		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type, array $payload ) use ( &$captured_payload ) {
			if ( 'story_workbench_branch' !== $prompt_type ) {
				return $response;
			}

			$captured_payload = $payload;

			return [
				'summary' => 'You shut down the captain\'s first clean read and make him chase the pace instead.',
				'follow_up' => 'The whole yard can see the lane stop bending his way.',
				'decision_prompt' => 'Press the opening before he can reset it.',
			];
		}, 10, 3 );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-preview' );
		$request->set_param( 'mission_slug', 'captain_of_the_yard' );
		$request->set_param( 'encounter_seed_slug', 'trial_lane' );
		$request->set_param( 'slot', 'set_progression' );
		$request->set_param( 'set_result', 'target_met' );
		$request->set_param( 'stance', 'steady' );

		$response = AdminApiController::preview_ironquest_story_workbench( $request );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertIsArray( $captured_payload );
		$this->assertStringContainsString( 'trial lane', strtolower( (string) ( $captured_payload['scene']['scene_brief'] ?? '' ) ) );
		$this->assertSame( 'survive the captain\'s first read and keep control of the exchange', $captured_payload['scene']['player_goal'] ?? '' );
		$this->assertSame( 'ai_scene_brief', $data['candidateSession']['candidates'][0]['source'] );
		$this->assertSame( 'You shut down the captain\'s first clean read and make him chase the pace instead.', $data['candidateSession']['candidates'][0]['draft']['summary'] );
	}
}
