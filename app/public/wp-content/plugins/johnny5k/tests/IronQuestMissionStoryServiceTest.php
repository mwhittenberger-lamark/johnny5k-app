<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiPromptService;
use Johnny5k\Services\IronQuestNarrativeService;
use Johnny5k\Services\IronQuestProfileService;
use Johnny5k\Tests\Support\ServiceTestCase;
use WP_Error;

if ( ! defined( 'JF_PLUGIN_DIR' ) ) {
	define( 'JF_PLUGIN_DIR', dirname( __DIR__ ) . '/' );
}

class IronQuestMissionStoryServiceTest extends ServiceTestCase {
	protected function tearDown(): void {
		remove_all_filters( 'johnny5k_ironquest_ai_response' );
		parent::tearDown();
	}

	public function test_get_or_create_story_state_builds_opening_and_choices(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'form_check',
		];
		$this->queueProfileLookups( $user_id, $profile, 8 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'mage',
				'motivation_slug' => 'discipline',
			]
		);

		$run = [
			'id'             => 51,
			'mission_slug'   => 'shadows_in_the_streets',
			'location_slug'  => 'grim_hollow_village',
			'encounter_phase'=> 'intro',
			'status'         => 'active',
		];

		$state = IronQuestNarrativeService::get_or_create_story_state( $user_id, $run );

		$this->assertSame( 51, $state['run_id'] );
		$this->assertSame( 'opening', $state['phase'] );
		$this->assertSame( 'intro', $state['encounter_phase'] );
		$this->assertSame( 'Shadows in the Streets', $state['mission_name'] );
		$this->assertNotSame( '', $state['opening_text'] );
		$this->assertSame( 'What do you do?', $state['decision_prompt'] );
		$this->assertCount( 3, $state['choices'] );
		$this->assertSame( 'opening', $state['transcript'][0]['kind'] );
	}

	public function test_ai_opening_and_choice_outcome_are_used_when_available(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'grim_hollow_village',
			'active_mission_slug'   => 'shadows_in_the_streets',
		];
		$this->queueProfileLookups( $user_id, $profile, 10 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'mage',
				'motivation_slug' => 'discipline',
			]
		);

		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type ) {
			return match ( $prompt_type ) {
				'mission_opening' => [
					'opening_text'      => "Fog folds around the empty lane. A chapel bell rings once, then cuts off.\n\nSomething ahead answers with a wet scrape from the dark.",
					'decision_prompt'   => 'How do you enter the street?',
					'current_situation' => 'The first undead movement is close, but you have not been seen yet.',
				],
				'choice_generation' => [
					'choices' => [
						[ 'tone' => 'aggressive', 'label' => 'Drive straight into the street before the dead can gather.' ],
						[ 'tone' => 'cautious', 'label' => 'Hold the edge of the fog and listen for the nearest threat.' ],
						[ 'tone' => 'creative', 'label' => 'Slip along the ruined wall and look for a side angle.' ],
					],
				],
				'choice_outcome' => [
					'outcome_text'      => "You catch the first shape before it fully turns. For a breath, the street belongs to you.\n\nThat opening is thin, but it is real.",
					'current_situation' => 'You have a narrow lane and the first exchange is yours to press.',
					'decision_prompt'   => 'Push the first encounter before the lane closes.',
				],
				default => $response,
			};
		}, 10, 2 );

		$run = [
			'id'             => 64,
			'mission_slug'   => 'shadows_in_the_streets',
			'location_slug'  => 'grim_hollow_village',
			'encounter_phase'=> 'intro',
			'status'         => 'active',
		];

		$state = IronQuestNarrativeService::get_or_create_story_state( $user_id, $run );
		$this->assertSame( 'How do you enter the street?', $state['decision_prompt'] );
		$this->assertSame( 'The first undead movement is close, but you have not been seen yet.', $state['current_situation'] );
		$this->assertSame( 'Drive straight into the street before the dead can gather.', $state['choices'][0]['label'] );

		$resolved = IronQuestNarrativeService::choose_opening_action( $user_id, $run, 'direct_assault', 'aggressive' );
		$this->assertStringContainsString( 'the street belongs to you', strtolower( $resolved['outcome_text'] ) );
		$this->assertSame( 'You have a narrow lane and the first exchange is yours to press.', $resolved['current_situation'] );
		$this->assertSame( 'Push the first encounter before the lane closes.', $resolved['decision_prompt'] );

		$progressed = IronQuestNarrativeService::advance_story_after_set(
			$user_id,
			$run,
			[
				'event_type'     => 'set_saved',
				'exercise_name'  => 'Bench Press',
				'slot_type'      => 'main',
				'exercise_order' => 1,
				'exercise_count' => 3,
				'set_number'     => 1,
				'sets_total'     => 3,
				'rep_target_min' => 8,
				'rep_target_max' => 10,
				'reps_completed' => 10,
			]
		);

		$this->assertNotSame( '', $progressed['latest_beat'] );
	}

	public function test_set_progression_payload_matches_premium_prompt_contract(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'grim_hollow_village',
			'active_mission_slug'   => 'shadows_in_the_streets',
		];
		$this->queueProfileLookups( $user_id, $profile, 10 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'mage',
				'motivation_slug' => 'discipline',
			]
		);

		$captured_payload = null;
		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type, array $payload ) use ( &$captured_payload ) {
			if ( 'set_progression' !== $prompt_type ) {
				return $response;
			}

			$captured_payload = $payload;

			return [
				'latest_beat'       => 'The lane holds for one more breath while you gather yourself for the next effort.',
				'current_situation' => 'The undead line tightens, but you still have room to drive the next action.',
				'decision_prompt'   => 'Drive the next set before the gap closes.',
			];
		}, 10, 3 );

		$run = [
			'id'                   => 66,
			'mission_slug'         => 'shadows_in_the_streets',
			'location_slug'        => 'grim_hollow_village',
			'encounter_phase'      => 'intro',
			'status'               => 'active',
			'gear_effects'         => [ 'Runed gauntlets steady the bar path' ],
			'ironquest_spell_effects' => [ 'Ember ward hardens your breathing' ],
		];

		IronQuestNarrativeService::choose_opening_action( $user_id, $run, 'steady_approach', 'steady' );
		IronQuestNarrativeService::advance_story_after_set(
			$user_id,
			$run,
			[
				'event_type'     => 'set_saved',
				'exercise_name'  => 'Bench Press',
				'slot_type'      => 'main',
				'exercise_order' => 1,
				'exercise_count' => 3,
				'set_number'     => 1,
				'sets_total'     => 3,
				'rep_target_min' => 8,
				'rep_target_max' => 10,
				'reps_completed' => 7,
				'current_rir'    => 1,
			]
		);

		$this->assertIsArray( $captured_payload );
		$this->assertContains( $captured_payload['mechanics']['roll_band'], [ 'dominant_success', 'strong_success', 'moderate_success', 'low_success', 'struggle', 'failure' ] );
		$this->assertSame( 'near_miss', $captured_payload['mechanics']['set_result'] );
		$this->assertSame( 'close_call', $captured_payload['mechanics']['set_result_detail'] );
		$this->assertSame( 1, $captured_payload['mechanics']['hp_loss_this_set'] );
		$this->assertSame( [ 'Runed gauntlets steady the bar path' ], $captured_payload['mechanics']['gear_effects'] );
		$this->assertSame( [ 'Ember ward hardens your breathing' ], $captured_payload['mechanics']['spell_effects'] );
	}

	public function test_ironquest_mode_instructions_match_premium_system_contract(): void {
		$instructions = $this->invokePrivateStatic( AiPromptService::class, 'get_mode_instructions', [ 'ironquest', [] ] );

		$this->assertStringContainsString( 'Dungeon Master and fitness guide for IronQuest', $instructions );
		$this->assertStringContainsString( 'Make each set feel like a meaningful action', $instructions );
		$this->assertStringContainsString( '30 to 60 second rests', $instructions );
		$this->assertStringContainsString( 'Make the user feel like the hero of the mission', $instructions );
	}

	public function test_ai_failures_fall_back_to_deterministic_story_generation(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'captain_of_the_yard',
		];
		$this->queueProfileLookups( $user_id, $profile, 10 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'warrior',
				'motivation_slug' => 'discipline',
			]
		);

		add_filter( 'johnny5k_ironquest_ai_response', static function ( $response, string $prompt_type ) {
			if ( in_array( $prompt_type, [ 'mission_opening', 'choice_generation', 'choice_outcome', 'set_progression' ], true ) ) {
				return new WP_Error( 'ai_down', 'AI unavailable' );
			}

			return $response;
		}, 10, 2 );

		$run = [
			'id'             => 65,
			'mission_slug'   => 'captain_of_the_yard',
			'location_slug'  => 'the_training_grounds',
			'encounter_phase'=> 'intro',
			'status'         => 'active',
		];

		$state = IronQuestNarrativeService::get_or_create_story_state( $user_id, $run );
		$this->assertSame( 'What do you do?', $state['decision_prompt'] );
		$this->assertCount( 3, $state['choices'] );
		$this->assertStringContainsString( 'captain of the yard', strtolower( $state['opening_text'] ) );

		$resolved = IronQuestNarrativeService::choose_opening_action( $user_id, $run, '', 'aggressive' );
		$this->assertNotSame( '', $resolved['outcome_text'] );
		$this->assertSame( 'Press into the encounter and let the next set decide the pace.', $resolved['decision_prompt'] );
	}

	public function test_choose_opening_action_persists_selected_choice_and_roll(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'form_check',
		];
		$this->queueProfileLookups( $user_id, $profile, 10 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'warrior',
				'motivation_slug' => 'discipline',
			]
		);

		$run = [
			'id'             => 63,
			'mission_slug'   => 'captain_of_the_yard',
			'location_slug'  => 'the_training_grounds',
			'encounter_phase'=> 'intro',
			'status'         => 'active',
		];

		$opening_state = IronQuestNarrativeService::get_or_create_story_state( $user_id, $run );
		$choice_id     = (string) $opening_state['choices'][0]['id'];

		$resolved = IronQuestNarrativeService::choose_opening_action( $user_id, $run, $choice_id, 'aggressive' );

		$this->assertSame( 'encounter', $resolved['phase'] );
		$this->assertSame( 'engaged', $resolved['encounter_phase'] );
		$this->assertSame( 'aggressive', $resolved['stance'] );
		$this->assertSame( $choice_id, $resolved['selected_choice']['id'] );
		$this->assertGreaterThanOrEqual( 1, $resolved['roll']['dice_roll'] );
		$this->assertLessThanOrEqual( 20, $resolved['roll']['dice_roll'] );
		$this->assertNotSame( '', $resolved['outcome_text'] );
		$this->assertSame( 'opening_choice', $resolved['transcript'][1]['kind'] );
		$this->assertSame( 24, $resolved['progress']['percent'] );
	}

	public function test_advance_story_and_complete_story_update_transcript_and_conclusion(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'the_training_grounds',
			'active_mission_slug'   => 'form_check',
		];
		$this->queueProfileLookups( $user_id, $profile, 12 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'rogue',
				'motivation_slug' => 'explore',
			]
		);

		$run = [
			'id'             => 77,
			'mission_slug'   => 'the_necromancer_of_hollow',
			'location_slug'  => 'grim_hollow_village',
			'encounter_phase'=> 'intro',
			'status'         => 'active',
		];

		IronQuestNarrativeService::choose_opening_action( $user_id, $run, '', 'steady' );
		$progressed = IronQuestNarrativeService::advance_story_after_set(
			$user_id,
			$run,
			[
				'event_type'         => 'exercise_completed',
				'exercise_name'      => 'Bench Press',
				'set_number'         => 3,
				'sets_total'         => 3,
				'rep_target_min'     => 8,
				'rep_target_max'     => 10,
				'reps_completed'     => 10,
				'completed_exercise' => true,
			]
		);

		$this->assertSame( 'final_push', $progressed['encounter_phase'] );
		$this->assertSame( 'Bench Press', $progressed['exercise_context']['exercise_name'] );
		$this->assertSame( 'close_combat', $progressed['exercise_context']['encounter_type'] );
		$this->assertContains( $progressed['exercise_context']['set_result'], [ 'push_set', 'target_met' ] );
		$this->assertGreaterThan( 50, $progressed['progress']['percent'] );
		$this->assertSame( 'exercise_transition', $progressed['transcript'][2]['kind'] );

		$completed = IronQuestNarrativeService::complete_story(
			$user_id,
			$run,
			'victory',
			[
				'xp'   => 300,
				'gold' => 40,
			]
		);

		$this->assertSame( 'completed', $completed['phase'] );
		$this->assertSame( 'complete', $completed['encounter_phase'] );
		$this->assertSame( 'victory', $completed['result_band'] );
		$this->assertSame( 100, $completed['progress']['percent'] );
		$this->assertNotSame( '', $completed['conclusion']['summary'] );
		$this->assertStringContainsString( 'The Necromancer falls.', $completed['conclusion']['summary'] );
		$this->assertStringContainsString( 'close-quarters clash', $completed['conclusion']['summary'] );
		$this->assertStringContainsString( '+300 XP', $completed['conclusion']['epilogue'] );
		$this->assertSame( 'mission_complete', $completed['transcript'][3]['kind'] );
	}

	public function test_encounter_classifier_covers_more_lift_families(): void {
		$this->assertSame(
			'burden',
			$this->invokePrivateStatic( IronQuestNarrativeService::class, 'resolve_encounter_type_for_exercise', [ 'Farmer Carry', 'challenge', 'workout' ] )
		);
		$this->assertSame(
			'breach',
			$this->invokePrivateStatic( IronQuestNarrativeService::class, 'resolve_encounter_type_for_exercise', [ 'Sled Push', 'challenge', 'workout' ] )
		);
		$this->assertSame(
			'duel',
			$this->invokePrivateStatic( IronQuestNarrativeService::class, 'resolve_encounter_type_for_exercise', [ 'Cable Lateral Raise', 'accessory', 'workout' ] )
		);
		$this->assertSame(
			'rhythm_trial',
			$this->invokePrivateStatic( IronQuestNarrativeService::class, 'resolve_encounter_type_for_exercise', [ 'Leg Press Machine', 'main', 'workout' ] )
		);
		$this->assertSame(
			'advance',
			$this->invokePrivateStatic( IronQuestNarrativeService::class, 'resolve_encounter_type_for_exercise', [ 'Walking Lunge', 'main', 'workout' ] )
		);
	}

	public function test_encounter_type_prose_branches_for_burden_and_rhythm_trials(): void {
		$state = [
			'enemy' => 'training constructs',
			'roll'  => [ 'roll_band' => 'moderate_success' ],
		];

		$burden_text = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_set_story_text',
			[ $state, 'Farmer Carry', 1, 3, 'target_met', 'set_saved', false, 'burden' ]
		);
		$rhythm_text = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_set_story_text',
			[ $state, 'Leg Press Machine', 1, 3, 'close_call', 'set_saved', false, 'rhythm_trial' ]
		);

		$this->assertStringContainsString( 'load obedient', $burden_text );
		$this->assertStringContainsString( 'machine tempo', $rhythm_text );
		$this->assertNotSame( $burden_text, $rhythm_text );
	}

	public function test_same_exercise_sets_generate_distinct_story_beats(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'grim_hollow_village',
			'active_mission_slug'   => 'shadows_in_the_streets',
		];
		$this->queueProfileLookups( $user_id, $profile, 12 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'mage',
				'motivation_slug' => 'discipline',
			]
		);

		$run = [
			'id'             => 88,
			'mission_slug'   => 'shadows_in_the_streets',
			'location_slug'  => 'grim_hollow_village',
			'encounter_phase'=> 'intro',
			'status'         => 'active',
		];

		IronQuestNarrativeService::choose_opening_action( $user_id, $run, '', 'steady' );
		$first = IronQuestNarrativeService::advance_story_after_set(
			$user_id,
			$run,
			[
				'event_type'      => 'set_saved',
				'exercise_name'   => 'Bench Press',
				'slot_type'       => 'main',
				'exercise_order'  => 1,
				'exercise_count'  => 3,
				'set_number'      => 1,
				'sets_total'      => 3,
				'rep_target_min'  => 8,
				'rep_target_max'  => 10,
				'reps_completed'  => 10,
			]
		);
		$second = IronQuestNarrativeService::advance_story_after_set(
			$user_id,
			$run,
			[
				'event_type'      => 'set_saved',
				'exercise_name'   => 'Bench Press',
				'slot_type'       => 'main',
				'exercise_order'  => 1,
				'exercise_count'  => 3,
				'set_number'      => 2,
				'sets_total'      => 3,
				'rep_target_min'  => 8,
				'rep_target_max'  => 10,
				'reps_completed'  => 10,
			]
		);

		$this->assertNotSame( $first['latest_beat'], $second['latest_beat'] );
		$this->assertStringContainsString( 'first exchange', strtolower( $first['latest_beat'] ) );
		$this->assertStringContainsString( 'set 2', strtolower( $second['latest_beat'] ) );
	}

	public function test_exercise_completion_opens_the_next_encounter_with_new_choices(): void {
		$user_id = 42;
		$profile = [
			'id'                    => 7,
			'user_id'               => $user_id,
			'enabled'               => false,
			'class_slug'            => '',
			'motivation_slug'       => '',
			'level'                 => 1,
			'xp'                    => 0,
			'gold'                  => 0,
			'hp_current'            => 100,
			'hp_max'                => 100,
			'current_location_slug' => 'grim_hollow_village',
			'active_mission_slug'   => 'shadows_in_the_streets',
		];
		$this->queueProfileLookups( $user_id, $profile, 12 );
		IronQuestProfileService::update_identity(
			$user_id,
			[
				'class_slug'      => 'rogue',
				'motivation_slug' => 'discipline',
			]
		);

		$run = [
			'id'             => 91,
			'mission_slug'   => 'shadows_in_the_streets',
			'location_slug'  => 'grim_hollow_village',
			'encounter_phase'=> 'intro',
			'status'         => 'active',
		];

		IronQuestNarrativeService::choose_opening_action( $user_id, $run, '', 'steady' );
		$transitioned = IronQuestNarrativeService::advance_story_after_set(
			$user_id,
			$run,
			[
				'event_type'         => 'exercise_completed',
				'exercise_name'      => 'Bench Press',
				'slot_type'          => 'main',
				'exercise_order'     => 1,
				'exercise_count'     => 3,
				'set_number'         => 3,
				'sets_total'         => 3,
				'rep_target_min'     => 8,
				'rep_target_max'     => 10,
				'reps_completed'     => 10,
				'completed_exercise' => true,
				'has_next_exercise'  => true,
				'next_exercise_name' => 'Incline Press',
				'next_slot_type'     => 'main',
			]
		);

		$this->assertSame( 'opening', $transitioned['phase'] );
		$this->assertSame( 'intro', $transitioned['encounter_phase'] );
		$this->assertSame( 2, $transitioned['encounter_index'] );
		$this->assertSame( [], $transitioned['selected_choice'] );
		$this->assertCount( 3, $transitioned['choices'] );
		$this->assertStringContainsString( 'Incline Press', $transitioned['current_situation'] );
		$this->assertStringContainsString( 'encounter 2 of 3', strtolower( $transitioned['decision_prompt'] ) );
	}

	public function test_opening_and_conclusion_prose_branch_by_encounter_type(): void {
		$location = [
			'name' => 'The Training Grounds',
			'tone' => 'electric',
		];
		$mission = [
			'name' => 'Cargo of Dawn',
			'goal' => 'secure the route',
			'narrative' => '',
		];

		$burden_opening = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_opening_text',
			[ $location, $mission, 'training constructs', 'burden' ]
		);
		$pursuit_opening = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_opening_text',
			[ $location, $mission, 'training constructs', 'pursuit' ]
		);

		$burden_summary = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_fallback_conclusion',
			[ [ 'enemy' => 'training constructs', 'encounter_type' => 'burden' ], $mission, 'victory' ]
		);
		$pursuit_summary = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_fallback_conclusion',
			[ [ 'enemy' => 'training constructs', 'encounter_type' => 'pursuit' ], $mission, 'victory' ]
		);
		$burden_epilogue = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_conclusion_epilogue',
			[ [ 'progress' => [ 'completed_sets' => 6 ], 'encounter_type' => 'burden' ], 'victory', 120, 18 ]
		);
		$pursuit_epilogue = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'build_conclusion_epilogue',
			[ [ 'progress' => [ 'completed_sets' => 6 ], 'encounter_type' => 'pursuit' ], 'victory', 120, 18 ]
		);

		$this->assertStringContainsString( 'burden march', $burden_opening );
		$this->assertStringContainsString( 'posture', $burden_opening );
		$this->assertStringContainsString( 'running pursuit', $pursuit_opening );
		$this->assertStringContainsString( 'route', $pursuit_opening );
		$this->assertStringContainsString( 'burden march', $burden_summary );
		$this->assertStringContainsString( 'carry ugly work', $burden_epilogue );
		$this->assertStringContainsString( 'running pursuit', $pursuit_summary );
		$this->assertStringContainsString( 'own the chase', $pursuit_epilogue );
		$this->assertNotSame( $burden_opening, $pursuit_opening );
		$this->assertNotSame( $burden_summary, $pursuit_summary );
		$this->assertNotSame( $burden_epilogue, $pursuit_epilogue );
	}

	public function test_authored_outcomes_gain_encounter_coda_or_render_placeholders(): void {
		$plain_summary = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'format_authored_conclusion',
			[
				'You secure the crossing.',
				[ 'enemy' => 'ash walkers', 'encounter_type' => 'breach' ],
				[ 'name' => 'Bridge of Cinders', 'goal' => 'secure the crossing' ],
				'victory',
			]
		);
		$token_summary = $this->invokePrivateStatic(
			IronQuestNarrativeService::class,
			'format_authored_conclusion',
			[
				'In {mission_name}, the {encounter_label} finally breaks and you {encounter_objective}.',
				[ 'enemy' => 'ash walkers', 'encounter_type' => 'pursuit' ],
				[ 'name' => 'Bridge of Cinders', 'goal' => 'secure the crossing' ],
				'victory',
			]
		);

		$this->assertStringContainsString( 'You secure the crossing.', $plain_summary );
		$this->assertStringContainsString( 'breach run', $plain_summary );
		$this->assertStringContainsString( 'drive the lane open', $plain_summary );
		$this->assertStringContainsString( 'Bridge of Cinders', $token_summary );
		$this->assertStringContainsString( 'running pursuit', $token_summary );
		$this->assertStringContainsString( 'run the distance before the route can close', $token_summary );
		$this->assertStringNotContainsString( 'The running pursuit stayed on your terms', $token_summary );
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
}