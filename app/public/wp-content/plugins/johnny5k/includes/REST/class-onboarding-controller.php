<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\CalorieEngine;
use Johnny5k\Services\AwardEngine;
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
			'health_flags'        => $health_flags,
			'progress_photos'     => $progress_photos,
			'completion_ready'    => empty( $missing_fields ),
			'missing_profile_fields' => $missing_fields,
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

				self::copy_template_day_exercises( $template_day_map[ $day_type ]->id, $user_day_id );
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

			self::copy_template_day_exercises( $td->id, $user_day_id );
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

			self::copy_template_day_exercises( (int) $template_day_map[ $day_type ]->id, $user_day_id );
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

	private static function copy_template_day_exercises( int $template_day_id, int $user_day_id ): void {
		global $wpdb;
		$p = $wpdb->prefix;

		$template_exercises = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_template_exercises WHERE template_day_id = %d ORDER BY priority",
			$template_day_id
		) );

		foreach ( $template_exercises as $te ) {
			$wpdb->insert( $p . 'fit_user_training_day_exercises', [
				'training_day_id' => $user_day_id,
				'exercise_id'     => $te->exercise_id,
				'slot_type'       => $te->slot_type,
				'rep_min'         => $te->rep_min,
				'rep_max'         => $te->rep_max,
				'sets_target'     => $te->sets_target,
				'rir_target'      => $te->rir_target,
				'sort_order'      => $te->priority,
				'active'          => 1,
			] );
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
