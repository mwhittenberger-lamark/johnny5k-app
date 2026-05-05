<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\PrivateMediaService;

class IronQuestPortraitService {
	private const HEADSHOT_META_KEY = 'jf_user_headshot_attachment_id';
	private const GENERATED_IMAGES_META_KEY = 'jf_user_gemini_generated_images';

	public static function maybe_generate_level_milestone_portrait( int $user_id, int $previous_level, int $current_level, array $context = [] ): ?array {
		foreach ( [ 5, 10, 20 ] as $milestone_level ) {
			if ( $previous_level >= $milestone_level || $current_level < $milestone_level ) {
				continue;
			}

			return self::generate_reward_portrait(
				$user_id,
				[
					'trigger'        => 'level_milestone',
					'unlock_key'     => 'level_' . $milestone_level . '_portrait',
					'label'          => 'Level ' . $milestone_level . ' Portrait',
					'description'    => 'Forged after reaching level ' . $milestone_level . '.',
					'milestone_level'=> $milestone_level,
				] + $context
			);
		}

		return null;
	}

	public static function maybe_generate_location_clear_portrait( int $user_id, string $location_slug, array $context = [] ): ?array {
		$location_slug = sanitize_key( $location_slug );
		if ( '' === $location_slug ) {
			return null;
		}

		$location = IronQuestRegistryService::get_location( $location_slug ) ?? [];
		$location_name = sanitize_text_field( (string) ( $location['name'] ?? self::humanize_key( $location_slug ) ) );

		return self::generate_reward_portrait(
			$user_id,
			[
				'trigger'       => 'location_clear',
				'unlock_key'    => $location_slug . '_victory_portrait',
				'label'         => $location_name . ' Victory Portrait',
				'description'   => 'Forged after clearing ' . $location_name . '.',
				'location_slug' => $location_slug,
			] + $context
		);
	}

	public static function maybe_generate_boss_victory_portrait( int $user_id, string $location_slug, string $mission_slug, array $context = [] ): ?array {
		$location_slug = sanitize_key( $location_slug );
		$mission_slug  = sanitize_key( $mission_slug );
		if ( '' === $location_slug || '' === $mission_slug ) {
			return null;
		}

		$location     = IronQuestRegistryService::get_location( $location_slug ) ?? [];
		$location_name = sanitize_text_field( (string) ( $location['name'] ?? self::humanize_key( $location_slug ) ) );
		$mission_name = self::resolve_mission_name( IronQuestRegistryService::get_location_missions( $location_slug ), $mission_slug );
		$mission_name = '' !== trim( $mission_name ) ? sanitize_text_field( $mission_name ) : 'Boss Victory';

		return self::generate_reward_portrait(
			$user_id,
			[
				'trigger'       => 'boss_victory',
				'unlock_key'    => $location_slug . '_' . $mission_slug . '_boss_victory_portrait',
				'label'         => $mission_name . ' Boss Portrait',
				'description'   => 'Forged after defeating the boss of ' . $location_name . '.',
				'location_slug' => $location_slug,
				'mission_slug'  => $mission_slug,
			] + $context
		);
	}

	private static function generate_reward_portrait( int $user_id, array $context ): ?array {
		$unlock_key = sanitize_key( (string) ( $context['unlock_key'] ?? '' ) );
		if ( '' === $unlock_key || self::unlock_exists( $user_id, $unlock_key ) ) {
			return null;
		}

		$headshot_attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );
		$johnny_reference_attachment_id = (int) get_option( 'jf_johnny_reference_attachment_id', 0 );
		if ( $headshot_attachment_id <= 0 || $johnny_reference_attachment_id <= 0 ) {
			IronQuestAnalyticsService::track_failure(
				$user_id,
				'reward_portrait_failed',
				'Reward portrait generation is missing required headshot references.',
				[
					'trigger'    => sanitize_key( (string) ( $context['trigger'] ?? '' ) ),
					'unlock_key' => $unlock_key,
				],
				'portrait_rewards',
				409
			);
			return null;
		}

		$headshot_data_url = self::attachment_to_ai_data_url( $headshot_attachment_id );
		$johnny_data_url = self::attachment_to_ai_data_url( $johnny_reference_attachment_id );
		if ( is_wp_error( $headshot_data_url ) || is_wp_error( $johnny_data_url ) ) {
			IronQuestAnalyticsService::track_failure(
				$user_id,
				'reward_portrait_failed',
				'Reward portrait references could not be loaded.',
				[
					'trigger'    => sanitize_key( (string) ( $context['trigger'] ?? '' ) ),
					'unlock_key' => $unlock_key,
				],
				'portrait_rewards',
				500
			);
			return null;
		}

