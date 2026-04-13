<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

class OverviewPage {

	public static function render(): void {
		$stats = OverviewStats::get();

		echo '<div class="wrap">';
		echo '<h1>Johnny5k Overview</h1>';
		echo '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px">';
		self::stat_card( 'Registered Users', (int) ( $stats['registered_users'] ?? 0 ) );
		self::stat_card( 'Onboarding Complete', (int) ( $stats['onboarding_complete'] ?? 0 ) );
		self::stat_card( 'Workout Sessions', (int) ( $stats['workout_sessions'] ?? 0 ) );
		self::stat_card( 'Meals Logged', (int) ( $stats['meals_logged'] ?? 0 ) );
		echo '</div>';
		echo '</div>';
	}

	private static function stat_card( string $label, int $value ): void {
		printf(
			'<div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;text-align:center">
				<div style="font-size:2em;font-weight:700;color:#1d2327">%s</div>
				<div style="color:#666;margin-top:4px">%s</div>
			</div>',
			esc_html( number_format_i18n( $value ) ),
			esc_html( $label )
		);
	}
}
