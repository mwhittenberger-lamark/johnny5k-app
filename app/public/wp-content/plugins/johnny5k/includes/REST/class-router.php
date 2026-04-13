<?php
namespace Johnny5k\REST;

defined( 'ABSPATH' ) || exit;

/**
 * Registers all fit/v1 REST routes.
 * Called from the main plugin file on `rest_api_init`.
 */
class Router {

	public static function register_routes(): void {
		// Core access and onboarding.
		AuthController::register_routes();
		OnboardingController::register_routes();

		// User state and coaching surfaces.
		BodyMetricsController::register_routes();
		DashboardController::register_routes();
		TrainingController::register_routes();
		WorkoutController::register_routes();

		// Nutrition and AI assistants.
		NutritionController::register_routes();
		AiController::register_routes();

		// Reporting and admin.
		AnalyticsController::register_routes();
		PushController::register_routes();
		AdminApiController::register_routes();
	}
}
