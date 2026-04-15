<?php

declare(strict_types=1);

namespace Johnny5k\Tests;

use Johnny5k\REST\AiChatController;
use Johnny5k\Tests\Support\ApiIntegrationTestCase;

class AiLabelApiIntegrationTest extends ApiIntegrationTestCase {
	public function test_label_analysis_accepts_front_and_back_images_with_note(): void {
		$db = $this->wpdb();
		$GLOBALS['johnny5k_test_current_user_id'] = 22;
		$GLOBALS['johnny5k_test_options']['jf_openai_api_key'] = 'test-key';

		$db->expectGetRow( 'SELECT first_name, training_experience FROM wp_fit_user_profiles WHERE user_id = 22', (object) [
			'first_name' => 'Mike',
			'training_experience' => 'intermediate',
		] );
		$db->expectGetRow( 'SELECT * FROM wp_fit_user_profiles WHERE user_id = 22', (object) [
			'user_id' => 22,
			'date_of_birth' => '',
			'starting_weight_lb' => 188.2,
			'height_cm' => 180,
			'sex' => 'male',
			'activity_level' => 'moderate',
			'current_goal' => 'cut',
			'goal_rate' => 'moderate',
		] );
		$db->expectGetRow( 'FROM wp_fit_user_goals', (object) [
			'id' => 14,
			'goal_type' => 'cut',
			'target_calories' => 2300,
			'target_protein_g' => 210,
		] );
		$db->expectGetRow( 'SELECT goal_type, target_calories, target_protein_g FROM wp_fit_user_goals WHERE user_id = 22 AND active = 1', (object) [
			'id' => 14,
			'goal_type' => 'cut',
			'target_calories' => 2300,
			'target_protein_g' => 210,
		] );
		$db->expectGetVar( 'SELECT weight_lb FROM wp_fit_body_metrics', 188.2 );
		$db->expectGetCol( 'SELECT weight_lb FROM wp_fit_body_metrics WHERE user_id = 22 ORDER BY metric_date DESC LIMIT 14', [ 188.2, 189.0 ] );
		for ( $i = 0; $i < 12; $i++ ) {
			$db->expectGetVar( 'SELECT timezone FROM wp_fit_user_profiles WHERE user_id = 22', 'UTC' );
		}
		$db->expectGetVar( 'FROM wp_fit_workout_sessions', 2 );
		$db->expectGetVar( 'SELECT session_date FROM wp_fit_workout_sessions', '2026-04-10' );
		$db->expectGetRow( 'AVG(daily_cal)', (object) [
			'avg_cal' => 2100,
			'avg_pro' => 180,
			'days_logged' => 5,
		] );
		$db->expectGetVar( "source = 'saved_meal'", 2 );
		$db->expectGetVar( 'confirmed = 1 AND DATE(meal_datetime) >=', 7 );
		$db->expectGetVar( 'SELECT meal_datetime FROM wp_fit_meals', '2026-04-10 18:45:00' );
		$db->expectGetResults( 'SELECT mi.food_name, mi.serving_amount, mi.serving_unit', [] );
		$db->expectGetVar( 'completed = 1 ORDER BY session_date DESC, id DESC LIMIT 1', 0 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_pantry_items', 10 );
		$db->expectGetVar( 'SELECT COUNT(*) FROM wp_fit_saved_meals', 4 );
		$db->expectGetRow( 'JOIN wp_fit_saved_meals sm', (object) [
			'name' => 'Chicken Bowl',
			'usage_count' => 2,
		] );

		update_user_meta( 22, 'jf_johnny_follow_ups', [] );
		update_user_meta( 22, 'jf_johnny_follow_up_history', [] );

		$this->queueHttpPostResponse([
			'response' => [ 'code' => 200 ],
			'body' => wp_json_encode([
				'id' => 'resp_label_1',
				'usage' => [
					'input_tokens' => 111,
					'output_tokens' => 42,
				],
				'output' => [
					[
						'type' => 'message',
						'content' => [
							[
								'type' => 'output_text',
								'text' => wp_json_encode([
									'food_name' => 'Protein Granola',
									'brand' => 'Pan Empire',
									'serving_size' => '2/3 cup',
									'calories' => 230,
									'protein_g' => 12,
									'carbs_g' => 28,
									'fat_g' => 8,
									'fiber_g' => 5,
									'sugar_g' => 7,
									'sodium_mg' => 190,
									'micros' => [],
									'fit_summary' => 'Solid high-protein cereal option.',
									'flags' => [ 'balanced macros' ],
									'swap_suggestions' => [
										[ 'title' => 'Add yogurt', 'body' => 'Pair it with Greek yogurt for more protein.' ],
									],
								]),
							],
						],
					],
				],
			]),
		]);

		$req = new \WP_REST_Request( 'POST', '/fit/v1/ai/analyse/label' );
		$req->set_param( 'front_image_base64', 'data:image/jpeg;base64,front-image' );
		$req->set_param( 'back_image_base64', 'data:image/jpeg;base64,back-image' );
		$req->set_param( 'label_note', 'Family size bag. Nutrition panel is on the second photo.' );

		$response = AiChatController::analyse_label( $req );
		$data = $response->get_data();

		self::assertSame( 200, $response->get_status() );
		self::assertSame( 'Protein Granola', $data['food_name'] );
		self::assertSame( 'Pan Empire', $data['brand'] );
		self::assertSame( '2/3 cup', $data['serving_size'] );
		self::assertSame( 230, $data['calories'] );
		self::assertFalse( $data['used_web_search'] );
		self::assertSame( 'label_scan', $data['source']['provider'] );

		$httpCalls = $GLOBALS['johnny5k_test_http_log']['post'];
		self::assertCount( 1, $httpCalls );
		self::assertSame( 'https://api.openai.com/v1/responses', $httpCalls[0]['url'] );

		$payload = json_decode( (string) ( $httpCalls[0]['args']['body'] ?? '' ), true );
		$content = $payload['input'][1]['content'] ?? [];

		self::assertSame( 'input_text', $content[0]['type'] ?? '' );
		self::assertStringContainsString( 'Family size bag. Nutrition panel is on the second photo.', (string) ( $content[0]['text'] ?? '' ) );
		self::assertSame( 'input_image', $content[1]['type'] ?? '' );
		self::assertSame( 'data:image/jpeg;base64,front-image', $content[1]['image_url'] ?? '' );
		self::assertSame( 'input_image', $content[2]['type'] ?? '' );
		self::assertSame( 'data:image/jpeg;base64,back-image', $content[2]['image_url'] ?? '' );
	}
}