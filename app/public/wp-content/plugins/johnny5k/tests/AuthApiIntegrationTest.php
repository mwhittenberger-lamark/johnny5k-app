<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\AuthController;
use Johnny5k\Tests\Support\ApiIntegrationTestCase;

class AuthApiIntegrationTest extends ApiIntegrationTestCase {
	public function test_auth_register_then_validate_returns_authenticated_session_payload(): void {
		$db = $this->wpdb();

		$req = new \WP_REST_Request( 'POST', '/fit/v1/auth/register' );
		$req->set_param( 'invite_code', 'ABCD-1234' );
		$req->set_param( 'email', 'new@example.com' );
		$req->set_param( 'password', 'strongpass' );
		$req->set_param( 'first_name', 'Mike' );
		$req->set_param( 'last_name', 'Smith' );

		$db->expectGetRow( 'FROM `wp_fit_invite_codes` WHERE code = \'ABCD-1234\'', (object) [
			'id' => 1,
			'used_by' => null,
		] );
		$db->expectGetVar( 'SELECT id FROM wp_fit_awards WHERE code = \'first_login\'', 5 );
		$db->expectGetVar( 'SELECT id FROM wp_fit_user_awards WHERE user_id = 100 AND award_id = 5', 0 );
		$db->expectGetVar( 'SELECT `onboarding_complete` FROM wp_fit_user_profiles WHERE user_id = 100', 0 );

		$response = AuthController::register( $req );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 100, $data['user_id'] );
		$this->assertSame( 'new@example.com', $data['email'] );
		$this->assertFalse( $data['onboarding_complete'] );
		$this->assertTrue( $data['valid'] );
		$this->assertSame( 'test-nonce', $data['nonce'] );
		$this->assertSame( 100, get_current_user_id() );
		$this->assertCount( 4, $db->inserted );
		$this->assertSame( 'wp_fit_user_profiles', $db->inserted[0]['table'] );
		$this->assertSame( 'wp_fit_user_preferences', $db->inserted[1]['table'] );
		$this->assertSame( 'wp_fit_user_awards', $db->inserted[2]['table'] );
		$this->assertSame( 'wp_fit_behavior_events', $db->inserted[3]['table'] );

		$db->expectGetVar( 'SELECT `onboarding_complete` FROM wp_fit_user_profiles WHERE user_id = 100', 0 );
		$validate = AuthController::validate_token( new \WP_REST_Request( 'GET', '/fit/v1/auth/validate' ) );
		$validate_data = $validate->get_data();

		$this->assertSame( 200, $validate->get_status() );
		$this->assertTrue( $validate_data['valid'] );
		$this->assertSame( 100, $validate_data['user_id'] );
	}

	public function test_auth_login_with_invalid_credentials_returns_401(): void {
		wp_insert_user( [
			'user_login' => 'mike',
			'user_email' => 'mike@example.com',
			'user_pass' => 'correctpass',
			'role' => 'subscriber',
		] );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/auth/login' );
		$req->set_param( 'email', 'mike@example.com' );
		$req->set_param( 'password', 'wrongpass' );

		$response = AuthController::login( $req );
		$data = $response->get_data();

		$this->assertSame( 401, $response->get_status() );
		$this->assertSame( 'invalid_credentials', $data['code'] );
		$this->assertSame( 'Invalid email or password.', $data['message'] );
	}

	public function test_auth_register_with_invalid_invite_code_returns_403(): void {
		$db = $this->wpdb();

		$req = new \WP_REST_Request( 'POST', '/fit/v1/auth/register' );
		$req->set_param( 'invite_code', 'BADC-0000' );
		$req->set_param( 'email', 'new@example.com' );
		$req->set_param( 'password', 'strongpass' );

		$db->expectGetRow( 'FROM `wp_fit_invite_codes` WHERE code = \'BADC-0000\'', null );

		$response = AuthController::register( $req );
		$data = $response->get_data();

		$this->assertSame( 403, $response->get_status() );
		$this->assertSame( 'invalid_invite_code', $data['code'] );
	}
}
