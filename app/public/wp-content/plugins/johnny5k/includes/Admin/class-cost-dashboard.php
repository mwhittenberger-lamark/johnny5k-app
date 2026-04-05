<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\CostTracker;

/**
 * Admin sub-page: API Cost Dashboard
 *
 * Renders a simple HTML table summary for monthly costs and a
 * per-user breakdown — no charting library needed server-side.
 */
class CostDashboard {

	public static function render(): void {
		$monthly_total = CostTracker::monthly_total();
		$by_user       = CostTracker::monthly_by_user();
		$daily_30      = CostTracker::daily_totals_last_30();

		echo '<div class="wrap">';
		echo '<h1>API Cost Dashboard</h1>';

		// Monthly total card
		$period = date( 'F Y' );
		echo '<p><strong>' . esc_html( $period ) . ' total:</strong> $' . number_format( (float) ( $monthly_total->total_cost_usd ?? 0 ), 4 ) . '</p>';

		// Per-user table
		echo '<h2>Monthly Costs by User</h2>';
		echo '<table class="widefat striped"><thead><tr>
			<th>User ID</th><th>Email</th><th>Service</th><th>Calls</th><th>Total USD</th>
		</tr></thead><tbody>';

		if ( empty( $by_user ) ) {
			echo '<tr><td colspan="5">No costs recorded this month.</td></tr>';
		}
		foreach ( $by_user as $row ) {
			printf(
				'<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td>$%s</td></tr>',
				(int)   $row->user_id,
				esc_html( $row->user_email     ?? '—' ),
				esc_html( $row->service        ?? '?' ),
				esc_html( $row->call_count      ?? 0 ),
				number_format( (float) ( $row->total_cost_usd ?? 0 ), 4 )
			);
		}

		echo '</tbody></table>';

		// Daily table (last 30 days)
		echo '<h2>Daily Totals — Last 30 Days</h2>';
		echo '<table class="widefat striped"><thead><tr>
			<th>Date</th><th>Service</th><th>Calls</th><th>Total USD</th>
		</tr></thead><tbody>';

		if ( empty( $daily_30 ) ) {
			echo '<tr><td colspan="4">No data.</td></tr>';
		}
		foreach ( $daily_30 as $row ) {
			printf(
				'<tr><td>%s</td><td>%s</td><td>%s</td><td>$%s</td></tr>',
				esc_html( $row->log_date      ?? '' ),
				esc_html( $row->service       ?? '?' ),
				esc_html( $row->call_count    ?? 0 ),
				number_format( (float) ( $row->total_cost_usd ?? 0 ), 4 )
			);
		}

		echo '</tbody></table></div>';
	}
}
