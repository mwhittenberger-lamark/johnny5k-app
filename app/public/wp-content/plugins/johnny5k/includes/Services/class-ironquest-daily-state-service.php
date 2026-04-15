<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class IronQuestDailyStateService {

	public static function get_state( int $user_id, ?string $state_date = null ): array {
		global $wpdb;

		$date  = self::normalize_state_date( $user_id, $state_date );
		$table = $wpdb->prefix . 'fit_ironquest_daily_state';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE user_id = %d AND state_date = %s LIMIT 1",
				$user_id,
				$date
			),
			ARRAY_A
		);

		if ( is_array( $row ) ) {
			return self::normalize_state_row( $row );
		}

		return self::upsert_state( $user_id, $date, [] );
	}

	public static function upsert_state( int $user_id, string $state_date, array $fields ): array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_daily_state';
		$date  = self::normalize_state_date( $user_id, $state_date );
		$existing = self::get_existing_row( $user_id, $date );

		$defaults = [
			'user_id'                => $user_id,
			'state_date'             => $date,
			'meal_quest_complete'    => 0,
			'sleep_quest_complete'   => 0,
			'cardio_quest_complete'  => 0,
			'steps_quest_complete'   => 0,
			'workout_quest_complete' => 0,
			'travel_points_earned'   => 0,
			'bonus_state_json'       => wp_json_encode( [] ),
		];

		$data = array_merge( $existing ?: $defaults, self::sanitize_state_fields( $fields ) );
		unset( $data['id'], $data['created_at'], $data['updated_at'] );

		if ( $existing ) {
			$wpdb->update(
				$table,
				$data,
				[ 'id' => (int) $existing['id'] ],
				[ '%d', '%s', '%d', '%d', '%d', '%d', '%d', '%d', '%s' ],
				[ '%d' ]
			);
		} else {
			$wpdb->insert(
				$table,
				$data,
				[ '%d', '%s', '%d', '%d', '%d', '%d', '%d', '%d', '%s' ]
			);
		}

		return self::get_state( $user_id, $date );
	}

	public static function mark_quest_complete( int $user_id, string $quest_key, ?string $state_date = null ): array {
		$date   = self::normalize_state_date( $user_id, $state_date );
		$column = match ( sanitize_key( $quest_key ) ) {
			'meal' => 'meal_quest_complete',
			'sleep' => 'sleep_quest_complete',
			'cardio' => 'cardio_quest_complete',
			'steps' => 'steps_quest_complete',
			'workout' => 'workout_quest_complete',
			default => '',
		};

		if ( '' === $column ) {
			return self::get_state( $user_id, $date );
		}

		return self::upsert_state( $user_id, $date, [ $column => 1 ] );
	}

	public static function add_travel_points( int $user_id, int $points, ?string $state_date = null ): array {
		$state = self::get_state( $user_id, $state_date );

		return self::upsert_state(
			$user_id,
			(string) ( $state['state_date'] ?? self::normalize_state_date( $user_id, $state_date ) ),
			[
				'travel_points_earned' => max( 0, (int) ( $state['travel_points_earned'] ?? 0 ) + max( 0, $points ) ),
			]
		);
	}

	public static function sync_travel_points_source( int $user_id, string $source_key, int $points, ?string $state_date = null ): array {
		$date  = self::normalize_state_date( $user_id, $state_date );
		$state = self::get_state( $user_id, $date );
		$bonus = is_array( $state['bonus_state'] ?? null ) ? $state['bonus_state'] : [];
		$source = sanitize_key( $source_key );

		if ( '' === $source ) {
			return $state;
		}

		$travel_sources = is_array( $bonus['travel_sources'] ?? null ) ? $bonus['travel_sources'] : [];
		$travel_sources[ $source ] = max( 0, $points );
		$bonus['travel_sources']   = $travel_sources;

		$total_points = 0;
		foreach ( $travel_sources as $travel_points ) {
			$total_points += max( 0, (int) $travel_points );
		}

		return self::upsert_state(
			$user_id,
			$date,
			[
				'travel_points_earned' => $total_points,
				'bonus_state_json'     => $bonus,
			]
		);
	}

	private static function get_existing_row( int $user_id, string $state_date ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'fit_ironquest_daily_state';
		$row   = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE user_id = %d AND state_date = %s LIMIT 1",
				$user_id,
				$state_date
			),
			ARRAY_A
		);

		return is_array( $row ) ? $row : null;
	}

	private static function sanitize_state_fields( array $fields ): array {
		$clean = [];
		foreach ( [ 'meal_quest_complete', 'sleep_quest_complete', 'cardio_quest_complete', 'steps_quest_complete', 'workout_quest_complete' ] as $key ) {
			if ( array_key_exists( $key, $fields ) ) {
				$clean[ $key ] = ! empty( $fields[ $key ] ) ? 1 : 0;
			}
		}
		if ( array_key_exists( 'travel_points_earned', $fields ) ) {
			$clean['travel_points_earned'] = max( 0, (int) $fields['travel_points_earned'] );
		}
		if ( array_key_exists( 'bonus_state_json', $fields ) ) {
			$bonus = $fields['bonus_state_json'];
			$clean['bonus_state_json'] = is_string( $bonus ) ? $bonus : wp_json_encode( $bonus );
		}

		return $clean;
	}

	private static function normalize_state_row( array $row ): array {
		return [
			'id'                    => (int) ( $row['id'] ?? 0 ),
			'user_id'               => (int) ( $row['user_id'] ?? 0 ),
			'state_date'            => (string) ( $row['state_date'] ?? '' ),
			'meal_quest_complete'   => ! empty( $row['meal_quest_complete'] ),
			'sleep_quest_complete'  => ! empty( $row['sleep_quest_complete'] ),
			'cardio_quest_complete' => ! empty( $row['cardio_quest_complete'] ),
			'steps_quest_complete'  => ! empty( $row['steps_quest_complete'] ),
			'workout_quest_complete'=> ! empty( $row['workout_quest_complete'] ),
			'travel_points_earned'  => (int) ( $row['travel_points_earned'] ?? 0 ),
			'bonus_state'           => json_decode( (string) ( $row['bonus_state_json'] ?? '' ), true ) ?: [],
			'created_at'            => (string) ( $row['created_at'] ?? '' ),
			'updated_at'            => (string) ( $row['updated_at'] ?? '' ),
		];
	}

	private static function normalize_state_date( int $user_id, ?string $state_date ): string {
		if ( is_string( $state_date ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $state_date ) ) {
			return $state_date;
		}

		return UserTime::today( $user_id );
	}
}
