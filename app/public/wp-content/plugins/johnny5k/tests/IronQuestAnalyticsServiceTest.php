<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\IronQuestAnalyticsService;
use Johnny5k\Tests\Support\ServiceTestCase;

class IronQuestAnalyticsServiceTest extends ServiceTestCase {
	public function test_track_records_behavior_event_and_recent_log(): void {
		$user_id = 42;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'admin@example.test', 'admin', [ 'manage_options' => true ] );

		IronQuestAnalyticsService::track(
			$user_id,
			'mission_started',
			[
				'run_id'        => 91,
				'location_slug' => 'grim_hollow_village',
				'mission_slug'  => 'captain_of_the_yard',
			],
			'success',
			'mission_start'
		);

		$inserted = array_values(
			array_filter(
				$this->wpdb()->inserted,
				static fn( array $entry ): bool => 'wp_fit_behavior_events' === $entry['table']
			)
		);

		$this->assertCount( 1, $inserted );
		$this->assertSame( 'ironquest_mission_started', $inserted[0]['data']['event_name'] );
		$this->assertSame( 'ironquest', $inserted[0]['data']['screen'] );
		$this->assertSame( 'mission_start', $inserted[0]['data']['context'] );

		$recent = IronQuestAnalyticsService::list_recent_events( 5, $user_id );
		$this->assertCount( 1, $recent );
		$this->assertSame( 'mission_started', $recent[0]['event_name'] );
		$this->assertSame( 'success', $recent[0]['status'] );
		$this->assertSame( 91, $recent[0]['metadata']['run_id'] );
	}

	public function test_track_failure_records_diagnostics_entry(): void {
		$user_id = 43;
		$GLOBALS['johnny5k_test_users'][ $user_id ] = new \WP_User( $user_id, 'support@example.test', 'support', [ 'manage_options' => true ] );

		IronQuestAnalyticsService::track_failure(
			$user_id,
			'world_art_failed',
			'API key expired.',
			[
				'art_type'      => 'store_owner',
				'location_slug' => 'the_training_grounds',
			],
			'world_art',
			503
		);

		$recent = IronQuestAnalyticsService::list_recent_events( 5, $user_id );
		$this->assertCount( 1, $recent );
		$this->assertSame( 'failure', $recent[0]['status'] );
		$this->assertSame( 'world_art_failed', $recent[0]['event_name'] );
		$this->assertSame( 503, $recent[0]['metadata']['status_code'] );

		$diagnostics = get_option( 'jf_internal_diagnostics_log', [] );
		$this->assertIsArray( $diagnostics );
		$this->assertSame( 'ironquest_backend', $diagnostics[0]['source'] ?? '' );
		$this->assertSame( 'API key expired.', $diagnostics[0]['error_message'] ?? '' );
	}
}
