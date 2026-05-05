<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestRegistryService {

	private const CONFIG_DIR = 'pwa/iron_quest/config/';

	/** @var array<string, array<string, mixed>> */
	private static array $cache = [];

	public static function get_seed_bundle(): array {
		return [
			'locations'    => self::get_locations_config(),
			'missions'     => self::get_missions_config(),
			'rivals'       => self::get_rivals_config(),
			'store_items'  => self::get_store_items_config(),
			'launch_graph' => self::get_launch_graph_config(),
			'visual_progression' => self::get_visual_progression_config(),
		];
	}

	public static function get_locations_config(): array {
		$config = self::read_json_config( 'locations.json' );

		return [
			'version'   => (int) ( $config['version'] ?? 0 ),
			'seed_set'  => sanitize_key( (string) ( $config['seed_set'] ?? '' ) ),
			'locations' => array_values( array_map( [ __CLASS__, 'normalize_location' ], (array) ( $config['locations'] ?? [] ) ) ),
		];
	}

	public static function get_missions_config(): array {
		$config = self::read_json_config( 'missions.json' );

		return [
			'version'  => (int) ( $config['version'] ?? 0 ),
			'seed_set' => sanitize_key( (string) ( $config['seed_set'] ?? '' ) ),
			'missions' => array_values( array_map( [ __CLASS__, 'normalize_mission' ], (array) ( $config['missions'] ?? [] ) ) ),
		];
	}

	public static function get_launch_graph_config(): array {
		$config = self::read_json_config( 'launch_graph.json' );

		return [
			'version'          => (int) ( $config['version'] ?? 0 ),
			'graph_slug'       => sanitize_key( (string) ( $config['graph_slug'] ?? '' ) ),
			'purpose'          => sanitize_textarea_field( (string) ( $config['purpose'] ?? '' ) ),
			'start_node'       => sanitize_key( (string) ( $config['start_node'] ?? '' ) ),
			'recommended_path' => self::sanitize_key_list( (array) ( $config['recommended_path'] ?? [] ) ),
			'nodes'            => array_values( array_map( [ __CLASS__, 'normalize_graph_node' ], (array) ( $config['nodes'] ?? [] ) ) ),
			'edges'            => array_values( array_map( [ __CLASS__, 'normalize_graph_edge' ], (array) ( $config['edges'] ?? [] ) ) ),
		];
	}

	public static function get_rivals_config(): array {
		$config = self::read_json_config( 'rivals.json' );

		return [
			'version'  => (int) ( $config['version'] ?? 0 ),
			'seed_set' => sanitize_key( (string) ( $config['seed_set'] ?? '' ) ),
			'rivals'   => array_values( array_map( [ __CLASS__, 'normalize_rival' ], (array) ( $config['rivals'] ?? [] ) ) ),
		];
	}

	public static function get_store_items_config(): array {
		$config = self::read_json_config( 'store_items.json' );

		return [
			'version'  => (int) ( $config['version'] ?? 0 ),
			'seed_set' => sanitize_key( (string) ( $config['seed_set'] ?? '' ) ),
			'items'    => array_values( array_map( [ __CLASS__, 'normalize_store_item' ], (array) ( $config['items'] ?? [] ) ) ),
		];
	}

	public static function get_visual_progression_config(): array {
		$config = self::read_json_config( 'visual_progression.json' );

		return [
			'version'           => (int) ( $config['version'] ?? 0 ),
			'seed_set'          => sanitize_key( (string) ( $config['seed_set'] ?? '' ) ),
			'level_bands'       => array_values( array_map( [ __CLASS__, 'normalize_visual_level_band' ], (array) ( $config['level_bands'] ?? [] ) ) ),
			'class_visuals'     => self::normalize_visual_map( (array) ( $config['class_visuals'] ?? [] ) ),
			'location_overlays' => self::normalize_visual_map( (array) ( $config['location_overlays'] ?? [] ) ),
		];
	}

	public static function get_location( string $slug ): ?array {
		$slug = sanitize_key( $slug );
		foreach ( self::get_locations_config()['locations'] as $location ) {
			if ( ( $location['slug'] ?? '' ) === $slug ) {
				return $location;
			}
		}

		return null;
	}

	public static function get_location_missions( string $location_slug ): array {
		$location_slug = sanitize_key( $location_slug );
		$matches       = [];

		foreach ( self::get_missions_config()['missions'] as $mission ) {
			if ( ( $mission['location_slug'] ?? '' ) === $location_slug ) {
				$matches[] = $mission;
			}
		}

		usort(
			$matches,
			static fn( array $a, array $b ): int => (int) ( $a['mission_number'] ?? 0 ) <=> (int) ( $b['mission_number'] ?? 0 )
		);

		return array_values( $matches );
	}

	public static function get_config_file_path( string $file_name ): string {
		$file_name = basename( $file_name );
		if ( '' === $file_name ) {
			return '';
		}

		return JF_PLUGIN_DIR . self::CONFIG_DIR . $file_name;
	}

	public static function reset_cache(): void {
		self::$cache = [];
	}

	private static function read_json_config( string $file_name ): array {
		if ( isset( self::$cache[ $file_name ] ) ) {
			return self::$cache[ $file_name ];
		}

		$path = self::get_config_file_path( $file_name );
		if ( ! file_exists( $path ) || ! is_readable( $path ) ) {
			self::$cache[ $file_name ] = [];
			return [];
		}

		$raw = file_get_contents( $path );
		if ( false === $raw || '' === $raw ) {
			self::$cache[ $file_name ] = [];
			return [];
		}

		$decoded = json_decode( $raw, true );
		self::$cache[ $file_name ] = is_array( $decoded ) ? $decoded : [];

		return self::$cache[ $file_name ];
	}

	private static function normalize_location( $location ): array {
		if ( ! is_array( $location ) ) {
			return [];
		}

		return [
			'slug'           => sanitize_key( (string) ( $location['slug'] ?? '' ) ),
			'name'           => sanitize_text_field( (string) ( $location['name'] ?? '' ) ),
			'seeded_for_v1'  => ! empty( $location['seeded_for_v1'] ),
			'v1_seed_order'  => (int) ( $location['v1_seed_order'] ?? 0 ),
			'theme'          => sanitize_text_field( (string) ( $location['theme'] ?? '' ) ),
			'tone'           => sanitize_text_field( (string) ( $location['tone'] ?? '' ) ),
			'story_context'  => sanitize_textarea_field( (string) ( $location['story_context'] ?? '' ) ),
			'level_range'    => self::normalize_level_range( $location['level_range'] ?? [] ),
			'source_doc'     => sanitize_text_field( (string) ( $location['source_doc'] ?? '' ) ),
			'content_counts' => self::normalize_content_counts( $location['content_counts'] ?? [] ),
			'reward_profile' => self::normalize_reward_profile( $location['reward_profile'] ?? [] ),
			'ai_prompt_anchor' => self::normalize_ai_prompt_anchor( $location['ai_prompt_anchor'] ?? [] ),
			'tavern'         => self::normalize_tavern( $location['tavern'] ?? [] ),
			'store'          => self::normalize_store( $location['store'] ?? [] ),
			'source_graph'   => self::normalize_source_graph( $location['source_graph'] ?? [] ),
		];
	}

	private static function normalize_mission( $mission ): array {
		if ( ! is_array( $mission ) ) {
			return [];
		}

		return [
			'slug'                   => sanitize_key( (string) ( $mission['slug'] ?? '' ) ),
			'location_slug'          => sanitize_key( (string) ( $mission['location_slug'] ?? '' ) ),
			'name'                   => sanitize_text_field( (string) ( $mission['name'] ?? '' ) ),
			'mission_number'         => (int) ( $mission['mission_number'] ?? 0 ),
			'is_boss'                => ! empty( $mission['is_boss'] ),
			'replayable'             => ! empty( $mission['replayable'] ),
			'mission_type'           => sanitize_key( (string) ( $mission['mission_type'] ?? '' ) ),
			'run_type'               => sanitize_key( (string) ( $mission['run_type'] ?? '' ) ),
			'goal'                   => sanitize_text_field( (string) ( $mission['goal'] ?? '' ) ),
			'narrative'              => sanitize_textarea_field( (string) ( $mission['narrative'] ?? '' ) ),
			'threat'                 => sanitize_text_field( (string) ( $mission['threat'] ?? '' ) ),
			'workout_feel'           => sanitize_text_field( (string) ( $mission['workout_feel'] ?? '' ) ),
			'story_profile'          => self::normalize_story_profile( $mission['story_profile'] ?? [] ),
			'story_slots'            => self::normalize_story_slots( $mission['story_slots'] ?? [] ),
			'beat_pools'             => self::normalize_beat_pools( $mission['beat_pools'] ?? [] ),
			'beat_templates'         => self::normalize_beat_templates( $mission['beat_templates'] ?? [] ),
			'encounter_seeds'        => self::normalize_encounter_seeds( $mission['encounter_seeds'] ?? [] ),
			'boss_unlock_requirements' => self::normalize_boss_unlock_requirements( $mission['boss_unlock_requirements'] ?? [] ),
			'outcomes'               => self::normalize_outcomes( $mission['outcomes'] ?? [] ),
		];
	}

	private static function normalize_graph_node( $node ): array {
		if ( ! is_array( $node ) ) {
			return [];
		}

		return [
			'slug'               => sanitize_key( (string) ( $node['slug'] ?? '' ) ),
			'role'               => sanitize_key( (string) ( $node['role'] ?? '' ) ),
			'available_at_start' => ! empty( $node['available_at_start'] ),
		];
	}

	private static function normalize_graph_edge( $edge ): array {
		if ( ! is_array( $edge ) ) {
			return [];
		}

		return [
			'from'         => sanitize_key( (string) ( $edge['from'] ?? '' ) ),
			'to'           => sanitize_key( (string) ( $edge['to'] ?? '' ) ),
			'edge_type'    => sanitize_key( (string) ( $edge['edge_type'] ?? '' ) ),
			'source'       => sanitize_key( (string) ( $edge['source'] ?? '' ) ),
			'requirements' => self::normalize_graph_requirements( $edge['requirements'] ?? [] ),
			'notes'        => sanitize_textarea_field( (string) ( $edge['notes'] ?? '' ) ),
		];
	}

	private static function normalize_level_range( $range ): array {
		if ( ! is_array( $range ) ) {
			return [];
		}

		return [
			'label' => sanitize_text_field( (string) ( $range['label'] ?? '' ) ),
			'min'   => (int) ( $range['min'] ?? 0 ),
			'max'   => (int) ( $range['max'] ?? 0 ),
		];
	}

	private static function normalize_content_counts( $counts ): array {
		if ( ! is_array( $counts ) ) {
			return [];
		}

		return [
			'standard_missions'            => (int) ( $counts['standard_missions'] ?? 0 ),
			'boss_missions'                => (int) ( $counts['boss_missions'] ?? 0 ),
			'easy_workout_missions'        => (int) ( $counts['easy_workout_missions'] ?? 0 ),
			'runner_task_cardio_missions'  => (int) ( $counts['runner_task_cardio_missions'] ?? 0 ),
		];
	}

	private static function normalize_reward_profile( $profile ): array {
		if ( ! is_array( $profile ) ) {
			return [];
		}

		return [
			'standard_xp'     => self::normalize_min_max( $profile['standard_xp'] ?? [] ),
			'standard_gold'   => self::normalize_min_max( $profile['standard_gold'] ?? [] ),
			'boss_xp'         => (int) ( $profile['boss_xp'] ?? 0 ),
			'boss_gold'       => (int) ( $profile['boss_gold'] ?? 0 ),
			'full_clear_bonus'=> [
				'xp'                 => (int) ( $profile['full_clear_bonus']['xp'] ?? 0 ),
				'gold'               => (int) ( $profile['full_clear_bonus']['gold'] ?? 0 ),
				'progression_unlock' => sanitize_key( (string) ( $profile['full_clear_bonus']['progression_unlock'] ?? '' ) ),
			],
		];
	}

	private static function normalize_ai_prompt_anchor( $anchor ): array {
		if ( ! is_array( $anchor ) ) {
			return [];
		}

		return [
			'theme'       => sanitize_text_field( (string) ( $anchor['theme'] ?? '' ) ),
			'tone'        => sanitize_text_field( (string) ( $anchor['tone'] ?? '' ) ),
			'enemy_types' => self::sanitize_text_list( (array) ( $anchor['enemy_types'] ?? [] ) ),
		];
	}

	private static function normalize_tavern( $tavern ): array {
		if ( ! is_array( $tavern ) ) {
			return [];
		}

		return [
			'name'          => sanitize_text_field( (string) ( $tavern['name'] ?? '' ) ),
			'tone_tags'     => self::sanitize_text_list( (array) ( $tavern['tone_tags'] ?? [] ) ),
			'visual_prompt' => sanitize_text_field( (string) ( $tavern['visual_prompt'] ?? '' ) ),
		];
	}

	private static function normalize_store( $store ): array {
		if ( ! is_array( $store ) ) {
			return [];
		}

		return [
			'name'                => sanitize_text_field( (string) ( $store['name'] ?? '' ) ),
			'owner_name'          => sanitize_text_field( (string) ( $store['owner_name'] ?? '' ) ),
			'tone_tags'           => self::sanitize_text_list( (array) ( $store['tone_tags'] ?? [] ) ),
			'owner_visual_prompt' => sanitize_text_field( (string) ( $store['owner_visual_prompt'] ?? '' ) ),
			'stock'               => [
				'recovery_goods' => self::sanitize_key_list( (array) ( $store['stock']['recovery_goods'] ?? [] ) ),
				'mission_prep'   => self::sanitize_key_list( (array) ( $store['stock']['mission_prep'] ?? [] ) ),
				'utility_charms' => self::sanitize_key_list( (array) ( $store['stock']['utility_charms'] ?? [] ) ),
			],
		];
	}

	private static function normalize_store_item( $item ): array {
		if ( ! is_array( $item ) ) {
			return [];
		}

		$use_effect = is_array( $item['use_effect'] ?? null ) ? $item['use_effect'] : [];

		return [
			'id'             => sanitize_key( (string) ( $item['id'] ?? '' ) ),
			'category'       => sanitize_key( (string) ( $item['category'] ?? '' ) ),
			'name'           => sanitize_text_field( (string) ( $item['name'] ?? '' ) ),
			'description'    => sanitize_text_field( (string) ( $item['description'] ?? '' ) ),
			'effect_summary' => sanitize_text_field( (string) ( $item['effect_summary'] ?? '' ) ),
			'cost_gold'      => max( 0, (int) ( $item['cost_gold'] ?? 0 ) ),
			'available'      => ! array_key_exists( 'available', $item ) || ! empty( $item['available'] ),
			'source_doc'     => sanitize_text_field( (string) ( $item['source_doc'] ?? '' ) ),
			'use_effect'     => [
				'type'                  => sanitize_key( (string) ( $use_effect['type'] ?? '' ) ),
				'hp_restore'            => max( 0, (int) ( $use_effect['hp_restore'] ?? 0 ) ),
				'active_effect_summary' => sanitize_text_field( (string) ( $use_effect['active_effect_summary'] ?? '' ) ),
			],
		];
	}

	private static function normalize_rival( $rival ): array {
		if ( ! is_array( $rival ) ) {
			return [];
		}

		return [
			'key'                 => sanitize_key( (string) ( $rival['key'] ?? '' ) ),
			'name'                => sanitize_text_field( (string) ( $rival['name'] ?? '' ) ),
			'title'               => sanitize_text_field( (string) ( $rival['title'] ?? '' ) ),
			'description'         => sanitize_textarea_field( (string) ( $rival['description'] ?? '' ) ),
			'reward_title'        => sanitize_text_field( (string) ( $rival['reward_title'] ?? '' ) ),
			'reward_journal_label'=> sanitize_text_field( (string) ( $rival['reward_journal_label'] ?? '' ) ),
			'portrait_hint'       => sanitize_text_field( (string) ( $rival['portrait_hint'] ?? '' ) ),
			'appearances'         => array_values( array_map( [ __CLASS__, 'normalize_rival_appearance' ], (array) ( $rival['appearances'] ?? [] ) ) ),
		];
	}

	private static function normalize_rival_appearance( $appearance ): array {
		if ( ! is_array( $appearance ) ) {
			return [];
		}

		return [
			'location_slug' => sanitize_key( (string) ( $appearance['location_slug'] ?? '' ) ),
			'mission_slugs' => self::sanitize_key_list( (array) ( $appearance['mission_slugs'] ?? [] ) ),
			'hook'          => sanitize_textarea_field( (string) ( $appearance['hook'] ?? '' ) ),
			'taunt'         => sanitize_textarea_field( (string) ( $appearance['taunt'] ?? '' ) ),
			'stakes'        => sanitize_textarea_field( (string) ( $appearance['stakes'] ?? '' ) ),
			'showdown'      => ! empty( $appearance['showdown'] ),
		];
	}

	private static function normalize_visual_level_band( $band ): array {
		if ( ! is_array( $band ) ) {
			return [];
		}

		return [
			'key'          => sanitize_key( (string) ( $band['key'] ?? '' ) ),
			'label'        => sanitize_text_field( (string) ( $band['label'] ?? '' ) ),
			'min_level'    => max( 0, (int) ( $band['min_level'] ?? 0 ) ),
			'max_level'    => max( 0, (int) ( $band['max_level'] ?? 0 ) ),
			'silhouette'   => sanitize_text_field( (string) ( $band['silhouette'] ?? '' ) ),
			'armor_finish' => sanitize_text_field( (string) ( $band['armor_finish'] ?? '' ) ),
			'presence'     => sanitize_text_field( (string) ( $band['presence'] ?? '' ) ),
		];
	}

	private static function normalize_visual_map( array $entries ): array {
		$normalized = [];
		foreach ( $entries as $key => $entry ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key || ! is_array( $entry ) ) {
				continue;
			}

			$normalized[ $key ] = array_map(
				static fn( $value ): string => sanitize_text_field( (string) $value ),
				array_filter(
					$entry,
					static fn( $value ): bool => is_scalar( $value ) && '' !== trim( (string) $value )
				)
			);
		}

		return $normalized;
	}

	private static function normalize_source_graph( $graph ): array {
		if ( ! is_array( $graph ) ) {
			return [];
		}

		return [
			'connected_from'    => self::sanitize_key_list( (array) ( $graph['connected_from'] ?? [] ) ),
			'unlocks_toward'    => self::sanitize_key_list( (array) ( $graph['unlocks_toward'] ?? [] ) ),
			'travel_requirement' => [
				'type'  => sanitize_key( (string) ( $graph['travel_requirement']['type'] ?? '' ) ),
				'value' => (int) ( $graph['travel_requirement']['value'] ?? 0 ),
				'unit'  => sanitize_key( (string) ( $graph['travel_requirement']['unit'] ?? '' ) ),
			],
		];
	}

	private static function normalize_boss_unlock_requirements( $requirements ): array {
		if ( ! is_array( $requirements ) ) {
			return [];
		}

		return [
			'complete_prior_missions' => (int) ( $requirements['complete_prior_missions'] ?? 0 ),
			'min_hp'                  => (int) ( $requirements['min_hp'] ?? 0 ),
			'source_doc_flags'        => self::sanitize_key_list( (array) ( $requirements['source_doc_flags'] ?? [] ) ),
		];
	}

	private static function normalize_story_profile( $profile ): array {
		if ( ! is_array( $profile ) ) {
			return [];
		}

		$stance_bias = [];
		foreach ( (array) ( $profile['stance_bias'] ?? [] ) as $key => $tags ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key ) {
				continue;
			}

			$stance_bias[ $key ] = self::sanitize_key_list( is_array( $tags ) ? $tags : [] );
		}

		return [
			'genre'                     => sanitize_key( (string) ( $profile['genre'] ?? '' ) ),
			'voice'                     => sanitize_key( (string) ( $profile['voice'] ?? '' ) ),
			'pacing'                    => sanitize_key( (string) ( $profile['pacing'] ?? '' ) ),
			'repetition_window'         => max( 1, (int) ( $profile['repetition_window'] ?? 8 ) ),
			'stance_bias'               => $stance_bias,
			'banned_terms'              => self::sanitize_text_list( (array) ( $profile['banned_terms'] ?? [] ) ),
			'allowed_mechanics_mentions'=> self::sanitize_key_list( (array) ( $profile['allowed_mechanics_mentions'] ?? [] ) ),
		];
	}

	private static function normalize_story_slots( $slots ): array {
		if ( ! is_array( $slots ) ) {
			return [];
		}

		$normalized = [];
		foreach ( $slots as $key => $slot ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key || ! is_array( $slot ) ) {
				continue;
			}

			$normalized[ $key ] = [
				'count_target' => max( 1, (int) ( $slot['count_target'] ?? 1 ) ),
				'notes'        => sanitize_textarea_field( (string) ( $slot['notes'] ?? '' ) ),
			];
		}

		return $normalized;
	}

	private static function normalize_beat_pools( $pools ): array {
		if ( ! is_array( $pools ) ) {
			return [];
		}

		$verbs = [];
		foreach ( (array) ( $pools['verbs'] ?? [] ) as $key => $items ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key ) {
				continue;
			}

			$verbs[ $key ] = self::sanitize_text_list( is_array( $items ) ? $items : [] );
		}

		return [
			'verbs'         => $verbs,
			'reversals'     => self::sanitize_text_list( (array) ( $pools['reversals'] ?? [] ) ),
			'payoffs'       => self::sanitize_text_list( (array) ( $pools['payoffs'] ?? [] ) ),
			'sensory'       => self::sanitize_text_list( (array) ( $pools['sensory'] ?? [] ) ),
			'crisis_images' => self::sanitize_text_list( (array) ( $pools['crisis_images'] ?? [] ) ),
			'transitions'   => self::sanitize_text_list( (array) ( $pools['transitions'] ?? [] ) ),
		];
	}

	private static function normalize_beat_templates( $templates ): array {
		if ( ! is_array( $templates ) ) {
			return [];
		}

		$normalized = [];
		foreach ( $templates as $template ) {
			if ( ! is_array( $template ) ) {
				continue;
			}

			$normalized[] = [
				'id'              => sanitize_key( (string) ( $template['id'] ?? '' ) ),
				'slot'            => sanitize_key( (string) ( $template['slot'] ?? '' ) ),
				'tags'            => self::sanitize_key_list( (array) ( $template['tags'] ?? [] ) ),
				'weight'          => max( 1, (int) ( $template['weight'] ?? 1 ) ),
				'conditions'      => self::normalize_story_conditions( $template['conditions'] ?? [] ),
				'tokens_required' => self::sanitize_key_list( (array) ( $template['tokens_required'] ?? [] ) ),
				'skeleton'        => self::normalize_story_skeleton( $template['skeleton'] ?? [] ),
			];
		}

		return array_values( $normalized );
	}

	private static function normalize_story_conditions( $conditions ): array {
		if ( ! is_array( $conditions ) ) {
			return [];
		}

		$normalized = [];
		foreach ( $conditions as $key => $values ) {
			$key = sanitize_key( (string) $key );
			if ( '' === $key ) {
				continue;
			}

			$list = is_array( $values ) ? $values : [ $values ];
			$normalized[ $key ] = array_values(
				array_filter(
					array_map(
						static function ( $value ) {
							if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
								return $value;
							}

							return sanitize_key( (string) $value );
						},
						$list
					),
					static fn( $value ): bool => '' !== (string) $value
				)
			);
		}

		return $normalized;
	}

	private static function normalize_story_skeleton( $skeleton ): array {
		if ( ! is_array( $skeleton ) ) {
			return [];
		}

		return [
			'setup'           => sanitize_textarea_field( (string) ( $skeleton['setup'] ?? '' ) ),
			'turn'            => sanitize_textarea_field( (string) ( $skeleton['turn'] ?? '' ) ),
			'close'           => sanitize_textarea_field( (string) ( $skeleton['close'] ?? '' ) ),
			'summary'         => sanitize_textarea_field( (string) ( $skeleton['summary'] ?? '' ) ),
			'follow_up'       => sanitize_textarea_field( (string) ( $skeleton['follow_up'] ?? '' ) ),
			'decision_prompt' => sanitize_textarea_field( (string) ( $skeleton['decision_prompt'] ?? '' ) ),
		];
	}

	private static function normalize_outcomes( $outcomes ): array {
		if ( ! is_array( $outcomes ) ) {
			return [];
		}

		return [
			'victory' => sanitize_textarea_field( (string) ( $outcomes['victory'] ?? '' ) ),
			'partial' => sanitize_textarea_field( (string) ( $outcomes['partial'] ?? '' ) ),
			'failure' => sanitize_textarea_field( (string) ( $outcomes['failure'] ?? '' ) ),
		];
	}

	private static function normalize_encounter_seeds( $seeds ): array {
		if ( ! is_array( $seeds ) ) {
			return [];
		}

		$normalized = [];

		foreach ( $seeds as $seed ) {
			if ( ! is_array( $seed ) ) {
				continue;
			}

				$normalized[] = [
					'slug'           => sanitize_key( (string) ( $seed['slug'] ?? '' ) ),
					'title'          => sanitize_text_field( (string) ( $seed['title'] ?? '' ) ),
					'scene_brief'    => sanitize_text_field( (string) ( $seed['scene_brief'] ?? '' ) ),
					'player_goal'    => sanitize_text_field( (string) ( $seed['player_goal'] ?? '' ) ),
					'opponent_pressure' => sanitize_text_field( (string) ( $seed['opponent_pressure'] ?? '' ) ),
					'failure_cost'   => sanitize_text_field( (string) ( $seed['failure_cost'] ?? '' ) ),
					'setting_detail' => sanitize_text_field( (string) ( $seed['setting_detail'] ?? '' ) ),
					'objective'      => sanitize_text_field( (string) ( $seed['objective'] ?? '' ) ),
					'threat'         => sanitize_text_field( (string) ( $seed['threat'] ?? '' ) ),
					'prop'           => sanitize_text_field( (string) ( $seed['prop'] ?? '' ) ),
					'landmark'       => sanitize_text_field( (string) ( $seed['landmark'] ?? '' ) ),
					'hazard'         => sanitize_text_field( (string) ( $seed['hazard'] ?? '' ) ),
					'stakes'         => sanitize_text_field( (string) ( $seed['stakes'] ?? '' ) ),
					'enemy_posture'  => sanitize_text_field( (string) ( $seed['enemy_posture'] ?? '' ) ),
					'sensory_detail' => sanitize_text_field( (string) ( $seed['sensory_detail'] ?? '' ) ),
					'pressure'       => sanitize_text_field( (string) ( $seed['pressure'] ?? '' ) ),
					'success_turn'   => sanitize_text_field( (string) ( $seed['success_turn'] ?? '' ) ),
					'advance_turn'   => sanitize_text_field( (string) ( $seed['advance_turn'] ?? '' ) ),
				'struggle_turn'  => sanitize_text_field( (string) ( $seed['struggle_turn'] ?? '' ) ),
				'crisis_turn'    => sanitize_text_field( (string) ( $seed['crisis_turn'] ?? '' ) ),
				'transition'     => sanitize_text_field( (string) ( $seed['transition'] ?? '' ) ),
			];
		}

		return array_values( $normalized );
	}

	private static function normalize_graph_requirements( $requirements ): array {
		if ( ! is_array( $requirements ) ) {
			return [];
		}

		return [
			'complete_location_arc' => sanitize_key( (string) ( $requirements['complete_location_arc'] ?? '' ) ),
		];
	}

	private static function normalize_min_max( $value ): array {
		if ( ! is_array( $value ) ) {
			return [];
		}

		return [
			'min' => (int) ( $value['min'] ?? 0 ),
			'max' => (int) ( $value['max'] ?? 0 ),
		];
	}

	private static function sanitize_key_list( array $items ): array {
		return array_values(
			array_filter(
				array_map(
					static fn( $item ): string => sanitize_key( (string) $item ),
					$items
				)
			)
		);
	}

	private static function sanitize_text_list( array $items ): array {
		return array_values(
			array_filter(
				array_map(
					static fn( $item ): string => sanitize_text_field( (string) $item ),
					$items
				),
				static fn( string $item ): bool => '' !== $item
			)
		);
	}
}
