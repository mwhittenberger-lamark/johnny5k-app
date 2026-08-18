<?php
namespace Johnny5k\Admin;

use Johnny5k\Services\AnnouncementTickerService;

defined( 'ABSPATH' ) || exit;

class AnnouncementTicker {
	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) wp_die( 'Unauthorized' );
		$saved = false;
		if ( 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) && check_admin_referer( 'jf_ticker_save' ) ) {
			$messages = AnnouncementTickerService::sanitize_messages( wp_unslash( $_POST['ticker_messages'] ?? [] ) );
			update_option( AnnouncementTickerService::OPTION_KEY, $messages, false );
			$saved = true;
		}
		$messages = AnnouncementTickerService::get_all();
		while ( count( $messages ) < 8 ) {
			$messages[] = [ 'id' => '', 'label' => '', 'message' => '', 'url' => '', 'active' => false, 'starts_at' => '', 'ends_at' => '', 'priority' => 50 ];
		}

		echo '<div class="wrap jf-ticker-admin"><h1>Johnny Wire</h1>';
		echo '<p class="description">Create the messages shown in the classy ticker across Johnny5k’s regular app screens. Live workout and full-screen briefing experiences stay distraction-free.</p>';
		if ( $saved ) echo '<div class="notice notice-success is-dismissible"><p>Ticker messages saved.</p></div>';
		echo '<form method="post">';
		wp_nonce_field( 'jf_ticker_save' );
		echo '<table class="widefat striped" style="margin-top:18px"><thead><tr><th style="width:60px">Live</th><th style="width:140px">Label</th><th>Message</th><th style="width:210px">Link</th><th style="width:160px">Starts</th><th style="width:160px">Ends</th><th style="width:80px">Priority</th></tr></thead><tbody>';
		foreach ( $messages as $index => $row ) {
			$prefix = 'ticker_messages[' . $index . ']';
			echo '<tr><td><input type="hidden" name="' . esc_attr( $prefix . '[id]' ) . '" value="' . esc_attr( (string) ( $row['id'] ?? '' ) ) . '"><label><input type="checkbox" name="' . esc_attr( $prefix . '[active]' ) . '" value="1" ' . checked( ! empty( $row['active'] ), true, false ) . '> On</label></td>';
			echo '<td><input class="regular-text" style="width:100%" maxlength="28" name="' . esc_attr( $prefix . '[label]' ) . '" value="' . esc_attr( (string) ( $row['label'] ?? '' ) ) . '" placeholder="Johnny says"></td>';
			echo '<td><input class="large-text" maxlength="220" name="' . esc_attr( $prefix . '[message]' ) . '" value="' . esc_attr( (string) ( $row['message'] ?? '' ) ) . '" placeholder="Consistency compounds. Make the next choice count."></td>';
			echo '<td><input class="regular-text code" style="width:100%" name="' . esc_attr( $prefix . '[url]' ) . '" value="' . esc_attr( (string) ( $row['url'] ?? '' ) ) . '" placeholder="/nutrition"></td>';
			echo '<td><input type="datetime-local" name="' . esc_attr( $prefix . '[starts_at]' ) . '" value="' . esc_attr( self::datetime_value( (string) ( $row['starts_at'] ?? '' ) ) ) . '"></td>';
			echo '<td><input type="datetime-local" name="' . esc_attr( $prefix . '[ends_at]' ) . '" value="' . esc_attr( self::datetime_value( (string) ( $row['ends_at'] ?? '' ) ) ) . '"></td>';
			echo '<td><input type="number" min="0" max="100" style="width:68px" name="' . esc_attr( $prefix . '[priority]' ) . '" value="' . esc_attr( (string) ( $row['priority'] ?? 50 ) ) . '"></td></tr>';
		}
		echo '</tbody></table>';
		echo '<p class="description">Higher priority messages appear first. Dates use the WordPress site timezone. Links may be app paths such as <code>/body</code> or full HTTPS URLs.</p>';
		submit_button( 'Save Johnny Wire' );
		echo '</form></div>';
	}

	private static function datetime_value( string $value ): string {
		if ( '' === $value ) return '';
		try {
			return ( new \DateTimeImmutable( $value, wp_timezone() ) )->format( 'Y-m-d\TH:i' );
		} catch ( \Exception $exception ) {
			return '';
		}
	}
}
