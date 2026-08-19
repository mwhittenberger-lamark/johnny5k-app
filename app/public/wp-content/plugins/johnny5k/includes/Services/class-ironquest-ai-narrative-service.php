<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestAiNarrativeService {
	public static function build_story_workbench_location_foundation( int $user_id, array $location, array $mission = [] ) {
		$payload = [
			'location' => self::normalize_location_for_prompt( $location ),
			'mission' => [
				'name' => sanitize_text_field( (string) ( $mission['name'] ?? '' ) ),
				'goal' => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
				'threat' => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
				'narrative' => sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) ),
			],
		];

		$response = self::request_json( $user_id, 'story_workbench_location_foundation', $payload, [
			'ironquest_prompt_type' => 'story_workbench_location_foundation',
			'ironquest_location' => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission' => (string) ( $mission['slug'] ?? '' ),
		] );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = (array) ( $response['data'] ?? [] );

		return [
			'theme' => sanitize_text_field( (string) ( $data['theme'] ?? '' ) ),
			'tone' => sanitize_text_field( (string) ( $data['tone'] ?? '' ) ),
			'story_context' => sanitize_textarea_field( (string) ( $data['story_context'] ?? '' ) ),
			'ai_theme' => sanitize_text_field( (string) ( $data['ai_theme'] ?? '' ) ),
			'ai_tone' => sanitize_text_field( (string) ( $data['ai_tone'] ?? '' ) ),
			'enemy_types' => self::sanitize_prompt_list( (array) ( $data['enemy_types'] ?? [] ) ),
			'debug_prompt' => sanitize_textarea_field( (string) ( $response['user_prompt'] ?? '' ) ),
		];
	}

	public static function build_story_workbench_mission_foundation( int $user_id, array $location, array $mission ) {
		$payload = [
			'location' => self::normalize_location_for_prompt( $location ),
			'mission' => [
				'name' => sanitize_text_field( (string) ( $mission['name'] ?? 'Mission' ) ),
				'goal' => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
				'threat' => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
				'narrative' => sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) ),
				'workout_feel' => sanitize_text_field( (string) ( $mission['workout_feel'] ?? '' ) ),
				'genre' => sanitize_key( (string) ( $mission['story_profile']['genre'] ?? '' ) ),
				'voice' => sanitize_key( (string) ( $mission['story_profile']['voice'] ?? '' ) ),
				'pacing' => sanitize_key( (string) ( $mission['story_profile']['pacing'] ?? '' ) ),
			],
		];

		$response = self::request_json( $user_id, 'story_workbench_mission_foundation', $payload, [
			'ironquest_prompt_type' => 'story_workbench_mission_foundation',
			'ironquest_location' => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission' => (string) ( $mission['slug'] ?? '' ),
		] );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = (array) ( $response['data'] ?? [] );

		return [
			'goal' => sanitize_text_field( (string) ( $data['goal'] ?? '' ) ),
			'threat' => sanitize_text_field( (string) ( $data['threat'] ?? '' ) ),
			'narrative' => sanitize_textarea_field( (string) ( $data['narrative'] ?? '' ) ),
			'workout_feel' => sanitize_text_field( (string) ( $data['workout_feel'] ?? '' ) ),
			'story_profile' => [
				'genre' => sanitize_key( (string) ( $data['genre'] ?? '' ) ),
				'voice' => sanitize_key( (string) ( $data['voice'] ?? '' ) ),
				'pacing' => sanitize_key( (string) ( $data['pacing'] ?? '' ) ),
			],
			'debug_prompt' => sanitize_textarea_field( (string) ( $response['user_prompt'] ?? '' ) ),
		];
	}

	public static function build_story_workbench_scene_fields( int $user_id, array $mission, array $encounter_seed ) {
		$normalized_scene = self::normalize_encounter_seed_for_prompt( $encounter_seed );
		$location = IronQuestRegistryService::get_location( (string) ( $mission['location_slug'] ?? '' ) ) ?? [];
		$payload = [
			'location' => self::normalize_location_for_prompt( $location ),
			'mission' => [
				'slug' => sanitize_key( (string) ( $mission['slug'] ?? '' ) ),
				'name' => sanitize_text_field( (string) ( $mission['name'] ?? 'Mission' ) ),
				'goal' => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
				'threat' => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
				'narrative' => sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) ),
				'workout_feel' => sanitize_text_field( (string) ( $mission['workout_feel'] ?? '' ) ),
				'location_slug' => sanitize_key( (string) ( $mission['location_slug'] ?? '' ) ),
				'genre' => sanitize_key( (string) ( $mission['story_profile']['genre'] ?? '' ) ),
				'voice' => sanitize_key( (string) ( $mission['story_profile']['voice'] ?? '' ) ),
				'pacing' => sanitize_key( (string) ( $mission['story_profile']['pacing'] ?? '' ) ),
			],
			'scene' => $normalized_scene,
		];

		$response = self::request_json( $user_id, 'story_workbench_scene_fields', $payload, [
			'ironquest_prompt_type' => 'story_workbench_scene_fields',
			'ironquest_location' => (string) ( $mission['location_slug'] ?? '' ),
			'ironquest_mission' => (string) ( $mission['slug'] ?? '' ),
		] );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = (array) ( $response['data'] ?? [] );

		return [
			'scene_brief' => sanitize_textarea_field( (string) ( $data['scene_brief'] ?? '' ) ),
			'player_goal' => sanitize_textarea_field( (string) ( $data['player_goal'] ?? '' ) ),
			'opponent_pressure' => sanitize_textarea_field( (string) ( $data['opponent_pressure'] ?? '' ) ),
			'failure_cost' => sanitize_textarea_field( (string) ( $data['failure_cost'] ?? '' ) ),
			'setting_detail' => sanitize_textarea_field( (string) ( $data['setting_detail'] ?? '' ) ),
			'debug_prompt' => sanitize_textarea_field( (string) ( $response['user_prompt'] ?? '' ) ),
		];
	}

	public static function build_story_workbench_branch_preview( int $user_id, array $mission, array $encounter_seed, array $filters, array $draft = [], array $template = [] ) {
		$location = IronQuestRegistryService::get_location( (string) ( $mission['location_slug'] ?? '' ) ) ?? [];
		$payload = [
			'location' => self::normalize_location_for_prompt( $location ),
			'mission' => [
				'name' => sanitize_text_field( (string) ( $mission['name'] ?? 'Mission' ) ),
				'goal' => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
				'threat' => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
				'narrative' => sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) ),
				'location_slug' => sanitize_key( (string) ( $mission['location_slug'] ?? '' ) ),
				'genre' => sanitize_key( (string) ( $mission['story_profile']['genre'] ?? '' ) ),
				'voice' => sanitize_key( (string) ( $mission['story_profile']['voice'] ?? '' ) ),
				'pacing' => sanitize_key( (string) ( $mission['story_profile']['pacing'] ?? '' ) ),
			],
			'scene' => self::normalize_encounter_seed_for_prompt( $encounter_seed ),
			'branch' => [
				'slot' => sanitize_key( (string) ( $filters['slot'] ?? '' ) ),
				'set_result' => sanitize_key( (string) ( $filters['set_result'] ?? '' ) ),
				'stance' => sanitize_key( (string) ( $filters['stance'] ?? '' ) ),
				'stage' => sanitize_key( (string) ( $filters['stage'] ?? '' ) ),
				'tension' => sanitize_key( (string) ( $filters['tension'] ?? '' ) ),
				'progress_phase' => sanitize_key( (string) ( $filters['progress_phase'] ?? '' ) ),
				'result_band' => sanitize_key( (string) ( $filters['result_band'] ?? '' ) ),
			],
			'authored_template' => [
				'id' => sanitize_key( (string) ( $template['id'] ?? '' ) ),
				'tags' => array_values( array_filter( array_map( 'sanitize_key', (array) ( $template['tags'] ?? [] ) ) ) ),
				'draft' => self::filter_story_struct_keys(
					$draft,
					[ 'summary', 'follow_up', 'decision_prompt' ]
				),
			],
		];

		$response = self::request_json( $user_id, 'story_workbench_branch', $payload, [
			'ironquest_prompt_type' => 'story_workbench_branch',
			'ironquest_location' => (string) ( $mission['location_slug'] ?? '' ),
			'ironquest_mission' => (string) ( $mission['slug'] ?? '' ),
		] );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = (array) ( $response['data'] ?? [] );

		return [
			'summary' => sanitize_textarea_field( (string) ( $data['summary'] ?? '' ) ),
			'follow_up' => sanitize_textarea_field( (string) ( $data['follow_up'] ?? '' ) ),
			'decision_prompt' => sanitize_text_field( (string) ( $data['decision_prompt'] ?? '' ) ),
			'debug_prompt' => sanitize_textarea_field( (string) ( $response['user_prompt'] ?? '' ) ),
		];
	}

	public static function build_opening_bundle( int $user_id, array $run, array $profile, array $location, array $mission, string $enemy, string $encounter_type, array $encounter_seed = [], array $scene_state = [] ): array {
		$opening_payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => '',
				'exercise_order' => 1,
				'encounter_type' => $encounter_type,
			],
			[
				'enemy'          => $enemy,
				'tension'        => 'rising',
				'encounter_seed' => $encounter_seed,
				'scene_state'    => $scene_state,
			],
			[],
			[
				'run' => [
					'id'       => (int) ( $run['id'] ?? 0 ),
					'run_type' => sanitize_key( (string) ( $run['run_type'] ?? '' ) ),
				],
			]
		);

		$opening = self::request_json( $user_id, 'mission_opening', $opening_payload, [
			'ironquest_prompt_type' => 'mission_opening',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

			$opening_data = is_wp_error( $opening ) ? [] : (array) ( $opening['data'] ?? [] );
			$opening_prompt = is_wp_error( $opening ) ? '' : (string) ( $opening['user_prompt'] ?? '' );
			$current_situation = sanitize_textarea_field( (string) ( $opening_data['current_situation'] ?? '' ) );

		$choice_payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => '',
				'exercise_order' => 1,
				'encounter_type' => $encounter_type,
			],
			[
				'current_situation' => $current_situation,
				'enemy'             => $enemy,
				'tension'           => 'rising',
				'encounter_seed'    => $encounter_seed,
				'scene_state'       => $scene_state,
			],
			[]
		);

		$choices = self::request_json( $user_id, 'choice_generation', $choice_payload, [
			'ironquest_prompt_type' => 'choice_generation',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

			return [
				'opening_text'      => sanitize_textarea_field( (string) ( $opening_data['opening_text'] ?? '' ) ),
				'decision_prompt'   => sanitize_text_field( (string) ( $opening_data['decision_prompt'] ?? '' ) ),
				'current_situation' => $current_situation,
				'choices'           => self::sanitize_choices( is_wp_error( $choices ) ? [] : (array) ( $choices['data']['choices'] ?? [] ) ),
				'debug_prompt'      => sanitize_textarea_field( $opening_prompt ),
			];
		}

	public static function build_choice_outcome( int $user_id, array $profile, array $location, array $mission, array $state, array $choice, array $roll ): array {
		$payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => (string) ( $state['exercise_context']['exercise_name'] ?? '' ),
				'exercise_order' => (int) ( $state['exercise_context']['exercise_order'] ?? max( 1, (int) ( $state['encounter_index'] ?? 1 ) ) ),
				'encounter_type' => (string) ( $state['encounter_type'] ?? 'skirmish' ),
				'sets_total'     => (int) ( $state['exercise_context']['sets_total'] ?? 0 ),
				'set_number'     => (int) ( $state['exercise_context']['set_number'] ?? 0 ),
			],
			[
				'opening_choice'    => (string) ( $choice['label'] ?? '' ),
				'current_situation' => (string) ( $state['current_situation'] ?? '' ),
				'enemy'             => (string) ( $state['enemy'] ?? '' ),
				'tension'           => (string) ( $state['tension'] ?? 'rising' ),
				'encounter_seed'    => (array) ( $state['encounter_seed'] ?? [] ),
				'scene_state'       => (array) ( $state['scene_state'] ?? [] ),
			],
			[
				'dice_roll'            => (int) ( $roll['dice_roll'] ?? 0 ),
				'roll_modifiers_total' => (int) ( $roll['roll_modifiers_total'] ?? 0 ),
				'roll_final'           => (int) ( $roll['roll_final'] ?? 0 ),
				'roll_band'            => (string) ( $roll['roll_band'] ?? '' ),
			]
		);

		$response = self::request_json( $user_id, 'choice_outcome', $payload, [
			'ironquest_prompt_type' => 'choice_outcome',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

		if ( is_wp_error( $response ) ) {
			return [];
		}

		$data = (array) ( $response['data'] ?? [] );

			return [
				'outcome_text'      => sanitize_textarea_field( (string) ( $data['outcome_text'] ?? '' ) ),
				'current_situation' => sanitize_textarea_field( (string) ( $data['current_situation'] ?? '' ) ),
				'decision_prompt'   => sanitize_text_field( (string) ( $data['decision_prompt'] ?? '' ) ),
				'debug_prompt'      => sanitize_textarea_field( (string) ( $response['user_prompt'] ?? '' ) ),
			];
		}

	public static function build_conclusion_summary( int $user_id, array $profile, array $location, array $mission, array $state, string $result_band ): array {
		$payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => (string) ( $state['exercise_context']['exercise_name'] ?? '' ),
				'exercise_order' => (int) ( $state['exercise_context']['exercise_order'] ?? 0 ),
				'encounter_type' => (string) ( $state['encounter_type'] ?? 'skirmish' ),
				'sets_total'     => (int) ( $state['exercise_context']['sets_total'] ?? 0 ),
				'set_number'     => (int) ( $state['exercise_context']['set_number'] ?? 0 ),
			],
			[
				'opening_choice'    => (string) ( $state['opening_choice'] ?? '' ),
				'current_situation' => (string) ( $state['current_situation'] ?? '' ),
				'enemy'             => (string) ( $state['enemy'] ?? '' ),
				'tension'           => (string) ( $state['tension'] ?? 'rising' ),
				'encounter_seed'    => (array) ( $state['encounter_seed'] ?? [] ),
				'scene_state'       => (array) ( $state['scene_state'] ?? [] ),
			],
			[
				'roll_band'   => (string) ( $state['roll']['roll_band'] ?? '' ),
				'result_band' => $result_band,
			]
		);

		$response = self::request_json( $user_id, 'mission_conclusion', $payload, [
			'ironquest_prompt_type' => 'mission_conclusion',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

		if ( is_wp_error( $response ) ) {
			return [];
		}

			return [
				'summary' => sanitize_textarea_field( (string) ( $response['data']['summary'] ?? '' ) ),
				'debug_prompt' => sanitize_textarea_field( (string) ( $response['user_prompt'] ?? '' ) ),
			];
		}

	private static function request_json( int $user_id, string $prompt_type, array $payload, array $context_overrides = [] ) {
		$user_prompt = self::build_user_prompt( $prompt_type, $payload );
		$filtered = apply_filters( 'johnny5k_ironquest_ai_response', null, $prompt_type, $payload, $context_overrides, $user_id );
		if ( $filtered instanceof \WP_Error ) {
			return $filtered;
		}

		if ( is_array( $filtered ) ) {
			return [
				'data'        => $filtered,
				'user_prompt' => $user_prompt,
			];
		}

		$response = AiService::preview_json(
			$user_id,
			$user_prompt,
			'ironquest',
			$context_overrides,
			AiService::ironquest_model()
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response['user_prompt'] = $user_prompt;

		return $response;
	}

	private static function build_shared_payload( array $profile, array $location, array $mission, array $encounter, array $story_state, array $mechanics = [], array $extras = [] ): array {
		$anchor = is_array( $location['ai_prompt_anchor'] ?? null ) ? $location['ai_prompt_anchor'] : [];

		return array_merge(
			[
				'user' => [
					'class'      => self::humanize_slug( (string) ( $profile['class_slug'] ?? 'hero' ) ),
					'subclass'   => self::humanize_slug( (string) ( $profile['subclass_slug'] ?? '' ) ),
					'level'      => max( 1, (int) ( $profile['level'] ?? 1 ) ),
					'hp_current' => max( 0, (int) ( $profile['hp_current'] ?? 0 ) ),
					'hp_max'     => max( 0, (int) ( $profile['hp_max'] ?? 0 ) ),
				],
				'mission' => [
					'name'      => sanitize_text_field( (string) ( $mission['name'] ?? 'Mission' ) ),
					'location'  => sanitize_text_field( (string) ( $location['name'] ?? 'Unknown' ) ),
					'theme'     => sanitize_text_field( (string) ( $anchor['theme'] ?? $location['theme'] ?? '' ) ),
					'tone'      => sanitize_text_field( (string) ( $anchor['tone'] ?? $location['tone'] ?? '' ) ),
					'objective' => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
					'threat'    => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
					'narrative' => sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) ),
				],
				'encounter' => [
					'exercise_name'  => sanitize_text_field( (string) ( $encounter['exercise_name'] ?? '' ) ),
					'exercise_order' => max( 0, (int) ( $encounter['exercise_order'] ?? 0 ) ),
					'exercise_count' => max( 0, (int) ( $encounter['exercise_count'] ?? 0 ) ),
					'encounter_type' => self::humanize_encounter_type( (string) ( $encounter['encounter_type'] ?? '' ) ),
					'sets_total'     => max( 0, (int) ( $encounter['sets_total'] ?? 0 ) ),
					'set_number'     => max( 0, (int) ( $encounter['set_number'] ?? 0 ) ),
				],
				'story_state' => [
					'opening_choice'    => sanitize_text_field( (string) ( $story_state['opening_choice'] ?? '' ) ),
					'current_situation' => sanitize_textarea_field( (string) ( $story_state['current_situation'] ?? '' ) ),
					'enemy'             => sanitize_text_field( (string) ( $story_state['enemy'] ?? '' ) ),
					'tension'           => sanitize_key( (string) ( $story_state['tension'] ?? 'rising' ) ),
				],
				'encounter_seed' => self::normalize_encounter_seed_for_prompt( (array) ( $story_state['encounter_seed'] ?? [] ) ),
				'scene_state'    => self::sanitize_story_struct( (array) ( $story_state['scene_state'] ?? [] ) ),
				'mechanics' => self::sanitize_mechanics( $mechanics ),
			],
			$extras
		);
	}

	private static function build_story_engine_payload_branch( array $story_engine_draft, array $story_engine_template ): array {
		return [
			'draft' => self::filter_story_struct_keys(
				$story_engine_draft,
				[ 'summary', 'follow_up', 'decision_prompt' ]
			),
			'template' => self::filter_story_struct_keys(
				$story_engine_template,
				[ 'id', 'slot' ]
			) + [
				'tags' => array_values(
					array_filter(
						array_map(
							static fn( $tag ): string => sanitize_key( (string) $tag ),
							(array) ( $story_engine_template['tags'] ?? [] )
						)
					)
				),
			],
		];
	}

	private static function filter_story_struct_keys( array $data, array $allowed_keys ): array {
		$allowed = array_fill_keys( $allowed_keys, true );

		return self::sanitize_story_struct(
			array_intersect_key( $data, $allowed )
		);
	}

	private static function sanitize_story_struct( array $data ): array {
		$clean = [];

		foreach ( $data as $key => $value ) {
			if ( is_array( $value ) ) {
				continue;
			}

			if ( is_numeric( $value ) ) {
				$clean[ $key ] = $value + 0;
				continue;
			}

			$clean[ $key ] = sanitize_text_field( (string) $value );
		}

		return $clean;
	}

	private static function sanitize_mechanics( array $mechanics ): array {
		$clean = [];
		foreach ( $mechanics as $key => $value ) {
			if ( is_array( $value ) ) {
				$clean[ $key ] = array_values( array_map( static function( $item ) {
					return is_scalar( $item ) ? sanitize_text_field( (string) $item ) : '';
				}, $value ) );
				continue;
			}

			if ( is_numeric( $value ) ) {
				$clean[ $key ] = $value + 0;
				continue;
			}

			$clean[ $key ] = sanitize_text_field( (string) $value );
		}

		return $clean;
	}

	private static function build_user_prompt( string $prompt_type, array $payload ): string {
		$payload_json = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		return match ( $prompt_type ) {
				'mission_opening' => "Generate the opening scene for an IronQuest mission. Return only valid JSON with this exact shape: {\"opening_text\":\"\",\"decision_prompt\":\"\",\"current_situation\":\"\"}. opening_text must be 2 short paragraphs maximum. Introduce the setting, immediate tension, and a clear problem. Do not resolve the scene yet. Treat encounter_seed.scene_brief as the clearest source of scene meaning when it is present, and use encounter_seed.player_goal, encounter_seed.opponent_pressure, encounter_seed.failure_cost, and encounter_seed.setting_detail to keep the narration plain and concrete. Reuse the exact landmark and threat from the payload instead of inventing a new location. decision_prompt must be one short in-world line inviting action. current_situation must be one concise sentence describing the immediate tactical problem using the same landmark or hazard.\n\nInput JSON:\n{$payload_json}",
				'choice_generation' => "Generate 3 distinct player action choices for the current IronQuest story moment. Return only valid JSON with this exact shape: {\"choices\":[{\"tone\":\"aggressive\",\"label\":\"\"},{\"tone\":\"cautious\",\"label\":\"\"},{\"tone\":\"creative\",\"label\":\"\"}]}. Provide exactly 3 options. Each label must be short and meaningfully different. Make them feel like three different tactics for this exact landmark, hazard, stakes, and threat. Avoid repeating the same force, wait, trick pattern unless the scene clearly supports it. Use the tone field as metadata only; assign aggressive, cautious, and creative to the option that best fits each tactic, but prioritize scene-specific action over formula. Base the options on encounter_seed.objective, encounter_seed.landmark, encounter_seed.hazard, encounter_seed.stakes, encounter_seed.enemy_posture, and story_state.current_situation.\n\nInput JSON:\n{$payload_json}",
				'choice_outcome' => "Generate the immediate story outcome of the player's action in IronQuest. Return only valid JSON with this exact shape: {\"outcome_text\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. outcome_text must be 2 short paragraphs maximum. Reflect the roll band clearly without mentioning numbers or dice. High bands should show advantage. Middle bands should show partial success and danger. Low bands should show a setback or loss of control. Keep continuity with the same scene meaning, landmark, hazard, and failure cost from encounter_seed and scene_state. When encounter_seed.scene_brief is present, use it as the clearest description of what this scene is about. current_situation must describe the updated tactical state in one sentence using the same scene anchors. decision_prompt must be one short in-world line that cues the next move.\n\nInput JSON:\n{$payload_json}",
				'set_progression' => "Generate a short rest-time story beat for IronQuest after a completed set. Return only valid JSON with this exact shape: {\"latest_beat\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. latest_beat must be 1 or 2 short paragraphs. Keep it concise and vivid for a 30 to 60 second rest. The story should react to the completed set. Better set performance should shift the scene toward the player. Worse set performance should increase danger or pressure. Reflect mechanics.set_result, mechanics.roll_band, mechanics.hp_loss_this_set, mechanics.gear_effects, mechanics.spell_effects, and mechanics.strain when present. Maintain continuity with the same encounter using encounter_seed, scene_state, and story_state.current_situation. Treat encounter_seed.scene_brief as the plain-language description of the scene when it is present. Use encounter_seed.player_goal, encounter_seed.opponent_pressure, encounter_seed.failure_cost, encounter_seed.setting_detail, encounter_seed.landmark, encounter_seed.hazard, and scene_state.stakes_now to keep the beat concrete. When story_engine.draft.summary, story_engine.draft.follow_up, or story_engine.draft.decision_prompt are present, treat them as authored continuity notes: clarify them into clean player-facing narration, preserve their scene direction, and stay close to their intent instead of inventing a different moment. Use story_engine.template.id and story_engine.template.tags only as support for tone and variation, not as text to quote. If encounter.set_number equals encounter.sets_total, make it feel like a turning point. Match the brevity and concreteness of these examples, but do not copy their content. Example strong beat: \"The crossroad opens for a breath. Then more dead press through the fog between the stalls and the gap starts to close again. Pain catches under your ribs as you brace for the next answer.\" Example strained beat: \"For one breath, the market crossroad is yours. Then more dead push through the fog between the stalls and the opening starts to close again. A sharp ache under your ribs reminds you how little margin you have left.\" Never mention literal exercise names, movement names, reps, set numbers, calculations, dice, JSON, app logic, or modern gym language in the story text. current_situation must be one sentence describing the immediate danger heading into the next effort using the same landmark or stakes. decision_prompt must be one short line that cues the next push and does not create a new choice menu.\n\nInput JSON:\n{$payload_json}",
				'exercise_transition' => "Generate the encounter transition for IronQuest after one encounter closes and the next one forms. Return only valid JSON with this exact shape: {\"latest_beat\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. latest_beat must be 1 or 2 short paragraphs. Show what the completed encounter achieved before pointing toward the next encounter. Use the current encounter_seed and next_encounter.encounter_seed so the transition names what was secured, what landmark or prop is now behind the player, what new landmark is ahead, what stakes are now immediate, and what enemy pressure is forming next. Keep it in the same adventure space instead of jumping to a disconnected image. When story_engine.draft.summary, story_engine.draft.follow_up, or story_engine.draft.decision_prompt are present, treat them as the authored continuity anchor for the transition: polish them, preserve their direction, and stay close to their scene logic instead of inventing a different bridge. Use story_engine.template.id and story_engine.template.tags only as support metadata for tone and variation. current_situation must be one sentence describing the immediate danger or setup around the next encounter using the new landmark, hazard, or stakes. decision_prompt must be one short line inviting the player to choose how they enter the next encounter.\n\nInput JSON:\n{$payload_json}",
				'mission_conclusion' => "Generate the mission conclusion for IronQuest. Return only valid JSON with this exact shape: {\"summary\":\"\"}. summary must be 2 short paragraphs maximum. Resolve the immediate story of the mission. Reflect the result band, the enemy pressure, and the player's earned outcome. Use the mission threat plus the most important scene anchors from encounter_seed and scene_state so the ending still feels tied to the same place and stakes. If the result is partial, leave some tension unresolved. Keep it vivid and earned.\n\nInput JSON:\n{$payload_json}",
				'story_workbench_branch' => "Generate a player-facing IronQuest story branch preview for the admin workbench. Return only valid JSON with this exact shape: {\"summary\":\"\",\"follow_up\":\"\",\"decision_prompt\":\"\"}. summary and follow_up must each be one short sentence. decision_prompt must be one short in-world line. Treat scene.scene_brief as the source-of-truth description of the scene when it is present. Use scene.player_goal, scene.opponent_pressure, scene.failure_cost, and scene.setting_detail to keep the writing concrete and easy to understand. Use location.name, location.theme, location.tone, location.story_context, and mission.narrative to keep the branch specific to this place and mission instead of sounding generic. Adapt the tone and pressure to branch.set_result, branch.stance, branch.stage, branch.tension, and branch.progress_phase. If authored_template.draft.summary, follow_up, or decision_prompt are present, treat them as rough notes to clarify into clean player-facing narration rather than copying vague metaphors. Keep the scene anchored to scene.landmark or scene.setting_detail. Never mention exercise mechanics, template ids, JSON, app logic, or admin concepts.\n\nInput JSON:\n{$payload_json}",
				'story_workbench_scene_fields' => "Rewrite the current IronQuest scene setup for admin authoring. Return only valid JSON with this exact shape: {\"scene_brief\":\"\",\"player_goal\":\"\",\"opponent_pressure\":\"\",\"failure_cost\":\"\",\"setting_detail\":\"\"}. Each field must be a single clear sentence in plain language. scene_brief should explain what is happening in the scene and why it matters. player_goal should state what the player is trying to accomplish. opponent_pressure should explain how the scene pushes back. failure_cost should state what failure means in concrete terms. setting_detail should provide one grounded visual or sensory detail. Use location.name, location.theme, location.tone, location.story_context, mission.goal, mission.threat, mission.narrative, mission.workout_feel, scene.landmark, scene.hazard, scene.enemy_posture, scene.stakes, and any existing scene_brief-style fields as source material, but rewrite them into cleaner player-facing language. Make the output clearly match this specific location and mission instead of sounding reusable across zones. Do not write metaphor-heavy fragments, design notes, JSON commentary, or admin terminology.\n\nInput JSON:\n{$payload_json}",
				'story_workbench_location_foundation' => "Rewrite the selected IronQuest location foundation for admin authoring. Return only valid JSON with this exact shape: {\"theme\":\"\",\"tone\":\"\",\"story_context\":\"\",\"ai_theme\":\"\",\"ai_tone\":\"\",\"enemy_types\":[\"\"]}. theme should be a short descriptive phrase for what this location is about. tone should describe the emotional texture of the location. story_context should be 2 short sentences explaining what kinds of conflicts and story pressure belong here. ai_theme should be a vivid visual anchor phrase for prompts. ai_tone should be a short phrase describing the narrative feeling prompts should keep. enemy_types must be 3 to 5 short enemy labels that fit the location. Use the current location values, ai prompt anchors, and the selected mission as source material, but rewrite them into clearer author-facing guidance.\n\nInput JSON:\n{$payload_json}",
				'story_workbench_mission_foundation' => "Rewrite the selected IronQuest mission foundation for admin authoring. Return only valid JSON with this exact shape: {\"goal\":\"\",\"threat\":\"\",\"narrative\":\"\",\"workout_feel\":\"\",\"genre\":\"\",\"voice\":\"\",\"pacing\":\"\"}. goal and threat must each be short and concrete. narrative must be 2 short sentences maximum and explain why this mission matters in player-facing terms. workout_feel must describe the training vibe in plain language. genre, voice, and pacing must be short slug-like labels suitable for story_profile fields. Use the selected mission plus its location foundation as source material, but rewrite them into clearer authoring guidance that supports better scene briefs and story beats.\n\nInput JSON:\n{$payload_json}",
				default => "Return only valid JSON.\n\nInput JSON:\n{$payload_json}",
			};
	}

	private static function normalize_location_for_prompt( array $location ): array {
		$anchor = is_array( $location['ai_prompt_anchor'] ?? null ) ? $location['ai_prompt_anchor'] : [];

		return [
			'slug' => sanitize_key( (string) ( $location['slug'] ?? '' ) ),
			'name' => sanitize_text_field( (string) ( $location['name'] ?? '' ) ),
			'theme' => sanitize_text_field( (string) ( $location['theme'] ?? '' ) ),
			'tone' => sanitize_text_field( (string) ( $location['tone'] ?? '' ) ),
			'story_context' => sanitize_textarea_field( (string) ( $location['story_context'] ?? '' ) ),
			'ai_theme' => sanitize_text_field( (string) ( $anchor['theme'] ?? '' ) ),
			'ai_tone' => sanitize_text_field( (string) ( $anchor['tone'] ?? '' ) ),
			'enemy_types' => self::sanitize_prompt_list( (array) ( $anchor['enemy_types'] ?? [] ) ),
		];
	}

	private static function sanitize_prompt_list( array $items ): array {
		$clean = [];
		foreach ( $items as $item ) {
			$value = sanitize_text_field( (string) $item );
			if ( '' !== $value ) {
				$clean[] = $value;
			}
		}

		return array_values( array_slice( $clean, 0, 8 ) );
	}

	private static function normalize_encounter_seed_for_prompt( array $encounter_seed ): array {
		$clean = self::sanitize_story_struct( $encounter_seed );

		$landmark = sanitize_text_field( (string) ( $clean['landmark'] ?? $clean['prop'] ?? '' ) );
		$objective = sanitize_text_field( (string) ( $clean['objective'] ?? '' ) );
		$hazard = sanitize_text_field( (string) ( $clean['hazard'] ?? '' ) );
		$threat = sanitize_text_field( (string) ( $clean['threat'] ?? '' ) );
		$enemy_posture = sanitize_text_field( (string) ( $clean['enemy_posture'] ?? '' ) );
		$pressure = sanitize_text_field( (string) ( $clean['pressure'] ?? '' ) );
		$stakes = sanitize_text_field( (string) ( $clean['stakes'] ?? '' ) );
		$sensory_detail = sanitize_text_field( (string) ( $clean['sensory_detail'] ?? '' ) );

		if ( '' === sanitize_text_field( (string) ( $clean['scene_brief'] ?? '' ) ) ) {
			$parts = array_filter( [
				$landmark !== '' ? sprintf( 'At %s', $landmark ) : '',
				$objective !== '' ? $objective : '',
				$hazard !== '' ? $hazard : $threat,
			] );
			$clean['scene_brief'] = sanitize_text_field( trim( implode( '. ', $parts ) ) );
		}

		if ( '' === sanitize_text_field( (string) ( $clean['player_goal'] ?? '' ) ) ) {
			$clean['player_goal'] = $objective;
		}

		if ( '' === sanitize_text_field( (string) ( $clean['opponent_pressure'] ?? '' ) ) ) {
			$clean['opponent_pressure'] = $pressure !== '' ? $pressure : $enemy_posture;
		}

		if ( '' === sanitize_text_field( (string) ( $clean['failure_cost'] ?? '' ) ) ) {
			$clean['failure_cost'] = $stakes;
		}

		if ( '' === sanitize_text_field( (string) ( $clean['setting_detail'] ?? '' ) ) ) {
			$clean['setting_detail'] = $sensory_detail !== '' ? $sensory_detail : $landmark;
		}

		return $clean;
	}

	private static function sanitize_choices( array $choices ): array {
		$tones = [ 'aggressive', 'cautious', 'creative' ];
		$clean = [];

		foreach ( array_slice( $choices, 0, 3 ) as $index => $choice ) {
			$choice_data = is_array( $choice ) ? $choice : [ 'label' => (string) $choice ];
			$label = sanitize_text_field( (string) ( $choice_data['label'] ?? '' ) );
			if ( '' === $label ) {
				continue;
			}

			$tone = sanitize_key( (string) ( $choice_data['tone'] ?? $tones[ $index ] ?? 'cautious' ) );
			if ( ! in_array( $tone, $tones, true ) ) {
				$tone = $tones[ $index ] ?? 'cautious';
			}

			$clean[] = [
				'id'    => self::choice_id_for_tone( $tone, $label ),
				'tone'  => $tone,
				'label' => $label,
			];
		}

		return array_values( $clean );
	}

	private static function choice_id_for_tone( string $tone, string $label ): string {
		return match ( $tone ) {
			'aggressive' => 'direct_assault',
			'creative'   => 'class_play',
			'cautious'   => 'steady_approach',
			default      => sanitize_title( $label ),
		};
	}

	private static function humanize_slug( string $value ): string {
		$value = trim( str_replace( [ '_', '-' ], ' ', sanitize_key( $value ) ) );
		if ( '' === $value ) {
			return '';
		}

		return ucwords( $value );
	}

	private static function humanize_encounter_type( string $value ): string {
		$value = sanitize_key( $value );
		if ( '' === $value ) {
			return 'skirmish';
		}

		return str_replace( '_', ' ', $value );
	}
}
