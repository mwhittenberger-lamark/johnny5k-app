<?php
namespace Johnny5k\Services;

defined( 'ABSPATH' ) || exit;

class SupportGuideService {

	private const OPTION_KEY = 'jf_support_guides';
	private const MAX_GUIDES = 48;
	private const MAX_LIST_ITEMS = 12;

	public static function default_guides(): array {
		return [
			[
				'id' => 'log-meal',
				'title' => 'Log a meal',
				'enabled' => 1,
				'action_label' => 'Open meal logging',
				'route_notice' => 'Johnny opened Nutrition so you can log the meal without hunting around.',
				'summary' => 'Use Nutrition when you need a clean manual log. Add the meal to the right slot, search first if it exists, and only estimate from plain English when search is not good enough.',
				'keywords' => [ 'log meal', 'enter meal', 'add food', 'log food', 'breakfast', 'lunch', 'dinner', 'snack' ],
				'intents' => [ 'how do i log a meal', 'how do i enter a meal', 'how do i add breakfast', 'how do i log dinner' ],
				'route_path' => '/nutrition',
				'route_screen' => 'nutrition',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Walk me through logging this meal cleanly and help me avoid a sloppy entry.',
				'steps' => [
					'Open Nutrition and pick the meal slot you actually ate, not just the first open one.',
					'Search saved or recent foods first so the log stays consistent.',
					'If search is weak, type the food in plain English and let Johnny build the draft.',
					'Check portions before saving so the calories are not quietly wrong.',
				],
				'common_issues' => [
					'Duplicate meals usually happen because users add a second entry instead of editing the meal already logged for today.',
					'When search fails, the fallback is a typed description, not guessing a random close-enough food.',
				],
				'related_tasks' => [ 'Save a meal', 'Review nutrition summary' ],
			],
			[
				'id' => 'log-meal-photo',
				'title' => 'Log a meal from a photo',
				'enabled' => 1,
				'action_label' => 'Open meal photo logging',
				'route_notice' => 'Johnny opened Nutrition so you can snap the meal and confirm it without digging.',
				'summary' => 'Use meal photo logging when the plate is easier to show than describe. The app drafts the foods, but the user still needs to confirm portions before the log is trustworthy.',
				'keywords' => [ 'meal photo', 'photo log', 'snap meal', 'take a food picture', 'picture of my meal' ],
				'intents' => [ 'how do i log a meal from a photo', 'how do i snap my meal', 'can i log food with a picture' ],
				'route_path' => '/nutrition',
				'route_screen' => 'nutrition',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Show me the meal-photo flow and help me clean up the draft before I save it.',
				'steps' => [
					'Open Nutrition and use Snap meal pic from the header.',
					'Take a clear shot that shows the whole plate, not a cropped guess.',
					'Add a note only if the photo misses something important like sauce, toppings, or a drink.',
					'Review the drafted foods and portions before saving anything.',
				],
				'common_issues' => [
					'Bad angles and cluttered photos create bad food guesses, so the right move is retake the shot, not force the draft through.',
					'Photo analysis is a draft, not a final log. Portions still need a human check.',
				],
				'related_tasks' => [ 'Log a meal', 'Scan a food label' ],
			],
			[
				'id' => 'scan-food-label',
				'title' => 'Scan a food label',
				'enabled' => 1,
				'action_label' => 'Open label scan',
				'route_notice' => 'Johnny opened Nutrition so you can scan the label and decide whether to save it or log it now.',
				'summary' => 'Use label scan when the package already tells the truth. The app can extract serving size, macros, and micros, then the user decides whether to save the food, log it now, or both.',
				'keywords' => [ 'scan label', 'food label', 'barcode', 'nutrition facts', 'package label' ],
				'intents' => [ 'how do i scan a label', 'how do i save food from a package', 'can i log a nutrition label' ],
				'route_path' => '/nutrition',
				'route_screen' => 'nutrition',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Walk me through scanning this label and help me decide whether to save it, log it now, or do both.',
				'steps' => [
					'Open Nutrition and use Scan label from the header.',
					'Upload a clear shot of the nutrition facts panel, not just the front of the package.',
					'Check serving size first, then calories, macros, sodium, sugar, and any warnings.',
					'Decide whether the right move is Save food, Quick log, or both.',
				],
				'common_issues' => [
					'Users often trust a blurry parse too quickly. If serving size looks off, retake the photo.',
					'Saving the food for later and logging today are separate actions, and many users want both.',
				],
				'related_tasks' => [ 'Log a meal', 'Save a meal for reuse' ],
			],
			[
				'id' => 'save-meal',
				'title' => 'Save a meal for reuse',
				'enabled' => 1,
				'action_label' => 'Open saved meals',
				'route_notice' => 'Johnny opened Saved Meals so you can build or reuse a repeat meal fast.',
				'summary' => 'Saved meals are for repeatable defaults. Use them when the user eats the same breakfast, lunch, post-workout meal, or fallback dinner often enough that rebuilding it is wasteful.',
				'keywords' => [ 'saved meal', 'save meal', 'meal template', 'repeat meal' ],
				'intents' => [ 'how do i save a meal', 'how do i create a saved meal', 'where are saved meals' ],
				'route_path' => '/nutrition',
				'route_screen' => 'nutrition',
				'focus_section' => 'savedMeals',
				'focus_tab' => '',
				'starter_prompt' => 'Help me build a saved meal that is actually reusable, not a messy one-off.',
				'steps' => [
					'Open Nutrition and jump to Saved meals.',
					'Start a draft and name it something the user will instantly recognize later.',
					'Add the exact foods and serving sizes, not vague placeholders.',
					'Save it and reuse it from the same Saved meals section next time.',
				],
				'common_issues' => [
					'A saved meal with vague portions becomes dead weight because nobody trusts it later.',
				],
				'related_tasks' => [ 'Log a meal', 'Plan the next meal' ],
			],
			[
				'id' => 'plan-workout',
				'title' => 'Plan a workout',
				'enabled' => 1,
				'action_label' => 'Open workout plan',
				'route_notice' => 'Johnny opened Workout so you can review or build the next training move.',
				'summary' => 'Workout is where the user reviews the next session, checks the split, and starts training. If the plan is wrong, Johnny should adjust the smallest thing that solves the problem before rebuilding everything.',
				'keywords' => [ 'plan workout', 'training plan', 'build workout', 'program', 'schedule workout' ],
				'intents' => [ 'how do i plan a workout', 'how do i build a training plan', 'where do i make my workout plan' ],
				'route_path' => '/workout',
				'route_screen' => 'workout',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Help me sort out the next workout without overcomplicating the whole plan.',
				'steps' => [
					'Open Workout and look at the actual day on deck before making changes.',
					'If the user already has a plan, decide whether the issue is the whole plan or just today\'s session.',
					'Use Johnny to create or adjust the plan only when the current setup really misses the mark.',
					'Start the session from Workout once the day looks right.',
				],
				'common_issues' => [
					'If the user only needs one movement changed, swapping the exercise is cleaner than rebuilding the whole program.',
					'Users often ask for a new plan when the real problem is just time, readiness, or one bad exercise choice.',
				],
				'related_tasks' => [ 'Swap a workout exercise', 'Use my exercise library' ],
			],
			[
				'id' => 'swap-exercise',
				'title' => 'Swap a workout exercise',
				'enabled' => 1,
				'action_label' => 'Open exercise swaps',
				'route_notice' => 'Johnny opened Workout so you can swap the exercise from the preview flow.',
				'summary' => 'Exercise swaps should happen from the workout flow, not by mentally rewriting the session. The goal is to keep the day intact while replacing the one movement that is a problem.',
				'keywords' => [ 'swap exercise', 'replace exercise', 'substitute movement', 'exercise library' ],
				'intents' => [ 'how do i swap an exercise', 'how do i replace an exercise in my workout' ],
				'route_path' => '/workout',
				'route_screen' => 'workout',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Help me replace one exercise without breaking the rest of the workout.',
				'steps' => [
					'Open Workout before the session starts.',
					'Use the swap flow on the exact exercise causing the problem.',
					'Check both library matches and personal exercises before giving up.',
					'Save the swap and make sure the rest of the day still looks coherent.',
				],
				'common_issues' => [
					'If there is no clean substitute, save a personal exercise first, then swap that in instead of settling for a bad match.',
				],
				'related_tasks' => [ 'Plan a workout', 'Use my exercise library' ],
			],
			[
				'id' => 'use-exercise-library',
				'title' => 'Use my exercise library',
				'enabled' => 1,
				'action_label' => 'Open exercise library',
				'route_notice' => 'Johnny opened your exercise library so you can manage custom exercises.',
				'summary' => 'The exercise library is where the user keeps custom movements that do not belong in the global catalog. Clean it up here so future swap flows are faster and more accurate.',
				'keywords' => [ 'exercise library', 'custom exercise', 'my exercises', 'personal library' ],
				'intents' => [ 'where is my exercise library', 'how do i add a custom exercise' ],
				'route_path' => '/workout/library',
				'route_screen' => 'workout',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Open my exercise library and help me add, clean up, or reuse my personal exercises.',
				'steps' => [
					'Open the Workout library screen.',
					'Create or edit only the exercises the user owns.',
					'Remove junk entries so swap suggestions stay useful later.',
					'Use those personal exercises inside the workout swap flow when needed.',
				],
				'common_issues' => [
					'Users mix up global exercises with personal ones. Only the personal entries should be edited or deleted here.',
				],
				'related_tasks' => [ 'Swap a workout exercise' ],
			],
			[
				'id' => 'manage-pantry',
				'title' => 'Manage pantry items',
				'enabled' => 1,
				'action_label' => 'Open pantry',
				'route_notice' => 'Johnny opened Pantry so you can work from what is already on hand.',
				'summary' => 'Pantry is what the user already has at home. Keep it clean and current so recipes and grocery-gap suggestions stop feeling random.',
				'keywords' => [ 'pantry', 'add groceries', 'what i have', 'pantry item' ],
				'intents' => [ 'how do i add pantry items', 'where is pantry', 'how do i update what i have at home' ],
				'route_path' => '/nutrition/pantry',
				'route_screen' => 'nutrition',
				'focus_section' => 'pantry',
				'focus_tab' => '',
				'starter_prompt' => 'Help me clean up Pantry so meal planning matches what I actually have on hand.',
				'steps' => [
					'Open Nutrition Pantry.',
					'Add one item, a bulk list, or a spoken list depending on how much needs to change.',
					'Check merged duplicates so the pantry stays usable instead of noisy.',
				],
				'common_issues' => [
					'Pantry is inventory on hand. Missing things belong in Grocery Gap, not here.',
				],
				'related_tasks' => [ 'Use grocery gap', 'Plan dinner with recipes' ],
			],
			[
				'id' => 'use-grocery-gap',
				'title' => 'Use grocery gap',
				'enabled' => 1,
				'action_label' => 'Open grocery gap',
				'route_notice' => 'Johnny opened Grocery Gap so you can fix the missing-items list quickly.',
				'summary' => 'Grocery Gap is the list of what is missing, not what is owned. It is where recipes, planning, and manual adds turn into a practical shopping list.',
				'keywords' => [ 'grocery gap', 'shopping list', 'missing ingredients', 'grocery list' ],
				'intents' => [ 'how do i add to grocery gap', 'where is my grocery list', 'how do i use grocery gap' ],
				'route_path' => '/nutrition',
				'route_screen' => 'nutrition',
				'focus_section' => 'groceryGap',
				'focus_tab' => '',
				'starter_prompt' => 'Help me turn Grocery Gap into a clean shopping list instead of a dump of random missing items.',
				'steps' => [
					'Open Nutrition and jump to Grocery Gap.',
					'Review recipe-driven gaps and any manual adds together.',
					'Clear noise, then mark items shopped when they move into Pantry.',
				],
				'common_issues' => [
					'Users often store owned items in Grocery Gap. If it is already in the kitchen, move it to Pantry instead.',
				],
				'related_tasks' => [ 'Manage pantry items', 'Plan dinner with recipes' ],
			],
			[
				'id' => 'plan-recipes',
				'title' => 'Plan meals with recipes',
				'enabled' => 1,
				'action_label' => 'Open recipes',
				'route_notice' => 'Johnny opened Recipes so you can plan the next meal instead of guessing.',
				'summary' => 'Recipes are for turning goals and pantry reality into an actual next meal. Use them when the user needs a concrete answer, not vague inspiration.',
				'keywords' => [ 'recipes', 'meal ideas', 'plan dinner', 'plan lunch' ],
				'intents' => [ 'how do i plan dinner', 'where are recipe ideas', 'how do i use recipes' ],
				'route_path' => '/nutrition',
				'route_screen' => 'nutrition',
				'focus_section' => 'recipes',
				'focus_tab' => '',
				'starter_prompt' => 'Help me pick the next recipe based on my day, my pantry, and what I am realistically going to cook.',
				'steps' => [
					'Open Nutrition Recipes.',
					'Filter by meal type if the user already knows the slot.',
					'Compare what is on hand with what is missing before recommending a recipe.',
					'Choose the meal that best fits the day, not just the one that sounds best.',
				],
				'common_issues' => [
					'If the user wants repeatability and speed, a saved meal may be the better tool than a recipe.',
				],
				'related_tasks' => [ 'Use grocery gap', 'Save a meal for reuse' ],
			],
			[
				'id' => 'log-sleep-and-steps',
				'title' => 'Log sleep or steps',
				'enabled' => 1,
				'action_label' => 'Open progress',
				'route_notice' => 'Johnny opened Progress on the right tab so you can log it now.',
				'summary' => 'Body is where users log recovery and output markers like sleep, steps, weight, and cardio. The right move is to land them on the correct tab fast and get the metric logged.',
				'keywords' => [ 'sleep', 'steps', 'body', 'cardio', 'weight' ],
				'intents' => [ 'how do i log sleep', 'how do i add steps', 'where do i log cardio' ],
				'route_path' => '/body',
				'route_screen' => 'body',
				'focus_section' => '',
				'focus_tab' => 'sleep',
				'starter_prompt' => 'Get me to the right Body tab and help me log the metric I missed without extra wandering.',
				'steps' => [
					'Open Body.',
					'Land on the tab that matches the metric the user is actually talking about.',
					'Enter the value and save it for today.',
				],
				'common_issues' => [
					'Users sometimes ask for sleep help when they really want recovery coaching. Log the metric first, then coach off the result.',
				],
				'related_tasks' => [ 'Plan recovery' ],
			],
			[
				'id' => 'update-profile',
				'title' => 'Update profile settings',
				'enabled' => 1,
				'action_label' => 'Open profile',
				'route_notice' => 'Johnny opened Profile so you can update your settings without digging.',
				'summary' => 'Profile is the control room for identity, targets, defaults, reminders, and Johnny preferences. Use it when the user needs to change how the app behaves, not just log today\'s data.',
				'keywords' => [ 'profile', 'settings', 'preferences', 'targets', 'defaults', 'profile settings' ],
				'intents' => [ 'where do i update my settings', 'how do i change my profile', 'where do i update my targets' ],
				'route_path' => '/settings',
				'route_screen' => 'settings',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Show me where this setting lives in Profile and get me to the right section fast.',
				'steps' => [
					'Open Profile.',
					'Go straight to the section that matches the change the user wants.',
					'Update the values and save so the app can recalculate targets or defaults if needed.',
				],
				'common_issues' => [
					'Users say settings like it is one screen, but targets, reminders, and voice preferences live in different Profile sections.',
				],
				'related_tasks' => [ 'Manage reminders in settings' ],
			],
			[
				'id' => 'manage-reminders',
				'title' => 'Manage reminders in settings',
				'enabled' => 1,
				'action_label' => 'Open reminders',
				'route_notice' => 'Johnny opened Settings so you can review or cancel reminders.',
				'summary' => 'Reminder management lives in Profile. Use it when the user wants to review, cancel, or sanity-check upcoming reminders that Johnny already scheduled.',
				'keywords' => [ 'reminders', 'text reminder', 'sms reminder', 'notifications', 'settings' ],
				'intents' => [ 'where do i manage reminders', 'how do i cancel a reminder', 'how do i review my text reminders' ],
				'route_path' => '/settings',
				'route_screen' => 'settings',
				'focus_section' => '',
				'focus_tab' => '',
				'starter_prompt' => 'Open Profile and help me review, clean up, or cancel my existing reminders.',
				'steps' => [
					'Open Profile.',
					'Go to the reminder management area.',
					'Review upcoming reminders and cancel the ones that no longer make sense.',
				],
				'common_issues' => [
					'Creating a new reminder and managing an existing one are different jobs. Do not mix them up in the explanation.',
				],
				'related_tasks' => [ 'Schedule a reminder with Johnny' ],
			],
		];
	}

