<?php
namespace Johnny5k\Auth;

defined( 'ABSPATH' ) || exit;

class PasswordResetEmailCustomizer {

	public static function register(): void {
		add_filter( 'retrieve_password_notification_email', [ __CLASS__, 'filter_notification_email' ], 10, 4 );
	}

	public static function filter_notification_email( array $defaults, string $key, string $user_login, \WP_User $user_data ): array {
		$reset_url = home_url( '/reset-password?key=' . rawurlencode( $key ) . '&login=' . rawurlencode( $user_login ) );

		$defaults['subject'] = sprintf( '[%s] Reset your Johnny5k password', wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES ) );
		$defaults['message'] = "Hi,\n\nWe received a request to reset your Johnny5k password.\n\nReset it here:\n{$reset_url}\n\nIf you did not request this, you can ignore this email.\n";

		return $defaults;
	}
}
