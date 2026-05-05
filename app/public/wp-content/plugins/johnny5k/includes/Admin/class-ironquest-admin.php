<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

use Johnny5k\REST\AdminApiController;
use Johnny5k\REST\IronQuestController;
use Johnny5k\Services\IronQuestAnalyticsService;
use Johnny5k\Services\IronQuestCharacterVisualService;
use Johnny5k\Services\IronQuestDailyStateService;
use Johnny5k\Services\IronQuestMissionService;
use Johnny5k\Services\IronQuestProfileService;
use Johnny5k\Services\IronQuestRegistryService;
use Johnny5k\Services\IronQuestRewardService;
use Johnny5k\Services\IronQuestWorldArtService;
use Johnny5k\Services\InternalDiagnosticsLogger;
use WP_Error;
use WP_User_Query;

class IronQuestAdmin {

	public static function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$notice      = null;
		$action_state = [];
		$lookup      = isset( $_REQUEST['lookup'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['lookup'] ) ) : '';
		$selected_id = isset( $_REQUEST['user_id'] ) ? absint( $_REQUEST['user_id'] ) : 0;

		if ( 'POST' === $_SERVER['REQUEST_METHOD'] && isset( $_POST['jf_ironquest_admin_action'] ) ) {
			check_admin_referer( 'jf_ironquest_admin_action' );
			$selected_id = absint( wp_unslash( $_POST['user_id'] ?? 0 ) );
			$lookup      = sanitize_text_field( wp_unslash( $_POST['lookup'] ?? $lookup ) );
			$action_state = self::handle_action( $selected_id );
			$notice       = [
				'type' => $action_state['type'] ?? 'success',
				'message' => $action_state['message'] ?? '',
			];
		}

		$resolution = self::resolve_user_lookup( $selected_id, $lookup );
		$user       = $resolution['user'] ?? null;

		echo '<div class="wrap">';
		echo '<h1>Johnny5k IronQuest User Admin</h1>';
		echo '<p class="description">Support and recovery tooling for individual IronQuest profiles inside the WordPress plugin admin.</p>';

		if ( is_array( $notice ) ) {
			self::render_notice( $notice['message'] ?? '', $notice['type'] ?? 'success' );
		}

		self::render_lookup_form( $lookup, $selected_id );

		if ( ! empty( $resolution['matches'] ) ) {
			self::render_matches( $resolution['matches'] );
		}

		if ( ! $user ) {
			echo '<div class="notice notice-info"><p>Look up a user by ID, email, login, or display name to inspect their IronQuest state.</p></div>';
			echo '</div>';
			return;
		}

