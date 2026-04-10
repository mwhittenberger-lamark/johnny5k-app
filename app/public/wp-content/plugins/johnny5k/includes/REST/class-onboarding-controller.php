<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\CalorieEngine;
use Johnny5k\Services\AwardEngine;
use Johnny5k\Services\BehaviorAnalyticsService;
use Johnny5k\Services\TrainingEngine;
use Johnny5k\Services\UserTime;

/**
 * REST Controller: Onboarding
 *
 * GET  /fit/v1/onboarding          — fetch current onboarding state
 * POST /fit/v1/onboarding/profile  — save profile + goals
 * POST /fit/v1/onboarding/prefs    — save preferences
 * POST /fit/v1/onboarding/complete — mark onboarding done, compute initial targets
 * POST /fit/v1/onboarding/restart  — mark onboarding incomplete so user can walk it again
 */
class OnboardingController {
	private const HEADSHOT_META_KEY = 'jf_user_headshot_attachment_id';
	private const GENERATED_IMAGES_META_KEY = 'jf_user_gemini_generated_images';

	public static function register_routes(): void {
		$ns = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/onboarding', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_state' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/profile', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_profile' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/prefs', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'save_preferences' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/health-flags', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'sync_health_flags' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/complete', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'complete' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/recalculate', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'recalculate_targets' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/restart', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'restart' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/training-schedule', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'update_training_schedule' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/sms-reminders', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_sms_reminders' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/sms-reminders/(?P<id>[a-z0-9\-]+)', [
			'methods'             => 'DELETE',
			'callback'            => [ __CLASS__, 'cancel_sms_reminder' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/onboarding/headshot', [
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'upload_headshot' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'serve_headshot' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_headshot' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/onboarding/generated-images', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'list_generated_images' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'generate_personalized_images' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/onboarding/generated-images/(?P<id>[a-z0-9\-]+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'serve_generated_image' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'update_generated_image' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_generated_image' ],
				'permission_callback' => $auth,
			],
		] );
	}

	// ── GET /onboarding ───────────────────────────────────────────────────────

	public static function get_state( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		global $wpdb;

		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );
		$prefs = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_preferences WHERE user_id = %d",
			$user_id
		) );
		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );
		$health_flags = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_user_health_flags WHERE user_id = %d AND active = 1 ORDER BY created_at DESC",
			$user_id
		) );
		$progress_photos = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, photo_date, angle, created_at FROM {$wpdb->prefix}fit_progress_photos WHERE user_id = %d ORDER BY photo_date DESC",
			$user_id
		) );
		$missing_fields = self::get_target_validation_errors( $profile );

		return new \WP_REST_Response( [
			'profile'             => $profile,
			'prefs'               => self::decode_preferences( $prefs ),
			'goal'                => $goal,
			'color_schemes'       => AdminApiController::get_color_schemes_config(),
			'app_images'          => AdminApiController::get_app_images_config(),
			'live_workout_frames' => AdminApiController::get_live_workout_frames_config(),
			'health_flags'        => $health_flags,
			'progress_photos'     => $progress_photos,
			'headshot'            => self::get_headshot_payload( $user_id ),
			'generated_images'    => self::get_generated_images_payload( $user_id ),
			'completion_ready'    => empty( $missing_fields ),
			'missing_profile_fields' => $missing_fields,
		] );
	}

	public static function upload_headshot( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$files = $req->get_file_params();

		if ( empty( $files['headshot'] ) ) {
			return new \WP_REST_Response( [ 'message' => 'No headshot file provided.' ], 400 );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		wp_set_current_user( $user_id );
		$attachment_id = media_handle_upload( 'headshot', 0 );
		if ( is_wp_error( $attachment_id ) ) {
			return new \WP_REST_Response( [ 'message' => $attachment_id->get_error_message() ], 500 );
		}

		$previous_attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );
		update_post_meta( $attachment_id, 'jf_private_photo', 1 );
		update_post_meta( $attachment_id, 'jf_owner_user_id', $user_id );
		update_user_meta( $user_id, self::HEADSHOT_META_KEY, $attachment_id );

		if ( $previous_attachment_id && $previous_attachment_id !== $attachment_id ) {
			wp_delete_attachment( $previous_attachment_id, true );
		}

		return new \WP_REST_Response( [
			'saved'    => true,
			'headshot' => self::get_headshot_payload( $user_id ),
		], 201 );
	}

	public static function serve_headshot( \WP_REST_Request $req ): mixed {
		$user_id = get_current_user_id();
		$attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );

		if ( ! $attachment_id ) {
			return new \WP_REST_Response( [ 'message' => 'Headshot not found.' ], 404 );
		}

		return self::stream_private_attachment( $attachment_id );
	}

	public static function delete_headshot( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );
		if ( ! $attachment_id ) {
			return new \WP_REST_Response( [ 'deleted' => true ], 200 );
		}

		delete_user_meta( $user_id, self::HEADSHOT_META_KEY );
		wp_delete_attachment( $attachment_id, true );

		return new \WP_REST_Response( [ 'deleted' => true ], 200 );
	}

	public static function list_generated_images( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( [
			'generated_images' => self::get_generated_images_payload( get_current_user_id() ),
		] );
	}

	public static function serve_generated_image( \WP_REST_Request $req ): mixed {
		$user_id = get_current_user_id();
		$image_id = sanitize_text_field( (string) $req->get_param( 'id' ) );
		$items = self::get_generated_images_payload( $user_id );
		$match = null;
		foreach ( $items as $item ) {
			if ( (string) ( $item['id'] ?? '' ) === $image_id ) {
				$match = $item;
				break;
			}
		}

		if ( ! $match || empty( $match['attachment_id'] ) ) {
			return new \WP_REST_Response( [ 'message' => 'Generated image not found.' ], 404 );
		}

		return self::stream_private_attachment( (int) $match['attachment_id'] );
	}

	public static function generate_personalized_images( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$headshot_attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );
		$johnny_reference_attachment_id = (int) get_option( 'jf_johnny_reference_attachment_id', 0 );

		if ( ! $headshot_attachment_id ) {
			return new \WP_REST_Response( [ 'message' => 'Upload a headshot before generating images.' ], 400 );
		}

		if ( ! $johnny_reference_attachment_id ) {
			return new \WP_REST_Response( [ 'message' => 'Johnny reference image is not configured in plugin settings.' ], 400 );
		}

		$custom_prompt = sanitize_textarea_field( (string) ( $req->get_param( 'prompt' ) ?: '' ) );
		$requested_count = (int) ( $req->get_param( 'count' ) ?? 2 );
		$generation_count = max( 1, min( 2, $requested_count ) );
		$scenarios = self::get_generation_scenarios();
		$scenarios = array_slice( $scenarios, 0, $generation_count );
		$progress_photo_data_urls = self::get_latest_progress_photo_data_urls( $user_id, 3 );
		$headshot_data_url = self::attachment_to_ai_data_url( $headshot_attachment_id );
		if ( is_wp_error( $headshot_data_url ) ) {
			return new \WP_REST_Response( [ 'message' => $headshot_data_url->get_error_message() ], 500 );
		}

		$johnny_data_url = self::attachment_to_ai_data_url( $johnny_reference_attachment_id );
		if ( is_wp_error( $johnny_data_url ) ) {
			return new \WP_REST_Response( [ 'message' => $johnny_data_url->get_error_message() ], 500 );
		}

		$reference_images = array_merge( [ $headshot_data_url, $johnny_data_url ], $progress_photo_data_urls );
		$created_items = [];

		foreach ( $scenarios as $scenario ) {
			$prompt = self::build_personalized_image_prompt( $custom_prompt, $scenario, $user_id );
			$result = \Johnny5k\Services\GeminiImageService::generate_image( $user_id, $prompt, $reference_images, [
				'aspect_ratio' => '1:1',
				'image_size'   => '2K',
			] );

			if ( is_wp_error( $result ) ) {
				return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
			}

			$attachment_id = self::create_private_generated_attachment( $user_id, $result['mime_type'], $result['data'], $scenario['slug'] );
			if ( is_wp_error( $attachment_id ) ) {
				return new \WP_REST_Response( [ 'message' => $attachment_id->get_error_message() ], 500 );
			}

				$created_items[] = [
					'id'            => wp_generate_uuid4(),
					'attachment_id' => (int) $attachment_id,
					'scenario'      => sanitize_text_field( $scenario['label'] ),
					'prompt'        => $prompt,
					'created_at'    => current_time( 'mysql' ),
					'favorited'     => false,
				];
			}

		$existing_items = get_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, true );
		$existing_items = is_array( $existing_items ) ? $existing_items : [];
		$merged_items = array_slice( array_merge( $created_items, $existing_items ), 0, 24 );
		update_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, $merged_items );

		return new \WP_REST_Response( [
			'generated_images' => self::get_generated_images_payload( $user_id ),
		], 201 );
	}

	public static function update_generated_image( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$image_id = sanitize_text_field( (string) $req->get_param( 'id' ) );
		$favorited = (bool) $req->get_param( 'favorited' );

		if ( '' === $image_id ) {
			return new \WP_REST_Response( [ 'message' => 'Generated image id is required.' ], 400 );
		}

		$items = get_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, true );
		$items = is_array( $items ) ? $items : [];
		$updated = false;

		foreach ( $items as &$item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( (string) ( $item['id'] ?? '' ) !== $image_id ) {
				continue;
			}
			$item['favorited'] = $favorited;
			$updated = true;
			break;
		}
		unset( $item );

		if ( ! $updated ) {
			return new \WP_REST_Response( [ 'message' => 'Generated image not found.' ], 404 );
		}

		update_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, $items );
		return new \WP_REST_Response( [
			'updated' => true,
			'generated_images' => self::get_generated_images_payload( $user_id ),
		] );
	}

	public static function delete_generated_image( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$image_id = sanitize_text_field( (string) $req->get_param( 'id' ) );

		if ( '' === $image_id ) {
			return new \WP_REST_Response( [ 'message' => 'Generated image id is required.' ], 400 );
		}

		$items = get_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, true );
		$items = is_array( $items ) ? $items : [];
		$next_items = [];
		$deleted = false;

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			if ( (string) ( $item['id'] ?? '' ) !== $image_id ) {
				$next_items[] = $item;
				continue;
			}
			$attachment_id = (int) ( $item['attachment_id'] ?? 0 );
			if ( $attachment_id ) {
				wp_delete_attachment( $attachment_id, true );
			}
			$deleted = true;
		}

		if ( ! $deleted ) {
			return new \WP_REST_Response( [ 'message' => 'Generated image not found.' ], 404 );
		}

		update_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, $next_items );
		return new \WP_REST_Response( [
			'deleted' => true,
			'generated_images' => self::get_generated_images_payload( $user_id ),
		] );
	}

	// ── POST /onboarding/profile ──────────────────────────────────────────────

	public static function save_profile( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		global $wpdb;
		$p = $wpdb->prefix;

		$allowed_profile = [
			'first_name', 'last_name', 'date_of_birth', 'sex', 'height_cm',
			'starting_weight_lb', 'current_goal', 'goal_rate', 'training_experience',
			'activity_level', 'available_time_default', 'phone', 'timezone', 'units',
		];
		$numeric_fields = [ 'height_cm', 'starting_weight_lb' ];

		$profile_data = [];
		foreach ( $allowed_profile as $field ) {
			$val = $req->get_param( $field );
			if ( $val !== null ) {
				if ( in_array( $field, $numeric_fields, true ) ) {
					$numeric_value = (float) $val;
					if ( $numeric_value > 0 ) {
						$profile_data[ $field ] = $numeric_value;
					}
					continue;
				}

				$profile_data[ $field ] = sanitize_text_field( (string) $val );
			}
		}

		$height_in = $req->get_param( 'height_in' );
		if ( $height_in !== null && ! isset( $profile_data['height_cm'] ) ) {
			$profile_data['height_cm'] = round( (float) $height_in * 2.54, 2 );
		}

		$weight_lb = $req->get_param( 'weight_lb' );
		if ( $weight_lb !== null && ! isset( $profile_data['starting_weight_lb'] ) ) {
			$parsed_weight = (float) $weight_lb;
			if ( $parsed_weight > 0 ) {
				$profile_data['starting_weight_lb'] = $parsed_weight;
			}
		}

		$goal_type = $req->get_param( 'goal_type' );
		if ( $goal_type !== null && ! isset( $profile_data['current_goal'] ) ) {
			$profile_data['current_goal'] = self::normalize_goal_type( (string) $goal_type );
		}

		if ( isset( $profile_data['activity_level'] ) ) {
			$profile_data['activity_level'] = self::normalize_activity_level( $profile_data['activity_level'] );
		}

		if ( isset( $profile_data['timezone'] ) ) {
			$profile_data['timezone'] = UserTime::sanitize_timezone( $profile_data['timezone'] );
		}

		if ( ! $profile_data ) {
			return new \WP_REST_Response( [ 'message' => 'No profile fields provided.' ], 400 );
		}

		// Upsert profile
		$existing = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );

		if ( $existing ) {
			$wpdb->update( $p . 'fit_user_profiles', $profile_data, [ 'user_id' => $user_id ] );
		} else {
			$profile_data['user_id'] = $user_id;
			$wpdb->insert( $p . 'fit_user_profiles', $profile_data );
		}

		// Update WP core name fields too
		if ( isset( $profile_data['first_name'] ) || isset( $profile_data['last_name'] ) ) {
			$update = [];
			if ( isset( $profile_data['first_name'] ) ) $update['first_name'] = $profile_data['first_name'];
			if ( isset( $profile_data['last_name'] ) )  $update['last_name']  = $profile_data['last_name'];
			wp_update_user( array_merge( $update, [ 'ID' => $user_id ] ) );
		}

		return new \WP_REST_Response( [ 'saved' => true ], 200 );
	}

	// ── POST /onboarding/prefs ────────────────────────────────────────────────

	public static function save_preferences( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		global $wpdb;
		$p = $wpdb->prefix;

		$json_fields = [
			'preferred_workout_days_json', 'equipment_available_json', 'exercise_preferences_json',
			'exercise_avoid_json', 'food_preferences_json', 'food_dislikes_json', 'common_breakfasts_json',
		];
		$bool_fields = [ 'notifications_enabled', 'voice_input_enabled' ];
		$goal_fields = [ 'target_steps', 'target_sleep_hours' ];

		$data = [];
		foreach ( $json_fields as $f ) {
			$val = $req->get_param( $f );
			if ( $val !== null ) {
				$data[ $f ] = wp_json_encode( is_array( $val ) ? $val : [] );
			}
		}

		$sms_enabled = $req->get_param( 'sms_reminders_enabled' );
		if ( $sms_enabled !== null && $req->get_param( 'notifications_enabled' ) === null ) {
			$data['notifications_enabled'] = (int) (bool) $sms_enabled;
		}

		foreach ( $bool_fields as $f ) {
			$val = $req->get_param( $f );
			if ( $val !== null ) {
				$data[ $f ] = (int) (bool) $val;
			}
		}

		$goal_data = [];
		foreach ( $goal_fields as $f ) {
			$val = $req->get_param( $f );
			if ( $val === null ) {
				continue;
			}

			if ( $f === 'target_steps' ) {
				$goal_data[ $f ] = (int) $val;
			} else {
				$goal_data[ $f ] = (float) $val;
			}
		}

		$phone_number = $req->get_param( 'phone_number' );
		if ( $phone_number === null ) {
			$phone_number = $req->get_param( 'phone' );
		}
		$profile_data = [];
		if ( $phone_number !== null ) {
			$profile_data['phone'] = sanitize_text_field( (string) $phone_number );
		}

		if ( ! $data && ! $goal_data && ! $profile_data ) {
			return  new \WP_REST_Response( [ 'message' => 'No preference fields provided.' ], 400 );
		}

		if ( $data ) {
			$existing = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM {$p}fit_user_preferences WHERE user_id = %d",
				$user_id
			) );

			if ( $existing ) {
				$wpdb->update( $p . 'fit_user_preferences', $data, [ 'user_id' => $user_id ] );
			} else {
				$data['user_id'] = $user_id;
				$wpdb->insert( $p . 'fit_user_preferences', $data );
			}
		}

		if ( $goal_data ) {
			self::upsert_active_goal( $user_id, $goal_data );
		}

		if ( $profile_data ) {
			$wpdb->update( $p . 'fit_user_profiles', $profile_data, [ 'user_id' => $user_id ] );
		}

		return new \WP_REST_Response( [ 'saved' => true ], 200 );
	}

	public static function sync_health_flags( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		global $wpdb;
		$p = $wpdb->prefix;

		$raw_flags = $req->get_param( 'flags' );
		$flags = is_array( $raw_flags ) ? $raw_flags : [];
		$seen_ids = [];

		foreach ( $flags as $flag ) {
			if ( ! is_array( $flag ) ) {
				continue;
			}

			$id = isset( $flag['id'] ) ? (int) $flag['id'] : 0;
			$data = [
				'user_id'   => $user_id,
				'flag_type' => sanitize_text_field( (string) ( $flag['flag_type'] ?? 'injury' ) ),
				'body_area' => sanitize_text_field( (string) ( $flag['body_area'] ?? '' ) ),
				'severity'  => sanitize_text_field( (string) ( $flag['severity'] ?? 'low' ) ),
				'notes'     => sanitize_textarea_field( (string) ( $flag['notes'] ?? '' ) ),
				'active'    => isset( $flag['active'] ) ? (int) (bool) $flag['active'] : 1,
			];

			if ( '' === $data['body_area'] ) {
				continue;
			}

			if ( $id > 0 ) {
				$updated = $wpdb->update( $p . 'fit_user_health_flags', $data, [ 'id' => $id, 'user_id' => $user_id ] );
				if ( false !== $updated ) {
					$seen_ids[] = $id;
				}
				continue;
			}

			$wpdb->insert( $p . 'fit_user_health_flags', $data );
			if ( $wpdb->insert_id ) {
				$seen_ids[] = (int) $wpdb->insert_id;
			}
		}

		$existing_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_health_flags WHERE user_id = %d AND flag_type = %s",
			$user_id,
			'injury'
		) );

		foreach ( is_array( $existing_ids ) ? $existing_ids : [] as $existing_id ) {
			$existing_id = (int) $existing_id;
			if ( $existing_id > 0 && ! in_array( $existing_id, $seen_ids, true ) ) {
				$wpdb->update(
					$p . 'fit_user_health_flags',
					[ 'active' => 0 ],
					[ 'id' => $existing_id, 'user_id' => $user_id ],
					[ '%d' ],
					[ '%d', '%d' ]
				);
			}
		}

		$active_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_health_flags WHERE user_id = %d AND active = 1 ORDER BY created_at DESC",
			$user_id
		) );

		return new \WP_REST_Response( [
			'saved' => true,
			'health_flags' => $active_rows,
		], 200 );
	}

	// ── POST /onboarding/complete ─────────────────────────────────────────────

	public static function complete( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$result = self::calculate_and_store_targets( $user_id );

		if ( $result instanceof \WP_REST_Response ) {
			return $result;
		}

		global $wpdb;
		$p = $wpdb->prefix;
		$profile = $result['profile'];
		$targets = $result['targets'];

		// Seed a default training plan from PPL template
		self::seed_training_plan( $user_id, $profile );

		// Mark onboarding complete
		$wpdb->update(
			$p . 'fit_user_profiles',
			[ 'onboarding_complete' => 1 ],
			[ 'user_id' => $user_id ]
		);

		AwardEngine::grant( $user_id, 'onboarding_complete' );
		BehaviorAnalyticsService::track(
			$user_id,
			'onboarding_complete',
			'onboarding',
			'complete',
			null,
			[
				'goal_type' => (string) ( $targets['goal_type'] ?? '' ),
				'target_calories' => (int) ( $targets['target_calories'] ?? 0 ),
			]
		);

		return new \WP_REST_Response( array_merge(
			[ 'completed' => true ],
			self::format_targets_response( $targets ),
			[
				'week_split'       => self::get_plan_preview( $user_id ),
				'suggested_meals'  => self::build_initial_meal_suggestions( $profile, $targets ),
				'coach_message'    => self::build_onboarding_message( $profile, $targets ),
			]
		), 200 );
	}

	public static function recalculate_targets( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$result = self::calculate_and_store_targets( $user_id );

		if ( $result instanceof \WP_REST_Response ) {
			return $result;
		}

		return new \WP_REST_Response( array_merge(
			[ 'recalculated' => true ],
			self::format_targets_response( $result['targets'] )
		), 200 );
	}

	private static function get_headshot_payload( int $user_id ): array {
		$attachment_id = (int) get_user_meta( $user_id, self::HEADSHOT_META_KEY, true );
		if ( ! $attachment_id ) {
			return [ 'configured' => false ];
		}

		$attachment = get_post( $attachment_id );
		return [
			'configured'    => true,
			'attachment_id' => $attachment_id,
			'updated_at'    => $attachment ? (string) ( $attachment->post_modified_gmt ?: $attachment->post_date_gmt ) : '',
		];
	}

	private static function get_generated_images_payload( int $user_id ): array {
		$items = get_user_meta( $user_id, self::GENERATED_IMAGES_META_KEY, true );
		$items = is_array( $items ) ? $items : [];
		$payload = [];

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$attachment_id = (int) ( $item['attachment_id'] ?? 0 );
			if ( ! $attachment_id || ! get_post( $attachment_id ) ) {
				continue;
			}

				$payload[] = [
					'id'            => sanitize_text_field( (string) ( $item['id'] ?? '' ) ),
					'attachment_id' => $attachment_id,
					'scenario'      => sanitize_text_field( (string) ( $item['scenario'] ?? '' ) ),
					'prompt'        => sanitize_textarea_field( (string) ( $item['prompt'] ?? '' ) ),
					'created_at'    => sanitize_text_field( (string) ( $item['created_at'] ?? '' ) ),
					'favorited'     => ! empty( $item['favorited'] ),
				];
			}

		return $payload;
	}

	private static function get_generation_scenarios(): array {
		$defaults = [
			[ 'label' => 'Gym dumbbell session', 'prompt' => 'Johnny and the user training side by side with dumbbells in a modern gym.' ],
			[ 'label' => 'Park run', 'prompt' => 'Johnny and the user running together through a bright city park trail.' ],
			[ 'label' => 'Mobility cooldown', 'prompt' => 'Johnny and the user stretching and cooling down on gym mats after training.' ],
			[ 'label' => 'Bench workout', 'prompt' => 'Johnny spotting the user during a strong upper-body workout in the gym.' ],
		];

		$raw_scenarios = get_option( 'jf_gemini_image_scenarios', $defaults );
		$raw_scenarios = is_array( $raw_scenarios ) ? $raw_scenarios : [];
		$scenarios = [];

		foreach ( $defaults as $index => $default ) {
			$current = isset( $raw_scenarios[ $index ] ) && is_array( $raw_scenarios[ $index ] ) ? $raw_scenarios[ $index ] : [];
			$label = sanitize_text_field( (string) ( $current['label'] ?? $default['label'] ) );
			$prompt = sanitize_textarea_field( (string) ( $current['prompt'] ?? $default['prompt'] ) );

			$label = '' !== $label ? $label : $default['label'];
			$prompt = '' !== $prompt ? $prompt : $default['prompt'];

			$scenarios[] = [
				'slug'   => self::build_generation_scenario_slug( $label, $index ),
				'label'  => $label,
				'prompt' => $prompt,
			];
		}

		return $scenarios;
	}

	private static function build_generation_scenario_slug( string $label, int $index ): string {
		$slug = sanitize_title( $label );
		if ( '' === $slug ) {
			$slug = 'scene-' . ( $index + 1 );
		}

		return $slug;
	}

	private static function build_personalized_image_prompt( string $custom_prompt, array $scenario, int $user_id ): string {
		global $wpdb;
		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT first_name, current_goal FROM {$wpdb->prefix}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );
		$first_name = sanitize_text_field( (string) ( $profile->first_name ?? 'the user' ) );
		$goal = sanitize_text_field( (string) ( $profile->current_goal ?? 'recomp' ) );
		$scenario_prompt = sanitize_text_field( (string) ( $scenario['prompt'] ?? '' ) );
		$custom_prompt = trim( $custom_prompt );

		$base_prompt = "Create a photorealistic square image featuring Johnny and {$first_name}. The user must match the uploaded headshot and progress-photo references. Johnny must match the uploaded Johnny reference image. Show both people together in the same scene, with realistic anatomy, natural skin texture, and believable gym or outdoor sports photography. Keep the user recognizable and flattering without changing identity. The user's fitness goal is {$goal}.";

		if ( '' !== $custom_prompt ) {
			$base_prompt .= ' Primary user direction (highest priority): ' . $custom_prompt . '.';
		}

		$base_prompt .= ' Scenario anchor: ' . $scenario_prompt . '.';
		$base_prompt .= ' Do not use or resemble Keanu Reeves. Keep both faces faithful to the provided reference images only.';
		$base_prompt .= ' Use a premium editorial fitness-photo style, crisp detail, energetic but realistic lighting, no text, no watermark overlays, and no collage layout.';

		return $base_prompt;
	}

	private static function get_latest_progress_photo_data_urls( int $user_id, int $limit = 3 ): array {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT attachment_id FROM {$wpdb->prefix}fit_progress_photos WHERE user_id = %d ORDER BY photo_date DESC, id DESC LIMIT %d",
			$user_id,
			$limit
		) );

		$images = [];
		foreach ( is_array( $rows ) ? $rows : [] as $row ) {
			$data_url = self::attachment_to_ai_data_url( (int) ( $row->attachment_id ?? 0 ) );
			if ( ! is_wp_error( $data_url ) ) {
				$images[] = $data_url;
			}
		}

		return $images;
	}

	private static function attachment_to_ai_data_url( int $attachment_id ): string|\WP_Error {
		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return new \WP_Error( 'attachment_missing', 'One of the reference images could not be found.' );
		}

		$mime = mime_content_type( $file_path ) ?: 'image/jpeg';
		$contents = file_get_contents( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( false === $contents ) {
			return new \WP_Error( 'attachment_read_failed', 'One of the reference images could not be read.' );
		}

		return 'data:' . $mime . ';base64,' . base64_encode( $contents ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	private static function create_private_generated_attachment( int $user_id, string $mime_type, string $binary_data, string $slug ): int|\WP_Error {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$extension_map = [
			'image/jpeg' => 'jpg',
			'image/png'  => 'png',
			'image/webp' => 'webp',
		];
		$extension = $extension_map[ $mime_type ] ?? 'png';
		$filename = sanitize_file_name( 'johnny-scene-' . $slug . '-' . time() . '.' . $extension );
		$upload = wp_upload_bits( $filename, null, $binary_data );
		if ( ! empty( $upload['error'] ) ) {
			return new \WP_Error( 'generated_image_upload_failed', (string) $upload['error'] );
		}

		$wp_filetype = wp_check_filetype( $upload['file'], null );
		$attachment_id = wp_insert_attachment( [
			'post_mime_type' => $wp_filetype['type'] ?: $mime_type,
			'post_title'     => 'Johnny personalized image',
			'post_status'    => 'inherit',
		], $upload['file'] );

		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

		$metadata = wp_generate_attachment_metadata( $attachment_id, $upload['file'] );
		wp_update_attachment_metadata( $attachment_id, $metadata );
		update_post_meta( $attachment_id, 'jf_private_photo', 1 );
		update_post_meta( $attachment_id, 'jf_owner_user_id', $user_id );

		return (int) $attachment_id;
	}

	private static function stream_private_attachment( int $attachment_id ): mixed {
		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return new \WP_REST_Response( [ 'message' => 'Image file not found.' ], 404 );
		}

		$mime = mime_content_type( $file_path ) ?: 'image/jpeg';
		header( 'Content-Type: ' . $mime );
		header( 'Content-Length: ' . filesize( $file_path ) );
		header( 'Cache-Control: private, max-age=300' );
		readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}

	public static function restart( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		global $wpdb;
		$p = $wpdb->prefix;

		$profile_exists = (bool) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );

		if ( ! $profile_exists ) {
			return new \WP_REST_Response( [ 'message' => 'Profile not found.' ], 404 );
		}

		$wpdb->update(
			$p . 'fit_user_profiles',
			[ 'onboarding_complete' => 0 ],
			[ 'user_id' => $user_id ]
		);

		return new \WP_REST_Response( [
			'restarted'           => true,
			'onboarding_complete' => false,
		], 200 );
	}

	public static function update_training_schedule( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		global $wpdb;
		$p = $wpdb->prefix;

		$schedule = self::normalize_preferred_schedule( $req->get_param( 'preferred_workout_days_json' ) );
		if ( empty( $schedule ) ) {
			return new \WP_REST_Response( [ 'message' => 'A weekly schedule is required.' ], 400 );
		}

		$active_days = array_filter( $schedule, fn( $entry ) => ( $entry['day_type'] ?? 'rest' ) !== 'rest' );
		if ( empty( $active_days ) ) {
			return new \WP_REST_Response( [ 'message' => 'Choose at least one non-rest day.' ], 400 );
		}

		$preferences = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_preferences WHERE user_id = %d",
			$user_id
		) );

		$preference_data = [ 'preferred_workout_days_json' => wp_json_encode( $schedule ) ];
		if ( $preferences ) {
			$wpdb->update( $p . 'fit_user_preferences', $preference_data, [ 'user_id' => $user_id ] );
		} else {
			$preference_data['user_id'] = $user_id;
			$wpdb->insert( $p . 'fit_user_preferences', $preference_data );
		}

		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );

		if ( ! $profile ) {
			return new \WP_REST_Response( [ 'message' => 'Profile not found.' ], 404 );
		}

		$plan = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $plan ) {
			self::seed_training_plan( $user_id, $profile );
		} else {
			self::rebuild_training_plan_days( (int) $plan->id, (int) ( $plan->program_template_id ?? 0 ), $profile, $schedule );
		}

		return new \WP_REST_Response( [
			'saved' => true,
			'week_split' => self::get_plan_preview( $user_id ),
		], 200 );
	}

	public static function get_sms_reminders( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		return new \WP_REST_Response( \Johnny5k\Services\SmsService::list_user_reminders( $user_id ), 200 );
	}

	public static function cancel_sms_reminder( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$reminder_id = sanitize_text_field( (string) $req->get_param( 'id' ) );
		$result = \Johnny5k\Services\SmsService::cancel_user_reminder( $user_id, $reminder_id );

		if ( is_wp_error( $result ) ) {
			$status = 'not_found' === $result->get_error_code() ? 404 : 400;
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], $status );
		}

		return new \WP_REST_Response( [ 'canceled' => true, 'reminder' => $result ], 200 );
	}

	// ── Seed default training plan ────────────────────────────────────────────

	private static function seed_training_plan( int $user_id, object $profile ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		// Find the PPL template matching the user's experience level
		$template = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_templates
			 WHERE active = 1 AND experience_level = %s
			 ORDER BY id LIMIT 1",
			$profile->training_experience ?? 'intermediate'
		) );

		if ( ! $template ) {
			$template = $wpdb->get_row( "SELECT * FROM {$p}fit_program_templates WHERE active = 1 LIMIT 1" );
		}
		if ( ! $template ) return;

		// Deactivate any existing plan
		$wpdb->update( $p . 'fit_user_training_plans', [ 'active' => 0 ], [ 'user_id' => $user_id ] );

		// Create new plan
		$wpdb->insert( $p . 'fit_user_training_plans', [
			'user_id'             => $user_id,
			'program_template_id' => $template->id,
			'name'                => $template->name,
			'start_date'          => UserTime::today( $user_id ),
			'active'              => 1,
		] );
		$plan_id = (int) $wpdb->insert_id;

		$preferences = $wpdb->get_row( $wpdb->prepare(
			"SELECT preferred_workout_days_json FROM {$p}fit_user_preferences WHERE user_id = %d",
			$user_id
		) );
		$preferred_schedule = self::normalize_preferred_schedule( json_decode( (string) ( $preferences->preferred_workout_days_json ?? '' ), true ) );

		// Copy template days → user training days
		$template_days = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_template_days WHERE program_template_id = %d ORDER BY default_order",
			$template->id
		) );
		$template_day_map = self::build_template_day_map( $template_days );

		if ( ! empty( $preferred_schedule ) ) {
			$order = 1;
			foreach ( $preferred_schedule as $scheduled_day ) {
				$day_type = sanitize_text_field( (string) ( $scheduled_day['day_type'] ?? 'rest' ) );
				$wpdb->insert( $p . 'fit_user_training_days', [
					'training_plan_id' => $plan_id,
					'day_type'         => $day_type,
					'day_order'        => $order,
					'time_tier'        => $profile->available_time_default ?? 'medium',
				] );
				$user_day_id = (int) $wpdb->insert_id;
				$order += 1;

				if ( 'rest' === $day_type || empty( $template_day_map[ $day_type ] ) ) {
					continue;
				}

				self::copy_template_day_exercises( $user_id, $day_type, (int) $template_day_map[ $day_type ]->id, $user_day_id );
			}

			return;
		}

		foreach ( $template_days as $td ) {
			$wpdb->insert( $p . 'fit_user_training_days', [
				'training_plan_id' => $plan_id,
				'day_type'         => $td->day_type,
				'day_order'        => $td->default_order,
				'time_tier'        => $profile->available_time_default ?? 'medium',
			] );
			$user_day_id = (int) $wpdb->insert_id;

			self::copy_template_day_exercises( $user_id, (string) $td->day_type, (int) $td->id, $user_day_id );
		}
	}

	private static function rebuild_training_plan_days( int $plan_id, int $template_id, object $profile, array $schedule ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$current_days = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, day_type, day_order, time_tier FROM {$p}fit_user_training_days WHERE training_plan_id = %d ORDER BY day_order",
			$plan_id
		) );

		$template_days = [];
		if ( $template_id > 0 ) {
			$template_days = $wpdb->get_results( $wpdb->prepare(
				"SELECT * FROM {$p}fit_program_template_days WHERE program_template_id = %d ORDER BY default_order",
				$template_id
			) );
		}
		$template_day_map = self::build_template_day_map( $template_days );
		$existing_by_type = [];
		foreach ( $current_days as $current_day ) {
			$existing_by_type[ $current_day->day_type ][] = $current_day;
		}
		$used_day_ids = [];

		$order = 1;
		foreach ( $schedule as $scheduled_day ) {
			$day_type = sanitize_text_field( (string) ( $scheduled_day['day_type'] ?? 'rest' ) );
			$matched_day = null;
			if ( ! empty( $existing_by_type[ $day_type ] ) ) {
				$matched_day = array_shift( $existing_by_type[ $day_type ] );
			}

			if ( $matched_day ) {
				$wpdb->update( $p . 'fit_user_training_days', [
					'day_type'  => $day_type,
					'day_order' => $order,
					'time_tier' => $matched_day->time_tier ?: ( $profile->available_time_default ?? 'medium' ),
				], [ 'id' => $matched_day->id ] );
				if ( 'rest' !== $day_type && ! empty( $template_day_map[ $day_type ] ) ) {
					$active_count = (int) $wpdb->get_var( $wpdb->prepare(
						"SELECT COUNT(*) FROM {$p}fit_user_training_day_exercises WHERE training_day_id = %d AND active = 1",
						(int) $matched_day->id
					) );
					if ( $active_count < 1 ) {
						self::copy_template_day_exercises( $profile->user_id ?? 0, $day_type, (int) $template_day_map[ $day_type ]->id, (int) $matched_day->id );
					}
				}
				$used_day_ids[] = (int) $matched_day->id;
				$order += 1;
				continue;
			}

			$wpdb->insert( $p . 'fit_user_training_days', [
				'training_plan_id' => $plan_id,
				'day_type'         => $day_type,
				'day_order'        => $order,
				'time_tier'        => $profile->available_time_default ?? 'medium',
			] );
			$user_day_id = (int) $wpdb->insert_id;
			$used_day_ids[] = $user_day_id;
			$order += 1;

			if ( 'rest' === $day_type || empty( $template_day_map[ $day_type ] ) ) {
				continue;
			}

			self::copy_template_day_exercises( $profile->user_id ?? 0, $day_type, (int) $template_day_map[ $day_type ]->id, $user_day_id );
		}

		$unused_day_ids = array_values( array_diff( array_map( fn( $day ) => (int) $day->id, $current_days ), $used_day_ids ) );
		if ( empty( $unused_day_ids ) ) {
			return;
		}

		$placeholders = implode( ',', array_fill( 0, count( $unused_day_ids ), '%d' ) );
		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$p}fit_user_training_day_exercises WHERE training_day_id IN ($placeholders)",
			...$unused_day_ids
		) );
		$wpdb->query( $wpdb->prepare(
			"DELETE FROM {$p}fit_user_training_days WHERE id IN ($placeholders)",
			...$unused_day_ids
		) );
	}

	private static function copy_template_day_exercises( int $user_id, string $day_type, int $template_day_id, int $user_day_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$template_exercises = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_template_exercises WHERE template_day_id = %d ORDER BY priority",
			$template_day_id
		) );

		$selected_exercise_ids = [];
		foreach ( $template_exercises as $te ) {
			$resolved = TrainingEngine::resolve_day_exercise_candidate(
				$user_id,
				$day_type,
				(string) $te->slot_type,
				(int) $te->exercise_id,
				$selected_exercise_ids
			);
			$resolved_exercise_id = (int) ( $resolved['exercise_id'] ?? 0 );
			if ( ! empty( $resolved['blocked'] ) || $resolved_exercise_id <= 0 ) {
				continue;
			}

			$wpdb->insert( $p . 'fit_user_training_day_exercises', [
				'training_day_id' => $user_day_id,
				'exercise_id'     => $resolved_exercise_id,
				'slot_type'       => $te->slot_type,
				'rep_min'         => $te->rep_min,
				'rep_max'         => $te->rep_max,
				'sets_target'     => $te->sets_target,
				'rir_target'      => $te->rir_target,
				'sort_order'      => $te->priority,
				'active'          => 1,
			] );
			$selected_exercise_ids[] = $resolved_exercise_id;
		}
	}

	private static function build_template_day_map( array $template_days ): array {
		$template_day_map = [];
		foreach ( $template_days as $td ) {
			if ( ! isset( $template_day_map[ $td->day_type ] ) ) {
				$template_day_map[ $td->day_type ] = $td;
			}
		}

		return $template_day_map;
	}

	private static function upsert_active_goal( int $user_id, array $goal_data ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$active_goal = $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1",
			$user_id
		) );

		if ( $active_goal ) {
			$wpdb->update( $p . 'fit_user_goals', $goal_data, [ 'id' => $active_goal ] );
			return;
		}

		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT current_goal, goal_rate FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );

		$wpdb->insert( $p . 'fit_user_goals', array_merge( [
			'user_id'    => $user_id,
			'goal_type'  => self::normalize_goal_type( (string) ( $profile->current_goal ?? 'maintain' ) ),
			'goal_rate'  => sanitize_text_field( (string) ( $profile->goal_rate ?? 'moderate' ) ),
			'start_date' => UserTime::today( $user_id ),
			'active'     => 1,
		], $goal_data ) );
	}

	private static function calculate_and_store_targets( int $user_id ): array|\WP_REST_Response {
		global $wpdb;
		$p = $wpdb->prefix;

		$profile = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );

		if ( ! $profile ) {
			return new \WP_REST_Response( [ 'message' => 'Profile not found. Complete profile step first.' ], 400 );
		}

		$missing_fields = self::get_target_validation_errors( $profile );
		if ( ! empty( $missing_fields ) ) {
			return new \WP_REST_Response( [
				'message' => 'Missing required profile fields for calorie targets.',
				'missing_profile_fields' => $missing_fields,
			], 400 );
		}

		$goal_row = (object) [
			'goal_type' => self::normalize_goal_type( (string) ( $profile->current_goal ?? 'maintain' ) ),
			'goal_rate' => sanitize_text_field( (string) ( $profile->goal_rate ?? 'moderate' ) ),
		];
		$targets = CalorieEngine::calculate_initial( $profile, $goal_row );

		self::upsert_active_goal( $user_id, [
			'goal_type'        => $goal_row->goal_type,
			'goal_rate'        => $goal_row->goal_rate,
			'target_calories'  => $targets['calories'],
			'target_protein_g' => $targets['protein_g'],
			'target_carbs_g'   => $targets['carbs_g'],
			'target_fat_g'     => $targets['fat_g'],
		] );

		return [
			'profile' => $profile,
			'targets' => $targets,
		];
	}

	private static function format_targets_response( array $targets ): array {
		return [
			'target_calories'   => $targets['calories'],
			'target_protein_g'  => $targets['protein_g'],
			'target_carbs_g'    => $targets['carbs_g'],
			'target_fat_g'      => $targets['fat_g'],
			'calorie_targets'   => [
				'calories'  => $targets['calories'],
				'protein_g' => $targets['protein_g'],
				'carbs_g'   => $targets['carbs_g'],
				'fat_g'     => $targets['fat_g'],
				'bmr'       => $targets['bmr'],
				'tdee'      => $targets['tdee'],
			],
		];
	}

	private static function decode_preferences( ?object $prefs ): ?object {
		if ( ! $prefs ) {
			return null;
		}

		$json_fields = [
			'preferred_workout_days_json',
			'equipment_available_json',
			'exercise_preferences_json',
			'exercise_avoid_json',
			'food_preferences_json',
			'food_dislikes_json',
			'common_breakfasts_json',
		];

		foreach ( $json_fields as $field ) {
			$decoded = json_decode( (string) ( $prefs->{$field} ?? '' ), true );
			$prefs->{$field} = is_array( $decoded ) ? $decoded : [];
		}

		return $prefs;
	}

	private static function normalize_preferred_schedule( $raw_schedule ): array {
		$valid_day_types = [ 'push', 'pull', 'legs', 'arms_shoulders', 'cardio', 'rest' ];
		$valid_days = [ 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun' ];

		if ( ! is_array( $raw_schedule ) ) {
			return [];
		}

		if ( ! empty( $raw_schedule ) && is_string( $raw_schedule[0] ?? null ) ) {
			$default_cycle = [ 'push', 'pull', 'legs', 'arms_shoulders', 'cardio' ];
			$index = 0;
			$result = [];
			foreach ( $valid_days as $day ) {
				if ( in_array( $day, $raw_schedule, true ) ) {
					$result[] = [
						'day' => $day,
						'day_type' => $default_cycle[ min( $index, count( $default_cycle ) - 1 ) ],
					];
					$index += 1;
				} else {
					$result[] = [ 'day' => $day, 'day_type' => 'rest' ];
				}
			}

			return $result;
		}

		$normalized = [];
		foreach ( $raw_schedule as $entry ) {
			$day = sanitize_text_field( (string) ( $entry['day'] ?? '' ) );
			$day_type = sanitize_text_field( (string) ( $entry['day_type'] ?? 'rest' ) );
			if ( ! in_array( $day, $valid_days, true ) ) {
				continue;
			}
			if ( ! in_array( $day_type, $valid_day_types, true ) ) {
				$day_type = 'rest';
			}
			$normalized[] = [
				'day' => $day,
				'day_type' => $day_type,
			];
		}

		if ( empty( $normalized ) ) {
			return [];
		}

		$lookup = [];
		foreach ( $normalized as $entry ) {
			$lookup[ $entry['day'] ] = $entry['day_type'];
		}

		$result = [];
		foreach ( $valid_days as $day ) {
			$result[] = [
				'day' => $day,
				'day_type' => $lookup[ $day ] ?? 'rest',
			];
		}

		return $result;
	}

	private static function get_plan_preview( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$plan = $wpdb->get_row( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $plan ) {
			return [];
		}

		$days = $wpdb->get_results( $wpdb->prepare(
			"SELECT day_type, day_order, time_tier FROM {$p}fit_user_training_days WHERE training_plan_id = %d ORDER BY day_order",
			$plan->id
		) ) ?: [];

		foreach ( $days as $day ) {
			$day->weekday_label = self::weekday_label( (int) $day->day_order );
		}

		return $days;
	}

	private static function weekday_label( int $day_order ): string {
		$labels = [ 1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun' ];
		return $labels[ $day_order ] ?? 'Day';
	}

	private static function build_initial_meal_suggestions( object $profile, array $targets ): array {
		$goal = self::normalize_goal_type( (string) ( $profile->current_goal ?? 'maintain' ) );
		$protein = (int) ( $targets['protein_g'] ?? 0 );

		$templates = [
			[
				'name' => 'Protein-first breakfast bowl',
				'description' => 'Greek yogurt, berries, and a scoop of protein for an easy high-protein start.',
			],
			[
				'name' => 'Simple lunch anchor',
				'description' => 'Lean protein, rice or potatoes, and one easy vegetable so lunch carries the day.',
			],
			[
				'name' => 'Easy dinner closeout',
				'description' => 'Pick one protein, one carb, and a high-volume side to finish the day without guesswork.',
			],
		];

		if ( 'cut' === $goal ) {
			$templates[1]['description'] = 'Lean protein, a measured carb, and a large produce side to stay full while keeping calories tight.';
		}

		if ( $protein >= 180 ) {
			$templates[0]['description'] .= ' Aim for 40 to 50 grams of protein in the first meal.';
		}

		return $templates;
	}

	private static function build_onboarding_message( object $profile, array $targets ): string {
		$goal = self::normalize_goal_type( (string) ( $profile->current_goal ?? 'maintain' ) );
		$goal_label = match ( $goal ) {
			'cut' => 'lean out',
			'gain' => 'build muscle',
			'recomp' => 'recomp your bodyweight',
			default => 'hold steady and build consistency',
		};

		return sprintf(
			'You are set up to %s with %d calories and a protein-first plan. Keep the first week simple: log honestly, start the sessions on time, and let the momentum build.',
			$goal_label,
			(int) ( $targets['calories'] ?? 0 )
		);
	}

	private static function get_target_validation_errors( ?object $profile ): array {
		if ( ! $profile ) {
			return [ 'first_name', 'date_of_birth', 'sex', 'height_cm', 'starting_weight_lb' ];
		}

		$required = [
			'first_name' => $profile->first_name ?? null,
			'date_of_birth' => $profile->date_of_birth ?? null,
			'sex' => $profile->sex ?? null,
			'height_cm' => isset( $profile->height_cm ) ? (float) $profile->height_cm : 0,
			'starting_weight_lb' => isset( $profile->starting_weight_lb ) ? (float) $profile->starting_weight_lb : 0,
		];

		$missing = [];
		foreach ( $required as $field => $value ) {
			if ( is_numeric( $value ) ) {
				if ( (float) $value <= 0 ) {
					$missing[] = $field;
				}
				continue;
			}

			if ( empty( $value ) ) {
				$missing[] = $field;
			}
		}

		return $missing;
	}

	private static function normalize_goal_type( string $goal_type ): string {
		return match ( $goal_type ) {
			'bulk' => 'gain',
			default => sanitize_key( $goal_type ),
		};
	}

	private static function normalize_activity_level( string $activity_level ): string {
		return match ( $activity_level ) {
			'active' => 'high',
			'very_active' => 'athlete',
			default => sanitize_key( $activity_level ),
		};
	}
}
