<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;
use Johnny5k\Services\UserTime;
use Johnny5k\Support\PrivateMediaService;

/**
 * REST Controller: Dashboard
 *
 * GET  /fit/v1/dashboard            — full daily snapshot
 * GET  /fit/v1/dashboard/awards     — user's earned awards
 * POST /fit/v1/dashboard/photo      — upload a progress photo
 * GET  /fit/v1/dashboard/photos     — list progress photos (private)
 * GET  /fit/v1/dashboard/photo/{id} — serve a private progress photo
 */
class DashboardController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = [ 'Johnny5k\REST\AuthController', 'require_auth' ];

		register_rest_route( $ns, '/dashboard', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_daily_snapshot' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/awards', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_awards' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/johnny-review', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_johnny_review' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/real-success-story', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'get_real_success_story' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/photo', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'upload_progress_photo' ],
			'permission_callback' => $auth,
			'args'                => [
				'angle' => [
					'required'          => false,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'validate_callback' => [ __CLASS__, 'validate_photo_angle' ],
				],
				'date'  => [
					'required'          => false,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'validate_callback' => [ __CLASS__, 'validate_iso_date' ],
				],
			],
		] );

		register_rest_route( $ns, '/dashboard/photos', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'list_progress_photos' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/photos/compare', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'compare_progress_photos' ],
			'permission_callback' => $auth,
			'args'                => [
				'first_photo_id'  => [ 'required' => true, 'type' => 'integer' ],
				'second_photo_id' => [ 'required' => true, 'type' => 'integer' ],
			],
		] );

		register_rest_route( $ns, '/dashboard/photos/baseline', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'set_progress_photo_baseline' ],
			'permission_callback' => $auth,
			'args'                => [
				'photo_id' => [ 'required' => false, 'type' => 'integer' ],
				'angle'    => [
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
					'validate_callback' => [ __CLASS__, 'validate_photo_angle' ],
				],
			],
		] );

		register_rest_route( $ns, '/dashboard/photo/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'serve_progress_photo' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'delete_progress_photo' ],
				'permission_callback' => $auth,
				'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
			],
		] );
	}

	// ── GET /dashboard ────────────────────────────────────────────────────────

	public static function get_daily_snapshot( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		return new \WP_REST_Response( self::get_daily_snapshot_data( $user_id ) );
	}

	public static function get_johnny_review( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$force   = rest_sanitize_boolean( $req->get_param( 'force' ) );
		$result  = static::fetch_dashboard_review( $user_id, (bool) $force );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function get_real_success_story( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$force   = rest_sanitize_boolean( $req->get_param( 'force' ) );
		$result  = static::fetch_dashboard_real_success_story( $user_id, (bool) $force );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	protected static function fetch_dashboard_review( int $user_id, bool $force ) {
		return AiService::dashboard_review( $user_id, $force );
	}

	protected static function fetch_dashboard_real_success_story( int $user_id, bool $force ) {
		return AiService::dashboard_real_success_story( $user_id, $force );
	}

	public static function get_daily_snapshot_data( int $user_id ): array {
		global $wpdb;
		$p       = $wpdb->prefix;
		$today = UserTime::today( $user_id );
		$tomorrow = UserTime::tomorrow( $user_id );
		$today_schedule = self::get_plan_day_for_date( $user_id, $today );
		$tomorrow_schedule = self::get_plan_day_for_date( $user_id, $tomorrow );

		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g, target_steps, target_sleep_hours, goal_type
			 FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );
		$goal = \Johnny5k\Services\ExerciseCalorieService::apply_exercise_calorie_target_adjustment( $user_id, $today, $goal );
		$exercise_calories = \Johnny5k\Services\ExerciseCalorieService::get_daily_exercise_calories( $user_id, $today );

		$meals_today = $wpdb->get_results( $wpdb->prepare(
			"SELECT m.id, m.meal_type, m.meal_datetime,
			        SUM(mi.calories)  AS calories,
			        SUM(mi.protein_g) AS protein_g,
			        SUM(mi.carbs_g)   AS carbs_g,
			        SUM(mi.fat_g)     AS fat_g
			 FROM {$p}fit_meals m
			 LEFT JOIN {$p}fit_meal_items mi ON mi.meal_id = m.id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1
			 GROUP BY m.id",
			$user_id, $today
		) );

		$nutrition_totals = array_reduce( $meals_today, function( $carry, $m ) {
			return [
				'calories'  => $carry['calories']  + (int) $m->calories,
				'protein_g' => $carry['protein_g'] + (float) $m->protein_g,
				'carbs_g'   => $carry['carbs_g']   + (float) $m->carbs_g,
				'fat_g'     => $carry['fat_g'] + (float) $m->fat_g,
			];
		}, [ 'calories' => 0, 'protein_g' => 0.0, 'carbs_g' => 0.0, 'fat_g' => 0.0 ] );

		$micronutrient_totals = $wpdb->get_row( $wpdb->prepare(
			"SELECT
				COALESCE(SUM(mi.fiber_g), 0) AS fiber_g,
				COALESCE(SUM(mi.sugar_g), 0) AS sugar_g,
				COALESCE(SUM(mi.sodium_mg), 0) AS sodium_mg
			 FROM {$p}fit_meal_items mi
			 JOIN {$p}fit_meals m ON m.id = mi.meal_id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
			$user_id, $today
		) );

		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, session_date, planned_day_type, actual_day_type, completed, skip_requested, time_tier, estimated_calories
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s
			 ORDER BY id DESC
			 LIMIT 1",
			$user_id, $today
		) );

		$training_status = self::get_today_training_status_data( $user_id, $today, $today_schedule, $session );

		$tomorrow_preview = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, session_date, planned_day_type, actual_day_type, completed, skip_requested, time_tier, estimated_calories
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s
			 ORDER BY id DESC
			 LIMIT 1",
			$user_id, $tomorrow
		) );

		if ( ! $tomorrow_preview ) {
			$tomorrow_preview = (object) [
				'date'             => $tomorrow,
				'planned_day_type' => $tomorrow_schedule->day_type ?? self::infer_next_day_type( $user_id, $tomorrow ),
				'time_tier'        => $tomorrow_schedule->time_tier ?? $session->time_tier ?? 'medium',
				'weekday_label'    => $tomorrow_schedule->weekday_label ?? self::weekday_label_for_date( $tomorrow ),
				'inferred'         => true,
			];
		} else {
			$tomorrow_preview->date = $tomorrow;
			$tomorrow_preview->weekday_label = self::weekday_label_for_date( $tomorrow );
			$tomorrow_preview->inferred = false;
		}

		$sleep = $wpdb->get_row( $wpdb->prepare(
			"SELECT hours_sleep, sleep_quality, sleep_date FROM {$p}fit_sleep_logs
			 WHERE user_id = %d
			 ORDER BY sleep_date DESC, id DESC
			 LIMIT 1",
			$user_id
		) );

		$actual_steps = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT steps FROM {$p}fit_step_logs WHERE user_id = %d AND step_date = %s",
			$user_id, $today
		) );

		$cardio_step_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT cardio_type, intensity, duration_minutes
			 FROM {$p}fit_cardio_logs
			 WHERE user_id = %d AND cardio_date = %s",
			$user_id, $today
		) );
		$cardio_equivalent_steps = 0;
		foreach ( $cardio_step_rows as $row ) {
			$cardio_equivalent_steps += BodyMetricsController::estimate_cardio_step_equivalent(
				(string) ( $row->cardio_type ?? 'other' ),
				(string) ( $row->intensity ?? 'moderate' ),
				(int) ( $row->duration_minutes ?? 0 )
			);
		}
		$total_movement_steps = $actual_steps + $cardio_equivalent_steps;

		$recovery_summary = self::build_recovery_summary( $user_id, $goal, $sleep, $actual_steps );
		$calorie_adjustment_preview = \Johnny5k\Services\CalorieEngine::calculate_weekly_adjustment( $user_id );

		$latest_weight = $wpdb->get_row( $wpdb->prepare(
			"SELECT weight_lb, metric_date FROM {$p}fit_body_metrics
			 WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );

		$score_7d_data = self::calculate_weekly_rhythm_score( $user_id, $goal );
		$score_7d = (int) ( $score_7d_data['score'] ?? 0 );

		$skip_count = \Johnny5k\Services\TrainingEngine::rolling_skip_count( $user_id );
		$streaks = [
			'logging_days'  => self::count_meal_streak( $user_id ),
			'training_days' => self::count_workout_streak( $user_id ),
			'sleep_days'    => self::count_sleep_streak( $user_id ),
			'cardio_days'   => self::count_cardio_streak( $user_id ),
		];
		$follow_up_overview = AiService::get_follow_up_overview( $user_id );
		$pending_follow_ups = AiService::get_pending_follow_ups( $user_id );
		$delivery_diagnostics = \Johnny5k\Services\CoachDeliveryService::get_user_delivery_diagnostics( $user_id );

		return [
			'date'             => $today,
			'goal'             => $goal,
			'exercise_calories' => $exercise_calories,
			'nutrition_totals' => $nutrition_totals,
			'micronutrient_totals' => $micronutrient_totals,
			'meals_today'      => $meals_today,
			'session'          => $session,
			'training_status'  => $training_status,
			'today_schedule'   => $today_schedule,
			'tomorrow_preview' => $tomorrow_preview,
			'tomorrow_schedule'=> $tomorrow_schedule,
			'sleep'            => $sleep,
			'steps'            => [
				'today' => $total_movement_steps,
				'actual_today' => $actual_steps,
				'cardio_equivalent_today' => $cardio_equivalent_steps,
				'total_movement_today' => $total_movement_steps,
				'target' => (int) ( $goal->target_steps ?? 8000 ),
			],
			'recovery_summary' => $recovery_summary,
			'calorie_adjustment_preview' => $calorie_adjustment_preview,
			'latest_weight'    => $latest_weight,
			'score_7d'         => $score_7d,
			'score_7d_breakdown' => $score_7d_data['breakdown'] ?? [],
			'streaks'          => $streaks,
			'skip_count_30d'   => $skip_count,
			'skip_warning'     => $skip_count >= 3,
			'follow_up_overview' => $follow_up_overview,
			'pending_follow_ups' => array_slice( $pending_follow_ups, 0, 4 ),
			'delivery_diagnostics' => $delivery_diagnostics,
		];
	}

	private static function get_today_training_status_data( int $user_id, string $date, ?object $today_schedule = null, ?object $latest_session = null ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$scheduled_day_type = (string) ( $today_schedule->day_type ?? self::infer_next_day_type( $user_id, $date ) );
		$scheduled_time_tier = (string) ( $today_schedule->time_tier ?? $latest_session->time_tier ?? 'medium' );

		$active_session = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, session_date, planned_day_type, actual_day_type, completed, skip_requested, time_tier, duration_minutes, estimated_calories, started_at, completed_at
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s AND completed = 0 AND skip_requested = 0
			 ORDER BY id DESC
			 LIMIT 1",
			$user_id,
			$date
		) );

		$completed_session = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, session_date, planned_day_type, actual_day_type, completed, skip_requested, time_tier, duration_minutes, estimated_calories, started_at, completed_at
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s AND completed = 1 AND skip_requested = 0
			 ORDER BY completed_at DESC, id DESC
			 LIMIT 1",
			$user_id,
			$date
		) );

		$cardio_log = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, cardio_date, cardio_type, duration_minutes, intensity, estimated_calories, notes
			 FROM {$p}fit_cardio_logs
			 WHERE user_id = %d AND cardio_date = %s
			 ORDER BY id DESC
			 LIMIT 1",
			$user_id,
			$date
		) );

		$active_summary = self::normalise_dashboard_session_summary( $active_session );
		$completed_summary = self::normalise_dashboard_session_summary( $completed_session );
		$cardio_summary = self::normalise_dashboard_cardio_summary( $cardio_log );

		$recorded = false;
		$recorded_type = '';
		$status = 'open';
		$matching_workout_session = null;

		if ( 'rest' === $scheduled_day_type ) {
			if ( 'rest' === self::get_dashboard_session_day_type( $completed_session ) ) {
				$recorded = true;
				$recorded_type = 'rest';
				$matching_workout_session = $completed_summary;
			}
			$status = 'rest_day';
		} elseif ( 'cardio' === $scheduled_day_type ) {
			if ( ! empty( $cardio_summary ) ) {
				$recorded = true;
				$recorded_type = 'cardio';
			} elseif ( 'cardio' === self::get_dashboard_session_day_type( $completed_session ) ) {
				$recorded = true;
				$recorded_type = 'cardio';
				$matching_workout_session = $completed_summary;
			}

			if ( ! $recorded ) {
				$status = 'cardio' === self::get_dashboard_session_day_type( $active_session ) ? 'active' : 'open';
			} else {
				$status = 'recorded';
			}
		} else {
			if ( self::is_strength_dashboard_session( $completed_session ) ) {
				$recorded = true;
				$recorded_type = 'workout';
				$matching_workout_session = $completed_summary;
			}

			if ( ! $recorded ) {
				$status = self::is_strength_dashboard_session( $active_session ) ? 'active' : 'open';
			} else {
				$status = 'recorded';
			}
		}

		return [
			'scheduled_day_type' => $scheduled_day_type,
			'scheduled_time_tier' => $scheduled_time_tier,
			'status' => $status,
			'recorded' => $recorded,
			'recorded_type' => $recorded_type,
			'has_active_session' => ! empty( $active_summary ),
			'active_session' => $active_summary,
			'completed_session' => $completed_summary,
			'matching_workout_session' => $matching_workout_session,
			'cardio_log' => $cardio_summary,
		];
	}

	private static function normalise_dashboard_session_summary( ?object $session ): ?array {
		if ( ! $session ) {
			return null;
		}

		return [
			'id' => (int) ( $session->id ?? 0 ),
			'session_date' => (string) ( $session->session_date ?? '' ),
			'planned_day_type' => (string) ( $session->planned_day_type ?? '' ),
			'actual_day_type' => (string) ( $session->actual_day_type ?? '' ),
			'completed' => ! empty( $session->completed ),
			'skip_requested' => ! empty( $session->skip_requested ),
			'time_tier' => (string) ( $session->time_tier ?? '' ),
			'duration_minutes' => isset( $session->duration_minutes ) ? (int) $session->duration_minutes : 0,
			'estimated_calories' => isset( $session->estimated_calories ) ? (int) $session->estimated_calories : 0,
			'started_at' => (string) ( $session->started_at ?? '' ),
			'completed_at' => (string) ( $session->completed_at ?? '' ),
		];
	}

	private static function normalise_dashboard_cardio_summary( ?object $cardio_log ): ?array {
		if ( ! $cardio_log ) {
			return null;
		}

		return [
			'id' => (int) ( $cardio_log->id ?? 0 ),
			'cardio_date' => (string) ( $cardio_log->cardio_date ?? '' ),
			'cardio_type' => (string) ( $cardio_log->cardio_type ?? '' ),
			'duration_minutes' => isset( $cardio_log->duration_minutes ) ? (int) $cardio_log->duration_minutes : 0,
			'intensity' => (string) ( $cardio_log->intensity ?? '' ),
			'estimated_calories' => isset( $cardio_log->estimated_calories ) ? (int) $cardio_log->estimated_calories : 0,
			'notes' => (string) ( $cardio_log->notes ?? '' ),
		];
	}

	private static function get_dashboard_session_day_type( ?object $session ): string {
		if ( ! $session ) {
			return '';
		}

		return (string) ( $session->actual_day_type ?: $session->planned_day_type ?: '' );
	}

	private static function is_strength_dashboard_session( ?object $session ): bool {
		$day_type = self::get_dashboard_session_day_type( $session );

		return '' !== $day_type && ! in_array( $day_type, [ 'rest', 'cardio' ], true );
	}

	// ── GET /dashboard/awards ─────────────────────────────────────────────────

	public static function get_awards( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		\Johnny5k\Services\AwardEngine::sync_user_awards( $user_id );

		$earned = $wpdb->get_results( $wpdb->prepare(
			"SELECT a.code, a.name, a.description, a.icon, a.points, ua.awarded_at
			 FROM {$wpdb->prefix}fit_user_awards ua
			 JOIN {$wpdb->prefix}fit_awards a ON a.id = ua.award_id
			 WHERE ua.user_id = %d ORDER BY ua.awarded_at DESC",
			$user_id
		) );

		$all_awards = $wpdb->get_results(
			"SELECT code, name, description, icon, points FROM {$wpdb->prefix}fit_awards WHERE active = 1"
		);

		$all_awards = array_map( static function( $award ) use ( $user_id ) {
			$progress = self::get_award_progress_data( $user_id, (string) ( $award->code ?? '' ) );
			foreach ( $progress as $key => $value ) {
				$award->{$key} = $value;
			}
			return $award;
		}, is_array( $all_awards ) ? $all_awards : [] );

		return new \WP_REST_Response( [
			'earned'     => $earned,
			'all_awards' => $all_awards,
		] );
	}

	private static function get_award_progress_data( int $user_id, string $code ): array {
		$context = self::get_award_progress_context( $user_id );

		switch ( $code ) {
			case 'first_login':
				return [
					'unlock_requirement' => 'Sign in to the app once.',
					'progress_current'   => $context['first_login'] ? 1 : 0,
					'progress_target'    => 1,
					'progress_text'      => $context['first_login'] ? 'First login has already been recorded.' : 'No first-login flag is recorded yet.',
				];
			case 'onboarding_complete':
				return [
					'unlock_requirement' => 'Finish onboarding and save your profile setup.',
					'progress_current'   => $context['onboarding_complete'] ? 1 : 0,
					'progress_target'    => 1,
					'progress_text'      => $context['onboarding_complete'] ? 'Onboarding is complete.' : 'Onboarding is still incomplete.',
				];
			case 'first_workout':
				return [
					'unlock_requirement' => 'Complete your first workout session.',
					'progress_current'   => min( 1, $context['completed_workouts_total'] ),
					'progress_target'    => 1,
					'progress_text'      => sprintf( '%d completed workout%s recorded.', $context['completed_workouts_total'], 1 === $context['completed_workouts_total'] ? '' : 's' ),
				];
			case 'first_meal_logged':
				return [
					'unlock_requirement' => 'Log and confirm your first meal.',
					'progress_current'   => min( 1, $context['confirmed_meals_total'] ),
					'progress_target'    => 1,
					'progress_text'      => sprintf( '%d confirmed meal%s recorded.', $context['confirmed_meals_total'], 1 === $context['confirmed_meals_total'] ? '' : 's' ),
				];
			case 'first_progress_photo':
				return [
					'unlock_requirement' => 'Upload your first progress photo.',
					'progress_current'   => min( 1, $context['progress_photos_total'] ),
					'progress_target'    => 1,
					'progress_text'      => sprintf( '%d progress photo%s uploaded.', $context['progress_photos_total'], 1 === $context['progress_photos_total'] ? '' : 's' ),
				];
			case 'logging_streak_7':
				return [
					'unlock_requirement' => 'Log at least one confirmed meal for 7 days in a row.',
					'progress_current'   => $context['meal_streak'],
					'progress_target'    => 7,
					'progress_text'      => sprintf( '%d of 7 consecutive meal-logging days currently live.', $context['meal_streak'] ),
				];
			case 'logging_streak_30':
				return [
					'unlock_requirement' => 'Log at least one confirmed meal for 30 days in a row.',
					'progress_current'   => $context['meal_streak'],
					'progress_target'    => 30,
					'progress_text'      => sprintf( '%d of 30 consecutive meal-logging days currently live.', $context['meal_streak'] ),
				];
			case 'workouts_week_complete':
				return [
					'unlock_requirement' => 'Complete all planned workouts in a 7-day stretch.',
					'progress_current'   => $context['workout_days_7d'],
					'progress_target'    => $context['planned_workout_days_7d'],
					'progress_text'      => sprintf( '%d of %d planned workout days completed in the last 7 days.', $context['workout_days_7d'], $context['planned_workout_days_7d'] ),
				];
			case 'protein_streak_5':
				return [
					'unlock_requirement' => $context['target_protein'] > 0 ? sprintf( 'Hit %.0fg protein for 5 straight days.', $context['target_protein'] ) : 'Hit your protein target for 5 straight days.',
					'progress_current'   => $context['protein_streak'],
					'progress_target'    => 5,
					'progress_text'      => sprintf( '%d of 5 qualifying protein days currently live.', $context['protein_streak'] ),
				];
			case 'steps_10k_3days':
				return [
					'unlock_requirement' => 'Reach 10,000 steps for 3 days in a row.',
					'progress_current'   => $context['steps_10k_streak'],
					'progress_target'    => 3,
					'progress_text'      => sprintf( '%d of 3 consecutive 10k-step days currently live.', $context['steps_10k_streak'] ),
				];
			case 'weight_loss_5lb':
				return [
					'unlock_requirement' => 'Get 5 lb below your starting weight.',
					'progress_current'   => max( 0, round( $context['weight_lost_lb'], 1 ) ),
					'progress_target'    => 5,
					'progress_text'      => $context['starting_weight_known'] ? sprintf( 'Current loss from starting weight: %.1f lb.', $context['weight_lost_lb'] ) : 'Starting weight is not set yet.',
				];
			case 'weight_loss_10lb':
				return [
					'unlock_requirement' => 'Get 10 lb below your starting weight.',
					'progress_current'   => max( 0, round( $context['weight_lost_lb'], 1 ) ),
					'progress_target'    => 10,
					'progress_text'      => $context['starting_weight_known'] ? sprintf( 'Current loss from starting weight: %.1f lb.', $context['weight_lost_lb'] ) : 'Starting weight is not set yet.',
				];
			case 'consistency_comeback':
				return [
					'unlock_requirement' => 'Return after a gap of 5 or more days and then log 3 straight days.',
					'progress_current'   => $context['meal_streak'],
					'progress_target'    => 3,
					'progress_text'      => $context['has_comeback_window'] ? 'A qualifying comeback window is already visible in the last 30 days.' : sprintf( '%d consecutive meal days are live after your latest gap check.', min( 3, $context['meal_streak'] ) ),
				];
			case 'first_pr':
				return [
					'unlock_requirement' => 'Set a new personal record in any exercise.',
					'progress_current'   => min( 1, $context['pr_total'] ),
					'progress_target'    => 1,
					'progress_text'      => sprintf( '%d personal record snapshot%s recorded.', $context['pr_total'], 1 === $context['pr_total'] ? '' : 's' ),
				];
			case 'sleep_streak_5':
				return [
					'unlock_requirement' => 'Log at least 7 hours of sleep for 5 nights in a row.',
					'progress_current'   => $context['sleep_streak'],
					'progress_target'    => 5,
					'progress_text'      => sprintf( '%d of 5 qualifying sleep nights currently live.', $context['sleep_streak'] ),
				];
			case 'cardio_streak_3':
				return [
					'unlock_requirement' => 'Log cardio for 3 days in a row.',
					'progress_current'   => $context['cardio_streak'],
					'progress_target'    => 3,
					'progress_text'      => sprintf( '%d of 3 consecutive cardio days currently live.', $context['cardio_streak'] ),
				];
			case 'meals_logged_week':
				return [
					'unlock_requirement' => 'Log meals across all 7 days in the week.',
					'progress_current'   => $context['meal_days_7d'],
					'progress_target'    => 7,
					'progress_text'      => sprintf( '%d of 7 days with meals logged in the last week.', $context['meal_days_7d'] ),
				];
			case 'calorie_target_week':
				return [
					'unlock_requirement' => $context['target_calories'] > 0 ? sprintf( 'Land within %d-%d calories on 5 days in a week.', (int) round( $context['target_calories'] * 0.85 ), (int) round( $context['target_calories'] * 1.15 ) ) : 'Land near your calorie target on 5 days in a week.',
					'progress_current'   => $context['calorie_days_7d'],
					'progress_target'    => 5,
					'progress_text'      => sprintf( '%d of 5 qualifying calorie-range days in the last week.', $context['calorie_days_7d'] ),
				];
			default:
				return [
					'unlock_requirement' => 'Keep logging consistently to unlock this award.',
					'progress_current'   => 0,
					'progress_target'    => 0,
					'progress_text'      => '',
				];
		}
	}

	private static function get_award_progress_context( int $user_id ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT target_calories, target_protein_g, target_steps, target_sleep_hours
			 FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		$starting_weight = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT starting_weight_lb FROM {$p}fit_user_profiles WHERE user_id = %d",
			$user_id
		) );
		$current_weight = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT weight_lb FROM {$p}fit_body_metrics WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );

		$completed_workouts_total = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_workout_sessions WHERE user_id = %d AND completed = 1",
			$user_id
		) );
		$confirmed_meals_total = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_meals WHERE user_id = %d AND confirmed = 1",
			$user_id
		) );
		$progress_photos_total = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_progress_photos WHERE user_id = %d",
			$user_id
		) );
		$pr_total = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_exercise_performance_snapshots WHERE user_id = %d",
			$user_id
		) );

		$start_date = UserTime::days_ago( $user_id, 6 );
		$workout_days_7d = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT session_date) FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1 AND session_date >= %s",
			$user_id,
			$start_date
		) );
		$planned_workout_days_7d = max( 1, self::count_planned_training_days_in_range( $user_id, $start_date, UserTime::today( $user_id ) ) );

		$meal_days_7d = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT DATE(meal_datetime)) FROM {$p}fit_meals
			 WHERE user_id = %d AND confirmed = 1 AND DATE(meal_datetime) >= %s",
			$user_id,
			$start_date
		) );

		$target_calories = (int) ( $goal->target_calories ?? 0 );
		$calorie_days_7d = $target_calories > 0
			? (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM (
					SELECT DATE(m.meal_datetime) AS meal_date
					FROM {$p}fit_meal_items mi
					JOIN {$p}fit_meals m ON m.id = mi.meal_id
					WHERE m.user_id = %d AND m.confirmed = 1 AND DATE(m.meal_datetime) >= %s
					GROUP BY DATE(m.meal_datetime)
					HAVING SUM(mi.calories) BETWEEN %d AND %d
				) calorie_days",
				$user_id,
				$start_date,
				(int) round( $target_calories * 0.85 ),
				(int) round( $target_calories * 1.15 )
			) )
			: 0;

		return [
			'first_login'            => (bool) get_user_meta( $user_id, 'jf_first_login_done', true ),
			'onboarding_complete'    => (bool) $wpdb->get_var( $wpdb->prepare( "SELECT onboarding_complete FROM {$p}fit_user_profiles WHERE user_id = %d", $user_id ) ),
			'completed_workouts_total' => $completed_workouts_total,
			'confirmed_meals_total'  => $confirmed_meals_total,
			'progress_photos_total'  => $progress_photos_total,
			'pr_total'               => $pr_total,
			'planned_workout_days_7d' => $planned_workout_days_7d,
			'workout_days_7d'        => $workout_days_7d,
			'meal_streak'            => self::count_meal_streak( $user_id ),
			'protein_streak'         => self::count_protein_streak( $user_id, (float) ( $goal->target_protein_g ?? 0 ) ),
			'steps_10k_streak'       => self::count_steps_streak( $user_id, 10000 ),
			'sleep_streak'           => self::count_sleep_streak( $user_id ),
			'cardio_streak'          => self::count_cardio_streak( $user_id ),
			'meal_days_7d'           => $meal_days_7d,
			'calorie_days_7d'        => $calorie_days_7d,
			'target_protein'         => (float) ( $goal->target_protein_g ?? 0 ),
			'target_calories'        => $target_calories,
			'weight_lost_lb'         => $starting_weight > 0 && $current_weight > 0 ? max( 0, $starting_weight - $current_weight ) : 0,
			'starting_weight_known'  => $starting_weight > 0,
			'has_comeback_window'    => self::has_consistency_comeback_window( $user_id ),
		];
	}

	// ── POST /dashboard/photo ─────────────────────────────────────────────────

	public static function upload_progress_photo( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		$files = $req->get_file_params();
		if ( empty( $files['photo'] ) ) {
			return new \WP_REST_Response( [ 'message' => 'No photo file provided.' ], 400 );
		}
		$upload_validation = PrivateMediaService::validate_uploaded_image( (array) $files['photo'], 'progress photo' );
		if ( is_wp_error( $upload_validation ) ) {
			return new \WP_REST_Response( [ 'message' => $upload_validation->get_error_message() ], 400 );
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		// Temporarily set current user so media is attributed correctly
		wp_set_current_user( $user_id );

		$attachment_id = media_handle_upload( 'photo', 0 );
		if ( is_wp_error( $attachment_id ) ) {
			return new \WP_REST_Response( [ 'message' => $attachment_id->get_error_message() ], 500 );
		}
		$secured = PrivateMediaService::ensure_private_attachment( (int) $attachment_id, $user_id );
		if ( is_wp_error( $secured ) ) {
			wp_delete_attachment( (int) $attachment_id, true );
			return new \WP_REST_Response( [ 'message' => $secured->get_error_message() ], 500 );
		}

		// Restrict direct URL access — mark as private so we serve via authenticated endpoint
		update_post_meta( $attachment_id, 'jf_private_photo', 1 );
		update_post_meta( $attachment_id, 'jf_owner_user_id', $user_id );

		global $wpdb;
		$angle = sanitize_text_field( $req->get_param( 'angle' ) ?: 'front' );
		if ( ! in_array( $angle, [ 'front', 'side', 'back' ], true ) ) {
			wp_delete_attachment( (int) $attachment_id, true );
			return new \WP_REST_Response( [ 'message' => 'Invalid photo angle.' ], 400 );
		}
		$date  = sanitize_text_field( $req->get_param( 'date' ) ?: UserTime::today( $user_id ) );

		$wpdb->insert( $wpdb->prefix . 'fit_progress_photos', [
			'user_id'       => $user_id,
			'photo_date'    => $date,
			'angle'         => $angle,
			'attachment_id' => $attachment_id,
		] );
		$photo_id = (int) $wpdb->insert_id;

		$baselines = self::get_progress_photo_baselines( $user_id );
		if ( empty( $baselines[ $angle ] ) ) {
			$baselines[ $angle ] = $photo_id;
			update_user_meta( $user_id, 'jf_progress_photo_baselines', $baselines );
		}

		\Johnny5k\Services\AwardEngine::sync_user_awards( $user_id );

		return new \WP_REST_Response( [
			'photo_id'      => $photo_id,
			'attachment_id' => $attachment_id,
			'date'          => $date,
			'angle'         => $angle,
		], 201 );
	}

	// ── GET /dashboard/photos ─────────────────────────────────────────────────

	public static function list_progress_photos( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$baselines = self::get_progress_photo_baselines( $user_id );

		$photos = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, photo_date, angle, created_at
			 FROM {$wpdb->prefix}fit_progress_photos
			 WHERE user_id = %d ORDER BY photo_date DESC",
			$user_id
		) );

		// Add signed REST URL for each photo (no direct media URL exposed)
		foreach ( $photos as $photo ) {
			$photo->id = (int) $photo->id;
			$photo->url = self::progress_photo_url( (int) $photo->id );
			$photo->is_baseline = (int) ( $baselines[ $photo->angle ] ?? 0 ) === (int) $photo->id;
		}

		return new \WP_REST_Response( [
			'photos'     => $photos,
			'baselines'  => $baselines,
		] );
	}

	// ── GET /dashboard/photo/{id} — serve photo file ─────────────────────────

	public static function serve_progress_photo( \WP_REST_Request $req ): mixed {
		$photo_id = (int) $req->get_param( 'id' );
		return self::stream_progress_photo_response( get_current_user_id(), $photo_id, true );
	}

	public static function ajax_progress_photo(): void {
		$photo_id = isset( $_GET['id'] ) ? (int) $_GET['id'] : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$nonce = isset( $_GET['_ajax_nonce'] ) ? sanitize_text_field( (string) $_GET['_ajax_nonce'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( function_exists( 'wp_verify_nonce' ) && ! wp_verify_nonce( $nonce, 'jf_progress_photo_' . $photo_id ) ) {
			status_header( 403 );
			wp_die( 'Invalid photo token.' );
		}
		self::stream_progress_photo_response( get_current_user_id(), $photo_id, false );
	}

	public static function compare_progress_photos( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id        = get_current_user_id();
		$first_photo_id = (int) $req->get_param( 'first_photo_id' );
		$second_photo_id = (int) $req->get_param( 'second_photo_id' );

		if ( ! $first_photo_id || ! $second_photo_id || $first_photo_id === $second_photo_id ) {
			return new \WP_REST_Response( [ 'message' => 'Choose two different progress photos to compare.' ], 400 );
		}

		$first_photo = self::get_progress_photo_for_user( $user_id, $first_photo_id );
		$second_photo = self::get_progress_photo_for_user( $user_id, $second_photo_id );

		if ( ! $first_photo || ! $second_photo ) {
			return new \WP_REST_Response( [ 'message' => 'One or both progress photos could not be found.' ], 404 );
		}

		$first_data_url = self::photo_attachment_to_ai_data_url( (int) $first_photo->attachment_id );
		if ( is_wp_error( $first_data_url ) ) {
			return new \WP_REST_Response( [ 'message' => $first_data_url->get_error_message() ], 500 );
		}

		$second_data_url = self::photo_attachment_to_ai_data_url( (int) $second_photo->attachment_id );
		if ( is_wp_error( $second_data_url ) ) {
			return new \WP_REST_Response( [ 'message' => $second_data_url->get_error_message() ], 500 );
		}

		$comparison = AiService::analyse_progress_photo(
			$user_id,
			$first_data_url,
			$second_data_url,
			[
				'first_photo' => [
					'id'         => (int) $first_photo->id,
					'photo_date' => sanitize_text_field( (string) $first_photo->photo_date ),
					'angle'      => sanitize_key( (string) $first_photo->angle ),
				],
				'second_photo' => [
					'id'         => (int) $second_photo->id,
					'photo_date' => sanitize_text_field( (string) $second_photo->photo_date ),
					'angle'      => sanitize_key( (string) $second_photo->angle ),
				],
			]
		);
		if ( is_wp_error( $comparison ) ) {
			return new \WP_REST_Response( [ 'message' => $comparison->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [
			'comparison'  => $comparison,
			'first_photo' => [
				'id'         => (int) $first_photo->id,
				'photo_date' => $first_photo->photo_date,
				'angle'      => $first_photo->angle,
				'url'        => self::progress_photo_url( (int) $first_photo->id ),
			],
			'second_photo' => [
				'id'         => (int) $second_photo->id,
				'photo_date' => $second_photo->photo_date,
				'angle'      => $second_photo->angle,
				'url'        => self::progress_photo_url( (int) $second_photo->id ),
			],
		] );
	}

	public static function set_progress_photo_baseline( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id  = get_current_user_id();
		$photo_id = (int) $req->get_param( 'photo_id' );
		$angle    = sanitize_text_field( (string) $req->get_param( 'angle' ) );

		if ( ! in_array( $angle, [ 'front', 'side', 'back' ], true ) ) {
			return new \WP_REST_Response( [ 'message' => 'Invalid photo angle.' ], 400 );
		}

		$baselines = self::get_progress_photo_baselines( $user_id );

		if ( $photo_id > 0 ) {
			$photo = self::get_progress_photo_for_user( $user_id, $photo_id );
			if ( ! $photo || $photo->angle !== $angle ) {
				return new \WP_REST_Response( [ 'message' => 'Photo not found for that angle.' ], 404 );
			}

			$baselines[ $angle ] = $photo_id;
		} else {
			unset( $baselines[ $angle ] );
		}

		update_user_meta( $user_id, 'jf_progress_photo_baselines', $baselines );

		return new \WP_REST_Response( [
			'saved'     => true,
			'baselines' => $baselines,
		], 200 );
	}

	public static function delete_progress_photo( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id  = get_current_user_id();
		$photo_id = (int) $req->get_param( 'id' );

		$photo = self::get_progress_photo_for_user( $user_id, $photo_id );
		if ( ! $photo ) {
			return new \WP_REST_Response( [ 'message' => 'Photo not found.' ], 404 );
		}

		$wpdb->delete(
			$wpdb->prefix . 'fit_progress_photos',
			[
				'id'      => $photo_id,
				'user_id' => $user_id,
			]
		);

		if ( ! empty( $photo->attachment_id ) ) {
			wp_delete_attachment( (int) $photo->attachment_id, true );
		}

		$baselines = self::get_progress_photo_baselines( $user_id );
		if ( (int) ( $baselines[ $photo->angle ] ?? 0 ) === $photo_id ) {
			unset( $baselines[ $photo->angle ] );
			update_user_meta( $user_id, 'jf_progress_photo_baselines', $baselines );
		}

		\Johnny5k\Services\AwardEngine::sync_user_awards( $user_id );

		return new \WP_REST_Response( [ 'deleted' => true, 'photo_id' => $photo_id ], 200 );
	}

	private static function get_progress_photo_for_user( int $user_id, int $photo_id ): ?object {
		global $wpdb;

		return $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_progress_photos WHERE id = %d AND user_id = %d",
			$photo_id,
			$user_id
		) );
	}

	private static function get_progress_photo_baselines( int $user_id ): array {
		$stored = get_user_meta( $user_id, 'jf_progress_photo_baselines', true );
		$stored = is_array( $stored ) ? $stored : [];

		$baselines = [];
		foreach ( [ 'front', 'side', 'back' ] as $angle ) {
			if ( ! empty( $stored[ $angle ] ) ) {
				$baselines[ $angle ] = (int) $stored[ $angle ];
			}
		}

		return $baselines;
	}

	private static function progress_photo_url( int $photo_id ): string {
		return add_query_arg( [
			'action'      => 'jf_progress_photo',
			'id'          => $photo_id,
			'_ajax_nonce' => wp_create_nonce( 'jf_progress_photo_' . $photo_id ),
		], admin_url( 'admin-ajax.php' ) );
	}

	private static function stream_progress_photo_response( int $user_id, int $photo_id, bool $return_rest ): mixed {
		if ( ! $user_id ) {
			if ( $return_rest ) {
				return new \WP_REST_Response( [ 'message' => 'Authentication required.' ], 401 );
			}

			status_header( 401 );
			wp_die( 'Authentication required.' );
		}

		$photo = self::get_progress_photo_for_user( $user_id, $photo_id );
		if ( ! $photo ) {
			if ( $return_rest ) {
				return new \WP_REST_Response( [ 'message' => 'Photo not found.' ], 404 );
			}

			status_header( 404 );
			wp_die( 'Photo not found.' );
		}

		$file_path = PrivateMediaService::file_path_for_attachment( (int) $photo->attachment_id );
		if ( is_wp_error( $file_path ) ) {
			if ( $return_rest ) {
				return new \WP_REST_Response( [ 'message' => 'Photo file not found.' ], 404 );
			}

			status_header( 404 );
			wp_die( 'Photo file not found.' );
		}

		$mime = mime_content_type( $file_path ) ?: 'image/jpeg';

		header( 'Content-Type: ' . $mime );
		header( 'Content-Length: ' . filesize( $file_path ) );
		header( 'Cache-Control: private, max-age=300' );
		readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}

	private static function photo_attachment_to_data_url( int $attachment_id ): string|\WP_Error {
		return PrivateMediaService::attachment_to_data_url(
			$attachment_id,
			'photo_missing',
			'Progress photo file not found.',
			[ 'image/jpeg', 'image/png', 'image/webp' ]
		);
	}

	private static function photo_attachment_to_ai_data_url( int $attachment_id ): string|\WP_Error {
		return PrivateMediaService::attachment_to_data_url(
			$attachment_id,
			'photo_missing',
			'Progress photo file not found.',
			[ 'image/jpeg', 'image/png', 'image/webp' ]
		);
	}

	public static function validate_photo_angle( $value ): bool {
		$angle = sanitize_text_field( (string) $value );
		return '' === $angle || in_array( $angle, [ 'front', 'side', 'back' ], true );
	}

	public static function validate_iso_date( $value ): bool {
		$date = sanitize_text_field( (string) $value );
		return '' === $date || 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date );
	}

	private static function build_recovery_summary( int $user_id, ?object $goal, ?object $sleep, int $steps_today ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$sleep_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT sleep_date, hours_sleep
			 FROM {$p}fit_sleep_logs
			 WHERE user_id = %d AND sleep_date >= %s
			 ORDER BY sleep_date DESC",
			$user_id,
			UserTime::days_ago( $user_id, 6 )
		), ARRAY_A );

		$cardio_minutes = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COALESCE(SUM(duration_minutes), 0) FROM {$p}fit_cardio_logs
			 WHERE user_id = %d AND cardio_date >= %s",
			$user_id,
			UserTime::days_ago( $user_id, 6 )
		) );

		$active_flag_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, flag_type, body_area, severity, notes, updated_at
			 FROM {$p}fit_user_health_flags
			 WHERE user_id = %d AND active = 1
			 ORDER BY created_at DESC",
			$user_id
		) );
		$now = UserTime::now( $user_id );
		$active_flag_load = 0.0;
		$active_flag_items = array_map( static function( object $row ) use ( $now, &$active_flag_load ): array {
			$flag_type = ucwords( str_replace( '_', ' ', (string) ( $row->flag_type ?? '' ) ) );
			$body_area = ucwords( str_replace( '_', ' ', (string) ( $row->body_area ?? '' ) ) );
			$label = trim( $flag_type );
			$severity = (string) ( $row->severity ?? 'low' );
			$severity_weight = match ( $severity ) {
				'high' => 3.0,
				'medium' => 2.0,
				default => 1.0,
			};
			$days_since_update = 999;
			try {
				$updated_at = new \DateTimeImmutable( (string) ( $row->updated_at ?? '' ), UserTime::timezone( get_current_user_id() ) );
				$days_since_update = (int) $now->diff( $updated_at )->days;
			} catch ( \Exception $e ) {
				$days_since_update = 999;
			}
			$recency_multiplier = $days_since_update <= 14 ? 1.0 : ( $days_since_update <= 45 ? 0.7 : 0.45 );
			$impact_score = round( $severity_weight * $recency_multiplier, 2 );
			$active_flag_load += $impact_score;

			if ( '' !== $body_area ) {
				$label = trim( $label . ': ' . $body_area );
			}

			return [
				'id'       => (int) ( $row->id ?? 0 ),
				'label'    => $label ?: 'Active flag',
				'severity' => $severity,
				'notes'    => (string) ( $row->notes ?? '' ),
				'days_since_update' => $days_since_update,
				'impact_score' => $impact_score,
			];
		}, is_array( $active_flag_rows ) ? $active_flag_rows : [] );
		$active_flags = count( $active_flag_rows );

		$target_sleep = (float) ( $goal->target_sleep_hours ?? 8 );
		$target_steps = (int) ( $goal->target_steps ?? 8000 );
		$last_sleep_date = (string) ( $sleep->sleep_date ?? '' );
		$recent_sleep_cutoff = UserTime::days_ago( $user_id, 1 );
		$has_recent_sleep = '' !== $last_sleep_date && $last_sleep_date >= $recent_sleep_cutoff;
		$last_sleep = $has_recent_sleep ? (float) ( $sleep->hours_sleep ?? 0 ) : 0;
		$steps_pct = $target_steps > 0 ? ( $steps_today / $target_steps ) : 0;
		$sleep_by_date = [];
		foreach ( is_array( $sleep_rows ) ? $sleep_rows : [] as $row ) {
			$date = (string) ( $row['sleep_date'] ?? '' );
			if ( '' === $date || isset( $sleep_by_date[ $date ] ) ) {
				continue;
			}
			$sleep_by_date[ $date ] = (float) ( $row['hours_sleep'] ?? 0 );
		}
		$recent_sleep_window = self::build_sleep_window_stats( $sleep_by_date, [
			UserTime::days_ago( $user_id, 3 ),
			UserTime::days_ago( $user_id, 2 ),
			UserTime::days_ago( $user_id, 1 ),
		] );
		$previous_sleep_window = self::build_sleep_window_stats( $sleep_by_date, [
			UserTime::days_ago( $user_id, 6 ),
			UserTime::days_ago( $user_id, 5 ),
			UserTime::days_ago( $user_id, 4 ),
		] );
		$avg_sleep = $recent_sleep_window['avg_logged'];
		$reason_items = [];
		$dominant_reason_key = '';

		$mode = 'normal';
		$headline = 'Recovery is supporting normal training.';
		if ( ! $has_recent_sleep ) {
			$reason_items[] = 'No sleep log from last night yet.';
			$dominant_reason_key = 'sleep';
		}
		if ( $last_sleep > 0 && $last_sleep < max( 5.5, $target_sleep - 2 ) ) {
			$reason_items[] = sprintf( 'Last night sleep was only %.1f hours.', $last_sleep );
			$dominant_reason_key = $dominant_reason_key ?: 'sleep';
		} elseif ( $avg_sleep > 0 && $avg_sleep < max( 6.5, $target_sleep - 1 ) ) {
			$reason_items[] = sprintf( 'Recent sleep average is %.1f hours.', $avg_sleep );
			$dominant_reason_key = $dominant_reason_key ?: 'sleep';
		}
		if ( $cardio_minutes >= 150 ) {
			$reason_items[] = sprintf( 'Cardio load is %d minutes over the last 7 days.', $cardio_minutes );
			$dominant_reason_key = $dominant_reason_key ?: 'cardio';
		}
		if ( $steps_pct >= 1.25 ) {
			$reason_items[] = sprintf( 'Today’s steps are at %d%% of target.', (int) round( $steps_pct * 100 ) );
			$dominant_reason_key = $dominant_reason_key ?: 'steps';
		}
		if ( $active_flag_load > 0 ) {
			$reason_items[] = sprintf( 'Active injury load is elevated (%.1f weighted points).', $active_flag_load );
			$dominant_reason_key = $dominant_reason_key ?: 'flags';
		}

		if ( $active_flag_load >= 3.5 || ( $has_recent_sleep && $last_sleep < max( 5.5, $target_sleep - 2 ) ) ) {
			$mode = 'maintenance';
			$headline = 'Recovery is compromised. Keep training lighter and cleaner today.';
		} elseif ( ! $has_recent_sleep || $active_flag_load >= 1.5 || $avg_sleep < max( 6.5, $target_sleep - 1 ) || $cardio_minutes >= 150 || $steps_pct >= 1.25 ) {
			$mode = 'caution';
			$headline = 'Recovery is mixed. Train well, but keep the session tight and avoid grinding.';
		}
		$trend = self::build_recovery_trend_summary( $recent_sleep_window, $previous_sleep_window );
		$recommended_action = self::build_recovery_action_payload( $dominant_reason_key ?: 'overview', $mode, $active_flags );

		return [
			'mode'              => $mode,
			'headline'          => $headline,
			'last_sleep_hours'  => $last_sleep,
			'last_sleep_date'   => $last_sleep_date,
			'last_sleep_is_recent' => $has_recent_sleep,
			'avg_sleep_3d'      => round( $avg_sleep, 1 ),
			'avg_sleep_3d_window' => round( $recent_sleep_window['avg_window'], 1 ),
			'sleep_logged_days_3d' => $recent_sleep_window['logged_days'],
			'sleep_missing_days_3d' => $recent_sleep_window['missing_days'],
			'steps_today'       => $steps_today,
			'steps_target'      => $target_steps,
			'cardio_minutes_7d' => $cardio_minutes,
			'active_flags'      => $active_flags,
			'active_flag_load'  => round( $active_flag_load, 2 ),
			'active_flag_items' => $active_flag_items,
			'why_summary'       => implode( ' ', array_slice( $reason_items, 0, 2 ) ),
			'reason_items'      => array_slice( $reason_items, 0, 3 ),
			'trend_direction'   => $trend['direction'],
			'trend_summary'     => $trend['summary'],
			'recommended_action'=> $recommended_action,
			'recommended_time_tier' => 'maintenance' === $mode ? 'short' : ( 'caution' === $mode ? 'medium' : 'full' ),
		];
	}

	private static function build_sleep_window_stats( array $sleep_by_date, array $dates ): array {
		$total_logged = 0.0;
		$logged_days = 0;
		$total_window = 0.0;

		foreach ( $dates as $date ) {
			$hours = isset( $sleep_by_date[ $date ] ) ? (float) $sleep_by_date[ $date ] : null;
			if ( null !== $hours ) {
				$total_logged += $hours;
				$logged_days++;
				$total_window += $hours;
			}
		}

		$window_days = max( 1, count( $dates ) );

		return [
			'avg_logged'  => $logged_days > 0 ? round( $total_logged / $logged_days, 2 ) : 0.0,
			'avg_window'  => round( $total_window / $window_days, 2 ),
			'logged_days' => $logged_days,
			'missing_days'=> max( 0, $window_days - $logged_days ),
		];
	}

	private static function build_recovery_trend_summary( array $recent_window, array $previous_window ): array {
		if ( (int) ( $recent_window['logged_days'] ?? 0 ) === 0 && (int) ( $previous_window['logged_days'] ?? 0 ) === 0 ) {
			return [
				'direction' => 'unknown',
				'summary' => 'Not enough sleep history to judge the recovery trend yet.',
			];
		}

		$recent = (float) ( $recent_window['avg_logged'] ?? 0 );
		$previous = (float) ( $previous_window['avg_logged'] ?? 0 );
		$delta = round( $recent - $previous, 1 );

		if ( $delta >= 0.4 ) {
			return [
				'direction' => 'improving',
				'summary' => sprintf( 'Recovery trend is improving. Sleep is up %.1f hours versus the previous 3-night block.', $delta ),
			];
		}
		if ( $delta <= -0.4 ) {
			return [
				'direction' => 'declining',
				'summary' => sprintf( 'Recovery trend is slipping. Sleep is down %.1f hours versus the previous 3-night block.', abs( $delta ) ),
			];
		}

		return [
			'direction' => 'steady',
			'summary' => 'Recovery trend is steady versus the previous 3-night block.',
		];
	}

	private static function build_recovery_action_payload( string $reason_key, string $mode, int $active_flags ): array {
		if ( 'flags' === $reason_key || $active_flags > 0 ) {
			return [
				'label' => 'Review flags',
				'target' => 'injuries',
				'notice' => 'Johnny opened injury flags so you can clean up anything that should not be driving recovery.',
			];
		}
		if ( 'sleep' === $reason_key || 'maintenance' === $mode ) {
			return [
				'label' => 'Log sleep',
				'target' => 'sleep',
				'notice' => 'Johnny opened sleep logging so the Recovery Loop can use the right night entry.',
			];
		}
		if ( 'cardio' === $reason_key ) {
			return [
				'label' => 'Open cardio',
				'target' => 'cardio',
				'notice' => 'Johnny opened cardio so you can review recent conditioning load.',
			];
		}
		if ( 'steps' === $reason_key ) {
			return [
				'label' => 'Open steps',
				'target' => 'steps',
				'notice' => 'Johnny opened steps so you can see whether movement load is driving the caution signal.',
			];
		}

		return [
			'label' => 'Open recovery',
			'target' => 'body',
			'notice' => 'Johnny opened recovery details so you can make the next call from live data.',
		];
	}

	private static function calculate_weekly_rhythm_score( int $user_id, ?object $goal ): array {
		global $wpdb;
		$p = $wpdb->prefix;
		$start_date = UserTime::days_ago( $user_id, 6 );
		$end_date = UserTime::today( $user_id );

		$meal_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(DISTINCT DATE(meal_datetime))
			 FROM {$p}fit_meals
			 WHERE user_id = %d AND confirmed = 1
			   AND DATE(meal_datetime) >= %s",
			$user_id,
			$start_date
		) );

		$target_protein = (float) ( $goal->target_protein_g ?? 0 );
		$protein_days = $target_protein > 0
			? (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM (
					SELECT DATE(m.meal_datetime) AS meal_date
					FROM {$p}fit_meal_items mi
					JOIN {$p}fit_meals m ON m.id = mi.meal_id
					WHERE m.user_id = %d AND m.confirmed = 1
					  AND DATE(m.meal_datetime) >= %s
					GROUP BY DATE(m.meal_datetime)
					HAVING SUM(mi.protein_g) >= %f
				) protein_days",
				$user_id,
				$start_date,
				$target_protein
			) )
			: $meal_days;

		$target_calories = (int) ( $goal->target_calories ?? 0 );
		$calorie_days = $target_calories > 0
			? (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM (
					SELECT DATE(m.meal_datetime) AS meal_date
					FROM {$p}fit_meal_items mi
					JOIN {$p}fit_meals m ON m.id = mi.meal_id
					WHERE m.user_id = %d AND m.confirmed = 1
					  AND DATE(m.meal_datetime) >= %s
					GROUP BY DATE(m.meal_datetime)
					HAVING SUM(mi.calories) BETWEEN %d AND %d
				) calorie_days",
				$user_id,
				$start_date,
				(int) round( $target_calories * 0.85 ),
				(int) round( $target_calories * 1.15 )
			) )
			: $meal_days;

		$target_sleep = (float) ( $goal->target_sleep_hours ?? 7 );
		$sleep_threshold = max( 6.5, round( $target_sleep - 0.5, 1 ) );
		$sleep_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_sleep_logs
			 WHERE user_id = %d AND sleep_date >= %s AND hours_sleep >= %f",
			$user_id,
			$start_date,
			$sleep_threshold
		) );

		$target_steps = (int) ( $goal->target_steps ?? 8000 );
		$steps_threshold = max( 6000, (int) round( $target_steps * 0.8 ) );
		$steps_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM {$p}fit_step_logs
			 WHERE user_id = %d AND step_date >= %s AND steps >= %d",
			$user_id,
			$start_date,
			$steps_threshold
		) );

		$movement_days = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COUNT(*) FROM (
				SELECT DISTINCT session_date AS activity_date
				FROM {$p}fit_workout_sessions
				WHERE user_id = %d AND completed = 1 AND session_date >= %s
				UNION
				SELECT DISTINCT cardio_date AS activity_date
				FROM {$p}fit_cardio_logs
				WHERE user_id = %d AND cardio_date >= %s
			) movement_days",
			$user_id,
			$start_date,
			$user_id,
			$start_date
		) );

		$planned_training_days = self::count_planned_training_days_in_range( $user_id, $start_date, $end_date );
		$movement_target = max( 2, $planned_training_days );

		$weights = [
			'meal_days'     => 20,
			'protein_days'  => 20,
			'calorie_days'  => 15,
			'sleep_days'    => 20,
			'steps_days'    => 10,
			'movement_days' => 15,
		];

		$ratios = [
			'meal_days'     => min( 1, $meal_days / 7 ),
			'protein_days'  => min( 1, $protein_days / 7 ),
			'calorie_days'  => min( 1, $calorie_days / 7 ),
			'sleep_days'    => min( 1, $sleep_days / 7 ),
			'steps_days'    => min( 1, $steps_days / 7 ),
			'movement_days' => min( 1, $movement_days / max( 1, $movement_target ) ),
		];

		$score = 0;
		foreach ( $weights as $key => $weight ) {
			$score += $weight * $ratios[ $key ];
		}

		return [
			'score' => (int) round( $score ),
			'breakdown' => [
				'meal_days' => [
					'label' => 'Meals logged',
					'value' => $meal_days,
					'target' => 7,
					'weight' => $weights['meal_days'],
				],
				'protein_days' => [
					'label' => 'Protein days',
					'value' => $protein_days,
					'target' => 7,
					'weight' => $weights['protein_days'],
					'helper' => $target_protein > 0 ? sprintf( 'Hit %.0fg protein.', $target_protein ) : 'Hit your protein target.',
				],
				'calorie_days' => [
					'label' => 'Calorie range days',
					'value' => $calorie_days,
					'target' => 7,
					'weight' => $weights['calorie_days'],
					'helper' => $target_calories > 0 ? sprintf( 'Land within %d-%d calories.', (int) round( $target_calories * 0.85 ), (int) round( $target_calories * 1.15 ) ) : 'Stay near your calorie target.',
				],
				'sleep_days' => [
					'label' => 'Sleep target days',
					'value' => $sleep_days,
					'target' => 7,
					'weight' => $weights['sleep_days'],
					'threshold' => $sleep_threshold,
					'helper' => sprintf( 'Log at least %.1fh sleep.', $sleep_threshold ),
				],
				'steps_days' => [
					'label' => 'Step target days',
					'value' => $steps_days,
					'target' => 7,
					'weight' => $weights['steps_days'],
					'threshold' => $steps_threshold,
					'helper' => sprintf( 'Reach %d+ steps.', $steps_threshold ),
				],
				'movement_days' => [
					'label' => 'Training or cardio days',
					'value' => $movement_days,
					'target' => $movement_target,
					'weight' => $weights['movement_days'],
					'helper' => 'Complete a workout or log cardio.',
				],
			],
		];
	}

	private static function infer_next_day_type( int $user_id, ?string $date = null ): string {
		global $wpdb;
		$p = $wpdb->prefix;

		$plan_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $plan_id ) {
			return 'rest';
		}

		$target_date = $date ?: UserTime::today( $user_id );
		$weekday_order = self::weekday_order_for_date( $user_id, $target_date );
		$day_type = $wpdb->get_var( $wpdb->prepare(
			"SELECT day_type FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_order = %d
			 LIMIT 1",
			$plan_id,
			$weekday_order
		) );

		if ( $day_type ) {
			return (string) $day_type;
		}

		$first_active_day = $wpdb->get_var( $wpdb->prepare(
			"SELECT day_type FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_type != 'rest'
			 ORDER BY day_order LIMIT 1",
			$plan_id
		) );

		return $first_active_day ? (string) $first_active_day : 'rest';
	}

	private static function get_plan_day_for_date( int $user_id, string $date ): ?object {
		global $wpdb;
		$p = $wpdb->prefix;

		$plan_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $plan_id ) {
			return null;
		}

		$weekday_order = self::weekday_order_for_date( $user_id, $date );
		$day = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, day_type, day_order, time_tier
			 FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_order = %d
			 LIMIT 1",
			$plan_id,
			$weekday_order
		) );

		if ( ! $day ) {
			return null;
		}

		$day->date = $date;
		$day->weekday_label = self::weekday_label_for_date( $user_id, $date );
		return $day;
	}

	private static function weekday_order_for_date( int $user_id, string $date ): int {
		return UserTime::weekday_order_for_date( $user_id, $date );
	}

	private static function count_planned_training_days_in_range( int $user_id, string $start_date, string $end_date ): int {
		$timezone = UserTime::timezone( $user_id );
		$start = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $start_date . ' 12:00:00', $timezone );
		$end = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $end_date . ' 12:00:00', $timezone );

		if ( false === $start || false === $end ) {
			return 0;
		}

		$count = 0;
		$current = $start;
		while ( $current <= $end ) {
			$day = self::get_plan_day_for_date( $user_id, $current->format( 'Y-m-d' ) );
			if ( $day && 'rest' !== ( $day->day_type ?? 'rest' ) ) {
				$count++;
			}
			$current = $current->modify( '+1 day' );
		}

		return $count;
	}

	private static function weekday_label_for_date( int $user_id, string $date ): string {
		return UserTime::weekday_label_for_date( $user_id, $date );
	}

	private static function count_meal_streak( int $user_id ): int {
		global $wpdb;
		return self::count_consecutive_days( $user_id, function( string $date ) use ( $wpdb, $user_id ): bool {
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_meals
				 WHERE user_id = %d AND DATE(meal_datetime) = %s AND confirmed = 1",
				$user_id, $date
			) );
			return $count > 0;
		} );
	}

	private static function count_workout_streak( int $user_id ): int {
		global $wpdb;
		return self::count_consecutive_days( $user_id, function( string $date ) use ( $wpdb, $user_id ): bool {
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions
				 WHERE user_id = %d AND session_date = %s AND completed = 1",
				$user_id, $date
			) );
			return $count > 0;
		} );
	}

	private static function count_protein_streak( int $user_id, float $target_protein ): int {
		if ( $target_protein <= 0 ) {
			return 0;
		}

		global $wpdb;
		return self::count_consecutive_days( $user_id, function( string $date ) use ( $wpdb, $user_id, $target_protein ): bool {
			$protein = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT SUM(mi.protein_g)
				 FROM {$wpdb->prefix}fit_meal_items mi
				 JOIN {$wpdb->prefix}fit_meals m ON m.id = mi.meal_id
				 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
				$user_id,
				$date
			) );
			return $protein >= $target_protein;
		} );
	}

	private static function count_sleep_streak( int $user_id ): int {
		global $wpdb;
		return self::count_consecutive_days( $user_id, function( string $date ) use ( $wpdb, $user_id ): bool {
			$hours = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT hours_sleep FROM {$wpdb->prefix}fit_sleep_logs WHERE user_id = %d AND sleep_date = %s",
				$user_id, $date
			) );
			return $hours >= 7.0;
		}, UserTime::yesterday( $user_id ) );
	}

	private static function count_cardio_streak( int $user_id ): int {
		global $wpdb;
		return self::count_consecutive_days( $user_id, function( string $date ) use ( $wpdb, $user_id ): bool {
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_cardio_logs WHERE user_id = %d AND cardio_date = %s",
				$user_id, $date
			) );
			return $count > 0;
		} );
	}

	private static function count_steps_streak( int $user_id, int $threshold ): int {
		global $wpdb;
		return self::count_consecutive_days( $user_id, function( string $date ) use ( $wpdb, $user_id, $threshold ): bool {
			$steps = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT steps FROM {$wpdb->prefix}fit_step_logs WHERE user_id = %d AND step_date = %s",
				$user_id,
				$date
			) );
			return $steps >= $threshold;
		} );
	}

	private static function count_consecutive_days( int $user_id, callable $has_activity, ?string $start_date = null ): int {
		$streak = 0;
		$current = UserTime::now( $user_id )->setTime( 12, 0 );

		if ( $start_date ) {
			$custom_start = \DateTimeImmutable::createFromFormat( 'Y-m-d H:i:s', $start_date . ' 12:00:00', UserTime::timezone( $user_id ) );
			if ( false !== $custom_start ) {
				$current = $custom_start;
			}
		}

		for ( $i = 0; $i < 30; $i++ ) {
			$date = $current->format( 'Y-m-d' );
			if ( $has_activity( $date ) ) {
				$streak++;
			} else {
				break;
			}
			$current = $current->modify( '-1 day' );
		}

		return $streak;
	}

	private static function has_consistency_comeback_window( int $user_id ): bool {
		global $wpdb;
		$dates = $wpdb->get_col( $wpdb->prepare(
			"SELECT DISTINCT DATE(meal_datetime) AS d
			 FROM {$wpdb->prefix}fit_meals
			 WHERE user_id = %d AND DATE(meal_datetime) >= %s
			   AND confirmed = 1
			 ORDER BY d ASC",
			$user_id,
			UserTime::days_ago( $user_id, 29 )
		) );

		if ( count( $dates ) < 4 ) {
			return false;
		}

		for ( $i = 1; $i < count( $dates ) - 2; $i++ ) {
			$gap = ( new \DateTime( $dates[ $i ] ) )->diff( new \DateTime( $dates[ $i - 1 ] ) )->days;
			if ( $gap < 5 ) {
				continue;
			}

			$d1 = new \DateTime( $dates[ $i ] );
			$d2 = new \DateTime( $dates[ $i + 1 ] ?? '' );
			$d3 = new \DateTime( $dates[ $i + 2 ] ?? '' );
			if ( 1 === $d1->diff( $d2 )->days && 1 === $d2->diff( $d3 )->days ) {
				return true;
			}
		}

		return false;
	}
}
