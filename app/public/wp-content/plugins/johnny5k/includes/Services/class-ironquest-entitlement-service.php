<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestEntitlementService {

	private const QA_ALLOWLIST_EMAILS = [
		'mike@panempire.com',
	];

	public static function user_has_access( int $user_id ): bool {
		$default = user_can( $user_id, 'manage_options' ) || self::is_allowlisted_email( $user_id );

		return (bool) apply_filters( 'jf_ironquest_user_has_access', $default, $user_id );
	}

	public static function get_access_state( int $user_id ): array {
		$has_access = self::user_has_access( $user_id );

		return [
			'user_id'    => $user_id,
			'has_access' => $has_access,
			'source'     => $has_access ? 'filter_or_admin_default' : 'filter_denied',
		];
	}

	private static function is_allowlisted_email( int $user_id ): bool {
		if ( $user_id <= 0 ) {
			return false;
		}

		$user = get_userdata( $user_id );
		if ( ! $user || empty( $user->user_email ) ) {
			return false;
		}

		return in_array( strtolower( (string) $user->user_email ), self::QA_ALLOWLIST_EMAILS, true );
	}
}
