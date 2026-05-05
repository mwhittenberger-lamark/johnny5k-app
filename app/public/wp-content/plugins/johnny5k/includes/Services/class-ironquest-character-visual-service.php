<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\PrivateMediaService;

class IronQuestCharacterVisualService {
	private const HEADSHOT_META_KEY = 'jf_user_headshot_attachment_id';
	private const GENERATED_IMAGES_META_KEY = 'jf_user_gemini_generated_images';
	private const CURRENT_FORM_META_KEY = 'jf_ironquest_current_form_portrait';

	public static function get_current_form_state( int $user_id, ?array $profile = null, ?array $unlock_history = null, ?array $daily_state = null ): array {
		$profile = is_array( $profile ) ? $profile : IronQuestProfileService::ensure_profile( $user_id );
		$unlock_history = is_array( $unlock_history ) ? $unlock_history : IronQuestRewardService::list_unlocks( $user_id );
		$daily_state = is_array( $daily_state ) ? $daily_state : IronQuestDailyStateService::get_state( $user_id );
		$visual_loadout = self::build_visual_loadout( $profile, $unlock_history, $daily_state );
		$visual_signature = self::build_visual_signature( $visual_loadout );
		$stored = self::normalize_current_form_meta( get_user_meta( $user_id, self::CURRENT_FORM_META_KEY, true ) );

		return [
			'label'                 => $stored['label'] ?: 'Current Form Portrait',
			'description'           => $stored['description'] ?: (string) $visual_loadout['summary_line'],
			'generated_image_id'    => $stored['generated_image_id'],
			'portrait_attachment_id'=> $stored['portrait_attachment_id'],
			'generated_at'          => $stored['generated_at'],
			'visual_signature'      => $visual_signature,
			'stale'                 => '' === $stored['generated_image_id'] || $stored['visual_signature'] !== $visual_signature,
			'visual_loadout'        => $visual_loadout,
		];
	}

