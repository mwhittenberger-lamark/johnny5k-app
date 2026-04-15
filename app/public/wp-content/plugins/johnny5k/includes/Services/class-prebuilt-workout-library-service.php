<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Support\TrainingDayTypes;

class PrebuiltWorkoutLibraryService {
	private const OPTION_KEY = 'jf_prebuilt_workout_library';

	private const BODY_PART_ICON_OPTIONS = [
		'chest'    => 'Chest',
		'back'     => 'Back',
		'shoulders'=> 'Shoulders',
		'arms'     => 'Arms',
		'legs'     => 'Legs',
		'glutes'   => 'Glutes',
		'core'     => 'Core',
		'full-body'=> 'Full Body',
	];

	private const GYM_SETUP_OPTIONS = [
		'Full gym'       => 'Full gym',
		'Dumbbells'      => 'Dumbbells',
		'Machines'       => 'Machines',
		'Home gym'       => 'Home gym',
		'Bodyweight only'=> 'Bodyweight only',
	];

	public static function get_body_part_icon_options(): array {
		return self::BODY_PART_ICON_OPTIONS;
	}

	public static function get_gym_setup_options(): array {
		return self::GYM_SETUP_OPTIONS;
	}

	public static function get_library(): array {
		$items = get_option( self::OPTION_KEY, [] );
		$items = self::sanitize_library( $items );

		usort( $items, static function( array $left, array $right ): int {
			return strcmp(
				strtolower( (string) ( $left['title'] ?? '' ) ),
				strtolower( (string) ( $right['title'] ?? '' ) )
			);
		} );

		return array_values( $items );
	}

	public static function get_item( int $id ): ?array {
		foreach ( self::get_library() as $item ) {
			if ( (int) ( $item['id'] ?? 0 ) === $id ) {
				return $item;
			}
		}

		return null;
	}

	public static function save_item( array $item ): array {
		$items = self::get_library();
		$item  = self::normalise_item( $item, (int) ( $item['id'] ?? 0 ) );

		$updated = false;
		foreach ( $items as $index => $existing ) {
			if ( (int) ( $existing['id'] ?? 0 ) !== (int) $item['id'] ) {
				continue;
			}

			$items[ $index ] = $item;
			$updated = true;
			break;
		}

		if ( ! $updated ) {
			$items[] = $item;
		}

		update_option( self::OPTION_KEY, array_values( $items ), false );
		return $item;
	}

	public static function delete_item( int $id ): void {
		$items = array_values( array_filter(
			self::get_library(),
			static fn( array $item ): bool => (int) ( $item['id'] ?? 0 ) !== $id
		) );

		update_option( self::OPTION_KEY, $items, false );
	}

	public static function sanitize_library( $items ): array {
		if ( ! is_array( $items ) ) {
			return [];
		}

		$clean = [];
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$normalized = self::normalise_item( $item, (int) ( $item['id'] ?? 0 ) );
			if ( '' === $normalized['title'] || empty( $normalized['exercises'] ) ) {
				continue;
			}

			$clean[] = $normalized;
		}