	public static function get_support_guides_config(): array {
		return self::sanitize_support_guides( get_option( self::OPTION_KEY, self::default_guides() ) );
	}

	public static function save_support_guides( $guides ): array {
		$clean = self::sanitize_support_guides( $guides );
		update_option( self::OPTION_KEY, $clean, false );
		return $clean;
	}

	public static function sanitize_support_guides( $guides ): array {
		if ( ! is_array( $guides ) ) {
			return self::default_guides();
		}

		$clean = [];
		foreach ( $guides as $index => $guide ) {
			if ( ! is_array( $guide ) ) {
				continue;
			}

			$id = sanitize_key( (string) ( $guide['id'] ?? '' ) );
			if ( '' === $id ) {
				$id = 'support-guide-' . ( $index + 1 );
			}

			$title = sanitize_text_field( (string) ( $guide['title'] ?? '' ) );
			if ( '' === $title ) {
				$title = 'Untitled guide';
			}

			$clean[] = [
				'id' => $id,
				'title' => $title,
				'enabled' => ! empty( $guide['enabled'] ) ? 1 : 0,
				'action_label' => sanitize_text_field( (string) ( $guide['action_label'] ?? '' ) ),
				'route_notice' => sanitize_textarea_field( (string) ( $guide['route_notice'] ?? '' ) ),
				'summary' => sanitize_textarea_field( (string) ( $guide['summary'] ?? '' ) ),
				'keywords' => self::sanitize_string_list( $guide['keywords'] ?? [] ),
				'intents' => self::sanitize_string_list( $guide['intents'] ?? [] ),
				'route_path' => sanitize_text_field( (string) ( $guide['route_path'] ?? '' ) ),
				'route_screen' => sanitize_key( (string) ( $guide['route_screen'] ?? '' ) ),
				'focus_section' => sanitize_key( (string) ( $guide['focus_section'] ?? '' ) ),
				'focus_tab' => sanitize_key( (string) ( $guide['focus_tab'] ?? '' ) ),
				'starter_prompt' => sanitize_textarea_field( (string) ( $guide['starter_prompt'] ?? '' ) ),
				'steps' => self::sanitize_string_list( $guide['steps'] ?? [] ),
				'common_issues' => self::sanitize_string_list( $guide['common_issues'] ?? [] ),
				'related_tasks' => self::sanitize_string_list( $guide['related_tasks'] ?? [] ),
			];

			if ( count( $clean ) >= self::MAX_GUIDES ) {
				break;
			}
		}

		return empty( $clean ) ? self::default_guides() : array_values( $clean );
	}