		$reference_images = array_merge(
			[ $headshot_data_url, $johnny_data_url ],
			self::get_latest_progress_photo_data_urls( $user_id, 3 )
		);
		$prompt = self::build_reward_portrait_prompt( $user_id, $context );
		$result = GeminiImageService::generate_image(
			$user_id,
			$prompt,
			$reference_images,
			[
				'aspect_ratio' => '1:1',
				'image_size'   => '2K',
			]
		);

		if ( is_wp_error( $result ) ) {
			IronQuestAnalyticsService::track_failure(
				$user_id,
				'reward_portrait_failed',
				$result->get_error_message(),
				[
					'trigger'    => sanitize_key( (string) ( $context['trigger'] ?? '' ) ),
					'unlock_key' => $unlock_key,
				],
				'portrait_rewards',
				503
			);
			return null;
		}

		$attachment_id = self::create_private_generated_attachment(
			$user_id,
			(string) ( $result['mime_type'] ?? 'image/png' ),
			(string) ( $result['data'] ?? '' ),
			$unlock_key
		);
		if ( is_wp_error( $attachment_id ) ) {
			IronQuestAnalyticsService::track_failure(
				$user_id,
				'reward_portrait_failed',
				$attachment_id->get_error_message(),
				[
					'trigger'    => sanitize_key( (string) ( $context['trigger'] ?? '' ) ),
					'unlock_key' => $unlock_key,
				],
				'portrait_rewards',
				500
			);
			return null;
		}

		$generated_image_id = wp_generate_uuid4();
		self::prepend_generated_image_entry(
			$user_id,
			[
				'id'            => $generated_image_id,
				'attachment_id' => (int) $attachment_id,
				'scenario'      => sanitize_text_field( (string) ( $context['label'] ?? 'IronQuest reward portrait' ) ),
				'prompt'        => $prompt,
				'created_at'    => current_time( 'mysql' ),
				'favorited'     => false,
				'type'          => 'ironquest_reward_portrait',
				'trigger'       => sanitize_key( (string) ( $context['trigger'] ?? '' ) ),
			]
		);

		$meta = [
			'label'                 => sanitize_text_field( (string) ( $context['label'] ?? 'IronQuest Reward Portrait' ) ),
			'description'           => sanitize_text_field( (string) ( $context['description'] ?? 'A new reward portrait has been forged.' ) ),
			'generated_image_id'    => $generated_image_id,
			'portrait_attachment_id'=> (int) $attachment_id,
			'trigger'               => sanitize_key( (string) ( $context['trigger'] ?? '' ) ),
			'location_slug'         => sanitize_key( (string) ( $context['location_slug'] ?? '' ) ),
			'mission_slug'          => sanitize_key( (string) ( $context['mission_slug'] ?? '' ) ),
			'milestone_level'       => max( 0, (int) ( $context['milestone_level'] ?? 0 ) ),
		];

		$unlock = IronQuestRewardService::grant_unlock(
			$user_id,
			'portrait',
			$unlock_key,
			! empty( $context['source_run_id'] ) ? (int) $context['source_run_id'] : null,
			$meta
		);

		if ( is_wp_error( $unlock ) || ! is_array( $unlock ) || ! empty( $unlock['duplicate'] ) ) {
			return null;
		}

		IronQuestAnalyticsService::track(
			$user_id,
			'reward_portrait_generated',
			[
				'trigger'            => sanitize_key( (string) ( $context['trigger'] ?? '' ) ),
				'unlock_key'         => $unlock_key,
				'generated_image_id' => $generated_image_id,
				'attachment_id'      => (int) $attachment_id,
				'location_slug'      => sanitize_key( (string) ( $context['location_slug'] ?? '' ) ),
				'mission_slug'       => sanitize_key( (string) ( $context['mission_slug'] ?? '' ) ),
			],
			'success',
			'portrait_rewards'
		);

