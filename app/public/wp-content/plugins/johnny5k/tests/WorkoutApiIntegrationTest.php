<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Tests\Support\ApiIntegrationTestCase;
use Johnny5k\Tests\Support\TestWorkoutController;

class WorkoutApiIntegrationTest extends ApiIntegrationTestCase {
	public function test_workout_start_creates_session_through_controller_flow(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7', 'UTC' );
		$db->expectGetRow( 'FROM wp_fit_workout_sessions', null );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/start' );
		$req->set_param( 'time_tier', 'full' );
		$req->set_param( 'day_type', 'push' );
		$req->set_param( 'readiness_score', 2 );

		$response = TestWorkoutController::start( $req );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 55, $data['session_id'] );
		$this->assertCount( 1, TestWorkoutController::$build_calls );
		$this->assertSame( 'short', TestWorkoutController::$build_calls[0]['time_tier'] );
		$this->assertTrue( TestWorkoutController::$build_calls[0]['maintenance_mode'] );
		$this->assertSame( 'push', TestWorkoutController::$build_calls[0]['day_type_override'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_workout_sessions', $db->updated[0]['table'] );
		$this->assertSame( 2, $db->updated[0]['data']['readiness_score'] );
	}

	public function test_workout_complete_returns_summary_and_snapshots(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_workout_sessions WHERE id = 55 AND user_id = 7', (object) [
			'id' => 55,
			'user_id' => 7,
			'planned_day_type' => 'push',
			'time_tier' => 'full',
			'started_at' => '2026-04-09 11:00:00',
			'completed' => 0,
		] );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/complete' );
		$req->set_param( 'id', 55 );

		$response = TestWorkoutController::complete_session( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['completed'] );
		$this->assertSame( 60, $data['duration_minutes'] );
		$this->assertSame( 321, $data['estimated_calories'] );
		$this->assertSame( 201, $data['snapshots'][0]['exercise_id'] );
		$this->assertSame( 'Strong session.', $data['ai_summary']['summary'] );
		$this->assertSame( [ 'user_id' => 7, 'session_id' => 55 ], TestWorkoutController::$complete_calls['summary'][0] );
		$this->assertSame( [ 'user_id' => 7, 'duration_minutes' => 60, 'day_type' => 'push', 'time_tier' => 'full' ], TestWorkoutController::$complete_calls['estimate'][0] );
		$this->assertSame( [ 55 ], TestWorkoutController::$complete_calls['snapshots'] );
		$this->assertActionMeta( $data, 'complete_session' );
		$this->assertSame( [ 7 ], TestWorkoutController::$complete_calls['evaluate'] );
		$this->assertSame( 'first_workout', TestWorkoutController::$complete_calls['grant'][0]['code'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 1, $db->updated[0]['data']['completed'] );
	}

	public function test_workout_complete_with_unknown_session_returns_404(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_workout_sessions WHERE id = 999 AND user_id = 7', null );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/999/complete' );
		$req->set_param( 'id', 999 );