		$state = IronQuestController::admin_build_profile_payload( (int) $user->ID );
		self::render_identity_summary( $user, $state );
		self::render_actions( $user, $state, $lookup, $action_state );
		self::render_state_panels( $user, $state );
		echo '</div>';
	}

	public static function render_story_workbench(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Unauthorized' );
		}

		$notice = null;
		$workbench_state = [];

		if ( 'POST' === $_SERVER['REQUEST_METHOD'] && isset( $_POST['jf_ironquest_admin_action'] ) ) {
			check_admin_referer( 'jf_ironquest_admin_action' );
			$action_state = self::handle_story_workbench_action();
			$notice = [
				'type' => $action_state['type'] ?? 'success',
				'message' => $action_state['message'] ?? '',
			];
			$workbench_state = is_array( $action_state['workbench'] ?? null ) ? $action_state['workbench'] : [];
		}

		$form_state = self::resolve_story_workbench_form_state();
		if ( is_array( $workbench_state['form'] ?? null ) ) {
			$form_state = array_merge( $form_state, $workbench_state['form'] );
		}

		echo '<div class="wrap">';
		echo '<h1>IronQuest Story Workbench</h1>';
		echo '<p class="description">Author mission story beats outside of the user support page. Use this screen to preview, approve, and export shared story-engine content.</p>';

		if ( is_array( $notice ) ) {
			self::render_notice( $notice['message'] ?? '', $notice['type'] ?? 'success' );
		}

		self::render_story_workbench_box( null, '', $form_state, $workbench_state, 'jf-ironquest-story-workbench' );
		echo '</div>';
	}

	private static function handle_action( int $user_id ): array {
		$action = sanitize_key( (string) wp_unslash( $_POST['jf_ironquest_admin_action'] ?? '' ) );
		if ( str_starts_with( $action, 'story_workbench_' ) ) {
			return self::handle_story_workbench_action( $user_id, $action );
		}

		if ( $user_id <= 0 || ! get_userdata( $user_id ) ) {
			return [
				'type'    => 'error',
				'message' => 'A valid user is required before running IronQuest admin actions.',
			];
		}

		try {
			$result = match ( $action ) {
				'enable'                  => IronQuestProfileService::enable_for_user( $user_id ),
				'disable'                 => IronQuestProfileService::disable_for_user( $user_id ),
				'sync_route'              => IronQuestController::admin_sync_route_progression( $user_id ),
				'clear_active_mission'    => IronQuestController::admin_clear_active_mission( $user_id ),
				'generate_current_form'   => IronQuestCharacterVisualService::generate_current_form_portrait( $user_id, true ),
				'generate_tavern_scene'   => IronQuestWorldArtService::generate_art( $user_id, 'tavern_scene', self::posted_location_slug() ?: self::current_location_slug( $user_id ), true ),
				'generate_store_owner'    => IronQuestWorldArtService::generate_art( $user_id, 'store_owner', self::posted_location_slug() ?: self::current_location_slug( $user_id ), true ),
				'generate_mission_art'    => IronQuestWorldArtService::generate_art(
					$user_id,
					'mission_card',
					self::posted_location_slug() ?: self::current_location_slug( $user_id ),
					true,
					[ 'mission_slug' => sanitize_key( (string) wp_unslash( $_POST['mission_slug'] ?? '' ) ) ]
				),
				'jump_location'           => IronQuestController::admin_jump_location( $user_id, self::required_posted_location_slug() ),
				'unlock_location'         => IronQuestController::admin_unlock_location( $user_id, self::required_posted_location_slug() ),
				'clear_location_arc'      => IronQuestController::admin_clear_location_arc( $user_id, self::required_posted_location_slug() ),
				'mark_daily_quest'        => IronQuestController::admin_mark_daily_quest( $user_id, self::required_posted_quest_key() ),
				'grant_travel'            => IronQuestController::admin_grant_travel_points( $user_id, max( 0, (int) wp_unslash( $_POST['travel_points'] ?? 0 ) ) ),
				'start_mission'           => IronQuestController::admin_start_mission(
					$user_id,
					self::posted_location_slug() ?: self::current_location_slug( $user_id ),
					sanitize_key( (string) wp_unslash( $_POST['mission_slug'] ?? '' ) ),
					sanitize_key( (string) wp_unslash( $_POST['run_type'] ?? 'workout' ) ) ?: 'workout'
				),
				'resolve_active_mission'  => IronQuestController::admin_resolve_active_mission(
					$user_id,
					sanitize_key( (string) wp_unslash( $_POST['result_band'] ?? 'victory' ) ) ?: 'victory',
					max( 0, (int) wp_unslash( $_POST['xp_awarded'] ?? 0 ) ),
					max( 0, (int) wp_unslash( $_POST['gold_awarded'] ?? 0 ) )
				),
				default                   => new WP_Error( 'ironquest_admin_invalid_action', 'Unsupported IronQuest admin action.' ),
			};
		} catch ( \Throwable $error ) {
			return [
				'type'    => 'error',
				'message' => $error->getMessage(),
			];
		}

		if ( is_wp_error( $result ) ) {
			return [
				'type'    => 'error',
				'message' => $result->get_error_message(),
			];
		}

		$messages = [
			'enable'                 => 'IronQuest enabled for the selected user.',
			'disable'                => 'IronQuest disabled for the selected user.',
			'sync_route'             => 'Route progression re-synced.',
			'clear_active_mission'   => 'Active mission cleared.',
			'generate_current_form'  => 'Current-form portrait regenerated.',
			'generate_tavern_scene'  => 'Tavern scene regenerated.',
			'generate_store_owner'   => 'Store owner portrait regenerated.',
			'generate_mission_art'   => 'Mission card art regenerated.',
			'jump_location'          => 'User moved to the selected location.',
			'unlock_location'        => 'Location unlocked for the selected user.',
			'clear_location_arc'     => 'Location arc cleared and route state updated.',
			'mark_daily_quest'       => 'Daily quest marked complete.',
			'grant_travel'           => 'Travel points granted.',
			'start_mission'          => 'Mission run started.',
			'resolve_active_mission' => 'Active mission resolved.',
		];

		return [
			'type'    => 'success',
			'message' => $messages[ $action ] ?? 'IronQuest admin action completed.',
		];
	}

	private static function handle_story_workbench_action( int $user_id = 0, string $action = '' ): array {
		if ( '' === $action ) {
			$action = sanitize_key( (string) wp_unslash( $_POST['jf_ironquest_admin_action'] ?? '' ) );
		}

		$form_state = self::resolve_story_workbench_form_state( $user_id );
		if ( 'story_workbench_bootstrap' === $action ) {
			return self::handle_story_workbench_bootstrap_action( $form_state );
		}

		if ( empty( $form_state['selected_mission'] ) ) {
			return [
				'type' => 'error',
				'message' => 'No authored missions are available for the story workbench yet.',
				'workbench' => [ 'form' => $form_state ],
			];
		}

				try {
					return match ( $action ) {
						'story_workbench_preview' => self::handle_story_workbench_preview_action( $form_state ),
						'story_workbench_save_location' => self::handle_story_workbench_save_location_action( $form_state ),
						'story_workbench_suggest_location' => self::handle_story_workbench_suggest_location_action( $form_state ),
						'story_workbench_save_mission' => self::handle_story_workbench_save_mission_action( $form_state ),
						'story_workbench_suggest_mission' => self::handle_story_workbench_suggest_mission_action( $form_state ),
						'story_workbench_save_scene' => self::handle_story_workbench_save_scene_action( $form_state ),
						'story_workbench_suggest_scene' => self::handle_story_workbench_suggest_scene_action( $form_state ),
						'story_workbench_review' => self::handle_story_workbench_review_action( $form_state ),
					'story_workbench_export' => self::handle_story_workbench_export_action( $form_state ),
					'story_workbench_apply' => self::handle_story_workbench_apply_action( $form_state ),
				default => [
					'type' => 'error',
					'message' => 'Unsupported story workbench action.',
					'workbench' => [ 'form' => $form_state ],
				],
			};
		} catch ( \Throwable $error ) {
			return [
				'type' => 'error',
				'message' => $error->getMessage(),
				'workbench' => [ 'form' => $form_state ],
			];
		}
	}

	private static function handle_story_workbench_preview_action( array $form_state ): array {
		$preview = self::request_story_workbench_preview( $form_state );
		if ( is_wp_error( $preview ) ) {
			return [
				'type' => 'error',
				'message' => $preview->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$count = count( (array) ( $preview['candidateSession']['candidates'] ?? [] ) );

		return [
			'type' => 'success',
			'message' => $count > 0 ? sprintf( 'Analyzed this story moment and generated %d %s.', $count, 1 === $count ? 'draft' : 'drafts' ) : 'No story drafts matched this branch yet. Try a different scene, outcome, or advanced branch filter.',
			'workbench' => [
				'form' => $form_state,
				'preview' => $preview,
			],
		];
	}

	private static function handle_story_workbench_bootstrap_action( array $form_state ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-bootstrap' );
		$request->set_param( 'mission_slug', sanitize_key( (string) wp_unslash( $_POST['mission_slug'] ?? '' ) ) );

		$bootstrapped = self::rest_response_to_data( AdminApiController::bootstrap_ironquest_story_workbench_mission( $request ) );
		if ( is_wp_error( $bootstrapped ) ) {
			return [
				'type' => 'error',
				'message' => $bootstrapped->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$refreshed_form_state = self::resolve_story_workbench_form_state();

		return [
			'type' => 'success',
			'message' => (string) ( $bootstrapped['message'] ?? 'Mission bootstrapped for the story workbench.' ),
			'workbench' => [
				'form' => $refreshed_form_state,
			],
		];
	}

	private static function handle_story_workbench_save_location_action( array $form_state ): array {
		$selected_location = is_array( $form_state['selected_location'] ?? null ) ? $form_state['selected_location'] : [];
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-location' );
		$request->set_param( 'location_slug', (string) ( $selected_location['slug'] ?? '' ) );
		$request->set_param(
			'location',
			[
				'theme' => sanitize_text_field( (string) wp_unslash( $_POST['location_theme'] ?? '' ) ),
				'tone' => sanitize_text_field( (string) wp_unslash( $_POST['location_tone'] ?? '' ) ),
				'story_context' => sanitize_textarea_field( (string) wp_unslash( $_POST['location_story_context'] ?? '' ) ),
				'ai_theme' => sanitize_text_field( (string) wp_unslash( $_POST['location_ai_theme'] ?? '' ) ),
				'ai_tone' => sanitize_text_field( (string) wp_unslash( $_POST['location_ai_tone'] ?? '' ) ),
				'enemy_types' => self::parse_story_workbench_list_input( (string) wp_unslash( $_POST['location_enemy_types'] ?? '' ) ),
			]
		);

		$saved = self::rest_response_to_data( AdminApiController::save_ironquest_story_workbench_location( $request ) );
		if ( is_wp_error( $saved ) ) {
			return [
				'type' => 'error',
				'message' => $saved->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$refreshed_form_state = self::resolve_story_workbench_form_state();

		return [
			'type' => 'success',
			'message' => (string) ( $saved['message'] ?? 'Location foundation saved.' ),
			'workbench' => [
				'form' => $refreshed_form_state,
			],
		];
	}

	private static function handle_story_workbench_suggest_location_action( array $form_state ): array {
		$selected_location = is_array( $form_state['selected_location'] ?? null ) ? $form_state['selected_location'] : [];
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-location-suggest' );
		$request->set_param( 'location_slug', (string) ( $selected_location['slug'] ?? '' ) );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );

		$suggested = self::rest_response_to_data( AdminApiController::suggest_ironquest_story_workbench_location( $request ) );
		if ( is_wp_error( $suggested ) ) {
			return [
				'type' => 'error',
				'message' => $suggested->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$form_state['selected_location'] = array_merge(
			(array) ( $form_state['selected_location'] ?? [] ),
			[
				'theme' => (string) ( $suggested['location']['theme'] ?? '' ),
				'tone' => (string) ( $suggested['location']['tone'] ?? '' ),
				'story_context' => (string) ( $suggested['location']['story_context'] ?? '' ),
				'ai_prompt_anchor' => array_merge(
					(array) ( $form_state['selected_location']['ai_prompt_anchor'] ?? [] ),
					[
						'theme' => (string) ( $suggested['location']['ai_theme'] ?? '' ),
						'tone' => (string) ( $suggested['location']['ai_tone'] ?? '' ),
						'enemy_types' => (array) ( $suggested['location']['enemy_types'] ?? [] ),
					]
				),
			]
		);

		return [
			'type' => 'success',
			'message' => 'AI suggestions loaded into the location foundation fields. Review them, then save if you want to keep them.',
			'workbench' => [
				'form' => $form_state,
			],
		];
	}

	private static function handle_story_workbench_save_mission_action( array $form_state ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-mission' );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );
		$request->set_param(
			'mission',
			[
				'goal' => sanitize_text_field( (string) wp_unslash( $_POST['mission_goal'] ?? '' ) ),
				'threat' => sanitize_text_field( (string) wp_unslash( $_POST['mission_threat'] ?? '' ) ),
				'narrative' => sanitize_textarea_field( (string) wp_unslash( $_POST['mission_narrative'] ?? '' ) ),
				'workout_feel' => sanitize_text_field( (string) wp_unslash( $_POST['mission_workout_feel'] ?? '' ) ),
				'story_profile' => [
					'genre' => sanitize_key( (string) wp_unslash( $_POST['mission_genre'] ?? '' ) ),
					'voice' => sanitize_key( (string) wp_unslash( $_POST['mission_voice'] ?? '' ) ),
					'pacing' => sanitize_key( (string) wp_unslash( $_POST['mission_pacing'] ?? '' ) ),
				],
			]
		);

		$saved = self::rest_response_to_data( AdminApiController::save_ironquest_story_workbench_mission( $request ) );
		if ( is_wp_error( $saved ) ) {
			return [
				'type' => 'error',
				'message' => $saved->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$refreshed_form_state = self::resolve_story_workbench_form_state();

		return [
			'type' => 'success',
			'message' => (string) ( $saved['message'] ?? 'Mission foundation saved.' ),
			'workbench' => [
				'form' => $refreshed_form_state,
			],
		];
	}

	private static function handle_story_workbench_suggest_mission_action( array $form_state ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-mission-suggest' );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );

		$suggested = self::rest_response_to_data( AdminApiController::suggest_ironquest_story_workbench_mission( $request ) );
		if ( is_wp_error( $suggested ) ) {
			return [
				'type' => 'error',
				'message' => $suggested->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$form_state['selected_mission'] = array_merge(
			(array) ( $form_state['selected_mission'] ?? [] ),
			[
				'goal' => (string) ( $suggested['mission']['goal'] ?? '' ),
				'threat' => (string) ( $suggested['mission']['threat'] ?? '' ),
				'narrative' => (string) ( $suggested['mission']['narrative'] ?? '' ),
				'workout_feel' => (string) ( $suggested['mission']['workout_feel'] ?? '' ),
				'story_profile' => array_merge(
					(array) ( $form_state['selected_mission']['story_profile'] ?? [] ),
					(array) ( $suggested['mission']['story_profile'] ?? [] )
				),
			]
		);

		return [
			'type' => 'success',
			'message' => 'AI suggestions loaded into the mission foundation fields. Review them, then save if you want to keep them.',
			'workbench' => [
				'form' => $form_state,
			],
		];
	}

	private static function handle_story_workbench_save_scene_action( array $form_state ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-scene' );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );
		$request->set_param( 'encounter_seed_slug', (string) ( $form_state['encounter_seed_slug'] ?? '' ) );
		$request->set_param(
			'scene',
			[
				'scene_brief' => sanitize_textarea_field( (string) wp_unslash( $_POST['scene_brief'] ?? '' ) ),
				'player_goal' => sanitize_textarea_field( (string) wp_unslash( $_POST['player_goal'] ?? '' ) ),
				'opponent_pressure' => sanitize_textarea_field( (string) wp_unslash( $_POST['opponent_pressure'] ?? '' ) ),
				'failure_cost' => sanitize_textarea_field( (string) wp_unslash( $_POST['failure_cost'] ?? '' ) ),
				'setting_detail' => sanitize_textarea_field( (string) wp_unslash( $_POST['setting_detail'] ?? '' ) ),
			]
		);

		$saved = self::rest_response_to_data( AdminApiController::save_ironquest_story_workbench_scene( $request ) );
		if ( is_wp_error( $saved ) ) {
			return [
				'type' => 'error',
				'message' => $saved->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$refreshed_form_state = self::resolve_story_workbench_form_state();

		return [
			'type' => 'success',
			'message' => (string) ( $saved['message'] ?? 'Scene brief saved.' ),
			'workbench' => [
				'form' => $refreshed_form_state,
			],
		];
	}

	private static function handle_story_workbench_suggest_scene_action( array $form_state ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-scene-suggest' );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );
		$request->set_param( 'encounter_seed_slug', (string) ( $form_state['encounter_seed_slug'] ?? '' ) );

		$suggested = self::rest_response_to_data( AdminApiController::suggest_ironquest_story_workbench_scene( $request ) );
		if ( is_wp_error( $suggested ) ) {
			return [
				'type' => 'error',
				'message' => $suggested->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$form_state['selected_encounter_seed'] = array_merge(
			(array) ( $form_state['selected_encounter_seed'] ?? [] ),
			(array) ( $suggested['scene'] ?? [] )
		);

		return [
			'type' => 'success',
			'message' => 'AI suggestions loaded into the scene brief fields. Review them, then save if you want to keep them.',
			'workbench' => [
				'form' => $form_state,
			],
		];
	}

	private static function handle_story_workbench_review_action( array $form_state ): array {
		$session_id = sanitize_key( (string) wp_unslash( $_POST['session_id'] ?? '' ) );
		$candidate_id = sanitize_key( (string) wp_unslash( $_POST['candidate_id'] ?? '' ) );
		$approved = ! empty( $_POST['approved'] );

		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-review' );
		$request->set_param( 'session_id', $session_id );
		$request->set_param( 'candidate_id', $candidate_id );
		$request->set_param( 'approved', $approved );

		$review = self::rest_response_to_data( AdminApiController::review_ironquest_story_workbench_candidate( $request ) );
		if ( is_wp_error( $review ) ) {
			return [
				'type' => 'error',
				'message' => $review->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$preview = self::request_story_workbench_preview( $form_state );
		if ( is_wp_error( $preview ) ) {
			return [
				'type' => 'success',
				'message' => (string) ( $review['message'] ?? 'Story workbench review updated.' ),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		return [
			'type' => 'success',
			'message' => (string) ( $review['message'] ?? 'Story workbench review updated.' ),
			'workbench' => [
				'form' => $form_state,
				'preview' => $preview,
			],
		];
	}

	private static function handle_story_workbench_export_action( array $form_state ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-export' );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );
		$request->set_param( 'slot', (string) ( $form_state['slot'] ?? '' ) );

		$export = self::rest_response_to_data( AdminApiController::export_ironquest_story_workbench( $request ) );
		if ( is_wp_error( $export ) ) {
			return [
				'type' => 'error',
				'message' => $export->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$preview = self::request_story_workbench_preview( $form_state );

		return [
			'type' => 'success',
			'message' => (int) ( $export['approved_count'] ?? 0 ) > 0
				? sprintf( 'Exported %d approved story workbench %s.', (int) $export['approved_count'], 1 === (int) $export['approved_count'] ? 'candidate' : 'candidates' )
				: 'No approved story workbench candidates are ready to export yet.',
			'workbench' => [
				'form' => $form_state,
				'preview' => is_wp_error( $preview ) ? null : $preview,
				'export' => $export,
			],
		];
	}

	private static function handle_story_workbench_apply_action( array $form_state ): array {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-apply' );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );
		$request->set_param( 'slot', (string) ( $form_state['slot'] ?? '' ) );

		$applied = self::rest_response_to_data( AdminApiController::apply_ironquest_story_workbench_export( $request ) );
		if ( is_wp_error( $applied ) ) {
			return [
				'type' => 'error',
				'message' => $applied->get_error_message(),
				'workbench' => [ 'form' => $form_state ],
			];
		}

		$preview = self::request_story_workbench_preview( $form_state );
		$export = self::rest_response_to_data( AdminApiController::export_ironquest_story_workbench( $request ) );

		return [
			'type' => 'success',
			'message' => (string) ( $applied['message'] ?? 'Story workbench templates applied.' ),
			'workbench' => [
				'form' => $form_state,
				'preview' => is_wp_error( $preview ) ? null : $preview,
				'export' => is_wp_error( $export ) ? null : $export,
				'applied' => $applied,
			],
		];
	}

	private static function render_lookup_form( string $lookup, int $selected_id ): void {
		echo '<form method="get" style="margin:18px 0 24px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">';
		echo '<input type="hidden" name="page" value="jf-ironquest-admin">';
		echo '<div>';
		echo '<label for="jf-ironquest-lookup" style="display:block;font-weight:600;margin-bottom:4px">User lookup</label>';
		echo '<input id="jf-ironquest-lookup" name="lookup" type="text" class="regular-text" placeholder="User ID, email, login, or display name" value="' . esc_attr( $lookup ) . '">';
		echo '</div>';
		if ( $selected_id > 0 ) {
			echo '<input type="hidden" name="user_id" value="' . esc_attr( (string) $selected_id ) . '">';
		}
		submit_button( 'Load IronQuest State', 'primary', '', false );
		echo '</form>';
	}

	private static function render_matches( array $matches ): void {
		echo '<div style="margin:0 0 24px">';
		echo '<h2 style="margin-bottom:8px">Matching users</h2>';
		echo '<ul style="margin:0;padding-left:18px">';
		foreach ( $matches as $user ) {
			$url = add_query_arg(
				[
					'page'    => 'jf-ironquest-admin',
					'user_id' => (int) $user->ID,
				],
				admin_url( 'admin.php' )
			);
			printf(
				'<li><a href="%s">%s</a> <span style="color:#666">(#%d, %s)</span></li>',
				esc_url( $url ),
				esc_html( $user->display_name ?: $user->user_login ),
				(int) $user->ID,
				esc_html( $user->user_email )
			);
		}
		echo '</ul>';
		echo '</div>';
	}

	private static function render_identity_summary( \WP_User $user, array $state ): void {
		$profile      = is_array( $state['profile'] ?? null ) ? $state['profile'] : [];
		$route_state  = is_array( $state['route_state'] ?? null ) ? $state['route_state'] : [];
		$active_run   = is_array( $state['active_run'] ?? null ) ? $state['active_run'] : [];
		$rival_state  = is_array( $state['rival_state'] ?? null ) ? $state['rival_state'] : [];
		$current_form = is_array( $state['character_sheet']['identity']['current_form'] ?? null ) ? $state['character_sheet']['identity']['current_form'] : [];

		echo '<div style="display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:12px;margin:20px 0">';
		self::render_stat_card( 'User', $user->display_name ?: $user->user_login, '#' . (int) $user->ID . ' · ' . $user->user_email );
		self::render_stat_card( 'Profile', ! empty( $profile['enabled'] ) ? 'Enabled' : 'Disabled', sprintf( 'Level %d · %d XP · %d gold', (int) ( $profile['level'] ?? 1 ), (int) ( $profile['xp'] ?? 0 ), (int) ( $profile['gold'] ?? 0 ) ) );
		self::render_stat_card( 'Route', self::humanize_key( (string) ( $profile['current_location_slug'] ?? '' ) ), sprintf( 'Unlocked: %d · Cleared: %d', count( (array) ( $route_state['unlocked_locations'] ?? [] ) ), count( (array) ( $route_state['cleared_locations'] ?? [] ) ) ) );
		self::render_stat_card( 'Active Run', ! empty( $active_run['id'] ) ? self::humanize_key( (string) ( $active_run['mission_slug'] ?? '' ) ) : 'None', ! empty( $active_run['id'] ) ? sprintf( '%s · %s', esc_html( (string) ( $active_run['run_type'] ?? 'workout' ) ), esc_html( (string) ( $active_run['encounter_phase'] ?? 'intro' ) ) ) : 'No live mission' );
		echo '</div>';

		echo '<div style="display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:12px;margin:0 0 24px">';
		self::render_stat_card( 'Rival', ! empty( $rival_state['name'] ) ? (string) $rival_state['name'] : 'None', ! empty( $rival_state['status_label'] ) ? (string) $rival_state['status_label'] : 'No active rival arc' );
		self::render_stat_card( 'Current Form', ! empty( $current_form['generated_image_id'] ) ? 'Ready' : 'Missing', ! empty( $current_form['generated_at'] ) ? 'Generated ' . (string) $current_form['generated_at'] : 'No current-form portrait yet' );
		self::render_stat_card( 'Daily State', (string) ( $state['daily_state']['state_date'] ?? current_time( 'Y-m-d' ) ), sprintf( 'Travel points: %d', (int) ( $state['daily_state']['travel_points'] ?? 0 ) ) );
		echo '</div>';
	}

	private static function render_actions( \WP_User $user, array $state, string $lookup, array $action_state = [] ): void {
		$profile         = is_array( $state['profile'] ?? null ) ? $state['profile'] : [];
		$locations       = array_values( IronQuestRegistryService::get_locations_config()['locations'] ?? [] );
		$current_location= sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$missions        = $current_location ? IronQuestRegistryService::get_location_missions( $current_location ) : [];

		echo '<h2>Admin Actions</h2>';
		echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:16px;margin-bottom:24px">';

		self::render_action_box(
			'Profile & Recovery',
			$user,
			$lookup,
			[
				self::action_button( 'enable', 'Enable IronQuest', 'button button-primary' ),
				self::action_button( 'disable', 'Disable IronQuest', 'button' ),
				self::action_button( 'sync_route', 'Re-sync Route', 'button' ),
				self::action_button( 'clear_active_mission', 'Clear Active Mission', 'button button-secondary' ),
			]
		);

		self::render_action_box(
			'Image Generation',
			$user,
			$lookup,
			[
				self::action_button( 'generate_current_form', 'Regenerate Current-Form Portrait', 'button button-primary' ),
				self::action_button( 'generate_tavern_scene', 'Regenerate Tavern Scene', 'button' ),
				self::action_button( 'generate_store_owner', 'Regenerate Store Owner Portrait', 'button' ),
			],
			function () use ( $current_location, $missions ): void {
				echo '<p><label for="jf-ironquest-mission-art" style="font-weight:600">Mission art target</label></p>';
				echo '<select id="jf-ironquest-mission-art" name="mission_slug">';
				foreach ( $missions as $mission ) {
					printf(
						'<option value="%s">%s</option>',
						esc_attr( (string) ( $mission['slug'] ?? '' ) ),
						esc_html( (string) ( $mission['name'] ?? $mission['slug'] ?? '' ) )
					);
				}
				echo '</select> ';
				printf( '<input type="hidden" name="location_slug" value="%s">', esc_attr( $current_location ) );
				echo '<button type="submit" name="jf_ironquest_admin_action" value="generate_mission_art" class="button">Regenerate Mission Art</button>';
			}
		);

		self::render_action_box(
			'Mission Actions',
			$user,
			$lookup,
			[],
			function () use ( $current_location, $missions ): void {
				echo '<p style="margin:0 0 8px"><label for="jf-ironquest-start-mission" style="font-weight:600">Start mission</label></p>';
				echo '<input type="hidden" name="location_slug" value="' . esc_attr( $current_location ) . '">';
				echo '<select id="jf-ironquest-start-mission" name="mission_slug">';
				foreach ( $missions as $mission ) {
					printf(
						'<option value="%s">%s</option>',
						esc_attr( (string) ( $mission['slug'] ?? '' ) ),
						esc_html( (string) ( $mission['name'] ?? $mission['slug'] ?? '' ) )
					);
				}
				echo '</select> ';
				echo '<select name="run_type"><option value="workout">Workout</option><option value="cardio">Cardio</option></select> ';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="start_mission" class="button">Start Mission</button>';

				echo '<hr>';
				echo '<p style="margin:0 0 8px"><label for="jf-ironquest-result-band" style="font-weight:600">Resolve active mission</label></p>';
				echo '<select id="jf-ironquest-result-band" name="result_band"><option value="victory">Victory</option><option value="partial">Partial</option><option value="failure">Failure</option></select> ';
				echo '<input type="number" name="xp_awarded" min="0" step="1" placeholder="XP override" style="width:110px"> ';
				echo '<input type="number" name="gold_awarded" min="0" step="1" placeholder="Gold override" style="width:110px"> ';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="resolve_active_mission" class="button button-secondary">Resolve</button>';
			}
		);

		self::render_action_box(
			'Route & Daily State',
			$user,
			$lookup,
			[],
			function () use ( $locations ): void {
				echo '<p style="margin:0 0 8px"><label for="jf-ironquest-location" style="font-weight:600">Location actions</label></p>';
				echo '<select id="jf-ironquest-location" name="location_slug">';
				foreach ( $locations as $location ) {
					printf(
						'<option value="%s">%s</option>',
						esc_attr( (string) ( $location['slug'] ?? '' ) ),
						esc_html( (string) ( $location['name'] ?? $location['slug'] ?? '' ) )
					);
				}
				echo '</select> ';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="jump_location" class="button">Jump</button> ';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="unlock_location" class="button">Unlock</button> ';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="clear_location_arc" class="button button-secondary">Clear Arc</button>';

				echo '<hr>';
				echo '<p style="margin:0 0 8px"><label for="jf-ironquest-daily-quest" style="font-weight:600">Daily quest + travel</label></p>';
				echo '<select id="jf-ironquest-daily-quest" name="quest_key"><option value="meal">Meal</option><option value="sleep">Sleep</option><option value="cardio">Cardio</option><option value="steps">Steps</option><option value="workout">Workout</option></select> ';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="mark_daily_quest" class="button">Mark Complete</button>';
				echo '<p style="margin:12px 0 8px"><input type="number" name="travel_points" min="0" step="1" placeholder="Travel points" style="width:120px"> ';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="grant_travel" class="button">Grant Travel</button></p>';
			}
		);

		echo '</div>';
		echo '<section style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:16px;margin:0 0 24px">';
		echo '<h2 style="margin-top:0">Story Workbench</h2>';
		echo '<p style="margin-bottom:0">Story authoring now lives on its own admin page so it is no longer tied to a user record. <a href="' . esc_url( admin_url( 'admin.php?page=jf-ironquest-story-workbench' ) ) . '">Open IronQuest Story Workbench</a>.</p>';
		echo '</section>';
	}

	private static function render_action_box( string $title, \WP_User $user, string $lookup, array $buttons, ?callable $extra = null ): void {
		echo '<form method="post" style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:16px">';
		wp_nonce_field( 'jf_ironquest_admin_action' );
		echo '<input type="hidden" name="page" value="jf-ironquest-admin">';
		echo '<input type="hidden" name="user_id" value="' . (int) $user->ID . '">';
		echo '<input type="hidden" name="lookup" value="' . esc_attr( $lookup ) . '">';
		echo '<h3 style="margin-top:0">' . esc_html( $title ) . '</h3>';
		if ( ! empty( $buttons ) ) {
			echo '<p style="display:flex;gap:8px;flex-wrap:wrap">';
			foreach ( $buttons as $button ) {
				echo $button; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			}
			echo '</p>';
		}
		if ( $extra ) {
			$extra();
		}
		echo '</form>';
	}

	private static function render_story_workbench_box( ?\WP_User $user, string $lookup, array $form_state, array $workbench_state, string $page_slug = 'jf-ironquest-admin' ): void {
		$unsupported_missions = self::get_story_workbench_unsupported_missions();
		$missions = array_values( array_filter( (array) ( $form_state['missions'] ?? [] ), 'is_array' ) );
		$selected_mission = is_array( $form_state['selected_mission'] ?? null ) ? $form_state['selected_mission'] : [];
		$encounter_seeds = array_values( array_filter( (array) ( $form_state['encounter_seeds'] ?? [] ), 'is_array' ) );
		$story_slots = (array) ( $form_state['story_slots'] ?? [] );
		$preview = is_array( $workbench_state['preview'] ?? null ) ? $workbench_state['preview'] : [];
		$export = is_array( $workbench_state['export'] ?? null ) ? $workbench_state['export'] : [];
		$applied = is_array( $workbench_state['applied'] ?? null ) ? $workbench_state['applied'] : [];
		$selection_diagnostics = is_array( $preview['selectionDiagnostics'] ?? null ) ? $preview['selectionDiagnostics'] : [];
		$coverage_report = is_array( $preview['coverageReport'] ?? null ) ? $preview['coverageReport'] : [];
		$selected_location = is_array( $form_state['selected_location'] ?? null ) ? (array) $form_state['selected_location'] : ( ! empty( $selected_mission['location_slug'] ) ? ( IronQuestRegistryService::get_location( (string) $selected_mission['location_slug'] ) ?? [] ) : [] );
		$selected_location_name = (string) ( $selected_location['name'] ?? self::humanize_key( (string) ( $selected_mission['location_slug'] ?? '' ) ) );
		$selected_slot_config = is_array( $selected_mission['story_slots'][ $form_state['slot'] ] ?? null ) ? $selected_mission['story_slots'][ $form_state['slot'] ] : [];
		$selected_encounter_seed = is_array( $form_state['selected_encounter_seed'] ?? null ) ? $form_state['selected_encounter_seed'] : [];
		$mission_supports_story_workbench = self::mission_supports_story_workbench( $selected_mission );
		$active_tab = in_array( (string) ( $form_state['workbench_tab'] ?? 'authoring' ), [ 'authoring', 'publish' ], true ) ? (string) $form_state['workbench_tab'] : 'authoring';
		$current_slot_templates = array_values(
			array_filter(
				(array) ( $selected_mission['beat_templates'] ?? [] ),
				fn( array $template ): bool => sanitize_key( (string) ( $template['slot'] ?? '' ) ) === sanitize_key( (string) ( $form_state['slot'] ?? '' ) )
			)
		);
		$approved_candidates = array_values( array_filter( (array) ( $preview['approvedCandidates'] ?? [] ), 'is_array' ) );

		echo '<section style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:16px;margin:0 0 24px">';
		echo '<h2 style="margin-top:0">Story Workbench</h2>';
		echo '<p class="description">Generate, approve, export, and apply authored beat candidates from the WordPress plugin admin. This authoring tool is not tied to the selected user\'s current route. Pick any mission below, then use supported missions to build shared story-engine content.</p>';

		if ( ! empty( $unsupported_missions ) ) {
			echo '<section style="border:1px solid #dcdcde;border-radius:8px;padding:12px;margin:0 0 16px">';
			echo '<h3 style="margin:0 0 8px">Bootstrap Unsupported Missions</h3>';
			echo '<p style="margin:0 0 12px;color:#50575e">These missions already have encounter seeds but are missing the starter story-engine bundle the workbench expects. Bootstrap adds default story slots, a default story profile, and generic starter beat templates so they can be edited here immediately.</p>';
			echo '<div style="display:grid;gap:8px">';
			foreach ( $unsupported_missions as $unsupported_mission ) {
				echo '<form method="post" style="display:flex;justify-content:space-between;gap:12px;align-items:center;background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				wp_nonce_field( 'jf_ironquest_admin_action' );
				self::render_action_form_context( $page_slug, $user, $lookup );
				echo '<input type="hidden" name="workbench_tab" value="authoring">';
				echo '<input type="hidden" name="mission_slug" value="' . esc_attr( (string) ( $unsupported_mission['slug'] ?? '' ) ) . '">';
				echo '<div>';
				echo '<strong>' . esc_html( self::format_story_workbench_mission_label( $unsupported_mission ) ) . '</strong>';
				echo '<p style="margin:4px 0 0;color:#50575e">Encounter seeds: ' . esc_html( (string) count( (array) ( $unsupported_mission['encounter_seeds'] ?? [] ) ) ) . ' · Story slots: ' . esc_html( (string) count( (array) ( $unsupported_mission['story_slots'] ?? [] ) ) ) . ' · Beat templates: ' . esc_html( (string) count( (array) ( $unsupported_mission['beat_templates'] ?? [] ) ) ) . '</p>';
				echo '</div>';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_bootstrap" class="button button-secondary">Bootstrap For Workbench</button>';
				echo '</form>';
			}
			echo '</div>';
			echo '</section>';
		}

		if ( empty( $missions ) ) {
			echo '<div class="notice notice-info inline"><p>No authored story-engine missions are ready yet. Use the bootstrap section above to prepare a mission for the workbench.</p></div>';
			echo '</section>';
			return;
		}

		echo '<div style="background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px;margin:0 0 16px">';
		echo '<strong>Guided flow</strong>';
		echo '<ol style="margin:8px 0 0 18px">';
		echo '<li><strong>Step 1:</strong> Pick the mission, scene, and story moment you want to author.</li>';
		echo '<li><strong>Step 2:</strong> Tune the location and mission foundations so the AI has better context.</li>';
		echo '<li><strong>Step 3:</strong> Edit the five scene fields for the selected encounter.</li>';
		echo '<li><strong>Step 4:</strong> Use the branch map to see which workout outcomes already have coverage.</li>';
		echo '<li><strong>Step 5:</strong> Generate or preview a branch, then approve the draft you want to keep.</li>';
		echo '</ol>';
		echo '<p style="margin:8px 0 0;color:#50575e">Recommended first pass: keep <strong>Workout outcome</strong> on Target met and <strong>Tone</strong> on Steady, then use the branch map to fill gaps.</p>';
		echo '</div>';

		echo '<form method="post" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px">';
		wp_nonce_field( 'jf_ironquest_admin_action' );
		self::render_action_form_context( $page_slug, $user, $lookup );
		self::render_story_workbench_hidden_filter_inputs( $form_state );
		echo '<button type="submit" name="workbench_tab" value="authoring" class="button' . ( 'authoring' === $active_tab ? ' button-primary' : '' ) . '">Authoring</button>';
		echo '<button type="submit" name="workbench_tab" value="publish" class="button' . ( 'publish' === $active_tab ? ' button-primary' : '' ) . '">Publish</button>';
		echo '</form>';

		echo '<div style="display:grid;gap:16px">';
		echo '<section style="border:1px solid #dcdcde;border-radius:8px;padding:12px">';
		echo '<h3 style="margin:0 0 8px">Step 1: Pick The Story Moment</h3>';
		echo '<p style="margin:0 0 12px;color:#50575e">Choose the mission beat you want to work on. Advanced engine filters stay hidden unless you need them.</p>';
		echo '<form method="post" data-story-workbench-form="1" style="display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:12px;align-items:end">';
		wp_nonce_field( 'jf_ironquest_admin_action' );
		self::render_action_form_context( $page_slug, $user, $lookup );
		echo '<input type="hidden" name="workbench_tab" value="' . esc_attr( $active_tab ) . '">';
		echo '<div><label for="jf-ironquest-workbench-mission" style="display:block;font-weight:600;margin-bottom:4px">Mission</label>';
		echo '<select id="jf-ironquest-workbench-mission" name="mission_slug" data-sync-targets="1" style="width:100%">';
		foreach ( $missions as $mission ) {
			printf(
				'<option value="%s"%s>%s</option>',
				esc_attr( (string) ( $mission['slug'] ?? '' ) ),
				selected( (string) ( $mission['slug'] ?? '' ), (string) ( $form_state['mission_slug'] ?? '' ), false ),
				esc_html( self::format_story_workbench_mission_label( $mission ) )
			);
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-seed" style="display:block;font-weight:600;margin-bottom:4px">Scene</label>';
		echo '<select id="jf-ironquest-workbench-seed" name="encounter_seed_slug" style="width:100%">';
		foreach ( $encounter_seeds as $seed ) {
			printf(
				'<option value="%s"%s>%s</option>',
				esc_attr( (string) ( $seed['slug'] ?? '' ) ),
				selected( (string) ( $seed['slug'] ?? '' ), (string) ( $form_state['encounter_seed_slug'] ?? '' ), false ),
				esc_html( (string) ( $seed['title'] ?? $seed['slug'] ?? '' ) )
			);
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-slot" style="display:block;font-weight:600;margin-bottom:4px">Story moment</label>';
		echo '<select id="jf-ironquest-workbench-slot" name="slot" style="width:100%"' . ( $mission_supports_story_workbench ? '' : ' disabled' ) . '>';
		if ( empty( $story_slots ) ) {
			echo '<option value="">No story slots yet</option>';
		} else {
			foreach ( $story_slots as $slot_key => $slot_config ) {
				printf(
					'<option value="%s"%s>%s</option>',
					esc_attr( (string) $slot_key ),
					selected( (string) $slot_key, (string) ( $form_state['slot'] ?? '' ), false ),
					esc_html( self::humanize_key( (string) $slot_key ) )
				);
			}
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-result" style="display:block;font-weight:600;margin-bottom:4px">Workout outcome</label>';
		echo '<select id="jf-ironquest-workbench-result" name="set_result" style="width:100%">';
		foreach ( self::story_workbench_set_result_options() as $value => $label ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $value ), selected( $value, (string) ( $form_state['set_result'] ?? '' ), false ), esc_html( $label ) );
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-stance" style="display:block;font-weight:600;margin-bottom:4px">Tone</label>';
		echo '<select id="jf-ironquest-workbench-stance" name="stance" style="width:100%">';
		foreach ( self::story_workbench_stance_options() as $value => $label ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $value ), selected( $value, (string) ( $form_state['stance'] ?? '' ), false ), esc_html( $label ) );
		}
		echo '</select></div>';
		echo '<div><details style="grid-column:1 / -1;background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:10px 12px">';
		echo '<summary style="cursor:pointer;font-weight:600">Advanced branch controls</summary>';
		echo '<p style="margin:8px 0 12px;color:#50575e">Only use these when you are testing a very specific story-engine branch.</p>';
		echo '<div style="display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:12px;align-items:end">';
		echo '<div><label for="jf-ironquest-workbench-stage" style="display:block;font-weight:600;margin-bottom:4px">Stage</label>';
		echo '<select id="jf-ironquest-workbench-stage" name="stage" style="width:100%">';
		foreach ( self::story_workbench_stage_options() as $value => $label ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $value ), selected( $value, (string) ( $form_state['stage'] ?? '' ), false ), esc_html( $label ) );
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-tension" style="display:block;font-weight:600;margin-bottom:4px">Tension</label>';
		echo '<select id="jf-ironquest-workbench-tension" name="tension" style="width:100%">';
		foreach ( self::story_workbench_tension_options() as $value => $label ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $value ), selected( $value, (string) ( $form_state['tension'] ?? '' ), false ), esc_html( $label ) );
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-phase" style="display:block;font-weight:600;margin-bottom:4px">Progress phase</label>';
		echo '<select id="jf-ironquest-workbench-phase" name="progress_phase" style="width:100%">';
		foreach ( self::story_workbench_progress_phase_options() as $value => $label ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $value ), selected( $value, (string) ( $form_state['progress_phase'] ?? '' ), false ), esc_html( $label ) );
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-band" style="display:block;font-weight:600;margin-bottom:4px">Result band</label>';
		echo '<select id="jf-ironquest-workbench-band" name="result_band" style="width:100%">';
		foreach ( self::story_workbench_result_band_options() as $value => $label ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $value ), selected( $value, (string) ( $form_state['result_band'] ?? '' ), false ), esc_html( $label ) );
		}
		echo '</select></div>';
		echo '<div><label for="jf-ironquest-workbench-count" style="display:block;font-weight:600;margin-bottom:4px">Candidates</label>';
		echo '<input id="jf-ironquest-workbench-count" name="count" type="number" min="1" max="24" step="1" value="' . esc_attr( (string) ( $form_state['count'] ?? 8 ) ) . '" style="width:100%">';
		echo '</div>';
		echo '</div>';
		echo '</details></div>';
		echo '<div style="grid-column:1 / -1;display:flex;gap:8px;flex-wrap:wrap">';
		echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_preview" class="button button-primary"' . ( $mission_supports_story_workbench ? '' : ' disabled' ) . '>Analyze Moment</button>';
		echo '</div>';
			echo '</form>';
			echo '</section>';

			if ( 'authoring' === $active_tab ) {
				echo '<section style="border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				echo '<h3 style="margin:0 0 8px">Step 2: Tune The Story Foundations</h3>';
				echo '<p style="margin:0 0 12px;color:#50575e">These higher-level fields drive the AI before it rewrites the five scene fields. Fix location and mission context here first.</p>';
				echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(280px,1fr));gap:12px">';
				echo '<form method="post" style="display:grid;gap:12px;background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				wp_nonce_field( 'jf_ironquest_admin_action' );
				self::render_action_form_context( $page_slug, $user, $lookup );
				self::render_story_workbench_hidden_filter_inputs( $form_state );
				echo '<div>';
				echo '<h4 style="margin:0 0 8px">Location Foundation</h4>';
				echo '<p style="margin:0;color:#50575e">' . esc_html( $selected_location_name ?: 'Unknown location' ) . '</p>';
				echo '</div>';
				echo '<div><label for="jf-ironquest-location-theme" style="display:block;font-weight:600;margin-bottom:4px">Location theme</label>';
				echo '<input id="jf-ironquest-location-theme" name="location_theme" type="text" value="' . esc_attr( (string) ( $selected_location['theme'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-location-tone" style="display:block;font-weight:600;margin-bottom:4px">Location tone</label>';
				echo '<input id="jf-ironquest-location-tone" name="location_tone" type="text" value="' . esc_attr( (string) ( $selected_location['tone'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-location-story-context" style="display:block;font-weight:600;margin-bottom:4px">Location story context</label>';
				echo '<textarea id="jf-ironquest-location-story-context" name="location_story_context" rows="3" style="width:100%">' . esc_textarea( (string) ( $selected_location['story_context'] ?? '' ) ) . '</textarea></div>';
				echo '<div><label for="jf-ironquest-location-ai-theme" style="display:block;font-weight:600;margin-bottom:4px">AI visual anchor</label>';
				echo '<input id="jf-ironquest-location-ai-theme" name="location_ai_theme" type="text" value="' . esc_attr( (string) ( $selected_location['ai_prompt_anchor']['theme'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-location-ai-tone" style="display:block;font-weight:600;margin-bottom:4px">AI narrative tone</label>';
				echo '<input id="jf-ironquest-location-ai-tone" name="location_ai_tone" type="text" value="' . esc_attr( (string) ( $selected_location['ai_prompt_anchor']['tone'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-location-enemy-types" style="display:block;font-weight:600;margin-bottom:4px">Enemy types</label>';
				echo '<textarea id="jf-ironquest-location-enemy-types" name="location_enemy_types" rows="4" style="width:100%">' . esc_textarea( implode( PHP_EOL, array_values( array_filter( (array) ( $selected_location['ai_prompt_anchor']['enemy_types'] ?? [] ), 'is_string' ) ) ) ) . '</textarea>';
				echo '<p style="margin:4px 0 0;color:#50575e">One enemy type per line.</p></div>';
				echo '<div style="display:flex;gap:8px;flex-wrap:wrap">';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_suggest_location" class="button button-secondary">Generate With AI</button>';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_save_location" class="button">Save Location Foundation</button>';
				echo '</div>';
				echo '</form>';

				echo '<form method="post" style="display:grid;gap:12px;background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				wp_nonce_field( 'jf_ironquest_admin_action' );
				self::render_action_form_context( $page_slug, $user, $lookup );
				self::render_story_workbench_hidden_filter_inputs( $form_state );
				echo '<div>';
				echo '<h4 style="margin:0 0 8px">Mission Foundation</h4>';
				echo '<p style="margin:0;color:#50575e">' . esc_html( (string) ( $selected_mission['name'] ?? $selected_mission['slug'] ?? '' ) ) . '</p>';
				echo '</div>';
				echo '<div><label for="jf-ironquest-mission-goal" style="display:block;font-weight:600;margin-bottom:4px">Mission goal</label>';
				echo '<input id="jf-ironquest-mission-goal" name="mission_goal" type="text" value="' . esc_attr( (string) ( $selected_mission['goal'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-mission-threat" style="display:block;font-weight:600;margin-bottom:4px">Mission threat</label>';
				echo '<input id="jf-ironquest-mission-threat" name="mission_threat" type="text" value="' . esc_attr( (string) ( $selected_mission['threat'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-mission-narrative" style="display:block;font-weight:600;margin-bottom:4px">Mission narrative</label>';
				echo '<textarea id="jf-ironquest-mission-narrative" name="mission_narrative" rows="4" style="width:100%">' . esc_textarea( (string) ( $selected_mission['narrative'] ?? '' ) ) . '</textarea></div>';
				echo '<div><label for="jf-ironquest-mission-workout-feel" style="display:block;font-weight:600;margin-bottom:4px">Workout feel</label>';
				echo '<input id="jf-ironquest-mission-workout-feel" name="mission_workout_feel" type="text" value="' . esc_attr( (string) ( $selected_mission['workout_feel'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:12px">';
				echo '<div><label for="jf-ironquest-mission-genre" style="display:block;font-weight:600;margin-bottom:4px">Genre</label><input id="jf-ironquest-mission-genre" name="mission_genre" type="text" value="' . esc_attr( (string) ( $selected_mission['story_profile']['genre'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-mission-voice" style="display:block;font-weight:600;margin-bottom:4px">Voice</label><input id="jf-ironquest-mission-voice" name="mission_voice" type="text" value="' . esc_attr( (string) ( $selected_mission['story_profile']['voice'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '<div><label for="jf-ironquest-mission-pacing" style="display:block;font-weight:600;margin-bottom:4px">Pacing</label><input id="jf-ironquest-mission-pacing" name="mission_pacing" type="text" value="' . esc_attr( (string) ( $selected_mission['story_profile']['pacing'] ?? '' ) ) . '" style="width:100%"></div>';
				echo '</div>';
				echo '<div style="display:flex;gap:8px;flex-wrap:wrap">';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_suggest_mission" class="button button-secondary">Generate With AI</button>';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_save_mission" class="button">Save Mission Foundation</button>';
				echo '</div>';
				echo '</form>';
				echo '</div>';
				echo '</section>';

				echo '<section style="border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				echo '<h3 style="margin:0 0 8px">Step 3: Edit The Scene Brief</h3>';
				echo '<p style="margin:0 0 12px;color:#50575e">This is the plain-language scene description the AI uses after location and mission context are set.</p>';
				echo '<form method="post" style="display:grid;gap:12px">';
				wp_nonce_field( 'jf_ironquest_admin_action' );
				self::render_action_form_context( $page_slug, $user, $lookup );
				self::render_story_workbench_hidden_filter_inputs( $form_state );
				echo '<div style="background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				echo '<p style="margin:0 0 4px"><strong>Scene:</strong> ' . esc_html( (string) ( $selected_encounter_seed['title'] ?? $form_state['encounter_seed_slug'] ?? 'No scene selected' ) ) . '</p>';
				echo '<p style="margin:0;color:#50575e">Change the mission or scene above and these fields refresh automatically.</p>';
				echo '</div>';
				echo '<div><label for="jf-ironquest-scene-brief" style="display:block;font-weight:600;margin-bottom:4px">Scene brief</label>';
				echo '<textarea id="jf-ironquest-scene-brief" name="scene_brief" rows="3" style="width:100%">' . esc_textarea( (string) ( $selected_encounter_seed['scene_brief'] ?? '' ) ) . '</textarea></div>';
				echo '<div><label for="jf-ironquest-player-goal" style="display:block;font-weight:600;margin-bottom:4px">Player goal</label>';
				echo '<textarea id="jf-ironquest-player-goal" name="player_goal" rows="2" style="width:100%">' . esc_textarea( (string) ( $selected_encounter_seed['player_goal'] ?? '' ) ) . '</textarea></div>';
				echo '<div><label for="jf-ironquest-opponent-pressure" style="display:block;font-weight:600;margin-bottom:4px">Opponent pressure</label>';
				echo '<textarea id="jf-ironquest-opponent-pressure" name="opponent_pressure" rows="2" style="width:100%">' . esc_textarea( (string) ( $selected_encounter_seed['opponent_pressure'] ?? '' ) ) . '</textarea></div>';
				echo '<div><label for="jf-ironquest-failure-cost" style="display:block;font-weight:600;margin-bottom:4px">Failure cost</label>';
				echo '<textarea id="jf-ironquest-failure-cost" name="failure_cost" rows="2" style="width:100%">' . esc_textarea( (string) ( $selected_encounter_seed['failure_cost'] ?? '' ) ) . '</textarea></div>';
				echo '<div><label for="jf-ironquest-setting-detail" style="display:block;font-weight:600;margin-bottom:4px">Setting detail</label>';
				echo '<textarea id="jf-ironquest-setting-detail" name="setting_detail" rows="2" style="width:100%">' . esc_textarea( (string) ( $selected_encounter_seed['setting_detail'] ?? '' ) ) . '</textarea></div>';
				echo '<div style="display:flex;gap:8px;flex-wrap:wrap">';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_suggest_scene" class="button button-secondary">Generate With AI</button>';
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_save_scene" class="button">Save Scene Brief</button>';
				echo '</div>';
				echo '</form>';
				echo '</section>';
			}

		if ( ! empty( $selected_mission ) ) {
			echo '<div style="margin:12px 0 0;background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
			echo '<p style="margin:0 0 6px"><strong>Selected mission:</strong> ' . esc_html( (string) ( $selected_mission['name'] ?? $selected_mission['slug'] ?? '' ) ) . '</p>';
			echo '<p style="margin:0 0 6px;color:#50575e"><strong>Location:</strong> ' . esc_html( $selected_location_name ?: 'Unknown' ) . ' · <strong>Encounter seeds:</strong> ' . esc_html( (string) count( $encounter_seeds ) ) . ' · <strong>Story slots:</strong> ' . esc_html( (string) count( $story_slots ) ) . ' · <strong>Workbench:</strong> ' . esc_html( $mission_supports_story_workbench ? 'ready' : 'not authored yet' ) . '</p>';
			echo '<p style="margin:0 0 6px;color:#50575e"><strong>Current slot footprint:</strong> ' . esc_html( (string) count( $current_slot_templates ) ) . ' live template(s) in this slot · ' . esc_html( (string) count( $approved_candidates ) ) . ' approved candidate(s) queued</p>';
			if ( ! empty( $selected_slot_config['notes'] ) ) {
				echo '<p style="margin:0;color:#50575e"><strong>Slot note:</strong> ' . esc_html( (string) $selected_slot_config['notes'] ) . '</p>';
			}
			echo '</div>';
		}

		if ( ! $mission_supports_story_workbench ) {
			echo '<div class="notice notice-warning inline" style="margin-top:16px"><p>This mission is in the dropdown, but it does not have story slots and beat templates yet. Add authored story data first, then preview/apply will work here.</p></div>';
		}

		if ( $mission_supports_story_workbench && empty( $preview ) ) {
			echo '<div class="notice notice-info inline" style="margin-top:16px"><p>No branch map loaded yet. Save the scene brief if needed, then use <strong>Analyze Moment</strong> to load coverage, find gaps, and preview drafts.</p></div>';
		}

		if ( 'authoring' === $active_tab && ! empty( $preview ) ) {
			$candidate_session = is_array( $preview['candidateSession'] ?? null ) ? $preview['candidateSession'] : [];
			$candidates = array_values( array_filter( (array) ( $candidate_session['candidates'] ?? [] ), 'is_array' ) );
			$missing_branches = self::story_workbench_missing_branches( $coverage_report );
			echo '<section style="margin-top:18px;display:grid;gap:12px;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
			echo '<h3 style="margin:0">Step 4: Review Branch Coverage</h3>';
			echo '<p style="margin:0;color:#50575e">Start here. This map shows which branches already resolve to a live template under the current scene and advanced filters.</p>';
			echo '<div style="background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
			echo '<strong>Prompt context</strong>';
			echo '<p style="margin:8px 0 4px">' . esc_html( (string) ( $preview['mission']['name'] ?? '' ) ) . ' · ' . esc_html( (string) ( $preview['promptContext']['encounterSeed']['title'] ?? $form_state['encounter_seed_slug'] ?? '' ) ) . '</p>';
			echo '<p style="margin:0;color:#50575e">Voice: ' . esc_html( (string) ( $preview['promptContext']['storyProfile']['voice'] ?? 'n/a' ) ) . ' · Genre: ' . esc_html( (string) ( $preview['promptContext']['storyProfile']['genre'] ?? 'n/a' ) ) . ' · Approved: ' . esc_html( (string) ( $candidate_session['approved_count'] ?? 0 ) ) . '</p>';
			echo '<p style="margin:6px 0 0;color:#50575e">Current branch focus: ' . esc_html( self::story_workbench_set_result_options()[ (string) ( $form_state['set_result'] ?? '' ) ] ?? (string) ( $form_state['set_result'] ?? 'n/a' ) ) . ' · ' . esc_html( self::story_workbench_stance_options()[ (string) ( $form_state['stance'] ?? '' ) ] ?? (string) ( $form_state['stance'] ?? 'n/a' ) ) . '</p>';
			if ( ! empty( $selection_diagnostics ) ) {
				echo '<p style="margin:6px 0 0;color:#50575e">Slot templates: ' . esc_html( (string) ( $selection_diagnostics['slot_template_count'] ?? 0 ) ) . ' · Branch matches: ' . esc_html( implode( ', ', (array) ( $selection_diagnostics['matching_template_ids'] ?? [] ) ) ?: 'none' ) . '</p>';
			}
			echo '</div>';

			echo '<div style="background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
			echo '<strong>Gap summary</strong>';
			if ( [] === $missing_branches ) {
				echo '<p style="margin:8px 0 0;color:#2f6f3e">This moment currently has a matching branch for every workout outcome and tone in the map below.</p>';
			} else {
				echo '<p style="margin:8px 0 6px;color:#50575e">Missing branches under the current scene and advanced filters:</p>';
				echo '<p style="margin:0;color:#1d2327">' . esc_html( implode( ' · ', array_map( static fn( array $branch ): string => $branch['set_result_label'] . ' / ' . $branch['stance_label'], $missing_branches ) ) ) . '</p>';
			}
			echo '</div>';

			if ( ! empty( $coverage_report['rows'] ) ) {
				echo '<div style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				echo '<strong>Slot coverage</strong>';
				echo '<p style="margin:6px 0 10px;color:#50575e">Click any cell to jump straight into that branch. Missing cells are the clearest authoring targets.</p>';
				echo '<table style="width:100%;border-collapse:collapse">';
				echo '<thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #dcdcde">Workout outcome</th>';
				foreach ( self::story_workbench_stance_options() as $label ) {
					echo '<th style="text-align:left;padding:6px;border-bottom:1px solid #dcdcde">' . esc_html( $label ) . ' tone</th>';
				}
				echo '</tr></thead><tbody>';
				foreach ( (array) $coverage_report['rows'] as $row ) {
					echo '<tr>';
					echo '<td style="padding:6px;border-bottom:1px solid #f0f0f1"><strong>' . esc_html( (string) ( $row['set_result_label'] ?? $row['set_result'] ?? '' ) ) . '</strong></td>';
					foreach ( (array) ( $row['cells'] ?? [] ) as $cell ) {
						$template_id = (string) ( $cell['template_id'] ?? '' );
						echo '<td style="padding:6px;border-bottom:1px solid #f0f0f1">';
						echo '<form method="post" style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;margin:0">';
						wp_nonce_field( 'jf_ironquest_admin_action' );
						self::render_action_form_context( $page_slug, $user, $lookup );
						self::render_story_workbench_hidden_filter_inputs( $form_state );
						echo '<input type="hidden" name="set_result" value="' . esc_attr( (string) ( $row['set_result'] ?? '' ) ) . '">';
						echo '<input type="hidden" name="stance" value="' . esc_attr( (string) ( $cell['stance'] ?? '' ) ) . '">';
						echo '<span style="color:' . esc_attr( '' !== $template_id ? '#1d2327' : '#8c8f94' ) . '">' . esc_html( '' !== $template_id ? $template_id : 'Missing branch' ) . '</span>';
						echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_preview" class="button button-small">' . esc_html( '' !== $template_id ? 'Preview branch' : 'Generate branch' ) . '</button>';
						echo '</form>';
						echo '</td>';
					}
					echo '</tr>';
				}
				echo '</tbody></table>';
				echo '</div>';
			}

			echo '<section style="display:grid;gap:12px">';
			echo '<h3 style="margin:0">Step 5: Review Drafts</h3>';
			foreach ( $candidates as $candidate ) {
				$status = sanitize_key( (string) ( $candidate['status'] ?? 'unreviewed' ) );
				echo '<div style="border:1px solid #dcdcde;border-radius:8px;padding:12px">';
				echo '<strong>' . esc_html( (string) ( $candidate['template_id'] ?? $candidate['candidate_id'] ?? 'candidate' ) ) . '</strong>';
				echo '<p style="margin:6px 0 8px;color:#50575e">Status: ' . esc_html( $status ?: 'unreviewed' ) . ' · Tags: ' . esc_html( implode( ', ', (array) ( $candidate['tags'] ?? [] ) ) ?: 'none' ) . '</p>';
				echo '<p style="margin:0 0 8px">' . esc_html( (string) ( $candidate['draft']['summary'] ?? '' ) ) . '</p>';
				echo '<p style="margin:0 0 8px">' . esc_html( (string) ( $candidate['draft']['follow_up'] ?? '' ) ) . '</p>';
				echo '<p style="margin:0 0 12px"><em>' . esc_html( (string) ( $candidate['draft']['decision_prompt'] ?? '' ) ) . '</em></p>';
				echo '<form method="post" style="display:inline-block;margin-right:8px">';
				wp_nonce_field( 'jf_ironquest_admin_action' );
					self::render_action_form_context( $page_slug, $user, $lookup );
				self::render_story_workbench_hidden_filter_inputs( $form_state );
				echo '<input type="hidden" name="session_id" value="' . esc_attr( (string) ( $candidate_session['session_id'] ?? '' ) ) . '">';
				echo '<input type="hidden" name="candidate_id" value="' . esc_attr( (string) ( $candidate['candidate_id'] ?? '' ) ) . '">';
				if ( 'approved' !== $status ) {
					echo '<input type="hidden" name="approved" value="1">';
				}
				echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_review" class="button">' . esc_html( 'approved' === $status ? 'Remove Approval' : 'Approve for Export' ) . '</button>';
				echo '</form>';
				echo '</div>';
			}
			echo '</section>';
			echo '</section>';
		}

		if ( 'publish' === $active_tab ) {
			echo '<section style="margin-top:18px;display:grid;gap:12px;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
			echo '<h3 style="margin:0">Publish Review</h3>';
			echo '<p style="margin:0;color:#50575e">This tab is only about what will go live. Review the replacement impact before exporting or applying.</p>';
			echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(280px,1fr));gap:12px">';
			echo '<div style="background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
			echo '<strong>Live right now</strong>';
			if ( [] === $current_slot_templates ) {
				echo '<p style="margin:8px 0 0;color:#8c8f94">No live templates currently sit in this story moment.</p>';
			} else {
				echo '<ul style="margin:8px 0 0 18px">';
				foreach ( $current_slot_templates as $template ) {
					echo '<li>' . esc_html( (string) ( $template['id'] ?? 'unknown_template' ) ) . '</li>';
				}
				echo '</ul>';
			}
			echo '</div>';
			echo '<div style="background:#f6f7f7;border:1px solid #dcdcde;border-radius:8px;padding:12px">';
			echo '<strong>Queued to publish</strong>';
			if ( [] === $approved_candidates ) {
				echo '<p style="margin:8px 0 0;color:#8c8f94">No approved drafts yet. Approve a candidate before export or apply will do anything.</p>';
			} else {
				echo '<ul style="margin:8px 0 0 18px">';
				foreach ( $approved_candidates as $approved_candidate ) {
					$candidate = (array) ( $approved_candidate['candidate'] ?? [] );
					echo '<li>' . esc_html( (string) ( $candidate['template_id'] ?? $candidate['candidate_id'] ?? 'approved_candidate' ) ) . '</li>';
				}
				echo '</ul>';
			}
			echo '</div>';
			echo '</div>';
			echo '<p style="margin:0;color:#50575e">Applying changes to this story moment will replace <strong>' . esc_html( (string) count( $current_slot_templates ) ) . '</strong> live template(s) with <strong>' . esc_html( (string) count( $approved_candidates ) ) . '</strong> approved draft(s) for <strong>' . esc_html( self::humanize_key( (string) ( $form_state['slot'] ?? '' ) ) ) . '</strong>.</p>';
			echo '<form method="post" style="display:flex;gap:8px;flex-wrap:wrap">';
			wp_nonce_field( 'jf_ironquest_admin_action' );
			self::render_action_form_context( $page_slug, $user, $lookup );
			self::render_story_workbench_hidden_filter_inputs( $form_state );
			echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_export" class="button"' . ( $mission_supports_story_workbench ? '' : ' disabled' ) . '>Export Approved JSON</button>';
			echo '<button type="submit" name="jf_ironquest_admin_action" value="story_workbench_apply" class="button button-secondary"' . ( $mission_supports_story_workbench ? '' : ' disabled' ) . '>Apply to Mission Config</button>';
			echo '</form>';

			if ( ! empty( $export['export_json'] ) ) {
				echo '<div>';
				echo '<h4 style="margin:0 0 8px">Export JSON</h4>';
				echo '<textarea readonly rows="14" style="width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">' . esc_textarea( (string) $export['export_json'] ) . '</textarea>';
				if ( ! empty( $applied['config_path'] ) ) {
					echo '<p style="margin:8px 0 0;color:#50575e">Last applied to: ' . esc_html( (string) $applied['config_path'] ) . '</p>';
				}
				echo '</div>';
			}

			echo '</section>';
		}
		echo '</div>';
		echo '</section>';
		self::render_story_workbench_inline_script();
	}

	private static function render_action_form_context( string $page_slug, ?\WP_User $user = null, string $lookup = '' ): void {
		echo '<input type="hidden" name="page" value="' . esc_attr( $page_slug ) . '">';
		if ( $user instanceof \WP_User ) {
			echo '<input type="hidden" name="user_id" value="' . (int) $user->ID . '">';
			echo '<input type="hidden" name="lookup" value="' . esc_attr( $lookup ) . '">';
		}
	}

	private static function render_story_workbench_hidden_filter_inputs( array $form_state ): void {
		echo '<input type="hidden" name="workbench_tab" value="' . esc_attr( (string) ( $form_state['workbench_tab'] ?? 'authoring' ) ) . '">';
		echo '<input type="hidden" name="mission_slug" value="' . esc_attr( (string) ( $form_state['mission_slug'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="encounter_seed_slug" value="' . esc_attr( (string) ( $form_state['encounter_seed_slug'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="slot" value="' . esc_attr( (string) ( $form_state['slot'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="set_result" value="' . esc_attr( (string) ( $form_state['set_result'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="stance" value="' . esc_attr( (string) ( $form_state['stance'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="stage" value="' . esc_attr( (string) ( $form_state['stage'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="tension" value="' . esc_attr( (string) ( $form_state['tension'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="progress_phase" value="' . esc_attr( (string) ( $form_state['progress_phase'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="result_band" value="' . esc_attr( (string) ( $form_state['result_band'] ?? '' ) ) . '">';
		echo '<input type="hidden" name="count" value="' . esc_attr( (string) ( $form_state['count'] ?? 8 ) ) . '">';
	}

	private static function render_story_workbench_inline_script(): void {
		static $rendered = false;
		if ( $rendered ) {
			return;
		}
		$rendered = true;

		echo '<script>';
		echo '(function(){';
		echo 'const form=document.querySelector(\'form[data-story-workbench-form="1"]\');';
		echo 'if(!form){return;}';
		echo 'const missionSelect=form.querySelector(\'select[data-sync-targets="1"]\');';
		echo 'if(!missionSelect){return;}';
		echo 'missionSelect.addEventListener("change",function(){';
		echo 'const actionInput=form.querySelector(\'[name="jf_ironquest_admin_action"]\');';
		echo 'if(actionInput){actionInput.value="";}';
		echo 'form.submit();';
		echo '});';
		echo '})();';
		echo '</script>';
	}

	private static function story_workbench_missing_branches( array $coverage_report ): array {
		$missing = [];
		foreach ( (array) ( $coverage_report['rows'] ?? [] ) as $row ) {
			foreach ( (array) ( $row['cells'] ?? [] ) as $cell ) {
				if ( '' !== sanitize_key( (string) ( $cell['template_id'] ?? '' ) ) ) {
					continue;
				}

				$missing[] = [
					'set_result' => sanitize_key( (string) ( $row['set_result'] ?? '' ) ),
					'set_result_label' => sanitize_text_field( (string) ( $row['set_result_label'] ?? $row['set_result'] ?? '' ) ),
					'stance' => sanitize_key( (string) ( $cell['stance'] ?? '' ) ),
					'stance_label' => sanitize_text_field( (string) ( $cell['stance_label'] ?? $cell['stance'] ?? '' ) ),
				];
			}
		}

		return $missing;
	}

	private static function resolve_story_workbench_form_state( int $user_id = 0, ?array $missions = null ): array {
		$preferred_location = $user_id > 0 ? self::current_location_slug( $user_id ) : '';
		$missions = is_array( $missions ) ? array_values( array_filter( $missions, 'is_array' ) ) : self::get_story_workbench_available_missions( $preferred_location );
		$mission_slug = sanitize_key( (string) wp_unslash( $_POST['mission_slug'] ?? '' ) );
		$selected_mission = [];
		foreach ( $missions as $mission ) {
			if ( $mission_slug === sanitize_key( (string) ( $mission['slug'] ?? '' ) ) ) {
				$selected_mission = $mission;
				break;
			}
		}
		if ( [] === $selected_mission ) {
			foreach ( $missions as $mission ) {
				if ( self::mission_supports_story_workbench( (array) $mission ) ) {
					$selected_mission = (array) $mission;
					break;
				}
			}
			if ( [] === $selected_mission ) {
				$selected_mission = $missions[0] ?? [];
			}
			$mission_slug = sanitize_key( (string) ( $selected_mission['slug'] ?? '' ) );
		}

		$encounter_seeds = array_values( array_filter( (array) ( $selected_mission['encounter_seeds'] ?? [] ), 'is_array' ) );
		$encounter_seed_slug = sanitize_key( (string) wp_unslash( $_POST['encounter_seed_slug'] ?? '' ) );
		if ( ! array_filter( $encounter_seeds, static fn( array $seed ): bool => $encounter_seed_slug === sanitize_key( (string) ( $seed['slug'] ?? '' ) ) ) ) {
			$encounter_seed_slug = sanitize_key( (string) ( $encounter_seeds[0]['slug'] ?? '' ) );
		}
			$selected_encounter_seed = [];
		foreach ( $encounter_seeds as $seed ) {
			if ( $encounter_seed_slug === sanitize_key( (string) ( $seed['slug'] ?? '' ) ) ) {
				$selected_encounter_seed = $seed;
				break;
			}
		}

		$story_slots = array_filter( (array) ( $selected_mission['story_slots'] ?? [] ), 'is_array' );
		$slot = sanitize_key( (string) wp_unslash( $_POST['slot'] ?? '' ) );
		if ( '' === $slot || ! isset( $story_slots[ $slot ] ) ) {
			$slot = sanitize_key( (string) array_key_first( $story_slots ) );
		}

		$set_result = sanitize_key( (string) wp_unslash( $_POST['set_result'] ?? 'target_met' ) );
		if ( ! isset( self::story_workbench_set_result_options()[ $set_result ] ) ) {
			$set_result = 'target_met';
		}

		$stance = sanitize_key( (string) wp_unslash( $_POST['stance'] ?? 'steady' ) );
		if ( ! isset( self::story_workbench_stance_options()[ $stance ] ) ) {
			$stance = 'steady';
		}

		$stage = sanitize_key( (string) wp_unslash( $_POST['stage'] ?? 'middle' ) );
		if ( ! isset( self::story_workbench_stage_options()[ $stage ] ) ) {
			$stage = 'middle';
		}

		$tension = sanitize_key( (string) wp_unslash( $_POST['tension'] ?? 'rising' ) );
		if ( ! isset( self::story_workbench_tension_options()[ $tension ] ) ) {
			$tension = 'rising';
		}

		$progress_phase = sanitize_key( (string) wp_unslash( $_POST['progress_phase'] ?? 'engaged' ) );
		if ( ! isset( self::story_workbench_progress_phase_options()[ $progress_phase ] ) ) {
			$progress_phase = 'engaged';
		}

		$result_band = sanitize_key( (string) wp_unslash( $_POST['result_band'] ?? 'victory' ) );
		if ( ! isset( self::story_workbench_result_band_options()[ $result_band ] ) ) {
			$result_band = 'victory';
		}

		$count = max( 1, min( 24, (int) wp_unslash( $_POST['count'] ?? 8 ) ) );
		$workbench_tab = sanitize_key( (string) wp_unslash( $_POST['workbench_tab'] ?? 'authoring' ) );
		if ( ! in_array( $workbench_tab, [ 'authoring', 'publish' ], true ) ) {
			$workbench_tab = 'authoring';
		}

		$selected_location = ! empty( $selected_mission['location_slug'] ) ? ( IronQuestRegistryService::get_location( (string) $selected_mission['location_slug'] ) ?? [] ) : [];

		return [
			'missions' => $missions,
			'selected_mission' => $selected_mission,
			'selected_location' => $selected_location,
			'mission_slug' => $mission_slug,
			'encounter_seeds' => $encounter_seeds,
			'selected_encounter_seed' => $selected_encounter_seed,
			'encounter_seed_slug' => $encounter_seed_slug,
			'story_slots' => $story_slots,
			'slot' => $slot,
			'set_result' => $set_result,
			'stance' => $stance,
			'stage' => $stage,
			'tension' => $tension,
			'progress_phase' => $progress_phase,
			'result_band' => $result_band,
			'count' => $count,
			'workbench_tab' => $workbench_tab,
		];
	}

	private static function get_story_workbench_available_missions( string $preferred_location = '' ): array {
		$preferred_location = sanitize_key( $preferred_location );
		$missions = array_values(
			array_filter(
				(array) ( IronQuestRegistryService::get_missions_config()['missions'] ?? [] ),
				static fn( $mission ): bool => is_array( $mission ) && self::mission_supports_story_workbench( (array) $mission )
			)
		);

		usort(
			$missions,
			static function ( array $left, array $right ) use ( $preferred_location ): int {
				$left_preferred = $preferred_location !== '' && sanitize_key( (string) ( $left['location_slug'] ?? '' ) ) === $preferred_location;
				$right_preferred = $preferred_location !== '' && sanitize_key( (string) ( $right['location_slug'] ?? '' ) ) === $preferred_location;

				if ( $left_preferred !== $right_preferred ) {
					return $left_preferred ? -1 : 1;
				}

				$location_compare = strcmp( (string) ( $left['location_slug'] ?? '' ), (string) ( $right['location_slug'] ?? '' ) );
				if ( 0 !== $location_compare ) {
					return $location_compare;
				}

				$number_compare = (int) ( $left['mission_number'] ?? 0 ) <=> (int) ( $right['mission_number'] ?? 0 );
				if ( 0 !== $number_compare ) {
					return $number_compare;
				}

				return strcmp( (string) ( $left['name'] ?? '' ), (string) ( $right['name'] ?? '' ) );
			}
		);

		return $missions;
	}

	private static function parse_story_workbench_list_input( string $raw ): array {
		$items = preg_split( '/\r\n|\r|\n|,/', $raw ) ?: [];
		$clean = [];
		foreach ( $items as $item ) {
			$value = sanitize_text_field( trim( (string) $item ) );
			if ( '' !== $value ) {
				$clean[] = $value;
			}
		}

		return array_values( array_slice( $clean, 0, 8 ) );
	}

	private static function get_story_workbench_unsupported_missions(): array {
		$missions = array_values(
			array_filter(
				(array) ( IronQuestRegistryService::get_missions_config()['missions'] ?? [] ),
				static fn( $mission ): bool => is_array( $mission ) && ! self::mission_supports_story_workbench( (array) $mission )
			)
		);

		usort(
			$missions,
			static function ( array $left, array $right ): int {
				$location_compare = strcmp( (string) ( $left['location_slug'] ?? '' ), (string) ( $right['location_slug'] ?? '' ) );
				if ( 0 !== $location_compare ) {
					return $location_compare;
				}

				$number_compare = (int) ( $left['mission_number'] ?? 0 ) <=> (int) ( $right['mission_number'] ?? 0 );
				if ( 0 !== $number_compare ) {
					return $number_compare;
				}

				return strcmp( (string) ( $left['name'] ?? '' ), (string) ( $right['name'] ?? '' ) );
			}
		);

		return $missions;
	}

	private static function mission_supports_story_workbench( array $mission ): bool {
		if ( [] === $mission ) {
			return false;
		}

		return ! empty( $mission['story_slots'] )
			&& ! empty( $mission['encounter_seeds'] )
			&& ! empty( $mission['beat_templates'] );
	}

	private static function format_story_workbench_mission_label( array $mission ): string {
		$mission_name = (string) ( $mission['name'] ?? $mission['slug'] ?? 'Unknown mission' );
		$location = IronQuestRegistryService::get_location( (string) ( $mission['location_slug'] ?? '' ) );
		$location_name = is_array( $location ) ? (string) ( $location['name'] ?? '' ) : self::humanize_key( (string) ( $mission['location_slug'] ?? '' ) );

		if ( '' === $location_name ) {
			return $mission_name;
		}

		return $location_name . ' - ' . $mission_name;
	}

	private static function request_story_workbench_preview( array $form_state ) {
		$request = new \WP_REST_Request( 'POST', '/fit/v1/admin/ironquest/story-workbench-preview' );
		$request->set_param( 'mission_slug', (string) ( $form_state['mission_slug'] ?? '' ) );
		$request->set_param( 'encounter_seed_slug', (string) ( $form_state['encounter_seed_slug'] ?? '' ) );
		$request->set_param( 'slot', (string) ( $form_state['slot'] ?? '' ) );
		$request->set_param( 'set_result', (string) ( $form_state['set_result'] ?? 'target_met' ) );
		$request->set_param( 'stance', (string) ( $form_state['stance'] ?? 'steady' ) );
		$request->set_param( 'stage', (string) ( $form_state['stage'] ?? 'middle' ) );
		$request->set_param( 'tension', (string) ( $form_state['tension'] ?? 'rising' ) );
		$request->set_param( 'progress_phase', (string) ( $form_state['progress_phase'] ?? 'engaged' ) );
		$request->set_param( 'result_band', (string) ( $form_state['result_band'] ?? 'victory' ) );
		$request->set_param( 'count', (int) ( $form_state['count'] ?? 8 ) );

		return self::rest_response_to_data( AdminApiController::preview_ironquest_story_workbench( $request ) );
	}

	private static function rest_response_to_data( \WP_REST_Response $response ) {
		if ( $response->get_status() >= 400 ) {
			$data = (array) $response->get_data();
			return new WP_Error( 'ironquest_admin_rest_error', (string) ( $data['message'] ?? 'IronQuest admin request failed.' ) );
		}

		return (array) $response->get_data();
	}

	private static function story_workbench_set_result_options(): array {
		return [
			'target_met' => 'Target met',
			'recovered' => 'Recovered',
			'close_call' => 'Close call',
			'slipped' => 'Slipped',
			'strain' => 'Strain',
			'struggle' => 'Struggle',
		];
	}

	private static function story_workbench_stance_options(): array {
		return [
			'steady' => 'Steady',
			'aggressive' => 'Aggressive',
			'cautious' => 'Cautious',
		];
	}

	private static function story_workbench_stage_options(): array {
		return [
			'opening' => 'Opening',
			'middle' => 'Middle',
			'closing' => 'Closing',
			'resolution' => 'Resolution',
		];
	}

	private static function story_workbench_tension_options(): array {
		return [
			'controlled' => 'Controlled',
			'rising' => 'Rising',
			'high' => 'High',
			'critical' => 'Critical',
		];
	}

	private static function story_workbench_progress_phase_options(): array {
		return [
			'engaged' => 'Engaged',
			'clash' => 'Clash',
			'final_push' => 'Final push',
			'transition' => 'Transition',
		];
	}

	private static function story_workbench_result_band_options(): array {
		return [
			'victory' => 'Victory',
			'partial' => 'Partial',
			'failure' => 'Failure',
		];
	}

	private static function render_state_panels( \WP_User $user, array $state ): void {
		$profile          = is_array( $state['profile'] ?? null ) ? $state['profile'] : [];
		$route_state      = is_array( $state['route_state'] ?? null ) ? $state['route_state'] : [];
		$daily_state      = is_array( $state['daily_state'] ?? null ) ? $state['daily_state'] : [];
		$active_run       = is_array( $state['active_run'] ?? null ) ? $state['active_run'] : [];
		$character_sheet  = is_array( $state['character_sheet'] ?? null ) ? $state['character_sheet'] : [];
		$recent_unlocks   = array_values( array_filter( (array) ( $state['recent_unlocks'] ?? [] ), 'is_array' ) );
		$unlock_history   = array_values( array_filter( (array) ( $state['unlock_history'] ?? [] ), 'is_array' ) );
		$current_location = sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
		$missions         = $current_location ? IronQuestRegistryService::get_location_missions( $current_location ) : [];
		$tavern_art       = $current_location ? IronQuestWorldArtService::get_tavern_scene( $current_location ) : [];
		$store_art        = $current_location ? IronQuestWorldArtService::get_store_owner( $current_location ) : [];
		$recent_events    = IronQuestAnalyticsService::list_recent_events( 30, (int) $user->ID );
		$recent_failures  = array_values(
			array_filter(
				InternalDiagnosticsLogger::list_entries( 50 ),
				static fn( array $entry ): bool => (int) ( $entry['user_id'] ?? 0 ) === (int) $user->ID
					&& 'ironquest_backend' === sanitize_key( (string) ( $entry['source'] ?? '' ) )
			)
		);

		echo '<div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:16px">';
		self::render_json_panel( 'Profile Snapshot', [
			'user' => [
				'id'           => (int) $user->ID,
				'email'        => (string) $user->user_email,
				'display_name' => (string) $user->display_name,
			],
			'profile' => $profile,
			'active_run' => $active_run,
			'rival_state' => $state['rival_state'] ?? [],
		] );
		self::render_json_panel( 'Route & Daily State', [
			'route_state' => $route_state,
			'daily_state' => $daily_state,
			'mission_modifiers' => $state['mission_modifiers'] ?? [],
		] );
		self::render_json_panel( 'Character Sheet & Portraits', [
			'identity'    => $character_sheet['identity'] ?? [],
			'collections' => $character_sheet['collections'] ?? [],
			'inventory'   => $character_sheet['inventory'] ?? [],
		] );
		self::render_json_panel( 'Unlock History', [
			'recent_unlocks' => $recent_unlocks,
			'unlock_count'   => count( $unlock_history ),
			'unlock_history' => array_slice( $unlock_history, 0, 20 ),
		] );
		self::render_json_panel( 'Current Location Art', [
			'location_slug' => $current_location,
			'tavern_art'    => $tavern_art,
			'store_art'     => $store_art,
			'mission_art'   => array_map(
				static fn( array $mission ): array => [
					'slug' => (string) ( $mission['slug'] ?? '' ),
					'name' => (string) ( $mission['name'] ?? '' ),
					'art'  => IronQuestWorldArtService::get_mission_card( $current_location, (string) ( $mission['slug'] ?? '' ) ),
				],
				$missions
			),
		] );
		self::render_json_panel( 'Store / Mission Board', [
			'mission_board' => $state['mission_board'] ?? [],
			'store'         => $state['store'] ?? [],
			'missions'      => $state['missions'] ?? [],
		] );
		self::render_json_panel( 'Analytics & Failures', [
			'recent_events'   => $recent_events,
			'recent_failures' => $recent_failures,
		] );
		echo '</div>';
	}

	private static function render_json_panel( string $title, array $data ): void {
		echo '<section style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:16px">';
		echo '<h3 style="margin-top:0">' . esc_html( $title ) . '</h3>';
		echo '<textarea readonly rows="16" style="width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">' . esc_textarea( self::pretty_json( $data ) ) . '</textarea>';
		echo '</section>';
	}

	private static function render_notice( string $message, string $type = 'success' ): void {
		$type = in_array( $type, [ 'success', 'warning', 'error', 'info' ], true ) ? $type : 'info';
		printf(
			'<div class="notice notice-%s%s"><p>%s</p></div>',
			esc_attr( $type ),
			'inline' === $type ? '' : ' is-dismissible',
			esc_html( $message )
		);
	}

	private static function render_stat_card( string $label, string $value, string $detail ): void {
		printf(
			'<div style="background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:16px">
				<div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#50575e;margin-bottom:6px">%s</div>
				<div style="font-size:20px;font-weight:700;color:#1d2327;margin-bottom:4px">%s</div>
				<div style="color:#50575e">%s</div>
			</div>',
			esc_html( $label ),
			esc_html( $value ),
			esc_html( $detail )
		);
	}

	private static function action_button( string $action, string $label, string $class ): string {
		return sprintf(
			'<button type="submit" name="jf_ironquest_admin_action" value="%s" class="%s">%s</button>',
			esc_attr( $action ),
			esc_attr( $class ),
			esc_html( $label )
		);
	}

	private static function resolve_user_lookup( int $selected_id, string $lookup ): array {
		if ( $selected_id > 0 ) {
			$user = get_userdata( $selected_id );
			return [
				'user'    => $user ?: null,
				'matches' => [],
			];
		}

		$lookup = trim( $lookup );
		if ( '' === $lookup ) {
			return [ 'user' => null, 'matches' => [] ];
		}

		if ( ctype_digit( $lookup ) ) {
			$user = get_userdata( (int) $lookup );
			return [ 'user' => $user ?: null, 'matches' => [] ];
		}

		$user = get_user_by( 'email', $lookup );
		if ( ! $user ) {
			$user = get_user_by( 'login', $lookup );
		}
		if ( $user ) {
			return [ 'user' => $user, 'matches' => [] ];
		}

		$query = new WP_User_Query(
			[
				'number'         => 10,
				'search'         => '*' . esc_attr( $lookup ) . '*',
				'search_columns' => [ 'user_login', 'user_email', 'display_name' ],
			]
		);

		$results = array_values( array_filter( $query->get_results(), static fn( $result ): bool => $result instanceof \WP_User ) );

		return [
			'user'    => 1 === count( $results ) ? $results[0] : null,
			'matches' => count( $results ) > 1 ? $results : [],
		];
	}

	private static function current_location_slug( int $user_id ): string {
		$profile = IronQuestProfileService::ensure_profile( $user_id );

		return sanitize_key( (string) ( $profile['current_location_slug'] ?? '' ) );
	}

	private static function posted_location_slug(): string {
		return sanitize_key( (string) wp_unslash( $_POST['location_slug'] ?? '' ) );
	}

	private static function required_posted_location_slug(): string {
		$location_slug = self::posted_location_slug();
		if ( '' === $location_slug ) {
			throw new \RuntimeException( 'A location slug is required for this IronQuest admin action.' );
		}

		return $location_slug;
	}

	private static function required_posted_quest_key(): string {
		$quest_key = sanitize_key( (string) wp_unslash( $_POST['quest_key'] ?? '' ) );
		if ( ! in_array( $quest_key, [ 'meal', 'sleep', 'cardio', 'steps', 'workout' ], true ) ) {
			throw new \RuntimeException( 'A valid daily quest key is required.' );
		}

		return $quest_key;
	}

	private static function humanize_key( string $value ): string {
		$normalized = sanitize_key( $value );
		if ( '' === $normalized ) {
			return 'Unknown';
		}

		return trim( preg_replace( '/\s+/', ' ', ucwords( str_replace( [ '_', '-' ], ' ', $normalized ) ) ) ?? '' );
	}

	private static function pretty_json( array $data ): string {
		$encoded = wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );

		return is_string( $encoded ) ? $encoded : '{}';
	}
}
