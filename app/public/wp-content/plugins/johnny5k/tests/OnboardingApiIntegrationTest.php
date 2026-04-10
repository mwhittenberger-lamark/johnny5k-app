<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\OnboardingController;
use Johnny5k\Tests\Support\ApiIntegrationTestCase;

class OnboardingApiIntegrationTest extends ApiIntegrationTestCase {
	public function test_onboarding_complete_calculates_targets_marks_profile_and_returns_payload(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles WHERE user_id = 7', (object) [
			'user_id' => 7,
			'first_name' => 'Mike',
			'date_of_birth' => '1990-01-01',
			'sex' => 'male',
			'height_cm' => 180,
			'starting_weight_lb' => 200,
			'current_goal' => 'cut',
			'goal_rate' => 'moderate',
			'training_experience' => 'intermediate',
		] );
		$db->expectGetVar( 'SELECT id FROM wp_fit_user_goals WHERE user_id = 7 AND active = 1', 0 );
		$db->expectGetRow( 'SELECT current_goal, goal_rate FROM wp_fit_user_profiles WHERE user_id = 7', (object) [
			'current_goal' => 'cut',
			'goal_rate' => 'moderate',
		] );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7', 'UTC' );
		$db->expectGetRow( 'FROM wp_fit_program_templates', null );
		$db->expectGetRow( 'SELECT * FROM wp_fit_program_templates WHERE active = 1 LIMIT 1', null );
		$db->expectGetVar( 'SELECT id FROM wp_fit_awards WHERE code = \'onboarding_complete\'', 6 );
		$db->expectGetVar( 'SELECT id FROM wp_fit_user_awards WHERE user_id = 7 AND award_id = 6', 0 );
		$db->expectGetRow( 'SELECT id FROM wp_fit_user_training_plans WHERE user_id = 7', null );

		$response = OnboardingController::complete( new \WP_REST_Request( 'POST', '/fit/v1/onboarding/complete' ) );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['completed'] );
		$this->assertSame( 2129, $data['target_calories'] );
		$this->assertSame( 200, $data['target_protein_g'] );
		$this->assertSame( [], $data['week_split'] );
		$this->assertStringContainsString( 'lean out', $data['coach_message'] );
		$this->assertCount( 3, $db->inserted );
		$this->assertSame( 'wp_fit_user_goals', $db->inserted[0]['table'] );
		$this->assertSame( 'wp_fit_user_awards', $db->inserted[1]['table'] );
		$this->assertSame( 'wp_fit_behavior_events', $db->inserted[2]['table'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_user_profiles', $db->updated[0]['table'] );
		$this->assertSame( 1, $db->updated[0]['data']['onboarding_complete'] );
	}

	public function test_onboarding_complete_with_missing_profile_fields_returns_400(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles WHERE user_id = 7', (object) [
			'user_id' => 7,
			'first_name' => 'Mike',
			'date_of_birth' => '',
			'sex' => '',
			'height_cm' => null,
			'starting_weight_lb' => null,
		] );

		$response = OnboardingController::complete( new \WP_REST_Request( 'POST', '/fit/v1/onboarding/complete' ) );
		$data = $response->get_data();

		$this->assertSame( 400, $response->get_status() );
		$this->assertSame( 'Missing required profile fields for calorie targets.', $data['message'] );
		$this->assertContains( 'date_of_birth', $data['missing_profile_fields'] );
		$this->assertContains( 'sex', $data['missing_profile_fields'] );
		$this->assertContains( 'height_cm', $data['missing_profile_fields'] );
		$this->assertContains( 'starting_weight_lb', $data['missing_profile_fields'] );
		$this->assertSame( [], $db->inserted );
	}
}
