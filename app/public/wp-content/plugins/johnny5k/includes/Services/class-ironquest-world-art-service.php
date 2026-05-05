<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\PrivateMediaService;

class IronQuestWorldArtService {
	private const REGISTRY_OPTION_KEY = 'jf_ironquest_world_art_registry_v1';

	public static function get_tavern_scene( string $location_slug ): array {
		$location_slug = sanitize_key( $location_slug );
		$location      = $location_slug ? ( IronQuestRegistryService::get_location( $location_slug ) ?? [] ) : [];
		$tavern        = is_array( $location['tavern'] ?? null ) ? $location['tavern'] : [];
		$label         = trim( (string) ( $tavern['name'] ?? '' ) );
		if ( '' === $label ) {
			$label = 'Tavern Scene';
		}

		return self::get_art_payload(
			self::build_art_key( 'tavern_scene', $location_slug ),
			[
				'art_type'      => 'tavern_scene',
				'location_slug' => $location_slug,
				'label'         => $label . ' Scene',
				'alt'           => sprintf(
					'%s in %s.',
					$label,
					(string) ( $location['name'] ?? self::humanize_key( $location_slug ?: 'current_region' ) )
				),
			]
		);
	}

	public static function get_store_owner( string $location_slug ): array {
		$location_slug = sanitize_key( $location_slug );
		$location      = $location_slug ? ( IronQuestRegistryService::get_location( $location_slug ) ?? [] ) : [];
		$store         = is_array( $location['store'] ?? null ) ? $location['store'] : [];
		$owner_name    = trim( (string) ( $store['owner_name'] ?? '' ) );
		if ( '' === $owner_name ) {
			$owner_name = trim( (string) ( $store['name'] ?? '' ) );
		}
		if ( '' === $owner_name ) {
			$owner_name = 'Storekeeper';
		}

		return self::get_art_payload(
			self::build_art_key( 'store_owner', $location_slug ),
			[
				'art_type'      => 'store_owner',
				'location_slug' => $location_slug,
				'label'         => $owner_name . ' Portrait',
				'alt'           => sprintf(
					'%s, storekeeper of %s.',
					$owner_name,
					(string) ( $location['name'] ?? self::humanize_key( $location_slug ?: 'current_region' ) )
				),
				'subject_name'  => $owner_name,
			]
		);
	}

	public static function get_mission_card( string $location_slug, string $mission_slug ): array {
		$location_slug = sanitize_key( $location_slug );
		$mission_slug  = sanitize_key( $mission_slug );
		$mission       = self::find_mission( $location_slug, $mission_slug );
		$label         = trim( (string) ( $mission['name'] ?? '' ) );
		if ( '' === $label ) {
			$label = 'Mission Card';
		}

		return self::get_art_payload(
			self::build_art_key( 'mission_card', $location_slug, $mission_slug ),
			[
				'art_type'      => 'mission_card',
				'location_slug' => $location_slug,
				'mission_slug'  => $mission_slug,
				'label'         => $label . ' Art',
				'alt'           => sprintf(
					'Mission art for %s.',
					$label
				),
			]
		);
	}

	public static function generate_art( int $user_id, string $art_type, string $location_slug, bool $force = false, array $context = [] ): array|\WP_Error {
		$art_type      = sanitize_key( $art_type );
		$location_slug = sanitize_key( $location_slug );
		$mission_slug  = sanitize_key( (string) ( $context['mission_slug'] ?? '' ) );
		$art_key       = self::build_art_key( $art_type, $location_slug, $mission_slug );
		$current       = self::get_art_payload( $art_key );

		if ( ! $force && 'ready' === ( $current['status'] ?? '' ) && ! empty( $current['attachment_id'] ) ) {
			IronQuestAnalyticsService::track(
				$user_id,
				'world_art_reused',
				[
					'art_type'      => $art_type,
					'location_slug' => $location_slug,
					'mission_slug'  => $mission_slug,
					'art_key'       => $art_key,
				],
				'success',
				'world_art'
			);
			return $current + [
				'generated' => false,
				'reused'    => true,
			];
		}

		$location = IronQuestRegistryService::get_location( $location_slug );
		if ( ! is_array( $location ) || empty( $location ) ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'world_art_failed', 'That IronQuest region could not be found.', [ 'art_type' => $art_type, 'location_slug' => $location_slug, 'mission_slug' => $mission_slug ], 'world_art', 400 );
			return new \WP_Error( 'invalid_location', 'That IronQuest region could not be found.' );
		}

