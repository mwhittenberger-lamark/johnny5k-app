<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\AiChatController;
use Johnny5k\REST\AiController;
use Johnny5k\REST\AuthController;
use Johnny5k\REST\NutritionController;
use Johnny5k\REST\NutritionRecipeController;
use Johnny5k\REST\Router;
use Johnny5k\Tests\Support\ServiceTestCase;

class RestRouteRegistrationTest extends ServiceTestCase {
	public function test_nested_ai_and_nutrition_controllers_self_register_without_injected_context(): void {
		AiChatController::register_routes();
		NutritionController::register_routes();
		NutritionRecipeController::register_routes();

		$this->assertRouteRegistered( '/ai/chat', [ AiChatController::class, 'chat' ] );
		$this->assertRouteRegistered( '/nutrition/meal', [ NutritionController::class, 'log_meal' ] );
		$this->assertRouteRegistered( '/nutrition/recipes', [ NutritionRecipeController::class, 'get_recipe_suggestions' ] );
	}

	public function test_ai_controller_registers_ai_routes_only(): void {
		AiController::register_routes();

		$this->assertRouteRegistered( '/ai/analyse/label', [ AiChatController::class, 'analyse_label' ] );
		$this->assertRouteNotRegistered( '/nutrition/summary' );
	}

	public function test_router_registers_top_level_and_nested_routes(): void {
		Router::register_routes();

		$this->assertRouteRegistered( '/auth/login', [ AuthController::class, 'login' ], '__return_true' );
		$this->assertRouteRegistered( '/dashboard', [ \Johnny5k\REST\DashboardController::class, 'get_daily_snapshot' ] );
		$this->assertRouteRegistered( '/dashboard/coaching-context', [ \Johnny5k\REST\DashboardController::class, 'get_coaching_context' ] );
		$this->assertRouteRegistered( '/ai/chat', [ AiChatController::class, 'chat' ] );
		$this->assertRouteRegistered( '/nutrition/recipes', [ NutritionRecipeController::class, 'get_recipe_suggestions' ] );
		$this->assertRouteRegistered( '/nutrition/summary', [ NutritionController::class, 'get_nutrition_summary' ] );
	}

	private function assertRouteRegistered(
		string $route,
		array $callback,
		array|string $expected_permission = [ AuthController::class, 'require_auth' ]
	): void {
		foreach ( $GLOBALS['johnny5k_test_registered_routes'] as $registered_route ) {
			if ( $registered_route['namespace'] !== JF_REST_NAMESPACE || $registered_route['route'] !== $route ) {
				continue;
			}

			$args = $registered_route['args'];
			if ( isset( $args['callback'] ) ) {
				$this->assertSame( $callback, $args['callback'] );
				$this->assertSame( $expected_permission, $args['permission_callback'] ?? null );
				return;
			}

			foreach ( $args as $definition ) {
				if ( ( $definition['callback'] ?? null ) === $callback ) {
					$this->assertSame( $expected_permission, $definition['permission_callback'] ?? null );
					return;
				}
			}
		}

		$this->fail( sprintf( 'Route %s was not registered with the expected callback.', $route ) );
	}

	private function assertRouteNotRegistered( string $route ): void {
		foreach ( $GLOBALS['johnny5k_test_registered_routes'] as $registered_route ) {
			if ( $registered_route['namespace'] === JF_REST_NAMESPACE && $registered_route['route'] === $route ) {
				$this->fail( sprintf( 'Route %s should not have been registered.', $route ) );
			}
		}

		$this->addToAssertionCount( 1 );
	}
}