	public static function generate_current_form_portrait( int $user_id, bool $force = false, array $context = [] ): array|\WP_Error {
		$profile = IronQuestProfileService::ensure_profile( $user_id );
		$unlock_history = IronQuestRewardService::list_unlocks( $user_id );
		$daily_state = IronQuestDailyStateService::get_state( $user_id );
		$current_form = self::get_current_form_state( $user_id, $profile, $unlock_history, $daily_state );

		if ( ! $force && ! empty( $current_form['generated_image_id'] ) && empty( $current_form['stale'] ) ) {
			IronQuestAnalyticsService::track(
				$user_id,
				'current_form_portrait_reused',
				[
					'generated_image_id' => (string) ( $current_form['generated_image_id'] ?? '' ),
					'visual_signature'   => (string) ( $current_form['visual_signature'] ?? '' ),
				],
				'success',
				'character_sheet'
			);
			return $current_form + [ 'generated' => false, 'reused' => true ];
		}

		$headshot_attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );
		if ( $headshot_attachment_id <= 0 ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'current_form_portrait_failed', 'Upload a headshot before forging a current-form portrait.', [], 'character_sheet', 409 );
			return new \WP_Error( 'ironquest_current_form_missing_headshot', 'Upload a headshot before forging a current-form portrait.' );
		}

		$headshot_data_url = self::attachment_to_ai_data_url( $headshot_attachment_id );
		if ( is_wp_error( $headshot_data_url ) ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'current_form_portrait_failed', 'The saved headshot could not be loaded for portrait generation.', [ 'headshot_attachment_id' => $headshot_attachment_id ], 'character_sheet', 409 );
			return new \WP_Error( 'ironquest_current_form_missing_headshot', 'The saved headshot could not be loaded for portrait generation.' );
		}

		$reference_images = array_merge(
			[ $headshot_data_url ],
			self::get_latest_progress_photo_data_urls( $user_id, 3 )
		);
		$prompt = self::build_current_form_prompt( $user_id, $profile, $current_form['visual_loadout'], $context );
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
			IronQuestAnalyticsService::track_failure( $user_id, 'current_form_portrait_failed', $result->get_error_message(), [ 'headshot_attachment_id' => $headshot_attachment_id ], 'character_sheet', 503 );
			return $result;
		}

		$attachment_id = self::create_private_generated_attachment(
			$user_id,
			(string) ( $result['mime_type'] ?? 'image/png' ),
			(string) ( $result['data'] ?? '' ),
			'current_form'
		);
		if ( is_wp_error( $attachment_id ) ) {
			IronQuestAnalyticsService::track_failure( $user_id, 'current_form_portrait_failed', $attachment_id->get_error_message(), [], 'character_sheet', 500 );
			return $attachment_id;
		}

		$generated_image_id = wp_generate_uuid4();
		self::prepend_generated_image_entry(
			$user_id,
			[
				'id'            => $generated_image_id,
				'attachment_id' => (int) $attachment_id,
				'scenario'      => 'Current Form Portrait',
				'prompt'        => $prompt,
				'created_at'    => current_time( 'mysql' ),
				'favorited'     => false,
				'type'          => 'ironquest_current_form_portrait',
				'trigger'       => 'character_sheet',
			]
		);

		$stored = [
			'label'                  => 'Current Form Portrait',
			'description'            => (string) ( $current_form['visual_loadout']['summary_line'] ?? 'A generated portrait of the current IronQuest form.' ),
			'generated_image_id'     => $generated_image_id,
			'portrait_attachment_id' => (int) $attachment_id,
			'visual_signature'       => (string) ( $current_form['visual_signature'] ?? '' ),
			'generated_at'           => current_time( 'mysql' ),
		];

		update_user_meta( $user_id, self::CURRENT_FORM_META_KEY, $stored );
		IronQuestAnalyticsService::track(
			$user_id,
			'current_form_portrait_generated',
			[
				'generated_image_id' => $generated_image_id,
				'attachment_id'      => (int) $attachment_id,
				'visual_signature'   => (string) ( $current_form['visual_signature'] ?? '' ),
				'location_name'      => (string) ( $current_form['visual_loadout']['location_name'] ?? '' ),
			],
			'success',
			'character_sheet'
		);

		return self::normalize_current_form_meta( $stored ) + [
			'generated'     => true,
			'reused'        => false,
			'visual_loadout'=> $current_form['visual_loadout'],
			'stale'         => false,
		];
	}

	private static function build_visual_loadout( array $profile, array $unlock_history, array $daily_state ): array {
		$config = IronQuestRegistryService::get_visual_progression_config();
		$class_slug = sanitize_key( (string) ( $profile['class_slug'] ?? '' ) );
		$level = max( 1, (int) ( $profile['level'] ?? 1 ) );
		$location_slug = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$class_visual = is_array( $config['class_visuals'][ $class_slug ] ?? null ) ? $config['class_visuals'][ $class_slug ] : [];
		$level_band = self::resolve_level_band( $level, (array) ( $config['level_bands'] ?? [] ) );
		$location_overlay = is_array( $config['location_overlays'][ $location_slug ] ?? null ) ? $config['location_overlays'][ $location_slug ] : [];
		$location = $location_slug ? ( IronQuestRegistryService::get_location( $location_slug ) ?? [] ) : [];
		$title_unlock = self::find_unlock_by_type( $unlock_history, 'title' );
		$relic_unlocks = self::find_unlocks_by_type( $unlock_history, 'relic', 2 );
		$store_state = is_array( $daily_state['bonus_state']['store'] ?? null ) ? $daily_state['bonus_state']['store'] : [];
		$active_charm = is_array( $store_state['active_charm'] ?? null ) ? $store_state['active_charm'] : [];
		$active_prep = is_array( $store_state['active_prep'] ?? null ) ? $store_state['active_prep'] : [];
		$relic_labels = array_values( array_filter( array_map( [ __CLASS__, 'resolve_unlock_label' ], $relic_unlocks ) ) );
		$title_label = self::resolve_unlock_label( $title_unlock );

		$summary_parts = array_values(
			array_filter(
				[
					(string) ( $level_band['label'] ?? '' ),
					(string) ( $class_visual['label'] ?? self::humanize_key( $class_slug ?: 'adventurer' ) ),
					(string) ( $location_overlay['label'] ?? ( $location['name'] ?? '' ) ),
					$title_label ? 'Title: ' . $title_label : '',
					! empty( $relic_labels ) ? 'Relics: ' . implode( ', ', $relic_labels ) : '',
					! empty( $active_charm['name'] ) ? 'Charm: ' . sanitize_text_field( (string) $active_charm['name'] ) : '',
					! empty( $active_prep['name'] ) ? 'Prep: ' . sanitize_text_field( (string) $active_prep['name'] ) : '',
				]
			)
		);

		return [
			'class_label'      => (string) ( $class_visual['label'] ?? self::humanize_key( $class_slug ?: 'adventurer' ) ),
			'class_wardrobe'   => (string) ( $class_visual['wardrobe'] ?? 'grounded fantasy travel gear' ),
			'weapon_profile'   => (string) ( $class_visual['weapon'] ?? 'simple adventurer gear with a practical weapon profile' ),
			'class_accent'     => (string) ( $class_visual['accent'] ?? 'steady heroic presence' ),
			'level_band_key'   => (string) ( $level_band['key'] ?? 'novice' ),
			'level_band_label' => (string) ( $level_band['label'] ?? 'Adventurer' ),
			'silhouette'       => (string) ( $level_band['silhouette'] ?? '' ),
			'armor_finish'     => (string) ( $level_band['armor_finish'] ?? '' ),
			'presence'         => (string) ( $level_band['presence'] ?? '' ),
			'location_name'    => sanitize_text_field( (string) ( $location['name'] ?? self::humanize_key( $location_slug ?: 'current_region' ) ) ),
			'location_theme'   => sanitize_text_field( (string) ( $location['ai_prompt_anchor']['theme'] ?? '' ) ),
			'location_tone'    => sanitize_text_field( (string) ( $location['ai_prompt_anchor']['tone'] ?? '' ) ),
			'region_style'     => (string) ( $location_overlay['style'] ?? '' ),
			'title'            => $title_label,
			'relic_props'      => $relic_labels,
			'active_charm'     => sanitize_text_field( (string) ( $active_charm['name'] ?? '' ) ),
			'active_prep'      => sanitize_text_field( (string) ( $active_prep['name'] ?? '' ) ),
			'summary_line'     => implode( ' • ', $summary_parts ),
		];
	}

	private static function resolve_level_band( int $level, array $bands ): array {
		foreach ( $bands as $band ) {
			if ( ! is_array( $band ) ) {
				continue;
			}

			$min = max( 0, (int) ( $band['min_level'] ?? 0 ) );
			$max = max( 0, (int) ( $band['max_level'] ?? 0 ) );
			if ( $level >= $min && ( 0 === $max || $level <= $max ) ) {
				return $band;
			}
		}

		return is_array( $bands[0] ?? null ) ? $bands[0] : [];
	}

	private static function build_current_form_prompt( int $user_id, array $profile, array $visual_loadout, array $context ): string {
		$first_name = self::resolve_first_name( $user_id );
		$extra_direction = sanitize_text_field( (string) ( $context['direction'] ?? '' ) );
		$prompt = "Create a square cinematic fantasy character-sheet portrait for {$first_name} alone. The user must match the uploaded headshot and progress-photo references faithfully without changing identity. Do not include Johnny or any other person. Present the user as their current IronQuest form in {$visual_loadout['location_name']}.";
		$prompt .= ' Class identity: ' . $visual_loadout['class_label'] . ' with ' . $visual_loadout['class_accent'] . '.';
		$prompt .= ' Wardrobe: ' . $visual_loadout['class_wardrobe'] . '.';
		$prompt .= ' Weapon profile: ' . $visual_loadout['weapon_profile'] . '.';
		$prompt .= ' Level band: ' . $visual_loadout['level_band_label'] . ' with ' . $visual_loadout['silhouette'] . ', ' . $visual_loadout['armor_finish'] . ', and ' . $visual_loadout['presence'] . '.';
		if ( '' !== $visual_loadout['region_style'] ) {
			$prompt .= ' Region styling should show ' . $visual_loadout['region_style'] . '.';
		}
		if ( '' !== $visual_loadout['title'] ) {
			$prompt .= ' Their earned title is ' . $visual_loadout['title'] . ', so the portrait should feel worthy of it.';
		}
		if ( ! empty( $visual_loadout['relic_props'] ) ) {
			$prompt .= ' Include subtle visible relic details inspired by ' . implode( ', ', $visual_loadout['relic_props'] ) . '.';
		}
		if ( '' !== $visual_loadout['active_charm'] ) {
			$prompt .= ' Show a visible charm or token inspired by ' . $visual_loadout['active_charm'] . '.';
		}
		if ( '' !== $visual_loadout['active_prep'] ) {
			$prompt .= ' Suggest current mission preparation inspired by ' . $visual_loadout['active_prep'] . '.';
		}
		if ( '' !== $visual_loadout['location_theme'] ) {
			$prompt .= ' Environment anchor: ' . $visual_loadout['location_theme'] . '.';
		}
		if ( '' !== $visual_loadout['location_tone'] ) {
			$prompt .= ' Tone: ' . $visual_loadout['location_tone'] . '.';
		}
		if ( '' !== $extra_direction ) {
			$prompt .= ' Additional direction: ' . $extra_direction . '.';
		}
		$prompt .= ' This should feel like premium collectible key art for a character sheet, not a modern gym photo or cosplay snapshot.';
		$prompt .= ' Avoid dumbbells, benches, treadmills, gym mats, sportswear, text, UI overlays, watermarks, and collage layouts.';
		$prompt .= ' Use dramatic but coherent fantasy lighting, clean composition, and readable heroic silhouette.';

		return $prompt;
	}

	private static function build_visual_signature( array $visual_loadout ): string {
		$signature_source = [
			'class_label'      => (string) ( $visual_loadout['class_label'] ?? '' ),
			'level_band_key'   => (string) ( $visual_loadout['level_band_key'] ?? '' ),
			'location_name'    => (string) ( $visual_loadout['location_name'] ?? '' ),
			'region_style'     => (string) ( $visual_loadout['region_style'] ?? '' ),
			'title'            => (string) ( $visual_loadout['title'] ?? '' ),
			'relic_props'      => array_values( array_map( 'strval', (array) ( $visual_loadout['relic_props'] ?? [] ) ) ),
			'active_charm'     => (string) ( $visual_loadout['active_charm'] ?? '' ),
			'active_prep'      => (string) ( $visual_loadout['active_prep'] ?? '' ),
		];

		return md5( wp_json_encode( $signature_source ) ?: '' );
	}

	private static function normalize_current_form_meta( mixed $stored ): array {
		$stored = is_array( $stored ) ? $stored : [];

		return [
			'label'                  => sanitize_text_field( (string) ( $stored['label'] ?? '' ) ),
			'description'            => sanitize_text_field( (string) ( $stored['description'] ?? '' ) ),
			'generated_image_id'     => sanitize_text_field( (string) ( $stored['generated_image_id'] ?? '' ) ),
			'portrait_attachment_id' => max( 0, (int) ( $stored['portrait_attachment_id'] ?? 0 ) ),
			'visual_signature'       => sanitize_text_field( (string) ( $stored['visual_signature'] ?? '' ) ),
			'generated_at'           => (string) ( $stored['generated_at'] ?? '' ),
		];
	}

	private static function find_unlock_by_type( array $unlock_history, string $type ): ?array {
		foreach ( $unlock_history as $unlock ) {
			if ( sanitize_key( (string) ( $unlock['unlock_type'] ?? '' ) ) === sanitize_key( $type ) ) {
				return is_array( $unlock ) ? $unlock : null;
			}
		}

		return null;
	}

	private static function find_unlocks_by_type( array $unlock_history, string $type, int $limit ): array {
		$matches = [];
		foreach ( $unlock_history as $unlock ) {
			if ( sanitize_key( (string) ( $unlock['unlock_type'] ?? '' ) ) !== sanitize_key( $type ) ) {
				continue;
			}

			$matches[] = $unlock;
			if ( count( $matches ) >= $limit ) {
				break;
			}
		}

		return $matches;
	}

	private static function resolve_unlock_label( ?array $unlock ): string {
		if ( ! is_array( $unlock ) ) {
			return '';
		}

		$meta = is_array( $unlock['meta'] ?? null ) ? $unlock['meta'] : [];
		$label = sanitize_text_field( (string) ( $meta['label'] ?? '' ) );

		return '' !== $label ? $label : self::humanize_key( (string) ( $unlock['unlock_key'] ?? '' ) );
	}

	private static function prepend_generated_image_entry( int $user_id, array $item ): void {
		$existing_items = get_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, true );
		$existing_items = is_array( $existing_items ) ? $existing_items : [];
		$persistent_items = array_values(
			array_filter(
				$existing_items,
				static fn( $entry ): bool => is_array( $entry ) && self::is_ironquest_generated_image_type( (string) ( $entry['type'] ?? '' ) )
			)
		);
		$standard_items = array_values(
			array_filter(
				$existing_items,
				static fn( $entry ): bool => ! is_array( $entry ) || ! self::is_ironquest_generated_image_type( (string) ( $entry['type'] ?? '' ) )
			)
		);
		$merged_items = array_merge( [ $item ], $persistent_items, array_slice( $standard_items, 0, 24 ) );
		update_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, $merged_items );
	}

	private static function is_ironquest_generated_image_type( string $type ): bool {
		return 0 === strpos( sanitize_key( $type ), 'ironquest_' );
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

	private static function get_latest_progress_photo_data_urls( int $user_id, int $limit ): array {
		global $wpdb;

		$limit = max( 1, $limit );
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT attachment_id FROM {$wpdb->prefix}fit_progress_photos WHERE user_id = %d AND attachment_id > 0 ORDER BY photo_date DESC, created_at DESC LIMIT %d",
				$user_id,
				$limit
			),
			ARRAY_A
		);

		$data_urls = [];
		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$attachment_id = (int) ( $row['attachment_id'] ?? 0 );
			if ( $attachment_id <= 0 ) {
				continue;
			}

			$data_url = self::attachment_to_ai_data_url( $attachment_id );
			if ( ! is_wp_error( $data_url ) ) {
				$data_urls[] = $data_url;
			}
		}

		return $data_urls;
	}

	private static function attachment_to_ai_data_url( int $attachment_id ): string|\WP_Error {
		return PrivateMediaService::attachment_to_data_url(
			$attachment_id,
			'attachment_missing',
			'One of the current-form portrait reference images could not be found.'
		);
	}

	private static function create_private_generated_attachment( int $user_id, string $mime_type, string $data, string $slug_suffix ): int|\WP_Error {
		return PrivateMediaService::create_private_attachment_from_binary(
			$user_id,
			$mime_type,
			$data,
			sprintf( 'ironquest-current-form-%s-%s', sanitize_key( $slug_suffix ), gmdate( 'YmdHis' ) ),
			'IronQuest current-form portrait'
		);
	}

	private static function humanize_key( string $key ): string {
		$key = trim( $key );
		if ( '' === $key ) {
			return '';
		}

		return ucwords( str_replace( [ '_', '-' ], ' ', $key ) );
	}
}
