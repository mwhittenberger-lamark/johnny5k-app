<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestEntitlementService {

	public static function user_has_access( int $user_id ): bool {
		$default = user_can( $user_id, 'manage_options' );

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
}
