<?php
namespace Johnny5k\Support;

defined( 'ABSPATH' ) || exit;

class TrainingDayTypes {
	private const LABELS = [
		'push'           => 'Push',
		'pull'           => 'Pull',
		'legs'           => 'Legs',
		'full_body'      => 'Full body',
		'arms_shoulders' => 'Bonus arms + shoulders',
		'chest'          => 'Chest',
		'back'           => 'Back',
		'shoulders'      => 'Shoulders',
		'arms'           => 'Arms',
		'stretching'     => 'Stretching',
		'abs'            => 'Abs / core',
		'cardio'         => 'Cardio',
		'rest'           => 'Rest',
	];

	private const DEFAULT_CYCLE = [ 'push', 'pull', 'legs', 'arms_shoulders', 'cardio' ];
	private const CUSTOM_WORKOUT_FALLBACK = 'arms_shoulders';

	public static function labels(): array {
		return self::LABELS;
	}

	public static function all(): array {
		return array_keys( self::LABELS );
	}

	public static function active(): array {
		return array_values( array_filter(
			self::all(),
			static fn( string $day_type ): bool => 'rest' !== $day_type
		) );
	}

	public static function default_cycle(): array {
		return self::DEFAULT_CYCLE;
	}

	public static function custom_workout_fallback(): string {
		return self::CUSTOM_WORKOUT_FALLBACK;
	}

	public static function normalize( $value ): ?string {
		if ( ! is_string( $value ) || '' === $value ) {
			return null;
		}

		$day_type = sanitize_key( $value );
		return in_array( $day_type, self::all(), true ) ? $day_type : null;
	}

	public static function is_valid( $value ): bool {
		return null !== self::normalize( $value );
	}

	public static function label( string $day_type ): string {
		return self::LABELS[ $day_type ] ?? self::humanize( $day_type );
	}

	public static function ai_list(): string {
		return implode( ', ', self::all() );
	}

	public static function enum_sql(): string {
		$values = array_map(
			static fn( string $day_type ): string => "'" . esc_sql( $day_type ) . "'",
			self::all()
		);

		return 'enum(' . implode( ',', $values ) . ')';
	}

	private static function humanize( string $value ): string {
		return ucwords( str_replace( '_', ' ', sanitize_key( $value ) ) );
	}
}