		$response = TestWorkoutController::complete_session( $req );
		$data = $response->get_data();

		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( 'Session not found.', $data['message'] );
	}

	public function test_workout_log_set_creates_set_for_owned_session(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/set' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'session_exercise_id', 700 );
		$req->set_param( 'set_number', 2 );
		$req->set_param( 'weight', 185 );
		$req->set_param( 'reps', 8 );
		$req->set_param( 'rir', 2 );
		$req->set_param( 'pain_flag', false );

		$response = TestWorkoutController::log_set( $req );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 1, $data['set_id'] );
		$this->assertCount( 1, $db->inserted );
		$this->assertSame( 'wp_fit_workout_sets', $db->inserted[0]['table'] );
		$this->assertSame( 700, $db->inserted[0]['data']['session_exercise_id'] );
		$this->assertSame( 2, $db->inserted[0]['data']['set_number'] );
		$this->assertSame( 185.0, $db->inserted[0]['data']['weight'] );
		$this->assertSame( 8, $db->inserted[0]['data']['reps'] );
		$this->assertActionMeta( $data, 'log_set' );
	}

	public function test_workout_log_set_rejects_missing_session(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 999', 0 );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/999/set' );
		$req->set_param( 'id', 999 );

		$response = TestWorkoutController::log_set( $req );
		$data = $response->get_data();

		$this->assertSame( 404, $response->get_status() );
		$this->assertSame( 'Session not found.', $data['message'] );
		$this->assertCount( 0, $db->inserted );
	}

	public function test_workout_update_set_persists_mutated_fields(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );

		$req = new \WP_REST_Request( 'PUT', '/fit/v1/workout/55/set/12' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'set_id', 12 );
		$req->set_param( 'weight', 205 );
		$req->set_param( 'reps', 5 );
		$req->set_param( 'completed', true );
		$req->set_param( 'pain_flag', true );
		$req->set_param( 'notes', 'Top set' );
		$req->set_param( 'action_id', 'client-123' );
		$req->set_param( 'action_source', 'coach_card' );

		$response = TestWorkoutController::update_set( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['updated'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_workout_sets', $db->updated[0]['table'] );
		$this->assertSame( [ 'id' => 12 ], $db->updated[0]['where'] );
		$this->assertSame( 205.0, $db->updated[0]['data']['weight'] );
		$this->assertSame( 5, $db->updated[0]['data']['reps'] );
		$this->assertSame( 1, $db->updated[0]['data']['completed'] );
		$this->assertSame( 1, $db->updated[0]['data']['pain_flag'] );
		$this->assertSame( 'Top set', $db->updated[0]['data']['notes'] );
		$this->assertActionMeta( $data, 'update_set', 'coach_card', 'client-123' );
	}

	public function test_workout_delete_set_removes_row_and_resequences_remaining_sets(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );
		$db->expectGetRow( 'FROM wp_fit_workout_sets ws', (object) [
			'id' => 12,
			'session_exercise_id' => 700,
			'set_number' => 2,
			'weight' => 185,
			'reps' => 8,
			'rir' => 2,
			'rpe' => null,
			'completed' => 1,
			'pain_flag' => 0,
			'notes' => 'Warm-up',
		] );
		$db->expectGetCol( 'SELECT id FROM wp_fit_workout_sets WHERE session_exercise_id = 700 ORDER BY set_number, id', [ 11, 13 ] );

		$req = new \WP_REST_Request( 'DELETE', '/fit/v1/workout/55/set/12' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'set_id', 12 );

		$response = TestWorkoutController::delete_set( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['deleted'] );
		$this->assertSame( 700, $data['set']['session_exercise_id'] );
		$this->assertCount( 1, $db->deleted );
		$this->assertSame( 'wp_fit_workout_sets', $db->deleted[0]['table'] );
		$this->assertSame( [ 'id' => 12 ], $db->deleted[0]['where'] );
		$this->assertCount( 2, $db->updated );
		$this->assertSame( [ 'set_number' => 1 ], $db->updated[0]['data'] );
		$this->assertSame( [ 'id' => 11 ], $db->updated[0]['where'] );
		$this->assertSame( [ 'set_number' => 2 ], $db->updated[1]['data'] );
		$this->assertSame( [ 'id' => 13 ], $db->updated[1]['where'] );
		$this->assertActionMeta( $data, 'delete_set' );
	}

	public function test_workout_swap_exercise_updates_session_exercise_and_returns_replacement(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );
		$db->expectGetRow( 'FROM wp_fit_workout_session_exercises', (object) [
			'exercise_id' => 201,
			'original_exercise_id' => null,
		] );
		$db->expectGetRow( "FROM wp_fit_exercises\n\t\t\t WHERE id = 305 AND active = 1", (object) [
			'id' => 305,
			'name' => 'Incline Dumbbell Press',
			'primary_muscle' => 'chest',
			'equipment' => 'dumbbell',
			'difficulty' => 'intermediate',
		] );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/swap' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'session_exercise_id', 700 );
		$req->set_param( 'new_exercise_id', 305 );

		$response = TestWorkoutController::swap_exercise( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['swapped'] );
		$this->assertSame( 305, $data['exercise']->id );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_workout_session_exercises', $db->updated[0]['table'] );
		$this->assertSame( [ 'id' => 700 ], $db->updated[0]['where'] );
		$this->assertSame( 305, $db->updated[0]['data']['exercise_id'] );
		$this->assertSame( 1, $db->updated[0]['data']['was_swapped'] );
		$this->assertSame( 201, $db->updated[0]['data']['original_exercise_id'] );
		$this->assertActionMeta( $data, 'swap_exercise' );
	}

	public function test_workout_skip_session_marks_skip_and_returns_warning_threshold(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/skip' );
		$req->set_param( 'id', 55 );

		$response = TestWorkoutController::skip_session( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['skipped'] );
		$this->assertSame( 3, $data['skip_count'] );
		$this->assertTrue( $data['skip_warning'] );
		$this->assertActionMeta( $data, 'skip_session' );
		$this->assertSame( [ [ 'session_id' => 55, 'user_id' => 7 ] ], TestWorkoutController::$skip_calls );
	}

	public function test_workout_restart_session_deactivates_and_deletes_active_session_records(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_workout_sessions WHERE id = 55 AND user_id = 7', (object) [
			'id' => 55,
			'user_id' => 7,
			'session_date' => '2026-04-09',
			'completed' => 0,
		] );
		$db->expectGetCol( "SELECT id FROM wp_fit_workout_sessions\n\t\t\t WHERE user_id = 7\n\t\t\t   AND session_date = '2026-04-09'\n\t\t\t   AND completed = 0\n\t\t\t   AND skip_requested = 0", [ 55 ] );
		$db->expectGetCol( 'SELECT id FROM wp_fit_workout_session_exercises WHERE session_id = 55', [ 700, 701 ] );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/restart' );
		$req->set_param( 'id', 55 );

		$response = TestWorkoutController::restart_session( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['restarted'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_workout_sessions', $db->updated[0]['table'] );
		$this->assertSame( 1, $db->updated[0]['data']['skip_requested'] );
		$this->assertCount( 2, $db->deleted );
		$this->assertSame( 'wp_fit_workout_session_exercises', $db->deleted[0]['table'] );
		$this->assertSame( 'wp_fit_workout_sessions', $db->deleted[1]['table'] );
		$this->assertTrue( (bool) array_filter( $db->queries, static fn( string $query ): bool => str_contains( $query, 'DELETE FROM wp_fit_workout_sets' ) ) );
	}

	public function test_workout_discard_session_deactivates_without_deleting_records(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_workout_sessions WHERE id = 55 AND user_id = 7', (object) [
			'id' => 55,
			'user_id' => 7,
			'session_date' => '2026-04-09',
			'completed' => 0,
		] );
		$db->expectGetCol( "SELECT id FROM wp_fit_workout_sessions\n\t\t\t WHERE user_id = 7\n\t\t\t   AND session_date = '2026-04-09'\n\t\t\t   AND completed = 0\n\t\t\t   AND skip_requested = 0", [ 55 ] );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/discard' );
		$req->set_param( 'id', 55 );

		$response = TestWorkoutController::discard_session( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['discarded'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_workout_sessions', $db->updated[0]['table'] );
		$this->assertCount( 0, $db->deleted );
		$this->assertCount( 0, $db->queries );
	}

	public function test_workout_undo_swap_restores_previous_exercise_state(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_workout_session_exercises WHERE id = 700 AND session_id = 55', 1 );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/swap/undo' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'session_exercise_id', 700 );
		$req->set_param( 'previous_exercise_id', 201 );
		$req->set_param( 'previous_original_exercise_id', 199 );
		$req->set_param( 'previous_was_swapped', false );

		$response = TestWorkoutController::undo_swap_exercise( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['undone'] );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_workout_session_exercises', $db->updated[0]['table'] );
		$this->assertSame( [ 'id' => 700, 'session_id' => 55 ], $db->updated[0]['where'] );
		$this->assertSame( 201, $db->updated[0]['data']['exercise_id'] );
		$this->assertSame( 0, $db->updated[0]['data']['was_swapped'] );
		$this->assertSame( 199, $db->updated[0]['data']['original_exercise_id'] );
		$this->assertActionMeta( $data, 'undo_swap_exercise' );
	}

	public function test_workout_undo_quick_add_removes_added_exercise_and_sets(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_workout_session_exercises WHERE id = 812 AND session_id = 55', 1 );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/quick-add/undo' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'session_exercise_id', 812 );

		$response = TestWorkoutController::undo_quick_add_exercise( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['undone'] );
		$this->assertCount( 2, $db->deleted );
		$this->assertSame( 'wp_fit_workout_sets', $db->deleted[0]['table'] );
		$this->assertSame( [ 'session_exercise_id' => 812 ], $db->deleted[0]['where'] );
		$this->assertSame( 'wp_fit_workout_session_exercises', $db->deleted[1]['table'] );
		$this->assertSame( [ 'id' => 812, 'session_id' => 55 ], $db->deleted[1]['where'] );
		$this->assertActionMeta( $data, 'undo_quick_add_exercise' );
	}

	public function test_workout_restore_set_returns_201_and_restored_payload_with_action_meta(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_workout_session_exercises WHERE id = 700 AND session_id = 55', 1 );
		$db->expectGetCol( 'SELECT id FROM wp_fit_workout_sets WHERE session_exercise_id = 700 ORDER BY set_number, id', [ 21, 22 ] );

		$req = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/set/restore' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'session_exercise_id', 700 );
		$req->set_param( 'set_number', 2 );
		$req->set_param( 'weight', 95 );
		$req->set_param( 'reps', 12 );
		$req->set_param( 'completed', true );
		$req->set_param( 'pain_flag', false );

		$response = TestWorkoutController::restore_set( $req );
		$data = $response->get_data();

		$this->assertSame( 201, $response->get_status() );
		$this->assertTrue( $data['restored'] );
		$this->assertSame( 1, $data['set_id'] );
		$this->assertCount( 1, $db->inserted );
		$this->assertSame( 'wp_fit_workout_sets', $db->inserted[0]['table'] );
		$this->assertCount( 1, $db->queries );
		$this->assertTrue( str_contains( $db->queries[0], 'UPDATE wp_fit_workout_sets' ) );
		$this->assertCount( 2, $db->updated );
		$this->assertSame( [ 'set_number' => 1 ], $db->updated[0]['data'] );
		$this->assertSame( [ 'id' => 21 ], $db->updated[0]['where'] );
		$this->assertSame( [ 'set_number' => 2 ], $db->updated[1]['data'] );
		$this->assertSame( [ 'id' => 22 ], $db->updated[1]['where'] );
		$this->assertActionMeta( $data, 'restore_set' );
	}

	public function test_workout_remove_and_restore_session_exercise_keep_payload_shape_and_status_parity(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );
		$db->expectGetRow( 'SELECT * FROM wp_fit_workout_session_exercises WHERE id = 701 AND session_id = 55', (object) [
			'id' => 701,
			'session_id' => 55,
			'exercise_id' => 201,
			'slot_type' => 'main',
			'planned_rep_min' => 8,
			'planned_rep_max' => 10,
			'planned_sets' => 3,
			'sort_order' => 2,
			'was_swapped' => 0,
			'original_exercise_id' => null,
			'notes' => null,
		] );
		$db->expectGetResults( 'FROM wp_fit_workout_sets', [
			(object) [
				'set_number' => 1,
				'weight' => 0,
				'reps' => 10,
				'rir' => null,
				'rpe' => null,
				'completed' => 1,
				'pain_flag' => 0,
				'notes' => null,
			],
		] );
		$db->expectGetCol( 'SELECT id FROM wp_fit_workout_session_exercises WHERE session_id = 55 ORDER BY sort_order, id', [ 700, 702 ] );

		$removeReq = new \WP_REST_Request( 'DELETE', '/fit/v1/workout/55/exercise/701' );
		$removeReq->set_param( 'id', 55 );
		$removeReq->set_param( 'session_exercise_id', 701 );

		$removeResponse = TestWorkoutController::remove_session_exercise( $removeReq );
		$removeData = $removeResponse->get_data();

		$this->assertSame( 200, $removeResponse->get_status() );
		$this->assertTrue( $removeData['removed'] );
		$this->assertSame( 201, $removeData['exercise']['exercise_id'] );
		$this->assertSame( 1, $removeData['exercise']['sets'][0]['set_number'] );
		$this->assertActionMeta( $removeData, 'remove_session_exercise' );

		$db->expectGetVar( 'SELECT user_id FROM wp_fit_workout_sessions WHERE id = 55', 7 );
		$db->expectGetCol( 'SELECT id FROM wp_fit_workout_session_exercises WHERE session_id = 55 ORDER BY sort_order, id', [ 700, 703, 702 ] );

		$restoreReq = new \WP_REST_Request( 'POST', '/fit/v1/workout/55/exercise/restore' );
		$restoreReq->set_param( 'id', 55 );
		$restoreReq->set_param( 'sort_order', 2 );
		$restoreReq->set_param( 'exercise_id', 201 );
		$restoreReq->set_param( 'slot_type', 'main' );
		$restoreReq->set_param( 'planned_rep_min', 8 );
		$restoreReq->set_param( 'planned_rep_max', 10 );
		$restoreReq->set_param( 'planned_sets', 3 );
		$restoreReq->set_param( 'sets', [
			[
				'set_number' => 1,
				'weight' => 0,
				'reps' => 10,
				'completed' => 1,
				'pain_flag' => 0,
			],
		] );

		$restoreResponse = TestWorkoutController::restore_session_exercise( $restoreReq );
		$restoreData = $restoreResponse->get_data();

		$this->assertSame( 201, $restoreResponse->get_status() );
		$this->assertTrue( $restoreData['restored'] );
		$this->assertSame( 1, $restoreData['session_exercise_id'] );
		$this->assertActionMeta( $restoreData, 'restore_session_exercise' );
	}

	public function test_workout_update_history_session_updates_row_and_moves_snapshots(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_workout_sessions WHERE id = 55 AND user_id = 7', (object) [
			'id' => 55,
			'user_id' => 7,
			'completed' => 1,
			'skip_requested' => 0,
			'session_date' => '2026-04-08',
			'actual_day_type' => 'push',
			'planned_day_type' => 'push',
			'time_tier' => 'medium',
			'duration_minutes' => 60,
		] );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7 LIMIT 1', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7 LIMIT 1', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7 LIMIT 1', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7 LIMIT 1', 'UTC' );
		$db->expectGetCol( 'SELECT DISTINCT exercise_id FROM wp_fit_workout_session_exercises WHERE session_id = 55', [ 201, 202 ] );
		$db->expectGetRow( 'SELECT s.id, s.session_date, s.planned_day_type, s.actual_day_type, s.time_tier', (object) [
			'id' => 55,
			'session_date' => '2026-04-09',
			'planned_day_type' => 'push',
			'actual_day_type' => 'pull',
			'time_tier' => 'short',
			'readiness_score' => 8,
			'duration_minutes' => 48,
			'estimated_calories' => 420,
			'completed_at' => '2026-04-09 12:00:00',
			'exercise_count' => 5,
			'completed_sets' => 14,
		] );

		$req = new \WP_REST_Request( 'PUT', '/fit/v1/workout/history/55' );
		$req->set_param( 'id', 55 );
		$req->set_param( 'session_date', '2026-04-09' );
		$req->set_param( 'actual_day_type', 'pull' );
		$req->set_param( 'time_tier', 'short' );
		$req->set_param( 'duration_minutes', 48 );
		$req->set_param( 'estimated_calories', 420 );
		$req->set_param( 'readiness_score', 8 );

		$response = TestWorkoutController::update_history_session( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 55, $data->id );
		$this->assertCount( 1, $db->updated );
		$this->assertSame( 'wp_fit_workout_sessions', $db->updated[0]['table'] );
		$this->assertSame( [ 'id' => 55, 'user_id' => 7 ], $db->updated[0]['where'] );
		$this->assertSame( '2026-04-09', $db->updated[0]['data']['session_date'] );
		$this->assertSame( 'pull', $db->updated[0]['data']['actual_day_type'] );
		$this->assertSame( 'short', $db->updated[0]['data']['time_tier'] );
		$this->assertSame( 420, $db->updated[0]['data']['estimated_calories'] );
		$this->assertTrue( (bool) array_filter( $db->queries, static fn( string $query ): bool => str_contains( $query, 'UPDATE wp_fit_exercise_performance_snapshots' ) ) );
	}

	public function test_workout_delete_history_session_removes_snapshots_and_records(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 7;

		$db->expectGetRow( 'SELECT * FROM wp_fit_workout_sessions WHERE id = 55 AND user_id = 7', (object) [
			'id' => 55,
			'user_id' => 7,
			'completed' => 1,
			'skip_requested' => 0,
			'session_date' => '2026-04-09',
		] );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7 LIMIT 1', 'UTC' );
		$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 7 LIMIT 1', 'UTC' );
		$db->expectGetCol( 'SELECT DISTINCT exercise_id FROM wp_fit_workout_session_exercises WHERE session_id = 55', [ 201, 202 ] );
		$db->expectGetCol( 'SELECT id FROM wp_fit_workout_session_exercises WHERE session_id = 55', [ 700, 701 ] );

		$req = new \WP_REST_Request( 'DELETE', '/fit/v1/workout/history/55' );
		$req->set_param( 'id', 55 );

		$response = TestWorkoutController::delete_history_session( $req );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $data['deleted'] );
		$this->assertCount( 2, $db->deleted );
		$this->assertSame( 'wp_fit_workout_session_exercises', $db->deleted[0]['table'] );
		$this->assertSame( 'wp_fit_workout_sessions', $db->deleted[1]['table'] );
		$this->assertCount( 2, $db->queries );
		$this->assertTrue( str_contains( $db->queries[0], 'DELETE FROM wp_fit_exercise_performance_snapshots' ) );
		$this->assertTrue( str_contains( $db->queries[1], 'DELETE FROM wp_fit_workout_sets' ) );
	}

	private function assertActionMeta( array $data, string $type, string $source = 'ui', string $action_id = '00000000-0000-4000-8000-000000000000' ): void {
		$this->assertArrayHasKey( 'action', $data );
		$this->assertSame( $action_id, $data['action']['id'] );
		$this->assertSame( $type, $data['action']['type'] );
		$this->assertSame( $source, $data['action']['source'] );
		$this->assertSame( '2026-04-09 12:00:00', $data['action']['timestamp'] );
	}
}
