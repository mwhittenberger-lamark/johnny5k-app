<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\Services\AiToolHandlerService;
use Johnny5k\Tests\Support\ServiceTestCase;

class JohnnyWorkoutLifecycleTest extends ServiceTestCase {
	public function test_complete_johnny_workout_lifecycle_preserves_each_state_transition(): void {
		$state = [
			'draft' => [
				'id' => 'draft-lifecycle',
				'name' => 'Full Body Circuit',
				'workout_structure' => 'circuit',
				'rounds' => 3,
				'exercises' => [
					[ 'exercise_id' => 10, 'plan_exercise_id' => 1, 'exercise_name' => 'Pushup', 'target_type' => 'reps', 'target_reps' => 10 ],
					[ 'exercise_id' => 20, 'plan_exercise_id' => 2, 'exercise_name' => 'Bodyweight Squat', 'target_type' => 'duration', 'target_duration_seconds' => 60 ],
				],
			],
			'approval' => null,
			'session' => null,
			'exercises' => [],
			'sets' => [],
			'next_set_id' => 100,
			'completed' => false,
		];

		$current = static function() use ( &$state ): \WP_REST_Response {
			return new \WP_REST_Response( [
				'session' => $state['session'],
				'exercises' => $state['exercises'],
				'custom_workout_draft' => $state['session'] ? null : $state['draft'],
			], 200 );
		};

		$base = [
			'workout_current' => $current,
			'today' => static fn( int $user_id ): string => '2026-08-07',
			'load_workout_approval' => static function( int $user_id ) use ( &$state ): array {
				return is_array( $state['approval'] ) ? $state['approval'] : [];
			},
			'save_workout_approval' => static function( int $user_id, array $approval ) use ( &$state ): void {
				$state['approval'] = $approval;
			},
			'workout_save_custom_draft' => static function( \WP_REST_Request $request ) use ( &$state ): \WP_REST_Response {
				$state['draft'] = $request->get_params();
				$state['approval'] = null;
				return new \WP_REST_Response( [ 'saved' => true, 'custom_workout_draft' => $state['draft'] ], 200 );
			},
			'workout_start' => static function( \WP_REST_Request $request ) use ( &$state ): \WP_REST_Response {
				$state['session'] = [ 'id' => 55, 'completed' => false ];
				$state['exercises'] = [
					[ 'id' => 501, 'exercise_name' => 'Bodyweight Squat' ],
					[ 'id' => 502, 'exercise_name' => 'Pushup' ],
				];
				return new \WP_REST_Response( [ 'session_id' => 55, 'draft_id' => $request->get_param( 'custom_workout_draft_id' ) ], 201 );
			},
			'workout_log_set' => static function( \WP_REST_Request $request ) use ( &$state ): \WP_REST_Response {
				$id = $state['next_set_id']++;
				$state['sets'][ $id ] = [
					'id' => $id,
					'session_exercise_id' => $request->get_param( 'session_exercise_id' ),
					'reps' => $request->get_param( 'reps' ),
					'duration_seconds' => $request->get_param( 'duration_seconds' ),
				];
				return new \WP_REST_Response( $state['sets'][ $id ], 201 );
			},
			'workout_update_set' => static function( \WP_REST_Request $request ) use ( &$state ): \WP_REST_Response {
				$id = (int) $request->get_param( 'set_id' );
				$state['sets'][ $id ]['reps'] = $request->get_param( 'reps' );
				return new \WP_REST_Response( $state['sets'][ $id ], 200 );
			},
			'workout_delete_set' => static function( \WP_REST_Request $request ) use ( &$state ): \WP_REST_Response {
				$id = (int) $request->get_param( 'set_id' );
				unset( $state['sets'][ $id ] );
				return new \WP_REST_Response( null, 204 );
			},
			'workout_complete' => static function( \WP_REST_Request $request ) use ( &$state ): \WP_REST_Response {
				$state['completed'] = true;
				$state['session']['completed'] = true;
				return new \WP_REST_Response( [ 'completed' => true, 'id' => $request->get_param( 'id' ) ], 200 );
			},
		];

		$blocked = AiToolHandlerService::execute( 42, 'start_workout', [], $base );
		$this->assertSame( 'Approve today’s workout before activating it.', $blocked['error'] ?? '' );

		$modified = AiToolHandlerService::execute( 42, 'modify_workout', [
			'action' => 'reorder',
			'exercise_order' => [ 'Bodyweight Squat', 'Pushup' ],
		], $base );
		$this->assertTrue( $modified['ok'] ?? false );
		$this->assertSame( [ 'Bodyweight Squat', 'Pushup' ], array_column( $state['draft']['exercises'], 'exercise_name' ) );
		$this->assertNull( $state['approval'] );

		$approved = AiToolHandlerService::execute( 42, 'approve_workout', [], $base );
		$this->assertTrue( $approved['ok'] ?? false );
		$this->assertSame( 'draft-lifecycle', $state['approval']['workout_id'] ?? '' );

		$started = AiToolHandlerService::execute( 42, 'start_workout', [ 'readiness_score' => 8 ], $base );
		$this->assertTrue( $started['ok'] ?? false );
		$this->assertSame( 55, $started['data']['session_id'] ?? 0 );

		$pushup = AiToolHandlerService::execute( 42, 'manage_workout_set', [
			'action' => 'create', 'exercise_name' => 'Pushup', 'set_number' => 1, 'circuit_round' => 1, 'reps' => 10,
		], $base );
		$this->assertTrue( $pushup['ok'] ?? false );
		$this->assertSame( 502, $pushup['data']['session_exercise_id'] ?? 0 );

		$corrected = AiToolHandlerService::execute( 42, 'manage_workout_set', [
			'action' => 'update', 'set_id' => 100, 'reps' => 12,
		], $base );
		$this->assertSame( 12, $corrected['data']['reps'] ?? 0 );

		$squat = AiToolHandlerService::execute( 42, 'manage_workout_set', [
			'action' => 'create', 'exercise_name' => 'Bodyweight Squat', 'set_number' => 1, 'circuit_round' => 1, 'duration_seconds' => 60,
		], $base );
		$this->assertSame( 60, $squat['data']['duration_seconds'] ?? 0 );

		$deleted = AiToolHandlerService::execute( 42, 'manage_workout_set', [ 'action' => 'delete', 'set_id' => 101 ], $base );
		$this->assertTrue( $deleted['ok'] ?? false );
		$this->assertArrayNotHasKey( 101, $state['sets'] );

		$completed = AiToolHandlerService::execute( 42, 'complete_workout', [], $base );
		$this->assertTrue( $completed['ok'] ?? false );
		$this->assertTrue( $state['completed'] );
	}
}