	public static function find_relevant_guides( string $message, array $context = [], int $limit = 3 ): array {
		$message = self::normalize_text( $message );
		if ( '' === $message ) {
			return [];
		}

		$current_screen = sanitize_key( (string) ( $context['current_screen'] ?? '' ) );
		$current_path   = strtolower( trim( (string) ( $context['current_path'] ?? '' ) ) );
		$message_tokens = self::tokenize( $message );
		$scored         = [];

		foreach ( self::get_support_guides_config() as $guide ) {
			if ( empty( $guide['enabled'] ) ) {
				continue;
			}

			$score = 0;
			$title_tokens = self::tokenize( (string) ( $guide['title'] ?? '' ) );
			$summary_tokens = self::tokenize( (string) ( $guide['summary'] ?? '' ) );

			foreach ( (array) ( $guide['intents'] ?? [] ) as $intent ) {
				$intent_text = self::normalize_text( (string) $intent );
				if ( '' !== $intent_text && str_contains( $message, $intent_text ) ) {
					$score += 14;
				}
			}

			foreach ( (array) ( $guide['keywords'] ?? [] ) as $keyword ) {
				$keyword_text = self::normalize_text( (string) $keyword );
				if ( '' === $keyword_text ) {
					continue;
				}

				if ( str_contains( $message, $keyword_text ) ) {
					$score += str_contains( $keyword_text, ' ' ) ? 8 : 5;
					continue;
				}

				$keyword_tokens = self::tokenize( $keyword_text );
				$score += 2 * count( array_intersect( $message_tokens, $keyword_tokens ) );
			}

			$score += 2 * count( array_intersect( $message_tokens, $title_tokens ) );
			$score += count( array_intersect( $message_tokens, $summary_tokens ) );

			$route_screen = sanitize_key( (string) ( $guide['route_screen'] ?? '' ) );
			$route_path   = strtolower( trim( (string) ( $guide['route_path'] ?? '' ) ) );
			if ( '' !== $current_screen && '' !== $route_screen && $current_screen === $route_screen ) {
				$score += 3;
			}
			if ( '' !== $current_path && '' !== $route_path && str_starts_with( $current_path, $route_path ) ) {
				$score += 2;
			}

			if ( $score <= 0 ) {
				continue;
			}

			$scored[] = [
				'score' => $score,
				'guide' => $guide,
			];
		}

		usort( $scored, static function( array $left, array $right ): int {
			if ( $left['score'] === $right['score'] ) {
				return strcmp( (string) ( $left['guide']['title'] ?? '' ), (string) ( $right['guide']['title'] ?? '' ) );
			}

			return $right['score'] <=> $left['score'];
		} );

		return array_values( array_map( static fn( array $row ): array => $row['guide'], array_slice( $scored, 0, max( 1, $limit ) ) ) );
	}

