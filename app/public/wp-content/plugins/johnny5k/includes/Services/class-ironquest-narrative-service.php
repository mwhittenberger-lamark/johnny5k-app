<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestNarrativeService {

	public static function get_mission_context( string $location_slug, string $mission_slug ): array {
		$location = IronQuestRegistryService::get_location( $location_slug ) ?? [];
		$mission  = [];

		foreach ( IronQuestRegistryService::get_location_missions( $location_slug ) as $candidate ) {
			if ( ( $candidate['slug'] ?? '' ) === sanitize_key( $mission_slug ) ) {
				$mission = $candidate;
				break;
			}
		}

		return [
			'location' => $location,
			'mission'  => $mission,
			'ai_anchor' => (array) ( $location['ai_prompt_anchor'] ?? [] ),
		];
	}

	public static function build_rest_context(
		int $user_id,
		string $location_slug,
		string $mission_slug,
		string $exercise_name = '',
		int $set_number = 0,
		string $result_band = '',
		string $readiness_band = ''
	): array {
		$profile = IronQuestProfileService::ensure_profile( $user_id );
		$context = self::get_mission_context( $location_slug, $mission_slug );

		return [
			'user_id'        => $user_id,
			'class_slug'     => (string) ( $profile['class_slug'] ?? '' ),
			'location_slug'  => sanitize_key( $location_slug ),
			'mission_slug'   => sanitize_key( $mission_slug ),
			'exercise_name'  => sanitize_text_field( $exercise_name ),
			'set_number'     => max( 0, $set_number ),
			'result_band'    => sanitize_key( $result_band ),
			'readiness_band' => sanitize_key( $readiness_band ),
			'location_name'  => (string) ( $context['location']['name'] ?? '' ),
			'mission_name'   => (string) ( $context['mission']['name'] ?? '' ),
			'ai_anchor'      => (array) ( $context['ai_anchor'] ?? [] ),
		];
	}
}
