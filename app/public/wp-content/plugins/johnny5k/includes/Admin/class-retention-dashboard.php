<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\AdminApiController;

/**
 * Admin sub-page: Retention & Winback Dashboard
 */
class RetentionDashboard {

	public static function render(): void {
		$days = isset( $_GET['days'] ) ? (int) $_GET['days'] : 30;
		$days = max( 7, min( 90, $days ) );
		$data = AdminApiController::retention_analytics_payload( $days );
		$segments = (array) ( $data['segments'] ?? [] );
		$users = (array) ( $data['users'] ?? [] );
		$events = (array) ( $data['events'] ?? [] );
		$push_summary = (array) ( $data['push_summary'] ?? [] );
		$delivery_summary = (array) ( $data['delivery_summary'] ?? [] );
		$recent_deliveries = (array) ( $data['recent_deliveries'] ?? [] );

		echo '<div class="wrap">';
		echo '<h1>User Analytics &amp; Winback</h1>';
		echo '<p>Segment users by inactivity, review behavior events, and spot trends for retention campaigns.</p>';

		echo '<form method="get" style="margin:12px 0 18px">';
		echo '<input type="hidden" name="page" value="jf-retention-dashboard" />';
		echo '<label for="jf-retention-days"><strong>Window:</strong> </label>';
		echo '<select id="jf-retention-days" name="days">';
		foreach ( [ 7, 14, 30, 60, 90 ] as $option ) {
			printf( '<option value="%d"%s>%d days</option>', $option, selected( $days, $option, false ), $option );
		}
		echo '</select> ';
		echo '<button class="button button-primary" type="submit">Refresh</button>';
		echo '</form>';

		echo '<div style="display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:12px;margin:16px 0 22px">';
		self::stat_card( 'Total Users', (int) ( $data['total_users'] ?? 0 ) );
		self::stat_card( 'Active (0-2d)', (int) ( $segments['active'] ?? 0 ) );
		self::stat_card( 'At Risk (3-6d)', (int) ( $segments['at_risk'] ?? 0 ) );
		self::stat_card( 'Winback (7-13d)', (int) ( $segments['winback'] ?? 0 ) );
		self::stat_card( 'Churned (14+d)', (int) ( $segments['churned'] ?? 0 ) );
		echo '</div>';

		echo '<h2>Push &amp; Delivery Health</h2>';
		echo '<div style="display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:12px;margin:16px 0 22px">';
		self::stat_card( 'Active Push Subs', (int) ( $push_summary['active_subscriptions'] ?? 0 ) );
		self::stat_card( 'Users With Push', (int) ( $push_summary['active_users'] ?? 0 ) );
		self::stat_card( 'Disabled Push Subs', (int) ( $push_summary['disabled_subscriptions'] ?? 0 ) );
		self::stat_card( 'Stale Active Subs', (int) ( $push_summary['stale_active_subscriptions'] ?? 0 ) );
		echo '</div>';

		echo '<table class="widefat striped"><thead><tr><th>Channel</th><th>Sent</th><th>Queued</th><th>Failed</th><th>Suppressed</th></tr></thead><tbody>';
		foreach ( [ 'push', 'sms', 'in_app' ] as $channel ) {
			$row = is_array( $delivery_summary[ $channel ] ?? null ) ? $delivery_summary[ $channel ] : [];
			printf(
				'<tr><td><strong>%s</strong></td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
				esc_html( strtoupper( $channel ) ),
				esc_html( number_format_i18n( (int) ( $row['sent'] ?? 0 ) ) ),
				esc_html( number_format_i18n( (int) ( $row['queued'] ?? 0 ) ) ),
				esc_html( number_format_i18n( (int) ( $row['failed'] ?? 0 ) ) ),
				esc_html( number_format_i18n( (int) ( $row['suppressed'] ?? 0 ) ) )
			);
		}
		echo '</tbody></table>';

		echo '<h2>Top Behavior Events (Last ' . esc_html( (string) $days ) . ' Days)</h2>';
		echo '<table class="widefat striped"><thead><tr><th>Event</th><th>Total Events</th><th>Distinct Users</th></tr></thead><tbody>';
		if ( empty( $events ) ) {
			echo '<tr><td colspan="3">No behavior events recorded yet.</td></tr>';
		}
		foreach ( $events as $event ) {
			printf(
				'<tr><td><code>%s</code></td><td>%s</td><td>%s</td></tr>',
				esc_html( (string) ( $event['event_name'] ?? '' ) ),
				esc_html( number_format_i18n( (int) ( $event['total_events'] ?? 0 ) ) ),
				esc_html( number_format_i18n( (int) ( $event['active_users'] ?? 0 ) ) )
			);
		}
		echo '</tbody></table>';

		echo '<h2 style="margin-top:24px">User Segments</h2>';
		echo '<table class="widefat striped"><thead><tr>
			<th>User</th><th>Email</th><th>Segment</th><th>Inactive Days</th><th>Last Active</th><th>Onboarding</th>
		</tr></thead><tbody>';

		if ( empty( $users ) ) {
			echo '<tr><td colspan="6">No users found.</td></tr>';
		}

		foreach ( $users as $user ) {
			$segment = (string) ( $user['segment'] ?? 'churned' );
			$segment_label = ucwords( str_replace( '_', ' ', $segment ) );
			$segment_style = match ( $segment ) {
				'active' => 'background:#e7f8ef;color:#117a45;',
				'at_risk' => 'background:#fff6df;color:#8a6000;',
				'winback' => 'background:#fdeee1;color:#9b4b00;',
				default => 'background:#fde8ec;color:#8a1d3a;',
			};
			printf(
				'<tr>
					<td>%s</td>
					<td>%s</td>
					<td><span style="display:inline-block;padding:4px 10px;border-radius:999px;font-weight:600;%s">%s</span></td>
					<td>%s</td>
					<td>%s</td>
					<td>%s</td>
				</tr>',
				esc_html( (string) ( $user['name'] ?: ( 'User #' . (int) ( $user['user_id'] ?? 0 ) ) ) ),
				esc_html( (string) ( $user['user_email'] ?? '' ) ),
				esc_attr( $segment_style ),
				esc_html( $segment_label ),
				isset( $user['inactive_days'] ) ? esc_html( (string) (int) $user['inactive_days'] ) : '—',
				! empty( $user['last_active_at'] ) ? esc_html( (string) $user['last_active_at'] ) : '—',
				! empty( $user['onboarding_complete'] ) ? 'Complete' : 'Not complete'
			);
		}

		echo '</tbody></table>';

		echo '<h2 style="margin-top:24px">Recent Coach Deliveries</h2>';
		echo '<table class="widefat striped"><thead><tr><th>User</th><th>Channel</th><th>Status</th><th>Delivery Key</th><th>Title</th><th>Error</th><th>Created</th></tr></thead><tbody>';
		if ( empty( $recent_deliveries ) ) {
			echo '<tr><td colspan="7">No coach deliveries logged yet.</td></tr>';
		}
		foreach ( $recent_deliveries as $delivery ) {
			$name = trim( (string) ( $delivery['first_name'] ?? '' ) . ' ' . (string) ( $delivery['last_name'] ?? '' ) );
			$user_label = '' !== trim( $name ) ? $name : (string) ( $delivery['user_email'] ?? ( 'User #' . (int) ( $delivery['user_id'] ?? 0 ) ) );
			printf(
				'<tr><td>%s</td><td>%s</td><td>%s</td><td><code>%s</code></td><td>%s</td><td>%s</td><td>%s</td></tr>',
				esc_html( $user_label ),
				esc_html( strtoupper( (string) ( $delivery['channel'] ?? '' ) ) ),
				esc_html( ucfirst( (string) ( $delivery['status'] ?? '' ) ) ),
				esc_html( (string) ( $delivery['delivery_key'] ?? '' ) ),
				esc_html( (string) ( $delivery['title'] ?? '' ) ),
				esc_html( (string) ( $delivery['error_message'] ?? '' ) ),
				esc_html( (string) ( $delivery['created_at'] ?? '' ) )
			);
		}
		echo '</tbody></table>';
		echo '</div>';
	}

	private static function stat_card( string $label, int $value ): void {
		printf(
			'<div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:14px 16px;text-align:center">
				<div style="font-size:1.65em;font-weight:700;color:#1d2327">%s</div>
				<div style="color:#666;margin-top:4px">%s</div>
			</div>',
			esc_html( number_format_i18n( $value ) ),
			esc_html( $label )
		);
	}
}
