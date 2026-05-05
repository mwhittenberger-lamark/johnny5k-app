<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\IronQuestRegistryService;
use Johnny5k\Services\IronQuestStoryEngineService;
use Johnny5k\Tests\Support\ServiceTestCase;

class IronQuestStoryEngineServiceTest extends ServiceTestCase {
	public function test_registry_normalizes_story_engine_branches_on_mission_payload(): void {
		$normalized = $this->invokePrivateStatic(
			IronQuestRegistryService::class,
			'normalize_mission',
			[
				[
					'slug' => 'captain_of_the_yard',
					'location_slug' => 'the_training_grounds',
					'name' => 'Captain of the Yard',
					'story_profile' => [
						'genre' => 'pressure_fantasy',
						'voice' => 'grounded_heroic',
						'repetition_window' => 9,
						'stance_bias' => [
							'steady' => [ 'control', 'tempo' ],
						],
						'banned_terms' => [ 'bench press' ],
					],
					'story_slots' => [
						'set_progression' => [
							'count_target' => 40,
							'notes' => 'Primary live-mode beat pool',
						],
					],
					'beat_pools' => [
						'verbs' => [
							'control' => [ 'steady', 'anchor' ],
						],
						'reversals' => [ 'The lane turns narrow again.' ],
					],
					'beat_templates' => [
						[
							'id' => 'captain_progression_advance_01',
							'slot' => 'set_progression',
							'tags' => [ 'advance', 'control' ],
							'weight' => 4,
							'conditions' => [
								'set_result' => [ 'moderate_success' ],
							],
							'tokens_required' => [ 'advance_turn', 'enemy_posture' ],
							'skeleton' => [
								'summary' => '{advance_turn}',
								'follow_up' => '{enemy_posture} starts losing the read.',
							],
						],
					],
				]
			]
		);

		$this->assertSame( 'pressure_fantasy', $normalized['story_profile']['genre'] );
		$this->assertSame( 9, $normalized['story_profile']['repetition_window'] );
		$this->assertSame( [ 'control', 'tempo' ], $normalized['story_profile']['stance_bias']['steady'] );
		$this->assertSame( 40, $normalized['story_slots']['set_progression']['count_target'] );
		$this->assertSame( [ 'steady', 'anchor' ], $normalized['beat_pools']['verbs']['control'] );
		$this->assertSame( 'captain_progression_advance_01', $normalized['beat_templates'][0]['id'] );
		$this->assertSame( 'set_progression', $normalized['beat_templates'][0]['slot'] );
		$this->assertSame( [ 'moderate_success' ], $normalized['beat_templates'][0]['conditions']['set_result'] );
	}

	public function test_select_candidate_skips_recent_template_and_picks_matching_alternative(): void {
		$mission = [
			'story_profile' => [
				'repetition_window' => 8,
			],
			'beat_templates' => [
				[
					'id' => 'captain_progression_advance_01',
					'slot' => 'set_progression',
					'tags' => [ 'advance', 'control', 'steady' ],
					'weight' => 4,
					'conditions' => [
						'set_result' => [ 'moderate_success' ],
					],
				],
				[
					'id' => 'captain_progression_advance_02',
					'slot' => 'set_progression',
					'tags' => [ 'advance', 'pressure' ],
					'weight' => 2,
					'conditions' => [
						'set_result' => [ 'moderate_success' ],
					],
				],
			],
		];
		$request = [
			'slot' => 'set_progression',
			'set_result' => 'moderate_success',
			'stance' => 'steady',
			'recent_template_ids' => [ 'captain_progression_advance_01' ],
			'recent_tags' => [ 'control' ],
		];

		$selected = IronQuestStoryEngineService::select_candidate( $mission, $request );

		$this->assertIsArray( $selected );
		$this->assertSame( 'captain_progression_advance_02', $selected['id'] );
	}

