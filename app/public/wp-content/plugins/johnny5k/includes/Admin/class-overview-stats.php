<?php
namespace Johnny5k\Admin;

defined( 'ABSPATH' ) || exit;

class OverviewStats {

	public static function get(): array {
		global $wpdb;
		$p = $wpdb->prefix;

		return [
			'registered_users' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_user_profiles" ),
			'onboarding_complete' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_user_profiles WHERE onboarding_complete = 1" ),
			'workout_sessions' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_workout_sessions WHERE completed = 1" ),
			'meals_logged' => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}fit_meals WHERE confirmed = 1" ),
		];
	}
}
