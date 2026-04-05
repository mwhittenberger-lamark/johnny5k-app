<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;

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

		register_rest_route( $ns, '/dashboard/photo', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'upload_progress_photo' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/photos', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'list_progress_photos' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/photo/(?P<id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ __CLASS__, 'serve_progress_photo' ],
			'permission_callback' => $auth,
			'args'                => [ 'id' => [ 'required' => true, 'type' => 'integer' ] ],
		] );
	}

	// ── GET /dashboard ────────────────────────────────────────────────────────

	public static function get_daily_snapshot( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$today   = current_time( 'Y-m-d' );
		$tomorrow = date( 'Y-m-d', strtotime( '+1 day', strtotime( $today ) ) );
		$p       = $wpdb->prefix;

		// Calorie goal
		$goal = $wpdb->get_row( $wpdb->prepare(
			"SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g, target_steps, target_sleep_hours, goal_type
			 FROM {$p}fit_user_goals WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		// Meals logged today
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
				'calories'  => $carry['calories']  + (int)   $m->calories,
				'protein_g' => $carry['protein_g'] + (float) $m->protein_g,
				'carbs_g'   => $carry['carbs_g']   + (float) $m->carbs_g,
				'fat_g'     => $carry['fat_g']      + (float) $m->fat_g,
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

		// Today's workout session
		$session = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, planned_day_type, completed, skip_requested, time_tier
			 FROM {$p}fit_workout_sessions WHERE user_id = %d AND session_date = %s",
			$user_id, $today
		) );

		$tomorrow_preview = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, planned_day_type, completed, skip_requested, time_tier
			 FROM {$p}fit_workout_sessions WHERE user_id = %d AND session_date = %s",
			$user_id, $tomorrow
		) );

		if ( ! $tomorrow_preview ) {
			$tomorrow_preview = (object) [
				'date'             => $tomorrow,
				'planned_day_type' => self::infer_next_day_type( $user_id ),
				'time_tier'        => $session->time_tier ?? 'medium',
				'inferred'         => true,
			];
		} else {
			$tomorrow_preview->date = $tomorrow;
			$tomorrow_preview->inferred = false;
		}

		// Sleep last night
		$sleep = $wpdb->get_row( $wpdb->prepare(
			"SELECT hours_sleep, sleep_quality FROM {$p}fit_sleep_logs
			 WHERE user_id = %d AND sleep_date = %s",
			$user_id, date( 'Y-m-d', strtotime( '-1 day' ) )
		) );

		// Steps today
		$steps = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT steps FROM {$p}fit_step_logs WHERE user_id = %d AND step_date = %s",
			$user_id, $today
		) );

		// Latest weight
		$latest_weight = $wpdb->get_row( $wpdb->prepare(
			"SELECT weight_lb, metric_date FROM {$p}fit_body_metrics
			 WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );

		// 7-day score (total from daily_scores)
		$score_7d = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT SUM(total_score) FROM {$p}fit_daily_scores
			 WHERE user_id = %d AND score_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
			$user_id
		) );

		// Skip warning?
		$skip_count = \Johnny5k\Services\TrainingEngine::rolling_skip_count( $user_id );
		$streaks = [
			'logging_days'  => self::count_meal_streak( $user_id ),
			'training_days' => self::count_workout_streak( $user_id ),
			'sleep_days'    => self::count_sleep_streak( $user_id ),
			'cardio_days'   => self::count_cardio_streak( $user_id ),
		];

		return new \WP_REST_Response( [
			'date'             => $today,
			'goal'             => $goal,
			'nutrition_totals' => $nutrition_totals,
			'micronutrient_totals' => $micronutrient_totals,
			'meals_today'      => $meals_today,
			'session'          => $session,
			'tomorrow_preview' => $tomorrow_preview,
			'sleep'            => $sleep,
			'steps'            => [ 'today' => $steps, 'target' => (int) ( $goal->target_steps ?? 8000 ) ],
			'latest_weight'    => $latest_weight,
			'score_7d'         => $score_7d,
			'streaks'          => $streaks,
			'skip_count_30d'   => $skip_count,
			'skip_warning'     => $skip_count >= 3,
		] );
	}

	// ── GET /dashboard/awards ─────────────────────────────────────────────────

	public static function get_awards( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();

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

		return new \WP_REST_Response( [
			'earned'     => $earned,
			'all_awards' => $all_awards,
		] );
	}

	// ── POST /dashboard/photo ─────────────────────────────────────────────────

	public static function upload_progress_photo( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();

		$files = $req->get_file_params();
		if ( empty( $files['photo'] ) ) {
			return new \WP_REST_Response( [ 'message' => 'No photo file provided.' ], 400 );
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

		// Restrict direct URL access — mark as private so we serve via authenticated endpoint
		update_post_meta( $attachment_id, 'jf_private_photo', 1 );
		update_post_meta( $attachment_id, 'jf_owner_user_id', $user_id );

		global $wpdb;
		$angle = sanitize_text_field( $req->get_param( 'angle' ) ?: 'front' );
		$date  = sanitize_text_field( $req->get_param( 'date' ) ?: current_time( 'Y-m-d' ) );

		$wpdb->insert( $wpdb->prefix . 'fit_progress_photos', [
			'user_id'       => $user_id,
			'photo_date'    => $date,
			'angle'         => $angle,
			'attachment_id' => $attachment_id,
		] );
		$photo_id = (int) $wpdb->insert_id;

		// Grant award
		\Johnny5k\Services\AwardEngine::grant( $user_id, 'first_progress_photo' );

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

		$photos = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, photo_date, angle, created_at
			 FROM {$wpdb->prefix}fit_progress_photos
			 WHERE user_id = %d ORDER BY photo_date DESC",
			$user_id
		) );

		// Add signed REST URL for each photo (no direct media URL exposed)
		foreach ( $photos as $photo ) {
			$photo->url = rest_url( JF_REST_NAMESPACE . '/dashboard/photo/' . $photo->id );
		}

		return new \WP_REST_Response( $photos );
	}

	// ── GET /dashboard/photo/{id} — serve photo file ─────────────────────────

	public static function serve_progress_photo( \WP_REST_Request $req ): mixed {
		global $wpdb;
		$user_id  = get_current_user_id();
		$photo_id = (int) $req->get_param( 'id' );

		$photo = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}fit_progress_photos WHERE id = %d AND user_id = %d",
			$photo_id, $user_id
		) );

		if ( ! $photo ) {
			return new \WP_REST_Response( [ 'message' => 'Photo not found.' ], 404 );
		}

		$file_path = get_attached_file( (int) $photo->attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return new \WP_REST_Response( [ 'message' => 'Photo file not found.' ], 404 );
		}

		$mime = mime_content_type( $file_path ) ?: 'image/jpeg';

		// Output directly with proper headers — halts REST layer
		header( 'Content-Type: ' . $mime );
		header( 'Content-Length: ' . filesize( $file_path ) );
		header( 'Cache-Control: private, max-age=300' );
		readfile( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}

	private static function infer_next_day_type( int $user_id ): string {
		global $wpdb;
		$p = $wpdb->prefix;

		$plan_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_user_training_plans WHERE user_id = %d AND active = 1 ORDER BY created_at DESC LIMIT 1",
			$user_id
		) );

		if ( ! $plan_id ) {
			return 'rest';
		}

		$last_day_type = $wpdb->get_var( $wpdb->prepare(
			"SELECT planned_day_type FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND completed = 1
			 ORDER BY session_date DESC LIMIT 1",
			$user_id
		) );

		$days = $wpdb->get_results( $wpdb->prepare(
			"SELECT day_type FROM {$p}fit_user_training_days
			 WHERE training_plan_id = %d AND day_type != 'rest'
			 ORDER BY day_order",
			$plan_id
		) );

		if ( ! $days ) {
			return 'rest';
		}

		$types = array_map( fn( $day ) => $day->day_type, $days );

		if ( ! $last_day_type ) {
			return $types[0];
		}

		$index = array_search( $last_day_type, $types, true );
		if ( false === $index ) {
			return $types[0];
		}

		return $types[ ( $index + 1 ) % count( $types ) ];
	}

	private static function count_meal_streak( int $user_id ): int {
		global $wpdb;
		return self::count_consecutive_days( function( string $date ) use ( $wpdb, $user_id ): bool {
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
		return self::count_consecutive_days( function( string $date ) use ( $wpdb, $user_id ): bool {
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_workout_sessions
				 WHERE user_id = %d AND session_date = %s AND completed = 1",
				$user_id, $date
			) );
			return $count > 0;
		} );
	}

	private static function count_sleep_streak( int $user_id ): int {
		global $wpdb;
		return self::count_consecutive_days( function( string $date ) use ( $wpdb, $user_id ): bool {
			$hours = (float) $wpdb->get_var( $wpdb->prepare(
				"SELECT hours_sleep FROM {$wpdb->prefix}fit_sleep_logs WHERE user_id = %d AND sleep_date = %s",
				$user_id, $date
			) );
			return $hours >= 7.0;
		} );
	}

	private static function count_cardio_streak( int $user_id ): int {
		global $wpdb;
		return self::count_consecutive_days( function( string $date ) use ( $wpdb, $user_id ): bool {
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}fit_cardio_logs WHERE user_id = %d AND cardio_date = %s",
				$user_id, $date
			) );
			return $count > 0;
		} );
	}

	private static function count_consecutive_days( callable $has_activity ): int {
		$streak = 0;
		$current = new \DateTime( 'today' );

		for ( $i = 0; $i < 30; $i++ ) {
			$date = $current->format( 'Y-m-d' );
			if ( $has_activity( $date ) ) {
				$streak++;
			} else {
				break;
			}
			$current->modify( '-1 day' );
		}

		return $streak;
	}
}