	public function test_select_candidate_uses_stance_bias_and_slot_pacing_to_break_ties(): void {
		$mission = [
			'story_profile' => [
				'repetition_window' => 6,
				'stance_bias' => [
					'steady' => [ 'control' ],
				],
			],
			'story_slots' => [
				'set_progression' => [
					'count_target' => 3,
				],
			],
			'beat_templates' => [
				[
					'id' => 'captain_progression_control_01',
					'slot' => 'set_progression',
					'tags' => [ 'control' ],
					'weight' => 2,
					'conditions' => [
						'set_result' => [ 'target_met' ],
					],
				],
				[
					'id' => 'captain_progression_crisis_01',
					'slot' => 'set_progression',
					'tags' => [ 'crisis', 'defiance' ],
					'weight' => 2,
					'conditions' => [
						'set_result' => [ 'target_met' ],
					],
				],
			],
		];

		$early = IronQuestStoryEngineService::select_candidate(
			$mission,
			[
				'slot' => 'set_progression',
				'set_result' => 'target_met',
				'stance' => 'steady',
				'stage' => 'opening',
				'tension' => 'controlled',
			],
			[
				'story_engine' => [
					'slot_counts' => [ 'set_progression' => 0 ],
				],
			]
		);
		$late = IronQuestStoryEngineService::select_candidate(
			$mission,
			[
				'slot' => 'set_progression',
				'set_result' => 'target_met',
				'stance' => 'steady',
				'stage' => 'closing',
				'tension' => 'critical',
			],
			[
				'story_engine' => [
					'slot_counts' => [ 'set_progression' => 2 ],
				],
			]
		);

		$this->assertIsArray( $early );
		$this->assertIsArray( $late );
		$this->assertSame( 'captain_progression_control_01', $early['id'] );
		$this->assertSame( 'captain_progression_crisis_01', $late['id'] );
	}

	public function test_render_candidate_and_record_selection_capture_story_engine_state(): void {
		$candidate = [
			'id' => 'captain_progression_advance_01',
			'slot' => 'set_progression',
			'tags' => [ 'advance', 'control', 'steady' ],
			'selection_score' => 42,
			'tokens_required' => [ 'advance_turn', 'enemy_posture' ],
			'skeleton' => [
				'summary' => '{advance_turn}',
				'follow_up' => '{enemy_posture} starts losing the clean read he wanted.',
				'decision_prompt' => 'Press the next exchange before he settles the lane again.',
			],
		];
		$encounter_seed = [
			'slug' => 'trial_lane',
			'advance_turn' => 'the lane starts feeling like your test to administer, not his',
			'enemy_posture' => 'the captain prowls just off-center, testing range without ever committing first',
		];
		$story_state = [
			'run_id' => 51,
			'encounter_seed' => [ 'slug' => 'trial_lane' ],
			'story_profile' => [ 'repetition_window' => 8 ],
			'story_engine' => [
				'recent_template_ids' => [ 'captain_opening_01' ],
				'recent_tags' => [ 'scrutiny' ],
				'recent_phrases' => [ 'The whole yard is already choosing what to believe.' ],
				'slot_counts' => [ 'opening_scene' => 1 ],
			],
		];

		$rendered = IronQuestStoryEngineService::render_candidate( $candidate, $encounter_seed );

		$this->assertSame( 'captain_progression_advance_01', $rendered['template_id'] );
		$this->assertSame( 'the lane starts feeling like your test to administer, not his', $rendered['draft']['summary'] );
		$this->assertSame( 'the captain prowls just off-center, testing range without ever committing first', $rendered['rendered_tokens']['enemy_posture'] );

		$updated_state = IronQuestStoryEngineService::record_selection( $story_state, $candidate, $rendered );

		$this->assertSame(
			[ 'captain_progression_advance_01', 'captain_opening_01' ],
			$updated_state['story_engine']['recent_template_ids']
		);
		$this->assertSame( 1, $updated_state['story_engine']['slot_counts']['opening_scene'] );
		$this->assertSame( 1, $updated_state['story_engine']['slot_counts']['set_progression'] );
		$this->assertSame( 'captain_progression_advance_01', $updated_state['story_engine']['last_selected']['template_id'] );
		$this->assertSame( 'trial_lane', $updated_state['story_engine']['last_selected']['encounter_seed_slug'] );
	}

	public function test_render_candidate_strips_banned_terms_from_draft_copy(): void {
		$rendered = IronQuestStoryEngineService::render_candidate(
			[
				'id' => 'captain_progression_advance_01',
				'slot' => 'set_progression',
				'skeleton' => [
					'summary' => 'Bench press form breaks the lane open.',
					'follow_up' => 'The rep count is all the captain can read.',
					'decision_prompt' => 'Leave the bench press behind.',
				],
			],
			[],
			[],
			[
				'banned_terms' => [ 'bench press', 'rep' ],
			]
		);

		$this->assertStringNotContainsStringIgnoringCase( 'bench press', $rendered['draft']['summary'] );
		$this->assertStringNotContainsStringIgnoringCase( 'rep', $rendered['draft']['follow_up'] );
		$this->assertStringNotContainsStringIgnoringCase( 'bench press', $rendered['draft']['decision_prompt'] );
	}
}
