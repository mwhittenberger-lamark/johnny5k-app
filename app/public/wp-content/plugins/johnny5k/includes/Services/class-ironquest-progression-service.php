<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestProgressionService {

	public static function level_for_xp( int $xp ): int {
		$xp    = max( 0, $xp );
		$level = 1;

		while ( $level < 100 && $xp >= self::xp_required_for_level( $level + 1 ) ) {
			$level++;
		}

		return $level;
	}

	public static function xp_required_for_level( int $level ): int {
		$level = max( 1, $level );

		return ( $level - 1 ) * 100;
	}

	public static function apply_progression_award(
		int $user_id,
		int $xp,
		int $gold,
		string $source_type,
		string $source_key,
		string $award_type = 'progression'
	): array|\WP_Error {
		$recorded = IronQuestRewardService::record_activity_award(
			$user_id,
			$source_type,
			$source_key,
			$award_type,
			[
				'xp'   => max( 0, $xp ),
				'gold' => max( 0, $gold ),
			]
		);

		if ( is_wp_error( $recorded ) ) {
			return $recorded;
		}

		if ( ! empty( $recorded['duplicate'] ) ) {
			return [
				'duplicate' => true,
				'profile'   => IronQuestProfileService::ensure_profile( $user_id ),
			];
		}

		$profile = IronQuestProfileService::update_progression( $user_id, $xp, $gold );

		return [
			'duplicate' => false,
			'profile'   => $profile,
			'ledger'    => $recorded,
		];
	}
}
