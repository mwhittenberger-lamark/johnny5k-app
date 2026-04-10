<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

/**
 * Registers all fit/v1 REST routes.
 * Called from the main plugin file on `rest_api_init`.
 */
class Router {

	public static function register_routes(): void {
		AuthController::register_routes();
		OnboardingController::register_routes();
		BodyMetricsController::register_routes();
		AnalyticsController::register_routes();
		DashboardController::register_routes();
		TrainingController::register_routes();
		WorkoutController::register_routes();
		AiController::register_routes();
		PushController::register_routes();
		AdminApiController::register_routes();
	}
}