		return array_values( $clean );
	}

	public static function normalise_item( array $item, int $fallback_id = 0 ): array {
		$id            = (int) ( $item['id'] ?? $fallback_id ?: time() );
		$title         = sanitize_text_field( (string) ( $item['title'] ?? '' ) );
		$description   = sanitize_textarea_field( (string) ( $item['description'] ?? '' ) );
		$required_setup = self::normalize_gym_setup( (string) ( $item['required_gym_setup'] ?? '' ) );
		$icons         = self::normalize_body_part_icons( $item['body_part_icons'] ?? [] );
		$exercises     = self::normalize_exercises( $item['exercises'] ?? [] );

		return [
			'id'                => $id > 0 ? $id : time(),
			'title'             => $title,
			'description'       => $description,
			'required_gym_setup'=> $required_setup,
			'body_part_icons'   => $icons,
			'exercises'         => $exercises,
			'exercise_count'    => count( $exercises ),
			'day_type'          => self::infer_day_type_from_icons( $icons ),
		];
	}

	public static function get_global_exercise_options(): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT id, name, primary_muscle, equipment
			 FROM {$wpdb->prefix}fit_exercises
			 WHERE active = 1 AND (user_id = 0 OR user_id IS NULL)
			 ORDER BY name ASC",
			ARRAY_A
		);

		return array_values( array_map( static function( array $row ): array {
			return [
				'id'             => (int) ( $row['id'] ?? 0 ),
				'name'           => sanitize_text_field( (string) ( $row['name'] ?? '' ) ),
				'primary_muscle' => sanitize_text_field( (string) ( $row['primary_muscle'] ?? '' ) ),
				'equipment'      => sanitize_text_field( (string) ( $row['equipment'] ?? '' ) ),
			];
		}, is_array( $rows ) ? $rows : [] ) );
	}

	public static function get_library_for_user( int $user_id ): array {
		$user_equipment = self::get_user_equipment_selection( $user_id );

		return array_map( static function( array $item ) use ( $user_equipment ): array {
			$item['matches_user_setup']    = self::matches_user_setup( $item, $user_equipment );
			$item['user_equipment_setup']  = $user_equipment;
			$item['required_setup_matches']= self::matching_setup_labels( (string) ( $item['required_gym_setup'] ?? '' ) );
			return $item;
		}, self::get_library() );
	}

	public static function get_user_equipment_selection( int $user_id ): array {
		global $wpdb;

		$raw_json = $wpdb->get_var( $wpdb->prepare(
			"SELECT equipment_available_json FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d LIMIT 1",
			$user_id
		) );
		$decoded = json_decode( (string) $raw_json, true );
		$options = is_array( $decoded ) ? $decoded : [];
		$clean   = [];

		foreach ( $options as $option ) {
			$normalized = self::normalize_gym_setup( (string) $option );
			if ( '' !== $normalized ) {
				$clean[ $normalized ] = $normalized;
			}
		}

		if ( empty( $clean ) ) {
			$clean['Full gym'] = 'Full gym';
		}

		return array_values( $clean );
	}

	public static function matches_user_setup( array $workout, array $user_equipment ): bool {
		$required = self::normalize_gym_setup( (string) ( $workout['required_gym_setup'] ?? '' ) );
		$user_equipment = array_values( array_filter( array_map(
			static fn( $value ): string => self::normalize_gym_setup( (string) $value ),
			$user_equipment
		) ) );

		if ( '' === $required || empty( $user_equipment ) || in_array( 'Full gym', $user_equipment, true ) ) {
			return true;
		}

		if ( 'Bodyweight only' === $required ) {
			return true;
		}

		return in_array( $required, self::matching_setup_labels( $required ), true )
			&& count( array_intersect( self::matching_setup_labels( $required ), $user_equipment ) ) > 0;
	}

	public static function matching_setup_labels( string $required_setup ): array {
		$required_setup = self::normalize_gym_setup( $required_setup );

		return match ( $required_setup ) {
			'Bodyweight only' => [ 'Bodyweight only', 'Dumbbells', 'Machines', 'Home gym', 'Full gym' ],
			'Dumbbells'       => [ 'Dumbbells', 'Home gym', 'Full gym' ],
			'Machines'        => [ 'Machines', 'Full gym' ],
			'Home gym'        => [ 'Home gym', 'Full gym' ],
			default           => [ 'Full gym' ],
		};
	}

	public static function build_custom_draft_payload( array $workout, string $time_tier = 'medium' ): array {
		$workout = self::normalise_item( $workout, (int) ( $workout['id'] ?? 0 ) );

		return [
			'id'                 => 'prebuilt_' . (int) ( $workout['id'] ?? 0 ),
			'name'               => (string) ( $workout['title'] ?? 'Prebuilt workout' ),
			'day_type'           => (string) ( $workout['day_type'] ?? TrainingDayTypes::custom_workout_fallback() ),
			'time_tier'          => 'full' === sanitize_key( $time_tier ) ? 'full' : ( 'short' === sanitize_key( $time_tier ) ? 'short' : 'medium' ),
			'coach_note'         => sanitize_textarea_field( (string) ( $workout['description'] ?? '' ) ),
			'source_type'        => 'prebuilt_workout_library',
			'source_id'          => (int) ( $workout['id'] ?? 0 ),
			'required_gym_setup' => (string) ( $workout['required_gym_setup'] ?? '' ),
			'body_part_icons'    => (array) ( $workout['body_part_icons'] ?? [] ),
			'exercises'          => array_map( static function( array $exercise, int $index ): array {
				return [
					'exercise_id'   => (int) ( $exercise['exercise_id'] ?? 0 ),
					'exercise_name' => (string) ( $exercise['exercise_name'] ?? '' ),
					'sets'          => max( 1, (int) ( $exercise['sets'] ?? 3 ) ),
					'rep_min'       => max( 1, (int) ( $exercise['rep_min'] ?? 8 ) ),
					'rep_max'       => max( 1, (int) ( $exercise['rep_max'] ?? 12 ) ),
					'slot_type'     => self::resolve_slot_type_for_position( $index ),
				];
			}, (array) ( $workout['exercises'] ?? [] ), array_keys( (array) ( $workout['exercises'] ?? [] ) ) ),
		];
	}

	public static function infer_day_type_from_icons( array $icons ): string {
		$icons = self::normalize_body_part_icons( $icons );

		if ( in_array( 'legs', $icons, true ) || in_array( 'glutes', $icons, true ) ) {
			return 'legs';
		}

		if ( in_array( 'back', $icons, true ) && ! array_intersect( [ 'chest', 'shoulders' ], $icons ) ) {
			return 'pull';
		}

		if ( array_intersect( [ 'chest', 'shoulders' ], $icons ) ) {
			return 'push';
		}

		if ( in_array( 'arms', $icons, true ) || in_array( 'core', $icons, true ) ) {
			return 'arms_shoulders';
		}

		return TrainingDayTypes::custom_workout_fallback();
	}

	private static function normalize_body_part_icons( $icons ): array {
		$allowed = array_keys( self::BODY_PART_ICON_OPTIONS );
		$icons = is_array( $icons ) ? $icons : [];

		return array_values( array_unique( array_filter( array_map(
			static function( $value ) use ( $allowed ): string {
				$icon = sanitize_key( (string) $value );
				return in_array( $icon, $allowed, true ) ? $icon : '';
			},
			$icons
		) ) ) );
	}

	private static function normalize_gym_setup( string $setup ): string {
		$clean = trim( sanitize_text_field( $setup ) );
		if ( '' === $clean ) {
			return '';
		}

		foreach ( self::GYM_SETUP_OPTIONS as $option ) {
			if ( 0 === strcasecmp( $option, $clean ) ) {
				return $option;
			}
		}

		return 'Full gym';
	}

	private static function normalize_exercises( $exercises ): array {
		$exercises = is_array( $exercises ) ? $exercises : [];
		$lookup = [];
		foreach ( self::get_global_exercise_options() as $option ) {
			$lookup[ (int) $option['id'] ] = $option;
		}

		$clean = [];
		$seen_ids = [];
		foreach ( $exercises as $exercise ) {
			$exercise = is_array( $exercise ) ? $exercise : (array) $exercise;
			$exercise_id = (int) ( $exercise['exercise_id'] ?? 0 );
			if ( $exercise_id <= 0 || isset( $seen_ids[ $exercise_id ] ) || empty( $lookup[ $exercise_id ] ) ) {
				continue;
			}

			$rep_min = max( 1, (int) ( $exercise['rep_min'] ?? 8 ) );
			$rep_max = max( $rep_min, (int) ( $exercise['rep_max'] ?? $rep_min ) );
			$seen_ids[ $exercise_id ] = true;
			$clean[] = [
				'exercise_id'    => $exercise_id,
				'exercise_name'  => sanitize_text_field( (string) ( $lookup[ $exercise_id ]['name'] ?? '' ) ),
				'primary_muscle' => sanitize_text_field( (string) ( $lookup[ $exercise_id ]['primary_muscle'] ?? '' ) ),
				'equipment'      => sanitize_text_field( (string) ( $lookup[ $exercise_id ]['equipment'] ?? '' ) ),
				'sets'           => max( 1, (int) ( $exercise['sets'] ?? 3 ) ),
				'rep_min'        => $rep_min,
				'rep_max'        => $rep_max,
			];
		}

		return array_values( $clean );
	}

	private static function resolve_slot_type_for_position( int $index ): string {
		return match ( $index ) {
			0       => 'main',
			1       => 'secondary',
			default => 'accessory',
		};
	}
}
