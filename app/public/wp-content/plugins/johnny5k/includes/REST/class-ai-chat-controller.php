<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

use Johnny5k\Services\AiService;

class AiChatController extends RestController {

	public static function register_routes(): void {
		$ns   = JF_REST_NAMESPACE;
		$auth = self::auth_callback();

		register_rest_route( $ns, '/ai/chat', [
			'methods'             => 'POST',
			'callback'            => [ __CLASS__, 'chat' ],
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

		if ( ! $message ) {
			return self::message( 'No message provided.', 400 );
		}

		$thread_key = 'u' . $user_id . '_' . $thread_key;
		$result     = AiService::chat( $user_id, $thread_key, $message, $mode, $context );

		if ( is_wp_error( $result ) ) {
			return new \WP_REST_Response( [ 'message' => $result->get_error_message() ], 500 );
		}

		return self::response( [
			'reply'             => $result['reply'],
			'actions'           => $result['actions'] ?? [],
			'sources'           => $result['sources'] ?? [],
			'used_web_search'   => (bool) ( $result['used_web_search'] ?? false ),
			'used_tools'        => $result['used_tools'] ?? [],
			'action_results'    => $result['action_results'] ?? [],
			'queued_follow_ups' => $result['queued_follow_ups'] ?? [],
			'why'               => $result['why'] ?? '',
			'context_used'      => $result['context_used'] ?? [],
			'confidence'        => $result['confidence'] ?? '',
		] );
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

			if ( is_array( $value ) ) {
				$clean[ $sanitized_key ] = array_values( array_filter( array_map( static fn( $item ) => sanitize_text_field( (string) $item ), $value ) ) );
				continue;
			}

			$clean[ $sanitized_key ] = sanitize_text_field( (string) $value );
		}

		return $clean;
	}
}
