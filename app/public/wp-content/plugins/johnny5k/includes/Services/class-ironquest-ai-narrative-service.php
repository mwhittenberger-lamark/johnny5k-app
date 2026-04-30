<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestAiNarrativeService {
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

	public static function build_set_beat_bundle( int $user_id, array $profile, array $location, array $mission, array $state, array $current_exercise, array $beat_context = [] ): array {
		$raw_set_result = (string) ( $current_exercise['set_result'] ?? '' );
		$payload = self::build_set_progression_payload( $profile, $location, $mission, $state, $current_exercise, $beat_context, $raw_set_result );

		$response = self::request_json( $user_id, 'set_progression', $payload, [
			'ironquest_prompt_type' => 'set_progression',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

		if ( is_wp_error( $response ) ) {
			return [];
		}

		$data = (array) ( $response['data'] ?? [] );

			return [
				'latest_beat'       => sanitize_textarea_field( (string) ( $data['latest_beat'] ?? '' ) ),
				'current_situation' => sanitize_textarea_field( (string) ( $data['current_situation'] ?? '' ) ),
				'decision_prompt'   => sanitize_text_field( (string) ( $data['decision_prompt'] ?? '' ) ),
				'debug_prompt'      => sanitize_textarea_field( (string) ( $response['user_prompt'] ?? '' ) ),
			];
		}

	public static function build_transition_bundle( int $user_id, array $profile, array $location, array $mission, array $state, array $current_exercise, array $next_encounter ): array {
		$transition_payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => '',
				'exercise_order' => (int) ( $current_exercise['exercise_order'] ?? 0 ),
				'encounter_type' => (string) ( $current_exercise['encounter_type'] ?? ( $state['encounter_type'] ?? 'skirmish' ) ),
				'sets_total'     => (int) ( $current_exercise['sets_total'] ?? 0 ),
				'set_number'     => (int) ( $current_exercise['set_number'] ?? 0 ),
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
				'set_result' => (string) ( $current_exercise['set_result'] ?? '' ),
			],
			[
				'next_encounter' => [
					'exercise_name'  => (string) ( $next_encounter['exercise_name'] ?? '' ),
					'exercise_order' => (int) ( $next_encounter['exercise_order'] ?? 0 ),
					'exercise_count' => (int) ( $next_encounter['exercise_count'] ?? 0 ),
					'encounter_type' => self::humanize_encounter_type( (string) ( $next_encounter['encounter_type'] ?? 'skirmish' ) ),
					'encounter_seed' => self::sanitize_story_struct( (array) ( $next_encounter['encounter_seed'] ?? [] ) ),
				],
			]
		);

		$transition = self::request_json( $user_id, 'exercise_transition', $transition_payload, [
			'ironquest_prompt_type' => 'exercise_transition',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

			$transition_data = is_wp_error( $transition ) ? [] : (array) ( $transition['data'] ?? [] );
			$transition_prompt = is_wp_error( $transition ) ? '' : (string) ( $transition['user_prompt'] ?? '' );
			$current_situation = sanitize_textarea_field( (string) ( $transition_data['current_situation'] ?? '' ) );

		$choice_payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => (string) ( $next_encounter['exercise_name'] ?? '' ),
				'exercise_order' => (int) ( $next_encounter['exercise_order'] ?? 0 ),
				'exercise_count' => (int) ( $next_encounter['exercise_count'] ?? 0 ),
				'encounter_type' => (string) ( $next_encounter['encounter_type'] ?? 'skirmish' ),
			],
			[
				'current_situation' => $current_situation,
				'enemy'             => (string) ( $state['enemy'] ?? '' ),
				'tension'           => (string) ( $state['tension'] ?? 'rising' ),
				'encounter_seed'    => (array) ( $next_encounter['encounter_seed'] ?? [] ),
				'scene_state'       => (array) ( $state['scene_state'] ?? [] ),
			],
			[]
		);

		$choices = self::request_json( $user_id, 'choice_generation', $choice_payload, [
			'ironquest_prompt_type' => 'choice_generation',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

			return [
				'latest_beat'       => sanitize_textarea_field( (string) ( $transition_data['latest_beat'] ?? '' ) ),
				'current_situation' => $current_situation,
				'decision_prompt'   => sanitize_text_field( (string) ( $transition_data['decision_prompt'] ?? '' ) ),
				'choices'           => self::sanitize_choices( is_wp_error( $choices ) ? [] : (array) ( $choices['data']['choices'] ?? [] ) ),
				'debug_prompt'      => sanitize_textarea_field( $transition_prompt ),
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
				'encounter_seed' => self::sanitize_story_struct( (array) ( $story_state['encounter_seed'] ?? [] ) ),
				'scene_state'    => self::sanitize_story_struct( (array) ( $story_state['scene_state'] ?? [] ) ),
				'mechanics' => self::sanitize_mechanics( $mechanics ),
			],
			$extras
		);
	}

	private static function build_set_progression_payload( array $profile, array $location, array $mission, array $state, array $current_exercise, array $beat_context, string $raw_set_result ): array {
		$anchor = is_array( $location['ai_prompt_anchor'] ?? null ) ? $location['ai_prompt_anchor'] : [];

		return [
			'user' => [
				'class'      => self::humanize_slug( (string) ( $profile['class_slug'] ?? 'hero' ) ),
				'hp_current' => max( 0, (int) ( $profile['hp_current'] ?? 0 ) ),
				'hp_max'     => max( 0, (int) ( $profile['hp_max'] ?? 0 ) ),
			],
			'mission' => [
				'location' => sanitize_text_field( (string) ( $location['name'] ?? 'Unknown' ) ),
				'theme'    => sanitize_text_field( (string) ( $anchor['theme'] ?? $location['theme'] ?? '' ) ),
				'tone'     => sanitize_text_field( (string) ( $anchor['tone'] ?? $location['tone'] ?? '' ) ),
				'threat'   => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
			],
			'encounter' => [
				'exercise_name'  => '',
				'exercise_order' => max( 0, (int) ( $current_exercise['exercise_order'] ?? 0 ) ),
				'exercise_count' => max( 0, (int) ( $current_exercise['exercise_count'] ?? 0 ) ),
				'encounter_type' => self::humanize_encounter_type( (string) ( $current_exercise['encounter_type'] ?? ( $state['encounter_type'] ?? 'skirmish' ) ) ),
				'sets_total'     => max( 0, (int) ( $current_exercise['sets_total'] ?? 0 ) ),
				'set_number'     => max( 0, (int) ( $current_exercise['set_number'] ?? 0 ) ),
			],
			'story_state' => [
				'current_situation' => sanitize_textarea_field( (string) ( $state['current_situation'] ?? '' ) ),
				'tension'           => sanitize_key( (string) ( $state['tension'] ?? 'rising' ) ),
			],
			'encounter_seed' => self::filter_story_struct_keys(
				(array) ( $state['encounter_seed'] ?? [] ),
				[ 'title', 'objective', 'threat', 'prop', 'landmark', 'hazard', 'stakes', 'enemy_posture', 'sensory_detail' ]
			),
			'scene_state' => self::filter_story_struct_keys(
				(array) ( $state['scene_state'] ?? [] ),
				[ 'phase', 'objective_status', 'current_visual', 'stakes_now', 'last_turn', 'enemy_posture' ]
			),
			'mechanics' => self::sanitize_mechanics(
				[
					'roll_band'         => (string) ( $state['roll']['roll_band'] ?? '' ),
					'set_result'        => self::normalize_set_result_for_prompt( $raw_set_result ),
					'set_result_detail' => sanitize_key( $raw_set_result ),
					'hp_loss_this_set'  => self::resolve_hp_loss_for_prompt( $raw_set_result, $beat_context ),
					'gear_effects'      => self::resolve_story_effects_for_prompt( 'gear', $state, $current_exercise ),
					'spell_effects'     => self::resolve_story_effects_for_prompt( 'spell', $state, $current_exercise ),
					'beat_stage'        => (string) ( $beat_context['stage'] ?? '' ),
					'beat_trend'        => (string) ( $beat_context['trend'] ?? '' ),
					'strain'            => (string) ( $beat_context['strain'] ?? '' ),
				]
			),
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
				'mission_opening' => "Generate the opening scene for an IronQuest mission. Return only valid JSON with this exact shape: {\"opening_text\":\"\",\"decision_prompt\":\"\",\"current_situation\":\"\"}. opening_text must be 2 short paragraphs maximum. Introduce the setting, immediate tension, and a clear problem. Do not resolve the scene yet. Use mission.theme, mission.tone, encounter_seed.objective, encounter_seed.landmark, encounter_seed.hazard, encounter_seed.stakes, encounter_seed.enemy_posture, and encounter_seed.sensory_detail to make the scene concrete. Reuse the exact landmark and threat from the payload instead of inventing a new location. decision_prompt must be one short in-world line inviting action. current_situation must be one concise sentence describing the immediate tactical problem using the same landmark or hazard.\n\nInput JSON:\n{$payload_json}",
				'choice_generation' => "Generate 3 distinct player action choices for the current IronQuest story moment. Return only valid JSON with this exact shape: {\"choices\":[{\"tone\":\"aggressive\",\"label\":\"\"},{\"tone\":\"cautious\",\"label\":\"\"},{\"tone\":\"creative\",\"label\":\"\"}]}. Provide exactly 3 options. Each label must be short and meaningfully different. Make them feel like three different tactics for this exact landmark, hazard, stakes, and threat. Avoid repeating the same force, wait, trick pattern unless the scene clearly supports it. Use the tone field as metadata only; assign aggressive, cautious, and creative to the option that best fits each tactic, but prioritize scene-specific action over formula. Base the options on encounter_seed.objective, encounter_seed.landmark, encounter_seed.hazard, encounter_seed.stakes, encounter_seed.enemy_posture, and story_state.current_situation.\n\nInput JSON:\n{$payload_json}",
				'choice_outcome' => "Generate the immediate story outcome of the player's action in IronQuest. Return only valid JSON with this exact shape: {\"outcome_text\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. outcome_text must be 2 short paragraphs maximum. Reflect the roll band clearly without mentioning numbers or dice. High bands should show advantage. Middle bands should show partial success and danger. Low bands should show a setback or loss of control. Keep continuity with the same landmark, hazard, stakes, and threat from encounter_seed and scene_state. current_situation must describe the updated tactical state in one sentence using the same scene anchors. decision_prompt must be one short in-world line that cues the next move.\n\nInput JSON:\n{$payload_json}",
				'set_progression' => "Generate a short rest-time story beat for IronQuest after a completed set. Return only valid JSON with this exact shape: {\"latest_beat\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. latest_beat must be 1 or 2 short paragraphs. Keep it concise and vivid for a 30 to 60 second rest. The story should react to the completed set. Better set performance should shift the scene toward the player. Worse set performance should increase danger or pressure. Reflect mechanics.set_result, mechanics.roll_band, mechanics.hp_loss_this_set, mechanics.gear_effects, mechanics.spell_effects, and mechanics.strain when present. Maintain continuity with the same encounter using encounter_seed, scene_state, and story_state.current_situation. Explicitly reuse encounter_seed.landmark, encounter_seed.hazard, encounter_seed.stakes, encounter_seed.enemy_posture, encounter_seed.sensory_detail, scene_state.current_visual, and scene_state.stakes_now when they are present so the beat stays in one place. If encounter.set_number equals encounter.sets_total, make it feel like a turning point. Match the brevity and concreteness of these examples, but do not copy their content. Example strong beat: \"The crossroad opens for a breath. Then more dead press through the fog between the stalls and the gap starts to close again. Pain catches under your ribs as you brace for the next answer.\" Example strained beat: \"For one breath, the market crossroad is yours. Then more dead push through the fog between the stalls and the opening starts to close again. A sharp ache under your ribs reminds you how little margin you have left.\" Never mention literal exercise names, movement names, reps, set numbers, calculations, dice, JSON, app logic, or modern gym language in the story text. current_situation must be one sentence describing the immediate danger heading into the next effort using the same landmark or stakes. decision_prompt must be one short line that cues the next push and does not create a new choice menu.\n\nInput JSON:\n{$payload_json}",
				'exercise_transition' => "Generate the encounter transition for IronQuest after one encounter closes and the next one forms. Return only valid JSON with this exact shape: {\"latest_beat\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. latest_beat must be 1 or 2 short paragraphs. Show what the completed encounter achieved before pointing toward the next encounter. Use the current encounter_seed and next_encounter.encounter_seed so the transition names what was secured, what landmark or prop is now behind the player, what new landmark is ahead, what stakes are now immediate, and what enemy pressure is forming next. Keep it in the same adventure space instead of jumping to a disconnected image. current_situation must be one sentence describing the immediate danger or setup around the next encounter using the new landmark, hazard, or stakes. decision_prompt must be one short line inviting the player to choose how they enter the next encounter.\n\nInput JSON:\n{$payload_json}",
				'mission_conclusion' => "Generate the mission conclusion for IronQuest. Return only valid JSON with this exact shape: {\"summary\":\"\"}. summary must be 2 short paragraphs maximum. Resolve the immediate story of the mission. Reflect the result band, the enemy pressure, and the player's earned outcome. Use the mission threat plus the most important scene anchors from encounter_seed and scene_state so the ending still feels tied to the same place and stakes. If the result is partial, leave some tension unresolved. Keep it vivid and earned.\n\nInput JSON:\n{$payload_json}",
				default => "Return only valid JSON.\n\nInput JSON:\n{$payload_json}",
			};
	}

	private static function normalize_set_result_for_prompt( string $set_result ): string {
		return match ( sanitize_key( $set_result ) ) {
			'surge', 'breakthrough' => 'exceeded_target',
			'target_met', 'push_set', 'recovered' => 'target_met',
			'close_call' => 'near_miss',
			'strain', 'slipped', 'struggle' => 'missed_target',
			default => sanitize_key( $set_result ),
		};
	}

	private static function resolve_hp_loss_for_prompt( string $set_result, array $beat_context ): int {
		$strain = sanitize_key( (string) ( $beat_context['strain'] ?? '' ) );

		if ( 'high' === $strain || in_array( sanitize_key( $set_result ), [ 'slipped', 'struggle' ], true ) ) {
			return 2;
		}

		if ( 'medium' === $strain || in_array( sanitize_key( $set_result ), [ 'close_call', 'strain' ], true ) ) {
			return 1;
		}

		return 0;
	}

	private static function resolve_story_effects_for_prompt( string $effect_type, array $state, array $current_exercise ): array {
		$effect_type = 'spell' === $effect_type ? 'spell' : 'gear';
		$raw_effects = $state[ $effect_type . '_effects' ] ?? $current_exercise[ $effect_type . '_effects' ] ?? [];
		$effects     = is_array( $raw_effects ) ? $raw_effects : [];

		return array_values(
			array_filter(
				array_map(
					static function ( $effect ): string {
						return is_scalar( $effect ) ? sanitize_text_field( (string) $effect ) : '';
					},
					$effects
				)
			)
		);
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
