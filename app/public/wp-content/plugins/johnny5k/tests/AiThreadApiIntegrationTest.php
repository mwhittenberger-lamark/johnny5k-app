<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\AiChatController;
use Johnny5k\REST\AuthController;
use Johnny5k\Tests\Support\ApiIntegrationTestCase;

class AiThreadApiIntegrationTest extends ApiIntegrationTestCase {
	public function test_ai_thread_retrieval_returns_messages_follow_ups_and_memory(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		update_user_meta( 7, 'jf_johnny_durable_memory', [
			'bullets' => [ 'Needs easy weekday lunches.' ],
			'profile' => [
				'preferred_workout_styles' => [ 'Bodyweight circuits' ],
				'favorite_exercises' => [ 'Push-ups' ],
				'disliked_exercises' => [ 'Burpees' ],
				'schedule_patterns' => [ 'Trains Mon/Wed/Fri mornings' ],
				'motivation_triggers' => [ 'Feels better after short wins' ],
				'past_struggles' => [ 'Falls off when sessions are too long' ],
				'milestones' => [ 'Completed first 4-week streak' ],
				'personal_context' => [ 'Often trains in hotel rooms' ],
			],
			'updated_at' => '2026-04-09 08:00:00',
		] );
		update_user_meta( 7, 'jf_johnny_follow_ups', [
			[
				'id' => 'fu1',
				'prompt' => 'Prep lunches on Sunday',
				'reason' => 'consistency',
				'due_at' => '2026-04-08 10:00:00',
				'status' => 'pending',
				'created_at' => '2026-04-07 09:00:00',
			],
		] );
		update_user_meta( 7, 'jf_johnny_follow_up_history', [
			[
				'id' => 'fu0',
				'prompt' => 'Hit protein goal',
				'reason' => 'nutrition',
				'state' => 'completed',
				'changed_at' => '2026-04-08 08:00:00',
				'due_at' => '2026-04-08 07:00:00',
			],
		] );

		$db->expectGetRow( 'FROM wp_fit_ai_threads WHERE thread_key = \'u7_main\'', (object) [ 'id' => 55 ] );
		$db->expectGetResults( 'FROM wp_fit_ai_messages', [
			(object) [
				'role' => 'user',
				'message_text' => 'How did I do?',
				'tool_payload_json' => '',
				'created_at' => '2026-04-09 10:00:00',
			],
			(object) [
				'role' => 'assistant',
				'message_text' => 'You were on track.',
				'tool_payload_json' => json_encode( [
					'used_tools' => [ 'get_today_nutrition' ],
					'confidence' => 'high',
				] ),
				'created_at' => '2026-04-09 10:01:00',
			],
		] );
		for ( $i = 0; $i < 6; $i++ ) {
			$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7', 'UTC' );
		}

		$req = new \WP_REST_Request( 'GET', '/fit/v1/ai/thread/main' );
		$req->set_param( 'key', 'main' );

		$response = AiChatController::get_thread( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertCount( 2, $data['messages'] );
		$this->assertSame( 'user', $data['messages'][0]['role'] );
		$this->assertSame( [ 'get_today_nutrition' ], $data['messages'][1]['used_tools'] );
		$this->assertSame( 'high', $data['messages'][1]['confidence'] );
		$this->assertSame( 'Needs easy weekday lunches.', $data['durable_memory']['bullets'][0] );
		$this->assertSame( 'Bodyweight circuits', $data['durable_memory']['profile']['preferred_workout_styles'][0] );
		$this->assertSame( 'Push-ups', $data['durable_memory']['profile']['favorite_exercises'][0] );
		$this->assertSame( 1, $data['follow_up_overview']['pending_count'] );
		$this->assertSame( 'Prep lunches on Sunday', $data['follow_ups'][0]['prompt'] );
	}

	public function test_ai_thread_permission_callback_requires_authentication(): void {
		$GLOBALS['johnny5k_test_current_user_id'] = 0;

		$result = AuthController::require_auth( new \WP_REST_Request( 'GET', '/fit/v1/ai/thread/main' ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rest_not_logged_in', $result->get_error_code() );
		$this->assertSame( 'Authentication required.', $result->get_error_message() );
	}
}
