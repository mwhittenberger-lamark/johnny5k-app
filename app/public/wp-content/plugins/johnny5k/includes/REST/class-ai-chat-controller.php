<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;
use Johnny5k\Services\UserTime;

class AiChatController extends RestController {
	private const PROACTIVE_SUGGESTION_SCREENS = [ 'nutrition', 'saved_meals', 'recipes', 'grocery_gap', 'pantry', 'steps', 'sleep', 'weight', 'workouts', 'cardio', 'workout', 'body', 'activity_log', 'settings' ];
	private const PROACTIVE_SUGGESTION_PRESENTATIONS = [ 'text', 'chart', 'link', 'story', 'meal_idea', 'image', 'none' ];

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = self::auth_callback();

		register_rest_route( $ns, '/ai/chat', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'chat' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/daily-brief', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'daily_brief' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/proactive-suggestion', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'proactive_suggestion' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/exercise-demo', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'exercise_demo' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/analyse/meal', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'analyse_meal' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/analyse/label', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'analyse_label' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/speech', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'synthesize_speech' ],
			'permission_callback' => $auth,
		] );

		register_rest_route( $ns, '/ai/transcribe', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'transcribe_audio' ],
			'permission_callback' => $auth,
		] );

			register_rest_route( $ns, '/ai/analyse/food-text', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'analyse_food_text' ],
				'permission_callback' => $auth,
			] );

			register_rest_route( $ns, '/ai/analyse/meal-text', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'analyse_meal_text' ],
				'permission_callback' => $auth,
			] );

			register_rest_route( $ns, '/ai/analyse/pantry-text', [
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'analyse_pantry_text' ],
				'permission_callback' => $auth,
			] );

		register_rest_route( $ns, '/ai/thread/(?P<key>[a-z0-9_\-]+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_thread' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'clear_thread' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/ai/follow-up/(?P<id>[a-z0-9\-]+)', [
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'update_follow_up' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ __CLASS__, 'dismiss_follow_up' ],
				'permission_callback' => $auth,
			],
		] );

		register_rest_route( $ns, '/ai/memory', [
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'get_memory' ],
				'permission_callback' => $auth,
			],
			[
				'methods'             => 'POST',
				'callback'            => [ __CLASS__, 'update_memory' ],
				'permission_callback' => $auth,
			],
		] );
	}

	public static function chat( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id    = get_current_user_id();
		$message    = sanitize_textarea_field( $req->get_param( 'message' ) ?: '' );
		$thread_key = sanitize_text_field( $req->get_param( 'thread_key' ) ?: 'main' );
		$mode       = sanitize_text_field( $req->get_param( 'mode' ) ?: 'general' );
		$context    = self::sanitize_ai_context_overrides( $req->get_param( 'context' ) );
		$chat_options = self::sanitize_ai_chat_options( $req->get_param( 'chat_options' ) );

		if ( ! $message ) {
			return self::message( 'No message provided.', 400 );
		}

		if ( isset( $chat_options['onboarding_answer'] ) ) {
			$answer_result = OnboardingController::answer_chat_onboarding( $user_id, $chat_options['onboarding_answer'] );
			if ( isset( $answer_result['error'] ) ) {
				return self::message( $answer_result['error'], 409 );
			}
			return self::response( [
				'reply' => $answer_result['reply'],
				'actions' => [],
				'used_tools' => [ 'answer_onboarding' ],
				'action_results' => [ [
					'action' => 'answer_onboarding',
					'ok' => true,
					'onboarding' => $answer_result['onboarding'],
					'completed' => (bool) $answer_result['completed'],
				] ],
				'onboarding_active' => ! $answer_result['completed'],
			] );
		}

		$matched_onboarding_answer = OnboardingController::match_chat_onboarding_answer( $user_id, $message );
		if ( is_array( $matched_onboarding_answer ) ) {
			return self::onboarding_answer_response( $matched_onboarding_answer );
		}

		$thread_key = 'u' . $user_id . '_' . $thread_key;
		$result     = AiService::chat( $user_id, $thread_key, $message, $mode, $context, $chat_options );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		$used_tools     = is_array( $result['used_tools'] ?? null ) ? $result['used_tools'] : [];
		$action_results = is_array( $result['action_results'] ?? null ) ? $result['action_results'] : [];
		$onboarding_active = in_array( 'activate_onboarding', $used_tools, true );

		if ( ! $onboarding_active ) {
			foreach ( $action_results as $action_result ) {
				if ( ! is_array( $action_result ) ) {
					continue;
				}

				$action_name = $action_result['action'] ?? $action_result['tool_name'] ?? '';
				if ( 'activate_onboarding' === $action_name ) {
					$onboarding_active = true;
					break;
				}
			}
		}

		$onboarding_payload = null;
		foreach ( $action_results as $action_result ) {
			if ( is_array( $action_result ) && is_array( $action_result['onboarding'] ?? null ) ) {
				$onboarding_payload = $action_result['onboarding'];
				break;
			}
		}

		return self::response( [
			'reply'             => $onboarding_active && $onboarding_payload ? $onboarding_payload['prompt'] : $result['reply'],
			'actions'           => $result['actions'] ?? [],
			'sources'           => $result['sources'] ?? [],
			'used_web_search'   => (bool) ( $result['used_web_search'] ?? false ),
			'used_tools'        => $used_tools,
			'action_results'    => $action_results,
			'onboarding_active' => $onboarding_active,
			'tool_errors'       => $result['tool_errors'] ?? [],
			'queued_follow_ups' => $result['queued_follow_ups'] ?? [],
			'why'               => $result['why'] ?? '',
			'context_used'      => $result['context_used'] ?? [],
			'confidence'        => $result['confidence'] ?? '',
		] );
	}

	private static function onboarding_answer_response( array $answer_result ): \WP_REST_Response {
		if ( isset( $answer_result['error'] ) ) return self::message( $answer_result['error'], 409 );
		return self::response( [
			'reply' => $answer_result['reply'],
			'actions' => [],
			'used_tools' => [ 'answer_onboarding' ],
			'action_results' => [ [
				'action' => 'answer_onboarding',
				'ok' => true,
				'onboarding' => $answer_result['onboarding'],
				'completed' => (bool) $answer_result['completed'],
			] ],
			'onboarding_active' => ! $answer_result['completed'],
		] );
	}

	public static function daily_brief( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id  = get_current_user_id();
		$timezone = UserTime::timezone( $user_id );
		$now      = new \DateTimeImmutable( 'now', $timezone );
		$today    = $now->format( 'Y-m-d' );
		$yesterday = $now->modify( '-1 day' )->format( 'Y-m-d' );
		$meta_key = 'jf_johnny_daily_brief_date';
		$first_interaction = get_user_meta( $user_id, $meta_key, true ) !== $today;

		if ( $first_interaction ) {
			update_user_meta( $user_id, $meta_key, $today );
		}

		$snapshot = DashboardController::get_daily_snapshot_data( $user_id );
		$readiness_input = is_array( $req->get_param( 'readiness' ) ) ? $req->get_param( 'readiness' ) : [];
		$readiness = [
			'energy' => self::limit_suggestion_text( sanitize_text_field( (string) ( $readiness_input['energy'] ?? '' ) ), 24 ),
			'body'   => self::limit_suggestion_text( sanitize_text_field( (string) ( $readiness_input['body'] ?? '' ) ), 24 ),
			'head'   => self::limit_suggestion_text( sanitize_text_field( (string) ( $readiness_input['head'] ?? '' ) ), 24 ),
		];
		$intro_message = '';
		$coach_feedback = '';
		$coach_tips = [];
		if ( ! in_array( '', $readiness, true ) ) {
			$intro_cache_key = 'jf_daily_brief_coaching_v2_' . $user_id . '_' . md5( $today . '|' . implode( '|', $readiness ) );
			$cached_coaching = get_transient( $intro_cache_key );
			if ( is_array( $cached_coaching ) ) {
				$intro_message = (string) ( $cached_coaching['intro_message'] ?? '' );
				$coach_feedback = (string) ( $cached_coaching['coach_feedback'] ?? '' );
				$coach_tips = is_array( $cached_coaching['coach_tips'] ?? null ) ? $cached_coaching['coach_tips'] : [];
			}
			if ( '' === $intro_message || '' === $coach_feedback ) {
				$intro_prompt = 'Create the personalized coaching opening for this user’s private daily fitness briefing. '
					. 'Sound like Johnny: warm, observant, concise, confident, and human. Carefully interpret readiness together with the live facts. '
					. 'The intro should inspire without a quotation, cliché, diagnosis, shame, invented fact, greeting, heading, or instruction; maximum 18 words. '
					. 'The feedback should be 2 concise sentences, name the most meaningful relationship between readiness and logged stats, and explain what it means for today. '
					. 'Return exactly 2 specific tips, each under 18 words. Tips must fit the time of day and current data. Do not always mention water; recommend hydration only when the context supports it. '
					. 'Never treat missing data as zero, invent a trend, or claim a workout is approved, queued, or active unless the context confirms it. '
					. 'Return JSON only as {"intro":string,"feedback":string,"tips":[string,string]}. Context: ' . wp_json_encode( [
						'local_day'       => $now->format( 'l' ),
						'local_hour'      => (int) $now->format( 'G' ),
						'readiness'       => $readiness,
						'latest_weight'   => $snapshot['latest_weight'] ?? null,
						'sleep'           => $snapshot['sleep'] ?? null,
						'nutrition'       => $snapshot['nutrition_totals'] ?? [],
						'goal'            => $snapshot['goal'] ?? null,
						'training_status' => $snapshot['training_status'] ?? [],
						'today_schedule'  => $snapshot['today_schedule'] ?? null,
						'week_attendance' => $snapshot['week_attendance'] ?? [],
						'recovery_summary'=> $snapshot['recovery_summary'] ?? null,
						'steps'           => $snapshot['steps'] ?? null,
						'score_7d'        => $snapshot['score_7d'] ?? null,
						'streaks'         => $snapshot['streaks'] ?? null,
						'skip_count_30d'  => $snapshot['skip_count_30d'] ?? null,
					] );
				$intro_result = AiService::preview_json( $user_id, $intro_prompt, 'accountability', [
					'screen'   => 'daily_briefing',
					'pathname' => '/dashboard',
				] );
				if ( ! is_wp_error( $intro_result ) ) {
					$intro_message = self::limit_suggestion_text( sanitize_text_field( (string) ( $intro_result['data']['intro'] ?? '' ) ), 180 );
					$coach_feedback = self::limit_suggestion_text( sanitize_textarea_field( (string) ( $intro_result['data']['feedback'] ?? '' ) ), 480 );
					$coach_tips = array_slice( array_values( array_filter( array_map( static fn( $tip ): string => sanitize_text_field( (string) $tip ), (array) ( $intro_result['data']['tips'] ?? [] ) ) ) ), 0, 2 );
					if ( '' !== $intro_message && '' !== $coach_feedback ) {
						set_transient( $intro_cache_key, compact( 'intro_message', 'coach_feedback', 'coach_tips' ), 6 * HOUR_IN_SECONDS );
					}
				}
			}
		}
		$yesterday_calories = (int) round( (float) $wpdb->get_var( $wpdb->prepare(
			"SELECT COALESCE(SUM(mi.calories), 0)
			 FROM {$wpdb->prefix}fit_meals m
			 LEFT JOIN {$wpdb->prefix}fit_meal_items mi ON mi.meal_id = m.id
			 WHERE m.user_id = %d AND DATE(m.meal_datetime) = %s AND m.confirmed = 1",
			$user_id,
			$yesterday
		) ) );

		return new \WP_REST_Response( [
			'first_interaction' => $first_interaction,
			'date'              => $today,
			'timezone'          => $timezone->getName(),
			'local_hour'        => (int) $now->format( 'G' ),
			'intro_message'     => $intro_message,
			'coach_feedback'    => $coach_feedback,
			'coach_tips'        => $coach_tips,
			'latest_weight'     => $snapshot['latest_weight'] ?? null,
			'yesterday'         => [
				'date'     => $yesterday,
				'calories' => $yesterday_calories,
			],
			'sleep'             => $snapshot['sleep'] ?? null,
			'training_status'   => $snapshot['training_status'] ?? [],
			'today_schedule'    => $snapshot['today_schedule'] ?? null,
			'week_attendance'   => $snapshot['week_attendance'] ?? [],
		] );
	}

	public static function proactive_suggestion( \WP_REST_Request $req ): \WP_REST_Response {
		return new \WP_REST_Response( self::generate_proactive_suggestion_for_user( get_current_user_id() ) );
	}

	public static function generate_proactive_suggestion_for_user( int $user_id ): array {
		global $wpdb;
		if ( $user_id <= 0 ) {
			return [ 'suggestion' => null ];
		}
		$cache_key = 'jf_proactive_suggestion_' . $user_id;
		$cached = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$snapshot = DashboardController::get_daily_snapshot_data( $user_id );
		$thread_key = 'u' . $user_id . '_main';
		$recent_messages = $wpdb->get_results( $wpdb->prepare(
			"SELECT m.role, m.message_text
			 FROM {$wpdb->prefix}fit_ai_messages m
			 JOIN {$wpdb->prefix}fit_ai_threads t ON t.id = m.thread_id
			 WHERE t.user_id = %d AND t.thread_key = %s AND m.role IN ('user','assistant')
			 ORDER BY m.id DESC LIMIT 8",
			$user_id,
			$thread_key
		), ARRAY_A );
		$recent_messages = array_reverse( is_array( $recent_messages ) ? $recent_messages : [] );
		$recent_messages = array_map( static function( array $message ): array {
			return [
				'role' => 'user' === ( $message['role'] ?? '' ) ? 'user' : 'assistant',
				'message_text' => self::limit_suggestion_text( (string) ( $message['message_text'] ?? '' ), 800 ),
			];
		}, $recent_messages );

		$today_context = [
			'date'                 => $snapshot['date'] ?? '',
			'goal'                 => $snapshot['goal'] ?? null,
			'nutrition_totals'     => $snapshot['nutrition_totals'] ?? [],
			'micronutrient_totals' => $snapshot['micronutrient_totals'] ?? [],
			'meals_today'          => $snapshot['meals_today'] ?? [],
			'training_status'      => $snapshot['training_status'] ?? [],
			'today_schedule'       => $snapshot['today_schedule'] ?? null,
			'sleep'                => $snapshot['sleep'] ?? null,
			'steps'                => $snapshot['steps'] ?? [],
			'latest_weight'        => $snapshot['latest_weight'] ?? null,
			'pending_follow_ups'   => $snapshot['pending_follow_ups'] ?? [],
		];

		$prompt = 'Evaluate whether there is one genuinely useful, timely suggestion to offer this user right now. '
			. 'Use their local time, goals, everything logged today, meaningful gaps still remaining, and the recent conversation. '
			. 'Possible categories include a missing log, next meal idea, hydration, movement, sleep preparation, recovery, a healthy-living nudge, a short inspirational micro-story, or occasionally a fun Johnny image that meaningfully celebrates progress or inspires the user. '
			. 'Do not nag, repeat the recent conversation, manufacture urgency, diagnose, or offer a suggestion merely to fill space. '
			. 'For inspirational stories, do not invent claims about identifiable real people. '
			. 'Return JSON only with exactly this shape: '
			. '{"has_suggestion":boolean,"label":string,"title":string,"subtitle":string,"action_type":"chat|daily_checkin|nutrition|progress_diary|open_screen|none","screen":"nutrition|saved_meals|recipes|grocery_gap|pantry|steps|sleep|weight|workouts|cardio|workout|body|activity_log|settings|none","presentation":"text|chart|link|story|meal_idea|image|none","prompt":string}. '
			. 'Keep label under 24 characters, title under 56 characters, and subtitle under 72 characters. '
			. 'Use open_screen when the best next step is an existing app destination. Use chat with a precise prompt when Johnny should answer with a chart, useful source link, meal idea, inspirational story, Johnny image, or explanation. For presentation image, explicitly ask for an image of Johnny so his official likeness reference is used. '
			. 'If has_suggestion is false, use empty strings and action_type none. '
			. "Today's live snapshot: " . wp_json_encode( $today_context ) . '. '
			. 'Recent conversation: ' . wp_json_encode( $recent_messages ) . '.';

		$result = AiService::preview_json( $user_id, $prompt, 'accountability', [
			'screen'              => 'johnny_home',
			'pathname'            => '/dashboard',
		] );

		if ( is_wp_error( $result ) ) {
			return [ 'suggestion' => null ];
		}

		$suggestion = self::normalize_proactive_suggestion( $result['data'] ?? [] );
		$response = [ 'suggestion' => $suggestion ];
		set_transient( $cache_key, $response, 105 );

		return $response;
	}

	private static function normalize_proactive_suggestion( array $data ): ?array {
		if ( empty( $data['has_suggestion'] ) ) {
			return null;
		}

		$action_type = sanitize_key( (string) ( $data['action_type'] ?? 'none' ) );
		if ( ! in_array( $action_type, [ 'chat', 'daily_checkin', 'nutrition', 'progress_diary', 'open_screen' ], true ) ) {
			return null;
		}
		$screen = sanitize_key( (string) ( $data['screen'] ?? 'none' ) );
		$presentation = sanitize_key( (string) ( $data['presentation'] ?? 'none' ) );
		if ( ! in_array( $presentation, self::PROACTIVE_SUGGESTION_PRESENTATIONS, true ) ) {
			$presentation = 'text';
		}
		if ( 'open_screen' === $action_type && ! in_array( $screen, self::PROACTIVE_SUGGESTION_SCREENS, true ) ) {
			return null;
		}

		$title = self::limit_suggestion_text( sanitize_text_field( (string) ( $data['title'] ?? '' ) ), 56 );
		$subtitle = self::limit_suggestion_text( sanitize_text_field( (string) ( $data['subtitle'] ?? '' ) ), 72 );
		$prompt = self::limit_suggestion_text( sanitize_textarea_field( (string) ( $data['prompt'] ?? '' ) ), 500 );
		if ( '' === $title || ( 'chat' === $action_type && '' === $prompt ) ) {
			return null;
		}

		return [
			'label'       => self::limit_suggestion_text( sanitize_text_field( (string) ( $data['label'] ?? 'Johnny suggests' ) ), 24 ) ?: 'Johnny suggests',
			'title'       => $title,
			'subtitle'    => $subtitle,
			'action_type' => $action_type,
			'screen'      => $screen,
			'presentation'=> $presentation,
			'prompt'      => $prompt,
		];
	}

	private static function limit_suggestion_text( string $text, int $length ): string {
		return function_exists( 'mb_substr' ) ? mb_substr( $text, 0, $length ) : substr( $text, 0, $length );
	}

	public static function exercise_demo( \WP_REST_Request $req ): \WP_REST_Response {
		$name = sanitize_text_field( (string) ( $req->get_param( 'exercise_name' ) ?: '' ) );
		if ( '' === $name ) {
			return self::message( 'An exercise name is required.', 400 );
		}

		$result = AiService::find_exercise_demo( get_current_user_id(), $name, [
			'equipment'      => sanitize_text_field( (string) ( $req->get_param( 'equipment' ) ?: '' ) ),
			'primary_muscle' => sanitize_text_field( (string) ( $req->get_param( 'primary_muscle' ) ?: '' ) ),
		] );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 502 );
		}

		return new \WP_REST_Response( $result, 200 );
	}

	public static function analyse_meal( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$image   = $req->get_param( 'image_base64' );
		$meal_note = sanitize_textarea_field( (string) ( $req->get_param( 'meal_note' ) ?: '' ) );

		if ( ! $image ) {
			return self::message( 'No image provided.', 400 );
		}

		$result = AiService::analyse_food_image( $user_id, $image, 'meal_photo', $meal_note );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function analyse_label( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$front_image = $req->get_param( 'front_image_base64' );
		$back_image  = $req->get_param( 'back_image_base64' );
		$image       = $req->get_param( 'image_base64' );
		$label_note  = sanitize_textarea_field( (string) ( $req->get_param( 'label_note' ) ?: '' ) );
		$images      = array_values( array_filter( [ $front_image, $back_image, $image ] ) );

		if ( empty( $images ) ) {
			return new \WP_REST_Response( [ 'message' => 'No image provided.' ], 400 );
		}

		$result = AiService::analyse_food_image( $user_id, $images, 'food_label', $label_note );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function synthesize_speech( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$text = sanitize_textarea_field( (string) ( $req->get_param( 'text' ) ?: '' ) );
		$voice = sanitize_key( (string) ( $req->get_param( 'voice' ) ?: 'alloy' ) );
		$speed = (float) ( $req->get_param( 'speed' ) ?? 1 );
		$format = sanitize_key( (string) ( $req->get_param( 'format' ) ?: 'mp3' ) );

		if ( '' === trim( $text ) ) {
			return new \WP_REST_Response( [ 'message' => 'No speech text provided.' ], 400 );
		}

		$result = AiService::synthesize_speech( $user_id, $text, [
			'voice' => $voice,
			'speed' => $speed,
			'format' => $format,
		] );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( [
			'audio_base64' => (string) ( $result['audio'] ?? '' ),
			'mime_type' => (string) ( $result['mime_type'] ?? 'audio/mpeg' ),
			'voice' => (string) ( $result['voice'] ?? $voice ),
			'model' => (string) ( $result['model'] ?? '' ),
		] );
	}

	public static function transcribe_audio( \WP_REST_Request $req ): \WP_REST_Response {
		$encoded = (string) ( $req->get_param( 'audio_base64' ) ?: '' );
		$mime_type = sanitize_text_field( (string) ( $req->get_param( 'mime_type' ) ?: 'audio/webm' ) );
		if ( str_contains( $encoded, ',' ) ) $encoded = (string) substr( $encoded, strpos( $encoded, ',' ) + 1 );
		$audio = base64_decode( preg_replace( '/\s+/', '', $encoded ), true );
		if ( false === $audio || '' === $audio ) return new \WP_REST_Response( [ 'message' => 'No valid voice recording was provided.' ], 400 );
		$result = AiService::transcribe_audio( get_current_user_id(), $audio, $mime_type );
		if ( is_wp_error( $result ) ) return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		return new \WP_REST_Response( $result, 200 );
	}

	public static function analyse_food_text( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id   = get_current_user_id();
		$food_text = sanitize_text_field( (string) ( $req->get_param( 'food_text' ) ?: '' ) );

		if ( ! $food_text ) {
			return new \WP_REST_Response( [ 'message' => 'No food text provided.' ], 400 );
		}

		$result = AiService::analyse_food_text( $user_id, $food_text );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function analyse_meal_text( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id   = get_current_user_id();
		$meal_text = sanitize_textarea_field( (string) ( $req->get_param( 'meal_text' ) ?: '' ) );

		if ( ! $meal_text ) {
			return new \WP_REST_Response( [ 'message' => 'No meal text provided.' ], 400 );
		}

		$result = AiService::analyse_meal_text( $user_id, $meal_text );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function analyse_pantry_text( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id     = get_current_user_id();
		$pantry_text = sanitize_textarea_field( (string) ( $req->get_param( 'pantry_text' ) ?: '' ) );

		if ( ! $pantry_text ) {
			return new \WP_REST_Response( [ 'message' => 'No pantry text provided.' ], 400 );
		}

		$result = AiService::analyse_pantry_text( $user_id, $pantry_text );
		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return new \WP_REST_Response( $result );
	}

	public static function get_thread( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$user_id = get_current_user_id();
		$key     = 'u' . $user_id . '_' . sanitize_text_field( $req->get_param( 'key' ) );

		$thread = $wpdb->get_row( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}fit_ai_threads WHERE thread_key = %s AND user_id = %d",
			$key,
			$user_id
		) );

		if ( ! $thread ) {
			return new \WP_REST_Response( [
				'messages'           => [],
				'follow_ups'         => AiService::get_pending_follow_ups( $user_id ),
				'follow_up_overview' => AiService::get_follow_up_overview( $user_id ),
				'durable_memory'     => AiService::get_durable_memory( $user_id ),
			] );
		}

		$messages = $wpdb->get_results( $wpdb->prepare(
			"SELECT role, message_text, tool_payload_json, created_at FROM {$wpdb->prefix}fit_ai_messages
			 WHERE thread_id = %d AND role IN ('user','assistant') ORDER BY id ASC",
			$thread->id
		) );
		$messages = array_map( static function( $message ): array {
			$row = [
				'role'         => $message->role,
				'message_text' => $message->message_text,
				'created_at'   => $message->created_at,
			];

			$meta = json_decode( (string) ( $message->tool_payload_json ?? '' ), true );
			if ( is_array( $meta ) ) {
				if ( isset( $meta['sources'] ) ) {
					$row['sources'] = is_array( $meta['sources'] ) ? $meta['sources'] : [];
				}
				if ( isset( $meta['actions'] ) ) {
					$row['actions'] = is_array( $meta['actions'] ) ? $meta['actions'] : [];
				}
				if ( isset( $meta['used_tools'] ) ) {
					$row['used_tools'] = is_array( $meta['used_tools'] ) ? $meta['used_tools'] : [];
				}
				if ( isset( $meta['action_results'] ) ) {
					$row['action_results'] = is_array( $meta['action_results'] ) ? $meta['action_results'] : [];
				}
				if ( isset( $meta['tool_errors'] ) ) {
					$row['tool_errors'] = is_array( $meta['tool_errors'] ) ? $meta['tool_errors'] : [];
				}
				if ( isset( $meta['why'] ) ) {
					$row['why'] = sanitize_textarea_field( (string) $meta['why'] );
				}
				if ( isset( $meta['context_used'] ) ) {
					$row['context_used'] = is_array( $meta['context_used'] ) ? array_values( array_filter( array_map( 'sanitize_text_field', $meta['context_used'] ) ) ) : [];
				}
				if ( isset( $meta['confidence'] ) ) {
					$row['confidence'] = sanitize_key( (string) $meta['confidence'] );
				}
			}

			return $row;
		}, $messages );

		return new \WP_REST_Response( [
			'messages'           => $messages,
			'follow_ups'         => AiService::get_pending_follow_ups( $user_id ),
			'follow_up_overview' => AiService::get_follow_up_overview( $user_id ),
			'durable_memory'     => AiService::get_durable_memory( $user_id ),
		] );
	}

	public static function clear_thread( \WP_REST_Request $req ): \WP_REST_Response {
		global $wpdb;
		$p       = $wpdb->prefix;
		$user_id = get_current_user_id();
		$key     = 'u' . $user_id . '_' . sanitize_text_field( $req->get_param( 'key' ) );

		$thread_id = (int) $wpdb->get_var( $wpdb->prepare(
			"SELECT id FROM {$p}fit_ai_threads WHERE thread_key = %s AND user_id = %d",
			$key,
			$user_id
		) );

		if ( $thread_id ) {
			$wpdb->delete( $p . 'fit_ai_messages', [ 'thread_id' => $thread_id ] );
			$wpdb->delete( $p . 'fit_ai_threads', [ 'id' => $thread_id ] );
		}

		return new \WP_REST_Response( [ 'cleared' => true ] );
	}

	public static function dismiss_follow_up( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id      = get_current_user_id();
		$follow_up_id = sanitize_text_field( (string) $req->get_param( 'id' ) );

		return new \WP_REST_Response( [
			'dismissed' => AiService::dismiss_follow_up( $user_id, $follow_up_id ),
		] );
	}

	public static function update_follow_up( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id      = get_current_user_id();
		$follow_up_id = sanitize_text_field( (string) $req->get_param( 'id' ) );
		$state        = sanitize_key( (string) ( $req->get_param( 'state' ) ?: 'pending' ) );
		$due_at       = sanitize_text_field( (string) ( $req->get_param( 'due_at' ) ?: '' ) );

		$updated = AiService::update_follow_up_state( $user_id, $follow_up_id, $state, $due_at );
		if ( null === $updated ) {
			return new \WP_REST_Response( [ 'message' => 'Could not update follow-up.' ], 400 );
		}

		return new \WP_REST_Response( [
			'updated'            => $updated,
			'follow_ups'         => AiService::get_pending_follow_ups( $user_id ),
			'follow_up_overview' => AiService::get_follow_up_overview( $user_id ),
		] );
	}

	public static function get_memory( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		return new \WP_REST_Response( [
			'durable_memory'     => AiService::get_durable_memory( $user_id ),
			'follow_up_overview' => AiService::get_follow_up_overview( $user_id ),
		] );
	}

	public static function update_memory( \WP_REST_Request $req ): \WP_REST_Response {
		$user_id = get_current_user_id();
		$bullets = $req->get_param( 'bullets' );
		$profile = $req->get_param( 'profile' );
		$updated = AiService::update_durable_memory(
			$user_id,
			is_array( $bullets ) ? $bullets : [],
			is_array( $profile ) ? $profile : []
		);

		return new \WP_REST_Response( [
			'durable_memory'     => $updated,
			'follow_up_overview' => AiService::get_follow_up_overview( $user_id ),
		] );
	}

	private static function sanitize_ai_context_overrides( $context ): array {
		if ( ! is_array( $context ) ) {
			return [];
		}

		$clean = [];
		foreach ( $context as $key => $value ) {
			$sanitized_key = sanitize_key( (string) $key );
			if ( '' === $sanitized_key ) {
				continue;
			}

			$sanitized_value = self::sanitize_ai_context_value( $value );
			if ( null === $sanitized_value ) {
				continue;
			}

			$clean[ $sanitized_key ] = $sanitized_value;
		}

		return $clean;
	}

	private static function sanitize_ai_chat_options( $options ): array {
		if ( ! is_array( $options ) ) {
			return [];
		}

		$clean = [];
		$thread_history = sanitize_key( (string) ( $options['thread_history'] ?? '' ) );
		if ( in_array( $thread_history, [ 'full', 'short', 'none' ], true ) ) {
			$clean['thread_history'] = $thread_history;
		}

		if ( isset( $options['history_limit'] ) ) {
			$clean['history_limit'] = max( 0, min( 18, (int) $options['history_limit'] ) );
		}

		if ( array_key_exists( 'include_thread_summary', $options ) ) {
			$clean['include_thread_summary'] = rest_sanitize_boolean( $options['include_thread_summary'] );
		}

		if ( array_key_exists( 'refresh_thread_summary', $options ) ) {
			$clean['refresh_thread_summary'] = rest_sanitize_boolean( $options['refresh_thread_summary'] );
		}

		if ( is_array( $options['onboarding_answer'] ?? null ) ) {
			$clean['onboarding_answer'] = [
				'node_id' => sanitize_key( (string) ( $options['onboarding_answer']['node_id'] ?? '' ) ),
				'value' => sanitize_key( (string) ( $options['onboarding_answer']['value'] ?? '' ) ),
				'label' => sanitize_text_field( (string) ( $options['onboarding_answer']['label'] ?? '' ) ),
			];
		}

		return $clean;
	}

	private static function sanitize_ai_context_value( $value ) {
		if ( null === $value ) {
			return null;
		}

		if ( is_bool( $value ) ) {
			return $value;
		}

		if ( is_int( $value ) || is_float( $value ) ) {
			return $value;
		}

		if ( is_object( $value ) ) {
			$value = get_object_vars( $value );
		}

		if ( is_array( $value ) ) {
			$is_list = array_is_list( $value );
			$clean   = [];

			foreach ( $value as $key => $item ) {
				$sanitized_item = self::sanitize_ai_context_value( $item );
				if ( null === $sanitized_item ) {
					continue;
				}

				if ( $is_list ) {
					$clean[] = $sanitized_item;
					continue;
				}

				$sanitized_key = sanitize_key( (string) $key );
				if ( '' === $sanitized_key ) {
					continue;
				}

				$clean[ $sanitized_key ] = $sanitized_item;
			}

			return $clean;
		}

		$clean = sanitize_text_field( (string) $value );
		return '' === $clean ? null : $clean;
	}
}
