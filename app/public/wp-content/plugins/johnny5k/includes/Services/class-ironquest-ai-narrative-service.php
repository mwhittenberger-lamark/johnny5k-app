<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestAiNarrativeService {
	public static function build_opening_bundle( int $user_id, array $run, array $profile, array $location, array $mission, string $enemy, string $encounter_type ): array {
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
				'enemy'   => $enemy,
				'tension' => 'rising',
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
		];
	}

	public static function build_set_beat_bundle( int $user_id, array $profile, array $location, array $mission, array $state, array $current_exercise, array $beat_context = [] ): array {
		$raw_set_result = (string) ( $current_exercise['set_result'] ?? '' );
		$payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => (string) ( $current_exercise['exercise_name'] ?? '' ),
				'exercise_order' => (int) ( $current_exercise['exercise_order'] ?? 0 ),
				'exercise_count' => (int) ( $current_exercise['exercise_count'] ?? 0 ),
				'encounter_type' => (string) ( $current_exercise['encounter_type'] ?? ( $state['encounter_type'] ?? 'skirmish' ) ),
				'sets_total'     => (int) ( $current_exercise['sets_total'] ?? 0 ),
				'set_number'     => (int) ( $current_exercise['set_number'] ?? 0 ),
			],
			[
				'opening_choice'    => (string) ( $state['opening_choice'] ?? '' ),
				'current_situation' => (string) ( $state['current_situation'] ?? '' ),
				'enemy'             => (string) ( $state['enemy'] ?? '' ),
				'tension'           => (string) ( $state['tension'] ?? 'rising' ),
			],
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
		);

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
		];
	}

	public static function build_transition_bundle( int $user_id, array $profile, array $location, array $mission, array $state, array $current_exercise, array $next_encounter ): array {
		$transition_payload = self::build_shared_payload(
			$profile,
			$location,
			$mission,
			[
				'exercise_name'  => (string) ( $current_exercise['exercise_name'] ?? '' ),
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
				],
			]
		);

		$transition = self::request_json( $user_id, 'exercise_transition', $transition_payload, [
			'ironquest_prompt_type' => 'exercise_transition',
			'ironquest_location'    => (string) ( $location['slug'] ?? '' ),
			'ironquest_mission'     => (string) ( $mission['slug'] ?? '' ),
		] );

		$transition_data = is_wp_error( $transition ) ? [] : (array) ( $transition['data'] ?? [] );
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
		];
	}

	private static function request_json( int $user_id, string $prompt_type, array $payload, array $context_overrides = [] ) {
		$filtered = apply_filters( 'johnny5k_ironquest_ai_response', null, $prompt_type, $payload, $context_overrides, $user_id );
		if ( $filtered instanceof \WP_Error ) {
			return $filtered;
		}

		if ( is_array( $filtered ) ) {
			return [ 'data' => $filtered ];
		}

		return AiService::preview_json(
			$user_id,
			self::build_user_prompt( $prompt_type, $payload ),
			'ironquest',
			$context_overrides
		);
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
				'mechanics' => self::sanitize_mechanics( $mechanics ),
			],
			$extras
		);
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
			'mission_opening' => "Generate the opening scene for an IronQuest mission. Return only valid JSON with this exact shape: {\"opening_text\":\"\",\"decision_prompt\":\"\",\"current_situation\":\"\"}. opening_text must be 2 or 3 short paragraphs maximum. Introduce the setting, immediate tension, and a clear problem. Do not resolve the scene yet. decision_prompt must be one short line inviting action. current_situation must be one concise sentence describing the immediate tactical problem. Keep it readable on a mobile screen.\n\nInput JSON:\n{$payload_json}",
			'choice_generation' => "Generate 3 distinct player action choices for the current IronQuest story moment. Return only valid JSON with this exact shape: {\"choices\":[{\"tone\":\"aggressive\",\"label\":\"\"},{\"tone\":\"cautious\",\"label\":\"\"},{\"tone\":\"creative\",\"label\":\"\"}]}. Provide exactly 3 options. Each label must be short, vivid, and meaningfully different. The aggressive option should be direct. The cautious option should be strategic. The creative option should feel clever or risky. Keep each label to a sentence fragment or one short sentence.\n\nInput JSON:\n{$payload_json}",
			'choice_outcome' => "Generate the immediate story outcome of the player's action in IronQuest. Return only valid JSON with this exact shape: {\"outcome_text\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. outcome_text must be 2 short paragraphs maximum and reflect the roll band clearly without mentioning numbers or dice. High bands should show earned advantage. Middle bands should show partial success and rising danger. Low bands should show a setback or loss of control. End by leading naturally into the first encounter. current_situation must describe the updated tactical state in one sentence. decision_prompt must be one short line that cues the next move.\n\nInput JSON:\n{$payload_json}",
			'set_progression' => "Generate a short rest-time story beat for IronQuest after a completed set. Return only valid JSON with this exact shape: {\"latest_beat\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. latest_beat must be 1 or 2 short paragraphs. This text will be read during a 30 to 60 second rest, so keep it concise, vivid, and readable on a phone. The story should react directly to the completed set. Better set performance should shift momentum toward the player. Worse set performance should increase danger or pressure. Reflect mechanics.roll_band, mechanics.set_result, mechanics.hp_loss_this_set, mechanics.gear_effects, mechanics.spell_effects, mechanics.beat_stage, mechanics.beat_trend, and mechanics.strain when they are present. If hp_loss_this_set is above 0, reflect it narratively as strain, damage, or fatigue. Keep continuity with the current situation, the enemy, the encounter type, and the user's class. Do not mention reps, calculations, hidden rules, dice, JSON, or app logic in the story text. If encounter.set_number is equal to encounter.sets_total, make the beat feel like a turning point. current_situation must be one sentence describing the immediate tactical pressure heading into the next effort. decision_prompt must be one short line that cues the next set and never creates a new choice menu.\n\nInput JSON:\n{$payload_json}",
			'exercise_transition' => "Generate the exercise transition for IronQuest after one encounter closes and the next one forms. Return only valid JSON with this exact shape: {\"latest_beat\":\"\",\"current_situation\":\"\",\"decision_prompt\":\"\"}. latest_beat must be 1 or 2 short paragraphs and show what the completed exercise achieved before pointing toward the next encounter. current_situation must be one sentence describing the immediate danger or setup around the next exercise. decision_prompt must be one short line inviting the player to choose how they enter the next encounter. Keep the tone escalating but readable.\n\nInput JSON:\n{$payload_json}",
			'mission_conclusion' => "Generate the mission conclusion for IronQuest. Return only valid JSON with this exact shape: {\"summary\":\"\"}. summary must be 2 short paragraphs maximum. It should reflect the mission result band, the enemy pressure, and the player's earned outcome. Keep it vivid but controlled.\n\nInput JSON:\n{$payload_json}",
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