		$prompt = match ( $art_type ) {
			'tavern_scene' => self::build_tavern_prompt( $location ),
			'store_owner'  => self::build_store_owner_prompt( $location ),
			'mission_card' => self::build_mission_card_prompt( $location, $mission_slug ),
			default        => null,
		};
		if ( is_wp_error( $prompt ) ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'world_art_failed', $prompt->get_error_message(), [ 'art_type' => $art_type, 'location_slug' => $location_slug, 'mission_slug' => $mission_slug ], 'world_art', 400 );
			return $prompt;
		}
		if ( ! is_string( $prompt ) || '' === $prompt ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'world_art_failed', 'That world-art request is not supported.', [ 'art_type' => $art_type, 'location_slug' => $location_slug, 'mission_slug' => $mission_slug ], 'world_art', 400 );
			return new \WP_Error( 'invalid_art_type', 'That world-art request is not supported.' );
		}

		$options = match ( $art_type ) {
			'tavern_scene' => [ 'aspect_ratio' => '16:9', 'image_size' => '2K' ],
			'mission_card' => [ 'aspect_ratio' => '16:9', 'image_size' => '2K' ],
			default        => [ 'aspect_ratio' => '3:4', 'image_size' => '2K' ],
		};
		$result = GeminiImageService::generate_image( $user_id, $prompt, [], $options );
		if ( is_wp_error( $result ) ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'world_art_failed', $result->get_error_message(), [ 'art_type' => $art_type, 'location_slug' => $location_slug, 'mission_slug' => $mission_slug ], 'world_art', 503 );
			return $result;
		}

		$attachment_id = PrivateMediaService::create_private_attachment_from_binary(
			$user_id,
			(string) ( $result['mime_type'] ?? 'image/png' ),
			(string) ( $result['data'] ?? '' ),
			$art_key,
			(string) ( $location['name'] ?? 'IronQuest World Art' )
		);
		if ( is_wp_error( $attachment_id ) ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'world_art_failed', $attachment_id->get_error_message(), [ 'art_type' => $art_type, 'location_slug' => $location_slug, 'mission_slug' => $mission_slug ], 'world_art', 500 );
			return $attachment_id;
		}

			$payload = match ( $art_type ) {
				'tavern_scene' => self::get_tavern_scene( $location_slug ),
				'store_owner'  => self::get_store_owner( $location_slug ),
				'mission_card' => self::get_mission_card( $location_slug, $mission_slug ),
				default        => self::get_art_payload( $art_key ),
			};
		$entry = array_merge(
			$payload,
			[
					'attachment_id' => (int) $attachment_id,
					'prompt'        => $prompt,
					'prompt_hash'   => md5( $prompt ),
					'status'        => 'ready',
					'generated_at'  => current_time( 'mysql' ),
					'mission_slug'  => $mission_slug,
				]
			);
		self::store_registry_entry( $art_key, $entry );
		IronQuestAnalyticsService::track(
			$user_id,
			'world_art_generated',
			[
				'art_type'      => $art_type,
				'location_slug' => $location_slug,
				'mission_slug'  => $mission_slug,
				'art_key'       => $art_key,
				'attachment_id' => (int) $attachment_id,
			],
			'success',
			'world_art'
		);

		return self::get_art_payload( $art_key ) + [
			'generated' => true,
			'reused'    => false,
		];
	}

	public static function get_attachment_id( string $art_key ): int {
		$entry = self::get_registry_entry( $art_key );

		return max( 0, (int) ( $entry['attachment_id'] ?? 0 ) );
	}

	private static function build_tavern_prompt( array $location ): string {
		$tavern        = is_array( $location['tavern'] ?? null ) ? $location['tavern'] : [];
		$location_name = sanitize_text_field( (string) ( $location['name'] ?? 'an IronQuest region' ) );
		$tavern_name   = sanitize_text_field( (string) ( $tavern['name'] ?? 'the local tavern' ) );
		$theme         = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['theme'] ?? '' ) );
		$tone          = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['tone'] ?? '' ) );
		$visual_prompt = sanitize_text_field( (string) ( $tavern['visual_prompt'] ?? '' ) );
		$tone_tags     = array_values( array_filter( array_map( 'strval', (array) ( $tavern['tone_tags'] ?? [] ) ) ) );

		$prompt = "Create a wide cinematic fantasy environment illustration of {$tavern_name} in {$location_name} for an RPG interface. No characters should dominate the frame.";
		if ( '' !== $visual_prompt ) {
			$prompt .= ' Visual direction: ' . $visual_prompt . '.';
		}
		if ( '' !== $theme ) {
			$prompt .= ' Regional anchor: ' . $theme . '.';
		}
		if ( '' !== $tone ) {
			$prompt .= ' Tone: ' . $tone . '.';
		}
		if ( ! empty( $tone_tags ) ) {
			$prompt .= ' Include atmosphere inspired by ' . implode( ', ', $tone_tags ) . '.';
		}
		$prompt .= ' This should feel like premium game key art for a tavern/rest screen, not a concept sketch.';
		$prompt .= ' No text, no UI, no logos, no split panels, no collage, no modern objects.';

		return $prompt;
	}

	private static function build_store_owner_prompt( array $location ): string {
		$store         = is_array( $location['store'] ?? null ) ? $location['store'] : [];
		$location_name = sanitize_text_field( (string) ( $location['name'] ?? 'an IronQuest region' ) );
		$store_name    = sanitize_text_field( (string) ( $store['name'] ?? 'the general store' ) );
		$owner_name    = sanitize_text_field( (string) ( $store['owner_name'] ?? $store_name ?: 'Storekeeper' ) );
		$theme         = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['theme'] ?? '' ) );
		$tone          = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['tone'] ?? '' ) );
		$visual_prompt = sanitize_text_field( (string) ( $store['owner_visual_prompt'] ?? '' ) );
		$tone_tags     = array_values( array_filter( array_map( 'strval', (array) ( $store['tone_tags'] ?? [] ) ) ) );

		$prompt = "Create a vertical cinematic fantasy portrait of {$owner_name}, the storekeeper of {$store_name} in {$location_name}. Show one person only.";
		if ( '' !== $visual_prompt ) {
			$prompt .= ' Visual direction: ' . $visual_prompt . '.';
		}
		if ( '' !== $theme ) {
			$prompt .= ' Regional anchor: ' . $theme . '.';
		}
		if ( '' !== $tone ) {
			$prompt .= ' Tone: ' . $tone . '.';
		}
		if ( ! empty( $tone_tags ) ) {
			$prompt .= ' Merchandise and styling should reflect ' . implode( ', ', $tone_tags ) . '.';
		}
		$prompt .= ' This should feel like polished in-game portrait art for a merchant screen, not a photo.';
		$prompt .= ' No text, no UI frame, no watermark, no modern clothing, and no extra people.';

		return $prompt;
	}

	private static function build_mission_card_prompt( array $location, string $mission_slug ): string|\WP_Error {
		$mission_slug = sanitize_key( $mission_slug );
		$location_slug = sanitize_key( (string) ( $location['slug'] ?? '' ) );
		$mission = self::find_mission( $location_slug, $mission_slug );
		if ( empty( $mission ) ) {
			return new \WP_Error( 'invalid_mission', 'That mission could not be found for this region.' );
		}

		$location_name = sanitize_text_field( (string) ( $location['name'] ?? 'an IronQuest region' ) );
		$mission_name  = sanitize_text_field( (string) ( $mission['name'] ?? self::humanize_key( $mission_slug ) ) );
		$theme         = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['theme'] ?? '' ) );
		$tone          = sanitize_text_field( (string) ( $location['ai_prompt_anchor']['tone'] ?? '' ) );
		$goal          = sanitize_text_field( (string) ( $mission['goal'] ?? '' ) );
		$threat        = sanitize_text_field( (string) ( $mission['threat'] ?? '' ) );
		$narrative     = sanitize_text_field( (string) ( $mission['narrative'] ?? '' ) );
		$workout_feel  = sanitize_text_field( (string) ( $mission['workout_feel'] ?? '' ) );
		$encounter     = is_array( $mission['encounter_seeds'][0] ?? null ) ? $mission['encounter_seeds'][0] : [];
		$landmark      = sanitize_text_field( (string) ( $encounter['landmark'] ?? '' ) );
		$hazard        = sanitize_text_field( (string) ( $encounter['hazard'] ?? '' ) );
		$prop          = sanitize_text_field( (string) ( $encounter['prop'] ?? '' ) );
		$sensory       = sanitize_text_field( (string) ( $encounter['sensory_detail'] ?? '' ) );

		$prompt = "Create a wide cinematic fantasy mission-card illustration for {$mission_name} in {$location_name}. This should feel like premium game card art with one clear focal scene and no text.";
		if ( '' !== $goal ) {
			$prompt .= ' Mission goal: ' . $goal . '.';
		}
		if ( '' !== $threat ) {
			$prompt .= ' Threat: ' . $threat . '.';
		}
		if ( '' !== $narrative ) {
			$prompt .= ' Narrative context: ' . $narrative . '.';
		}
		if ( '' !== $workout_feel ) {
			$prompt .= ' It should carry the feeling of ' . $workout_feel . '.';
		}
		if ( '' !== $theme ) {
			$prompt .= ' Regional anchor: ' . $theme . '.';
		}
		if ( '' !== $tone ) {
			$prompt .= ' Tone: ' . $tone . '.';
		}
		if ( '' !== $landmark ) {
			$prompt .= ' Landmark: ' . $landmark . '.';
		}
		if ( '' !== $hazard ) {
			$prompt .= ' Hazard: ' . $hazard . '.';
		}
		if ( '' !== $prop ) {
			$prompt .= ' Prop detail: ' . $prop . '.';
		}
		if ( '' !== $sensory ) {
			$prompt .= ' Atmosphere detail: ' . $sensory . '.';
		}
		$prompt .= ' No UI frame, no words, no logo, no collage, and no modern gym equipment.';

		return $prompt;
	}

	private static function get_art_payload( string $art_key, array $defaults = [] ): array {
		$art_key = sanitize_key( $art_key );
		$entry   = self::get_registry_entry( $art_key );

		return [
			'art_key'       => $art_key,
			'art_type'      => sanitize_key( (string) ( $entry['art_type'] ?? $defaults['art_type'] ?? '' ) ),
			'location_slug' => sanitize_key( (string) ( $entry['location_slug'] ?? $defaults['location_slug'] ?? '' ) ),
			'mission_slug'  => sanitize_key( (string) ( $entry['mission_slug'] ?? $defaults['mission_slug'] ?? '' ) ),
			'label'         => sanitize_text_field( (string) ( $entry['label'] ?? $defaults['label'] ?? 'IronQuest world art' ) ),
			'alt'           => sanitize_text_field( (string) ( $entry['alt'] ?? $defaults['alt'] ?? 'IronQuest world art.' ) ),
			'subject_name'  => sanitize_text_field( (string) ( $entry['subject_name'] ?? $defaults['subject_name'] ?? '' ) ),
			'generated_at'  => (string) ( $entry['generated_at'] ?? '' ),
			'attachment_id' => max( 0, (int) ( $entry['attachment_id'] ?? 0 ) ),
			'status'        => max( 0, (int) ( $entry['attachment_id'] ?? 0 ) ) > 0 ? 'ready' : 'missing',
		];
	}

	private static function build_art_key( string $art_type, string $location_slug, string $mission_slug = '' ): string {
		$suffix = '' !== $mission_slug ? '_' . $mission_slug : '';
		return sanitize_key( $art_type . '_' . $location_slug . $suffix );
	}

	private static function get_registry_entry( string $art_key ): array {
		$registry = get_option( self::REGISTRY_OPTION_KEY, [] );
		$registry = is_array( $registry ) ? $registry : [];
		$entry    = $registry[ sanitize_key( $art_key ) ] ?? [];

		return is_array( $entry ) ? $entry : [];
	}

	private static function store_registry_entry( string $art_key, array $entry ): void {
		$registry = get_option( self::REGISTRY_OPTION_KEY, [] );
		$registry = is_array( $registry ) ? $registry : [];
			$registry[ sanitize_key( $art_key ) ] = [
				'art_type'      => sanitize_key( (string) ( $entry['art_type'] ?? '' ) ),
				'location_slug' => sanitize_key( (string) ( $entry['location_slug'] ?? '' ) ),
				'mission_slug'  => sanitize_key( (string) ( $entry['mission_slug'] ?? '' ) ),
				'label'         => sanitize_text_field( (string) ( $entry['label'] ?? '' ) ),
			'alt'           => sanitize_text_field( (string) ( $entry['alt'] ?? '' ) ),
			'subject_name'  => sanitize_text_field( (string) ( $entry['subject_name'] ?? '' ) ),
			'attachment_id' => max( 0, (int) ( $entry['attachment_id'] ?? 0 ) ),
			'prompt'        => sanitize_textarea_field( (string) ( $entry['prompt'] ?? '' ) ),
			'prompt_hash'   => sanitize_text_field( (string) ( $entry['prompt_hash'] ?? '' ) ),
			'generated_at'  => (string) ( $entry['generated_at'] ?? '' ),
		];
		update_option( self::REGISTRY_OPTION_KEY, $registry, false );
	}

	private static function humanize_key( string $value ): string {
		$value = trim( str_replace( [ '_', '-' ], ' ', $value ) );

		return '' === $value ? 'IronQuest' : ucwords( $value );
	}

	private static function find_mission( string $location_slug, string $mission_slug ): array {
		$location_slug = sanitize_key( $location_slug );
		$mission_slug  = sanitize_key( $mission_slug );
		if ( '' === $location_slug || '' === $mission_slug ) {
			return [];
		}

		foreach ( IronQuestRegistryService::get_location_missions( $location_slug ) as $mission ) {
			if ( sanitize_key( (string) ( $mission['slug'] ?? '' ) ) === $mission_slug ) {
				return is_array( $mission ) ? $mission : [];
			}
		}

		return [];
	}
}