	public static function build_prompt_block( string $message, array $context = [] ): string {
		$guides = self::find_relevant_guides( $message, $context, 2 );
		if ( empty( $guides ) ) {
			return '';
		}

		$lines = [
			'App support guide snippets:',
			'Use these as the source of truth for in-app help and navigation before guessing UI details.',
		];

		foreach ( $guides as $guide ) {
			$lines[] = '- Task: ' . (string) ( $guide['title'] ?? '' );
			if ( ! empty( $guide['summary'] ) ) {
				$lines[] = '  Summary: ' . (string) $guide['summary'];
			}
			$payload = array_filter([
				'screen' => (string) ( $guide['route_screen'] ?? '' ),
				'route_path' => (string) ( $guide['route_path'] ?? '' ),
				'focus_section' => (string) ( $guide['focus_section'] ?? '' ),
				'focus_tab' => (string) ( $guide['focus_tab'] ?? '' ),
				'guide_id' => (string) ( $guide['id'] ?? '' ),
				'action_label' => (string) ( $guide['action_label'] ?? '' ),
				'notice' => (string) ( $guide['route_notice'] ?? '' ),
				'starter_prompt' => (string) ( $guide['starter_prompt'] ?? '' ),
			], static fn( $value ): bool => '' !== trim( (string) $value ) );
			if ( ! empty( $payload ) ) {
				$lines[] = '  Open-screen payload: ' . wp_json_encode( $payload );
			}
			$route = trim( (string) ( $guide['route_path'] ?? '' ) );
			if ( '' !== $route ) {
				$route_meta = [];
				if ( ! empty( $guide['focus_section'] ) ) {
					$route_meta[] = 'section ' . $guide['focus_section'];
				}
				if ( ! empty( $guide['focus_tab'] ) ) {
					$route_meta[] = 'tab ' . $guide['focus_tab'];
				}
				$lines[] = '  Route: ' . $route . ( $route_meta ? ' (' . implode( ', ', $route_meta ) . ')' : '' );
			}
			if ( ! empty( $guide['steps'] ) ) {
				$lines[] = '  Steps: ' . implode( ' | ', array_slice( (array) $guide['steps'], 0, 4 ) );
			}
			if ( ! empty( $guide['common_issues'] ) ) {
				$lines[] = '  Common issues: ' . implode( ' | ', array_slice( (array) $guide['common_issues'], 0, 2 ) );
			}
			if ( ! empty( $guide['starter_prompt'] ) ) {
				$lines[] = '  Starter prompt: ' . (string) $guide['starter_prompt'];
			}
		}

		return "\n\n" . implode( "\n", $lines );
	}

