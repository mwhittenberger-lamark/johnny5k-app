<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\CalorieEngine;
use Johnny5k\Services\AwardEngine;
use Johnny5k\Services\TrainingEngine;

/**
 * REST Controller: Onboarding
 *
 * GET  /fit/v1/onboarding          — fetch current onboarding state
 * POST /fit/v1/onboarding/profile  — save profile + goals
 * POST /fit/v1/onboarding/prefs    — save preferences
 * POST /fit/v1/onboarding/complete — mark onboarding done, compute initial targets
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
			'start_date'          => current_time( 'Y-m-d' ),
			'active'              => 1,
		] );
		$plan_id = (int) $wpdb->insert_id;

		// Copy template days → user training days
		$template_days = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$p}fit_program_template_days WHERE program_template_id = %d ORDER BY default_order",
			$template->id
		) );

		foreach ( $template_days as $td ) {
			$wpdb->insert( $p . 'fit_user_training_days', [
				'training_plan_id' => $plan_id,
				'day_type'         => $td->day_type,
				'day_order'        => $td->default_order,
				'time_tier'        => $profile->available_time_default ?? 'medium',
			] );
			$user_day_id = (int) $wpdb->insert_id;

			// Copy exercises for this day
			$template_exercises = $wpdb->get_results( $wpdb->prepare(
				"SELECT * FROM {$p}fit_program_template_exercises WHERE template_day_id = %d ORDER BY priority",
				$td->id
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
			'start_date' => current_time( 'Y-m-d' ),
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

		return $wpdb->get_results( $wpdb->prepare(
			"SELECT day_type, day_order, time_tier FROM {$p}fit_user_training_days WHERE training_plan_id = %d ORDER BY day_order",
			$plan->id
		) ) ?: [];
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