		return [
			'id'                     => (string) ( $unlock['id'] ?? '' ),
			'unlock_type'            => 'portrait',
			'unlock_key'             => $unlock_key,
			'label'                  => (string) $meta['label'],
			'description'            => (string) $meta['description'],
			'generated_image_id'     => $generated_image_id,
			'portrait_attachment_id' => (int) $attachment_id,
			'created_at'             => (string) $meta['created_at'] ?? current_time( 'mysql' ),
			'meta'                   => $meta,
		];
	}

	private static function unlock_exists( int $user_id, string $unlock_key ): bool {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_unlocks';
		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE user_id = %d AND unlock_type = %s AND unlock_key = %s LIMIT 1",
				$user_id,
				'portrait',
				$unlock_key
			)
		);

		return $existing_id > 0;
	}

	private static function prepend_generated_image_entry( int $user_id, array $item ): void {
		$existing_items = get_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, true );
		$existing_items = is_array( $existing_items ) ? $existing_items : [];
			$reward_items = array_values(
				array_filter(
					$existing_items,
					static fn( $entry ): bool => is_array( $entry ) && 0 === strpos( sanitize_key( (string) ( $entry['type'] ?? '' ) ), 'ironquest_' )
				)
			);
			$standard_items = array_values(
				array_filter(
					$existing_items,
					static fn( $entry ): bool => ! is_array( $entry ) || 0 !== strpos( sanitize_key( (string) ( $entry['type'] ?? '' ) ), 'ironquest_' )
				)
			);
		$merged_items = array_merge( [ $item ], $reward_items, array_slice( $standard_items, 0, 24 ) );
		update_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, $merged_items );
	}

	private static function build_reward_portrait_prompt( int $user_id, array $context ): string {
		$profile = IronQuestProfileService::ensure_profile( $user_id );
		$location_slug = sanitize_key( (string) ( $context['location_slug'] ?? ( $profile['current_location_slug'] ?? '' ) ) );
		$location = $location_slug ? ( IronQuestRegistryService::get_location( $location_slug ) ?? [] ) : [];
		$location_name = sanitize_text_field( (string) ( $location['name'] ?? 'The Training Grounds' ) );
		$location_theme = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['theme'] ?? 'heroic fantasy landmark, grounded adventure detail, cinematic atmosphere' ) );
		$location_tone = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['tone'] ?? 'heroic, earned, cinematic' ) );
		$trigger = sanitize_key( (string) ( $context['trigger'] ?? '' ) );
		$mission_slug = sanitize_key( (string) ( $context['mission_slug'] ?? '' ) );
		$mission = $location_slug && $mission_slug ? ( IronQuestRegistryService::get_location_missions( $location_slug ) ?? [] ) : [];
		$mission_name = self::resolve_mission_name( $mission, $mission_slug );
		$first_name = self::resolve_first_name( $user_id );
		$class_profile = self::describe_class( (string) ( $profile['class_slug'] ?? '' ) );
		$motivation_profile = self::describe_motivation( (string) ( $profile['motivation_slug'] ?? '' ) );
		$achievement_line = self::build_achievement_line( $trigger, $context, $location_name, $mission_name );

		$prompt = "Create a square cinematic fantasy reward portrait for IronQuest featuring Johnny and {$first_name}. The user must match the uploaded headshot and progress-photo references. Johnny must match the uploaded Johnny reference image. Keep both faces faithful, recognizable, and flattering without changing identity. Present the user as the clear quest hero and Johnny as a seasoned guide. The user's class identity is {$class_profile['label']} with {$class_profile['direction']}. Their motivation arc is {$motivation_profile['label']} with {$motivation_profile['direction']}. Stage the scene in {$location_name} with {$location_theme}. Tone: {$location_tone}. {$achievement_line}";
		$prompt .= ' This must read as a rare reward portrait, like a fantasy splash screen or collectible card illustration, not a modern gym photo or sports ad.';
		$prompt .= ' Use grounded high-fantasy wardrobe, props, and environmental storytelling. Avoid dumbbells, benches, treadmills, gym mats, and modern fitness equipment.';
		$prompt .= ' Do not use or resemble Keanu Reeves. Keep both faces faithful to the provided reference images only.';
		$prompt .= ' Use premium cinematic fantasy styling, dramatic but coherent lighting, atmospheric depth, no text, no watermark overlays, and no collage layout.';

		return $prompt;
	}

	private static function build_achievement_line( string $trigger, array $context, string $location_name, string $mission_name ): string {
		return match ( $trigger ) {
			'level_milestone' => 'This portrait marks the user reaching level ' . max( 0, (int) ( $context['milestone_level'] ?? 0 ) ) . ', so the pose should feel earned, ascendant, and unmistakably stronger than a starter portrait.',
			'boss_victory'    => 'This portrait marks the defeat of ' . ( '' !== $mission_name ? $mission_name : 'a boss encounter' ) . ' in ' . $location_name . '. The scene should feel dangerous, triumphant, and rarer than a normal mission reward.',
			'location_clear'  => 'This portrait marks the full clear of ' . $location_name . ( '' !== $mission_name ? ' after resolving ' . $mission_name . '.' : '.' ) . ' The scene should feel victorious, world-specific, and memorable.',
			default           => 'This portrait marks a major IronQuest milestone and should feel rare, earned, and worth keeping.',
		};
	}

	private static function resolve_mission_name( array $missions, string $mission_slug ): string {
		if ( '' === $mission_slug ) {
			return '';
		}

		foreach ( $missions as $mission ) {
			if ( sanitize_key( (string) ( $mission['slug'] ?? '' ) ) !== $mission_slug ) {
				continue;
			}

			return sanitize_text_field( (string) ( $mission['name'] ?? self::humanize_key( $mission_slug ) ) );
		}

		return self::humanize_key( $mission_slug );
	}

	private static function resolve_first_name( int $user_id ): string {
		global $wpdb;

		$first_name = (string) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT first_name FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d LIMIT 1",
				$user_id
			)
		);

		$first_name = sanitize_text_field( $first_name );

		return '' !== $first_name ? $first_name : 'the user';
	}

	private static function describe_class( string $class_slug ): array {
		return match ( sanitize_key( $class_slug ) ) {
			'warrior' => [
				'label'     => 'Warrior',
				'direction' => 'direct, durable, melee-focused heroic presence',
			],
			'ranger' => [
				'label'     => 'Ranger',
				'direction' => 'nimble travel gear, fieldcraft, and vigilant pathfinder energy',
			],
			'mage' => [
				'label'     => 'Mage',
				'direction' => 'controlled arcane rituals, runic detail, and cerebral spellcaster focus',
			],
			'rogue' => [
				'label'     => 'Rogue',
				'direction' => 'agile stealth gear, hidden tools, and sharp underworld precision',
			],
			default => [
				'label'     => 'Adventurer',
				'direction' => 'grounded heroic fantasy styling and a clear quest identity',
			],
		};
	}

	private static function describe_motivation( string $motivation_slug ): array {
		return match ( sanitize_key( $motivation_slug ) ) {
			'discipline' => [
				'label'     => 'Discipline',
				'direction' => 'composed ritual, controlled posture, and earned structure',
			],
			'strength' => [
				'label'     => 'Strength',
				'direction' => 'raw capability, power, and undeniable force',
			],
			'transformation' => [
				'label'     => 'Transformation',
				'direction' => 'visible metamorphosis, ascension, and becoming',
			],
			'redemption' => [
				'label'     => 'Redemption',
				'direction' => 'battle-worn resolve, comeback energy, and reclaimed purpose',
			],
			default => [
				'label'     => 'Purpose',
				'direction' => 'clear resolve and a forward-moving quest arc',
			],
		};
	}

	private static function get_latest_progress_photo_data_urls( int $user_id, int $limit = 3 ): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT attachment_id FROM {$wpdb->prefix}fit_progress_photos WHERE user_id = %d ORDER BY photo_date DESC, id DESC LIMIT %d",
				$user_id,
				$limit
			)
		);
		$images = [];

		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$data_url = self::attachment_to_ai_data_url( (int) ( $row->attachment_id ?? 0 ) );
			if ( ! is_wp_error( $data_url ) ) {
				$images[] = $data_url;
			}
		}

		return $images;
	}

	private static function attachment_to_ai_data_url( int $attachment_id ): string|\WP_Error {
		return PrivateMediaService::attachment_to_data_url(
			$attachment_id,
			'attachment_missing',
			'One of the reward portrait reference images could not be found.',
			[ 'image/jpeg', 'image/png', 'image/webp' ]
		);
	}

	private static function create_private_generated_attachment( int $user_id, string $mime_type, string $binary_data, string $slug ): int|\WP_Error {
		$filename = sanitize_file_name( 'ironquest-reward-' . $slug . '-' . time() );

		return PrivateMediaService::create_private_attachment_from_binary(
			$user_id,
			$mime_type,
			$binary_data,
			$filename,
			'IronQuest reward portrait'
		);
	}

	private static function humanize_key( string $value ): string {
		$normalized = sanitize_key( $value );
		if ( '' === $normalized ) {
			return 'Unknown';
		}

		return trim( preg_replace( '/\s+/', ' ', ucwords( str_replace( [ '_', '-' ], ' ', $normalized ) ) ) ?? '' );
	}
}