	public static function support_analytics_payload( int $days = 30 ): array {
		global $wpdb;

		$days = max( 7, min( 90, $days ) );
		$since_utc = gmdate( 'Y-m-d H:i:s', time() - ( $days * DAY_IN_SECONDS ) );
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT event_name, screen, context, metadata_json, occurred_at
			 FROM {$wpdb->prefix}fit_behavior_events
			 WHERE occurred_at >= %s AND event_name LIKE 'support_%%'
			 ORDER BY occurred_at DESC
			 LIMIT 5000",
			$since_utc
		), ARRAY_A );

		$totals = [
			'entrypoints' => 0,
			'prompts_started' => 0,
			'navigations' => 0,
			'unresolved' => 0,
		];
		$guide_rollup = [];
		$surface_rollup = [];

		foreach ( (array) $rows as $row ) {
			$event_name = sanitize_key( (string) ( $row['event_name'] ?? '' ) );
			$metadata = json_decode( (string) ( $row['metadata_json'] ?? '' ), true );
			$metadata = is_array( $metadata ) ? $metadata : [];
			$guide_id = sanitize_key( (string) ( $metadata['guide_id'] ?? '' ) );
			$surface = sanitize_key( (string) ( $metadata['surface'] ?? $row['screen'] ?? '' ) );

			switch ( $event_name ) {
				case 'support_entrypoint_opened':
					$totals['entrypoints']++;
					self::increment_support_rollup( $guide_rollup, $guide_id, 'entrypoints' );
					self::increment_support_rollup( $surface_rollup, $surface, 'entrypoints' );
					break;
				case 'support_prompt_started':
					$totals['prompts_started']++;
					self::increment_support_rollup( $guide_rollup, $guide_id, 'prompts_started' );
					self::increment_support_rollup( $surface_rollup, $surface, 'prompts_started' );
					break;
				case 'support_navigation_used':
					$totals['navigations']++;
					self::increment_support_rollup( $guide_rollup, $guide_id, 'navigations' );
					self::increment_support_rollup( $surface_rollup, $surface, 'navigations' );
					break;
				case 'support_help_unresolved':
					$totals['unresolved']++;
					self::increment_support_rollup( $guide_rollup, $guide_id, 'unresolved' );
					self::increment_support_rollup( $surface_rollup, $surface, 'unresolved' );
					break;
			}
		}

		return [
			'days' => $days,
			'since_utc' => $since_utc,
			'totals' => $totals,
			'top_guides' => self::format_support_rollup( $guide_rollup, 'guide_id' ),
			'top_surfaces' => self::format_support_rollup( $surface_rollup, 'surface' ),
		];
	}

	private static function sanitize_string_list( $items ): array {
		if ( ! is_array( $items ) ) {
			$items = preg_split( '/\r\n|\r|\n|,/', (string) $items ) ?: [];
		}

		$clean = [];
		foreach ( $items as $item ) {
			$value = sanitize_text_field( trim( (string) $item ) );
			if ( '' === $value ) {
				continue;
			}

			$clean[] = $value;
			if ( count( $clean ) >= self::MAX_LIST_ITEMS ) {
				break;
			}
		}

		return array_values( array_unique( $clean ) );
	}

	private static function normalize_text( string $value ): string {
		$value = strtolower( wp_strip_all_tags( $value ) );
		$value = preg_replace( '/[^a-z0-9\s\/]/', ' ', $value );
		$value = preg_replace( '/\s+/', ' ', (string) $value );
		return trim( (string) $value );
	}

	private static function tokenize( string $value ): array {
		$normalized = self::normalize_text( $value );
		if ( '' === $normalized ) {
			return [];
		}

		$tokens = preg_split( '/\s+/', $normalized ) ?: [];
		$tokens = array_filter( $tokens, static fn( string $token ): bool => strlen( $token ) >= 3 );
		return array_values( array_unique( $tokens ) );
	}

	private static function increment_support_rollup( array &$rollup, string $key, string $metric ): void {
		if ( '' === $key ) {
			$key = 'unknown';
		}

		if ( ! isset( $rollup[ $key ] ) ) {
			$rollup[ $key ] = [
				'entrypoints' => 0,
				'prompts_started' => 0,
				'navigations' => 0,
				'unresolved' => 0,
			];
		}

		$rollup[ $key ][ $metric ]++;
	}

	private static function format_support_rollup( array $rollup, string $label_key ): array {
		$rows = [];
		foreach ( $rollup as $key => $metrics ) {
			$rows[] = array_merge([
				$label_key => $key,
			], $metrics );
		}

		usort( $rows, static function( array $left, array $right ): int {
			$left_total = (int) ( $left['prompts_started'] ?? 0 ) + (int) ( $left['entrypoints'] ?? 0 );
			$right_total = (int) ( $right['prompts_started'] ?? 0 ) + (int) ( $right['entrypoints'] ?? 0 );

			if ( $left_total === $right_total ) {
				return strcmp( (string) reset( $left ), (string) reset( $right ) );
			}

			return $right_total <=> $left_total;
		} );

		return array_slice( $rows, 0, 8 );
	}
	}