<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Bootstrap\CronBootstrap;
use Johnny5k\Services\JobLogger;

class JobMonitorPage {
	public static function render(): void {
		$jobs = CronBootstrap::registered_jobs();
		$log_entries = JobLogger::list_entries( 20 );

		echo '<div class="wrap">';
		echo '<h1>Johnny5k Job Monitor</h1>';
		echo '<p>Queue health for recurring background jobs managed by Action Scheduler.</p>';
		echo '<p><a class="button button-secondary" href="' . esc_url( admin_url( 'tools.php?page=action-scheduler' ) ) . '">Open Scheduled Actions</a></p>';

		echo '<table class="widefat striped" style="margin-top:20px">';
		echo '<thead><tr><th>Job</th><th>Last run</th><th>Last success</th><th>Last failure</th><th>Failed jobs</th><th>Pending jobs</th><th>Retry policy</th></tr></thead><tbody>';

		foreach ( $jobs as $hook => $job ) {
			$health = JobLogger::health_for_hook( $hook );
			$metrics = CronBootstrap::queue_metrics( $hook );
			$retry_label = ! empty( $job['retryable'] ) ? 'Automatic retry enabled' : 'Logged only';

			echo '<tr>';
			echo '<td><strong>' . esc_html( (string) $job['label'] ) . '</strong><br><code>' . esc_html( $hook ) . '</code></td>';
			echo '<td>' . esc_html( self::format_datetime( $health['last_started_at'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( self::format_datetime( $health['last_success_at'] ?? '' ) ) . '</td>';
			echo '<td>' . esc_html( self::format_failure( $health ) ) . '</td>';
			echo '<td>' . esc_html( (string) $metrics['failed'] ) . '</td>';
			echo '<td>' . esc_html( (string) $metrics['pending'] ) . '</td>';
			echo '<td>' . esc_html( $retry_label ) . '</td>';
			echo '</tr>';
		}

		echo '</tbody></table>';

		echo '<h2 style="margin-top:24px">Recent job log</h2>';
		echo '<table class="widefat striped"><thead><tr><th>Time</th><th>Hook</th><th>Event</th><th>Details</th></tr></thead><tbody>';

		if ( [] === $log_entries ) {
			echo '<tr><td colspan="4">No job activity has been logged yet.</td></tr>';
		} else {
			foreach ( $log_entries as $entry ) {
				$payload = is_array( $entry['payload'] ?? null ) ? $entry['payload'] : [];
				$details = wp_json_encode( $payload );

				echo '<tr>';
				echo '<td>' . esc_html( self::format_datetime( (string) ( $entry['created_at'] ?? '' ) ) ) . '</td>';
				echo '<td><code>' . esc_html( (string) ( $entry['hook'] ?? '' ) ) . '</code></td>';
				echo '<td>' . esc_html( (string) ( $entry['event'] ?? '' ) ) . '</td>';
				echo '<td><code>' . esc_html( false !== $details ? $details : '' ) . '</code></td>';
				echo '</tr>';
			}
		}

		echo '</tbody></table>';
		echo '</div>';
	}

	private static function format_datetime( string $value ): string {
		return '' === trim( $value ) ? 'Never' : $value . ' UTC';
	}

	private static function format_failure( array $health ): string {
		$time = trim( (string) ( $health['last_failure_at'] ?? '' ) );
		$error = trim( (string) ( $health['last_error'] ?? '' ) );

		if ( '' === $time ) {
			return 'No recorded failure';
		}

		return '' === $error ? $time . ' UTC' : $time . ' UTC - ' . $error;
	}
}