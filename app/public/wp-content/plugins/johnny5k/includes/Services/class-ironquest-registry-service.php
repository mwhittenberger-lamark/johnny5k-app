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
			'launch_graph' => self::get_launch_graph_config(),
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

	private static function read_json_config( string $file_name ): array {
		if ( isset( self::$cache[ $file_name ] ) ) {
			return self::$cache[ $file_name ];
		}

		$path = JF_PLUGIN_DIR . self::CONFIG_DIR . $file_name;
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
			'level_range'    => self::normalize_level_range( $location['level_range'] ?? [] ),
			'source_doc'     => sanitize_text_field( (string) ( $location['source_doc'] ?? '' ) ),
			'content_counts' => self::normalize_content_counts( $location['content_counts'] ?? [] ),
			'reward_profile' => self::normalize_reward_profile( $location['reward_profile'] ?? [] ),
			'ai_prompt_anchor' => self::normalize_ai_prompt_anchor( $location['ai_prompt_anchor'] ?? [] ),
			'tavern'         => self::normalize_tavern( $location['tavern'] ?? [] ),
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
			'name'      => sanitize_text_field( (string) ( $tavern['name'] ?? '' ) ),
			'tone_tags' => self::sanitize_text_list( (array) ( $tavern['tone_tags'] ?? [] ) ),
		];
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
