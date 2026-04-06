<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;
use Johnny5k\Services\UserTime;

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

		register_rest_route( $ns, '/dashboard/photos/compare', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'compare_progress_photos' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/dashboard/photos/baseline', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'set_progress_photo_baseline' ],
			'permission_callback' => $auth,
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
		$result  = AiService::dashboard_review( $user_id, (bool) $force );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
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
			"SELECT id, session_date, planned_day_type, actual_day_type, completed, skip_requested, time_tier
			 FROM {$p}fit_workout_sessions
			 WHERE user_id = %d AND session_date = %s
			 ORDER BY id DESC
			 LIMIT 1",
			$user_id, $today
		) );

		$tomorrow_preview = $wpdb->get_row( $wpdb->prepare(
			"SELECT id, session_date, planned_day_type, actual_day_type, completed, skip_requested, time_tier
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

		$steps = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT steps FROM {$p}fit_step_logs WHERE user_id = %d AND step_date = %s",
			$user_id, $today
		) );

		$recovery_summary = self::build_recovery_summary( $user_id, $goal, $sleep, $steps );
		$calorie_adjustment_preview = \Johnny5k\Services\CalorieEngine::calculate_weekly_adjustment( $user_id );

		$latest_weight = $wpdb->get_row( $wpdb->prepare(
			"SELECT weight_lb, metric_date FROM {$p}fit_body_metrics
			 WHERE user_id = %d ORDER BY metric_date DESC LIMIT 1",
			$user_id
		) );

		$score_7d = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT SUM(total_score) FROM {$p}fit_daily_scores
			 WHERE user_id = %d AND score_date >= %s",
			$user_id,
			UserTime::days_ago( $user_id, 6 )
		) );

		$skip_count = \Johnny5k\Services\TrainingEngine::rolling_skip_count( $user_id );
		$streaks = [
			'logging_days'  => self::count_meal_streak( $user_id ),
			'training_days' => self::count_workout_streak( $user_id ),
			'sleep_days'    => self::count_sleep_streak( $user_id ),
			'cardio_days'   => self::count_cardio_streak( $user_id ),
		];

		return [
			'date'             => $today,
			'goal'             => $goal,
			'nutrition_totals' => $nutrition_totals,
			'micronutrient_totals' => $micronutrient_totals,
			'meals_today'      => $meals_today,
			'session'          => $session,
			'today_schedule'   => $today_schedule,
			'tomorrow_preview' => $tomorrow_preview,
			'tomorrow_schedule'=> $tomorrow_schedule,
			'sleep'            => $sleep,
			'steps'            => [ 'today' => $steps, 'target' => (int) ( $goal->target_steps ?? 8000 ) ],
			'recovery_summary' => $recovery_summary,
			'calorie_adjustment_preview' => $calorie_adjustment_preview,
			'latest_weight'    => $latest_weight,
			'score_7d'         => $score_7d,
			'streaks'          => $streaks,
			'skip_count_30d'   => $skip_count,
			'skip_warning'     => $skip_count >= 3,
		];
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

		$comparison = AiService::analyse_progress_photo( $user_id, $first_data_url, $second_data_url );
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
			'action' => 'jf_progress_photo',
			'id'     => $photo_id,
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

		$file_path = get_attached_file( (int) $photo->attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
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
		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return new \WP_Error( 'photo_missing', 'Progress photo file not found.' );
		}

		$mime = mime_content_type( $file_path ) ?: 'image/jpeg';
		$contents = file_get_contents( $file_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( false === $contents ) {
			return new \WP_Error( 'photo_read_failed', 'Could not read the progress photo file.' );
		}

		return 'data:' . $mime . ';base64,' . base64_encode( $contents ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	private static function photo_attachment_to_ai_data_url( int $attachment_id ): string|\WP_Error {
		$file_path = get_attached_file( $attachment_id );
		if ( ! $file_path || ! file_exists( $file_path ) ) {
			return new \WP_Error( 'photo_missing', 'Progress photo file not found.' );
		}

		$mime = mime_content_type( $file_path ) ?: 'image/jpeg';
		$allowed_mimes = [ 'image/jpeg', 'image/png', 'image/webp', 'image/gif' ];

		if ( in_array( $mime, $allowed_mimes, true ) ) {
			return self::photo_attachment_to_data_url( $attachment_id );
		}

		if ( ! function_exists( 'wp_get_image_editor' ) ) {
			return new \WP_Error( 'photo_format_unsupported', 'Progress photo format is not supported for AI comparison.' );
		}

		$image_editor = wp_get_image_editor( $file_path );
		if ( is_wp_error( $image_editor ) ) {
			return new \WP_Error( 'photo_convert_failed', 'Progress photo could not be prepared for AI comparison.' );
		}

		$temp_file = wp_tempnam( wp_basename( $file_path ) . '.jpg' );
		if ( ! $temp_file ) {
			return new \WP_Error( 'photo_temp_failed', 'Progress photo could not be prepared for AI comparison.' );
		}

		$saved = $image_editor->save( $temp_file, 'image/jpeg' );
		if ( is_wp_error( $saved ) || empty( $saved['path'] ) ) {
			@unlink( $temp_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
			return new \WP_Error( 'photo_convert_failed', 'Progress photo could not be converted for AI comparison.' );
		}

		$jpeg_contents = file_get_contents( $saved['path'] ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		@unlink( $saved['path'] ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

		if ( false === $jpeg_contents ) {
			return new \WP_Error( 'photo_read_failed', 'Could not read the prepared progress photo file.' );
		}

		return 'data:image/jpeg;base64,' . base64_encode( $jpeg_contents ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	}

	private static function build_recovery_summary( int $user_id, ?object $goal, ?object $sleep, int $steps_today ): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$avg_sleep = (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT AVG(hours_sleep) FROM {$p}fit_sleep_logs
			 WHERE user_id = %d AND sleep_date >= %s",
			$user_id,
			UserTime::days_ago( $user_id, 2 )
		) );

		$cardio_minutes = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT COALESCE(SUM(duration_minutes), 0) FROM {$p}fit_cardio_logs
			 WHERE user_id = %d AND cardio_date >= %s",
			$user_id,
			UserTime::days_ago( $user_id, 6 )
		) );

		$active_flag_rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, flag_type, body_area, severity, notes
			 FROM {$p}fit_user_health_flags
			 WHERE user_id = %d AND active = 1
			 ORDER BY created_at DESC",
			$user_id
		) );
		$active_flags = count( $active_flag_rows );
		$active_flag_items = array_map( static function( object $row ): array {
			$flag_type = ucwords( str_replace( '_', ' ', (string) ( $row->flag_type ?? '' ) ) );
			$body_area = ucwords( str_replace( '_', ' ', (string) ( $row->body_area ?? '' ) ) );
			$label = trim( $flag_type );

			if ( '' !== $body_area ) {
				$label = trim( $label . ': ' . $body_area );
			}

			return [
				'id'       => (int) ( $row->id ?? 0 ),
				'label'    => $label ?: 'Active flag',
				'severity' => (string) ( $row->severity ?? 'low' ),
				'notes'    => (string) ( $row->notes ?? '' ),
			];
		}, is_array( $active_flag_rows ) ? $active_flag_rows : [] );

		$target_sleep = (float) ( $goal->target_sleep_hours ?? 8 );
		$target_steps = (int) ( $goal->target_steps ?? 8000 );
		$last_sleep = (float) ( $sleep->hours_sleep ?? 0 );
		$steps_pct = $target_steps > 0 ? ( $steps_today / $target_steps ) : 0;

		$mode = 'normal';
		$headline = 'Recovery is supporting normal training.';

		if ( $active_flags > 0 || $last_sleep < max( 5.5, $target_sleep - 2 ) ) {
			$mode = 'maintenance';
			$headline = 'Recovery is compromised. Keep training lighter and cleaner today.';
		} elseif ( $avg_sleep < max( 6.5, $target_sleep - 1 ) || $cardio_minutes >= 150 || $steps_pct >= 1.25 ) {
			$mode = 'caution';
			$headline = 'Recovery is mixed. Train well, but keep the session tight and avoid grinding.';
		}

		return [
			'mode'              => $mode,
			'headline'          => $headline,
			'last_sleep_hours'  => $last_sleep,
			'avg_sleep_3d'      => round( $avg_sleep, 1 ),
			'steps_today'       => $steps_today,
			'steps_target'      => $target_steps,
			'cardio_minutes_7d' => $cardio_minutes,
			'active_flags'      => $active_flags,
			'active_flag_items' => $active_flag_items,
			'recommended_time_tier' => 'maintenance' === $mode ? 'short' : ( 'caution' === $mode ? 'medium' : 'full' ),
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
			$current->modify( '-1 day' );
		}

		return $streak;
	}
}
