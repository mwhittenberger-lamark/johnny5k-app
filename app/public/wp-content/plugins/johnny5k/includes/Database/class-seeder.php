<?php
namespace Johnny5k\Database;

defined( 'ABSPATH' ) || exit;

/**
 * Seeds the exercise library, awards, and default program templates.
 * All inserts use ON DUPLICATE KEY UPDATE so re-running is safe.
 */
class Seeder {

	public static function run(): void {
		self::seed_exercises();
		self::seed_exercise_substitutions();
		self::seed_awards();
		self::seed_program_templates();
	}

	// ── Exercises ─────────────────────────────────────────────────────────────

	private static function seed_exercises(): void {
		global $wpdb;
		$t = $wpdb->prefix . 'fit_exercises';

		$exercises = [
			// Push — main
			[ 'barbell-bench-press',        'Barbell Bench Press',           'horizontal_push', 'chest',     'barbell',     'intermediate', 7, 3, 2, 5, 8,  3, 'double_progression',  '["push"]', '["main"]' ],
			[ 'dumbbell-incline-press',      'Dumbbell Incline Press',        'horizontal_push', 'chest',     'dumbbell',    'intermediate', 8, 2, 1, 8, 12, 3, 'double_progression',  '["push"]', '["main","secondary"]' ],
			[ 'dumbbell-flat-press',         'Dumbbell Flat Press',           'horizontal_push', 'chest',     'dumbbell',    'beginner',     9, 2, 1, 8, 12, 3, 'double_progression',  '["push"]', '["main","secondary"]' ],
			[ 'cable-chest-fly',             'Cable Chest Fly',              'horizontal_push', 'chest',     'cable',       'beginner',     9, 1, 1, 12, 15, 3, 'double_progression', '["push"]', '["accessory"]' ],
			[ 'push-up',                     'Push-Up',                      'horizontal_push', 'chest',     'bodyweight',  'beginner',     10, 1, 1, 10, 20, 3, 'double_progression', '["push"]', '["main","secondary","accessory"]' ],
			[ 'dips',                        'Dips',                         'vertical_push',   'chest',     'bodyweight',  'intermediate', 7, 3, 1, 6, 12, 3, 'double_progression',  '["push"]', '["main","secondary"]' ],
			// Push — triceps
			[ 'tricep-pushdown',             'Tricep Pushdown',              'elbow_extension', 'triceps',   'cable',       'beginner',     10, 1, 1, 10, 15, 3, 'double_progression', '["push","arms_shoulders"]', '["accessory"]' ],
			[ 'skull-crushers',              'Skull Crushers',               'elbow_extension', 'triceps',   'barbell',     'intermediate', 7, 3, 1, 8, 12, 3, 'double_progression',  '["push","arms_shoulders"]', '["accessory"]' ],
			[ 'overhead-tricep-extension',   'Overhead Tricep Extension',    'elbow_extension', 'triceps',   'dumbbell',    'beginner',     9, 1, 1, 10, 15, 3, 'double_progression',  '["push","arms_shoulders"]', '["accessory"]' ],
			[ 'close-grip-bench-press',      'Close Grip Bench Press',       'horizontal_push', 'triceps',   'barbell',     'intermediate', 7, 3, 2, 5, 8,  3, 'double_progression',  '["push","arms_shoulders"]', '["main","accessory"]' ],
			// Shoulders (included in push/pull/legs)
			[ 'overhead-press-barbell',      'Overhead Press (Barbell)',     'vertical_push',   'shoulders', 'barbell',     'intermediate', 6, 4, 3, 4, 8,  3, 'load_progression',    '["push"]', '["main","shoulders"]' ],
			[ 'dumbbell-shoulder-press',     'Dumbbell Shoulder Press',      'vertical_push',   'shoulders', 'dumbbell',    'beginner',     9, 2, 2, 8, 12, 3, 'double_progression',  '["push","arms_shoulders"]', '["main","shoulders"]' ],
			[ 'dumbbell-lateral-raise',      'Dumbbell Lateral Raise',       'shoulder_abduct', 'shoulders', 'dumbbell',    'beginner',     10, 1, 1, 12, 20, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["shoulders","accessory"]' ],
			[ 'cable-lateral-raise',         'Cable Lateral Raise',          'shoulder_abduct', 'shoulders', 'cable',       'beginner',     10, 1, 1, 12, 20, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["shoulders","accessory"]' ],
			[ 'rear-delt-fly',               'Rear Delt Fly',                'shoulder_abduct', 'rear_delt', 'dumbbell',    'beginner',     10, 1, 1, 15, 20, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["shoulders","accessory"]' ],
			[ 'face-pulls',                  'Face Pulls',                   'shoulder_abduct', 'rear_delt', 'cable',       'beginner',     10, 1, 1, 15, 20, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["shoulders","accessory"]' ],
			[ 'arnold-press',                'Arnold Press',                 'vertical_push',   'shoulders', 'dumbbell',    'intermediate', 8, 2, 2, 8, 12, 3, 'double_progression',  '["push","arms_shoulders"]', '["shoulders","main"]' ],
			// Pull — main
			[ 'barbell-row',                 'Barbell Row',                  'horizontal_pull', 'back',      'barbell',     'intermediate', 6, 3, 3, 5, 8,  3, 'load_progression',    '["pull"]', '["main"]' ],
			[ 'dumbbell-row',                'Dumbbell Row',                 'horizontal_pull', 'back',      'dumbbell',    'beginner',     9, 2, 1, 8, 12, 3, 'double_progression',  '["pull"]', '["main","secondary"]' ],
			[ 'cable-row',                   'Cable Row',                    'horizontal_pull', 'back',      'cable',       'beginner',     9, 1, 1, 10, 15, 3, 'double_progression', '["pull"]', '["main","secondary"]' ],
			[ 'lat-pulldown',                'Lat Pulldown',                 'vertical_pull',   'back',      'cable',       'beginner',     9, 1, 1, 8, 12, 3, 'double_progression',  '["pull"]', '["main"]' ],
			[ 'pull-up',                     'Pull-Up',                      'vertical_pull',   'back',      'bodyweight',  'intermediate', 8, 2, 1, 4, 10, 3, 'double_progression',  '["pull"]', '["main"]' ],
			[ 'chin-up',                     'Chin-Up',                      'vertical_pull',   'back',      'bodyweight',  'intermediate', 8, 2, 1, 4, 10, 3, 'double_progression',  '["pull","arms_shoulders"]', '["main"]' ],
			[ 'chest-supported-row',         'Chest Supported Row',          'horizontal_pull', 'back',      'dumbbell',    'beginner',     10, 1, 1, 10, 15, 3, 'double_progression', '["pull"]', '["main","secondary"]' ],
			// Pull — biceps
			[ 'barbell-curl',                'Barbell Curl',                 'elbow_flexion',   'biceps',    'barbell',     'beginner',     9, 2, 1, 8, 12, 3, 'double_progression',  '["pull","arms_shoulders"]', '["accessory"]' ],
			[ 'dumbbell-hammer-curl',        'Hammer Curl',                  'elbow_flexion',   'biceps',    'dumbbell',    'beginner',     9, 1, 1, 10, 15, 3, 'double_progression', '["pull","arms_shoulders"]', '["accessory"]' ],
			[ 'preacher-curl',               'Preacher Curl',                'elbow_flexion',   'biceps',    'barbell',     'intermediate', 8, 2, 1, 8, 12, 3, 'double_progression',  '["pull","arms_shoulders"]', '["accessory"]' ],
			[ 'cable-bicep-curl',            'Cable Bicep Curl',             'elbow_flexion',   'biceps',    'cable',       'beginner',     10, 1, 1, 10, 15, 3, 'double_progression', '["pull","arms_shoulders"]', '["accessory"]' ],
			[ 'concentration-curl',          'Concentration Curl',           'elbow_flexion',   'biceps',    'dumbbell',    'beginner',     10, 1, 1, 10, 15, 3, 'double_progression', '["pull","arms_shoulders"]', '["accessory"]' ],
			// Legs — main
			[ 'barbell-squat',               'Barbell Back Squat',           'squat',           'quads',     'barbell',     'intermediate', 5, 4, 5, 4, 6,  3, 'top_set_backoff',     '["legs"]', '["main"]' ],
			[ 'goblet-squat',                'Goblet Squat',                 'squat',           'quads',     'dumbbell',    'beginner',     9, 2, 2, 10, 15, 3, 'double_progression', '["legs"]', '["main","secondary"]' ],
			[ 'leg-press',                   'Leg Press',                    'squat',           'quads',     'machine',     'beginner',     9, 2, 1, 10, 15, 3, 'double_progression', '["legs"]', '["main","secondary"]' ],
			[ 'romanian-deadlift',           'Romanian Deadlift',            'hip_hinge',       'hamstrings','barbell',     'intermediate', 7, 3, 4, 6, 10, 3, 'double_progression',  '["legs"]', '["main","secondary"]' ],
			[ 'dumbbell-romanian-deadlift',  'Dumbbell Romanian Deadlift',   'hip_hinge',       'hamstrings','dumbbell',    'beginner',     9, 2, 2, 8, 12, 3, 'double_progression',  '["legs"]', '["main","secondary"]' ],
			[ 'walking-lunges',              'Walking Lunges',               'lunge',           'quads',     'dumbbell',    'beginner',     8, 2, 2, 10, 16, 3, 'double_progression', '["legs"]', '["secondary","accessory"]' ],
			[ 'leg-curl-machine',            'Leg Curl',                     'knee_flexion',    'hamstrings','machine',     'beginner',     9, 1, 1, 10, 15, 3, 'double_progression', '["legs"]', '["secondary","accessory"]' ],
			[ 'leg-extension-machine',       'Leg Extension',                'knee_extension',  'quads',     'machine',     'beginner',     8, 2, 1, 12, 15, 3, 'double_progression', '["legs"]', '["accessory"]' ],
			[ 'hip-thrust',                  'Hip Thrust',                   'hip_extension',   'glutes',    'barbell',     'beginner',     9, 2, 2, 10, 15, 3, 'double_progression', '["legs"]', '["main","secondary"]' ],
			[ 'calf-raise',                  'Calf Raise',                   'plantarflexion',  'calves',    'machine',     'beginner',     10, 1, 1, 15, 20, 3, 'double_progression', '["legs"]', '["accessory"]' ],
			// Abs
			[ 'crunch',                      'Crunch',                       'trunk_flexion',   'abs',       'bodyweight',  'beginner',     10, 1, 1, 15, 25, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["abs"]' ],
			[ 'plank',                       'Plank',                        'trunk_stability', 'abs',       'bodyweight',  'beginner',     10, 1, 1, 20, 60, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["abs"]' ],
			[ 'hanging-leg-raise',           'Hanging Leg Raise',            'trunk_flexion',   'abs',       'bodyweight',  'intermediate', 8, 2, 1, 8, 15, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["abs"]' ],
			[ 'cable-crunch',                'Cable Crunch',                 'trunk_flexion',   'abs',       'cable',       'beginner',     9, 1, 1, 12, 20, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["abs"]' ],
			[ 'russian-twist',               'Russian Twist',                'trunk_rotation',  'abs',       'bodyweight',  'beginner',     9, 1, 1, 15, 20, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["abs"]' ],
			[ 'dead-bug',                    'Dead Bug',                     'trunk_stability', 'abs',       'bodyweight',  'beginner',     10, 1, 1, 8, 12, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["abs"]' ],
			// Challenge
			[ 'burpees',                     'Burpees',                      'total_body',      'full_body', 'bodyweight',  'intermediate', 7, 2, 2, 10, 20, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["challenge"]' ],
			[ 'box-jumps',                   'Box Jumps',                    'plyometric',      'quads',     'bodyweight',  'intermediate', 7, 3, 3, 6, 10, 3, 'double_progression', '["legs"]', '["challenge"]' ],
			[ 'farmers-walk',                "Farmer's Walk",                'carry',           'full_body', 'dumbbell',    'beginner',     9, 2, 2, 20, 40, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["challenge"]' ],
			[ 'battle-ropes',                'Battle Ropes',                 'total_body',      'full_body', 'other',       'beginner',     8, 2, 1, 20, 40, 3, 'double_progression', '["push","pull","legs","arms_shoulders"]', '["challenge"]' ],
		];

		foreach ( $exercises as $e ) {
			$wpdb->query( $wpdb->prepare(
				"INSERT INTO `$t`
				 (slug, name, movement_pattern, primary_muscle, equipment, difficulty,
				  age_friendliness_score, joint_stress_score, spinal_load_score,
				  default_rep_min, default_rep_max, default_sets, default_progression_type,
				  day_types_json, slot_types_json, active)
				 VALUES (%s,%s,%s,%s,%s,%s,%d,%d,%d,%d,%d,%d,%s,%s,%s,1)
				 ON DUPLICATE KEY UPDATE name=VALUES(name)",
				$e[0], $e[1], $e[2], $e[3], $e[4], $e[5],
				$e[6], $e[7], $e[8], $e[9], $e[10], $e[11], $e[12],
				$e[13], $e[14]
			) );
		}
	}

	// ── Substitutions ─────────────────────────────────────────────────────────

	private static function seed_exercise_substitutions(): void {
		global $wpdb;
		$ex = $wpdb->prefix . 'fit_exercises';
		$st = $wpdb->prefix . 'fit_exercise_substitutions';

		// Pairs: [ original_slug, substitute_slug, reason_code, priority ]
		$pairs = [
			[ 'barbell-bench-press',    'dumbbell-flat-press',           'equipment',     1 ],
			[ 'barbell-bench-press',    'push-up',                       'equipment',     2 ],
			[ 'barbell-bench-press',    'dumbbell-incline-press',        'variation',     3 ],
			[ 'overhead-press-barbell', 'dumbbell-shoulder-press',       'equipment',     1 ],
			[ 'overhead-press-barbell', 'arnold-press',                  'variation',     2 ],
			[ 'barbell-squat',          'goblet-squat',                  'joint_friendly',1 ],
			[ 'barbell-squat',          'leg-press',                     'equipment',     2 ],
			[ 'barbell-row',            'dumbbell-row',                  'equipment',     1 ],
			[ 'barbell-row',            'cable-row',                     'joint_friendly',2 ],
			[ 'barbell-row',            'chest-supported-row',           'joint_friendly',3 ],
			[ 'pull-up',                'lat-pulldown',                  'skill_level',   1 ],
			[ 'barbell-curl',           'dumbbell-hammer-curl',          'joint_friendly',1 ],
			[ 'skull-crushers',         'overhead-tricep-extension',     'joint_friendly',1 ],
			[ 'skull-crushers',         'tricep-pushdown',               'joint_friendly',2 ],
			[ 'romanian-deadlift',      'dumbbell-romanian-deadlift',    'equipment',     1 ],
			[ 'romanian-deadlift',      'leg-curl-machine',              'joint_friendly',2 ],
			[ 'dumbbell-lateral-raise', 'cable-lateral-raise',           'variation',     1 ],
		];

		foreach ( $pairs as $pair ) {
			$orig_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM `$ex` WHERE slug=%s", $pair[0] ) );
			$sub_id  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM `$ex` WHERE slug=%s", $pair[1] ) );
			if ( $orig_id && $sub_id ) {
				$wpdb->query( $wpdb->prepare(
					"INSERT INTO `$st` (exercise_id, substitute_exercise_id, reason_code, priority)
					 VALUES (%d,%d,%s,%d)
					 ON DUPLICATE KEY UPDATE priority=VALUES(priority)",
					$orig_id, $sub_id, $pair[2], $pair[3]
				) );
			}
		}
	}

	// ── Awards ────────────────────────────────────────────────────────────────

	private static function seed_awards(): void {
		global $wpdb;
		$t = $wpdb->prefix . 'fit_awards';

		$awards = [
			[ 'first_login',             'First Step',             'Logged into the app for the first time.',                          '🏁', 5  ],
			[ 'onboarding_complete',     'All Set Up',             'Completed onboarding and set up your profile.',                    '✅', 10 ],
			[ 'first_workout',           'First Sweat',            'Completed your very first workout session.',                       '💪', 15 ],
			[ 'first_meal_logged',       'First Bite',             'Logged your first meal.',                                          '🍽️', 10 ],
			[ 'first_progress_photo',    'Baseline Locked',        'Uploaded your first progress photo.',                              '📸', 20 ],
			[ 'logging_streak_7',        '7-Day Streak',           'Logged something every day for 7 consecutive days.',              '🔥', 25 ],
			[ 'logging_streak_30',       '30-Day Streak',          'Logged every day for 30 days straight. That\'s dedication.',      '🏆', 75 ],
			[ 'workouts_week_complete',  'Week Crushed',           'Completed all planned workouts in a week.',                        '⚡', 30 ],
			[ 'protein_streak_5',        'Protein King/Queen',     'Hit your protein target for 5 days in a row.',                    '🥩', 20 ],
			[ 'steps_10k_3days',         '10K Club',               'Hit 10,000 steps on 3 days in a row.',                            '👟', 20 ],
			[ 'weight_loss_5lb',         'First 5 Pounds',         'Lost your first 5 lbs. Steady wins the race.',                    '📉', 50 ],
			[ 'weight_loss_10lb',        'Ten Down',               'Down 10 lbs from your starting point.',                           '🎯', 75 ],
			[ 'consistency_comeback',    'Comeback Kid',           'Got back on track after missing 3 or more days.',                  '💥', 30 ],
			[ 'first_pr',                'Personal Record',        'Set a new personal record on any exercise.',                       '🥇', 25 ],
			[ 'sleep_streak_5',          'Sleep Champion',         'Logged 7+ hours of sleep for 5 nights in a row.',                 '😴', 20 ],
			[ 'cardio_streak_3',         'Cardio Streak',          'Logged cardio for 3 days in a row.',                              '🏃', 15 ],
			[ 'meals_logged_week',       'Clean Week',             'Logged every meal for a full 7 days.',                            '📋', 30 ],
			[ 'calorie_target_week',     'On Target',              'Hit your calorie target (within 100 kcal) for 5 days in a week.', '🎯', 25 ],
		];

		foreach ( $awards as $a ) {
			$wpdb->query( $wpdb->prepare(
				"INSERT INTO `$t` (code, name, description, icon, points, active)
				 VALUES (%s,%s,%s,%s,%d,1)
				 ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)",
				$a[0], $a[1], $a[2], $a[3], $a[4]
			) );
		}
	}

	// ── Program Templates ─────────────────────────────────────────────────────

	private static function seed_program_templates(): void {
		global $wpdb;
		$pt  = $wpdb->prefix . 'fit_program_templates';
		$ptd = $wpdb->prefix . 'fit_program_template_days';
		$pte = $wpdb->prefix . 'fit_program_template_exercises';
		$ex  = $wpdb->prefix . 'fit_exercises';

		// Template: Universal PPL (works for cut/maintain/gain/recomp, all experience levels)
		// The training engine uses this as the base and adapts per user. One canonical template.
		$template_id = $wpdb->get_var( "SELECT id FROM `$pt` WHERE name='PPL Universal'" );
		if ( ! $template_id ) {
			$wpdb->insert( $pt, [
				'name'             => 'PPL Universal',
				'goal_type'        => 'maintain',
				'experience_level' => 'intermediate',
				'active'           => 1,
			] );
			$template_id = $wpdb->insert_id;
		}

		// Days: Push → Pull → Legs → Push → Pull → Legs → Arms+Shoulders (optional)
		$days = [
			[ 'push',          1, 'medium' ],
			[ 'pull',          2, 'medium' ],
			[ 'legs',          3, 'medium' ],
			[ 'push',          4, 'medium' ],
			[ 'pull',          5, 'medium' ],
			[ 'legs',          6, 'medium' ],
			[ 'arms_shoulders',7, 'medium' ],
		];

		// [ day_type => [ [slug, slot_type, priority, rep_min, rep_max, sets, rir, optional] ] ]
		$day_exercises = [
			'push' => [
				[ 'barbell-bench-press',     'main',       1, 5, 8,   3, 2.0, 0 ],
				[ 'dumbbell-incline-press',  'secondary',  2, 8, 12,  3, 2.0, 0 ],
				[ 'overhead-press-barbell',  'shoulders',  3, 5, 8,   3, 2.0, 0 ],
				[ 'cable-chest-fly',         'accessory',  4, 12, 15, 3, 2.0, 0 ],
				[ 'tricep-pushdown',         'accessory',  5, 10, 15, 3, 2.0, 0 ],
				[ 'dumbbell-lateral-raise',  'shoulders',  6, 15, 20, 3, null, 0 ],
			],
			'pull' => [
				[ 'barbell-row',             'main',       1, 5, 8,   3, 2.0, 0 ],
				[ 'lat-pulldown',            'secondary',  2, 8, 12,  3, 2.0, 0 ],
				[ 'cable-row',               'secondary',  3, 10, 15, 3, 2.0, 0 ],
				[ 'barbell-curl',            'accessory',  4, 8, 12,  3, 2.0, 0 ],
				[ 'face-pulls',              'shoulders',  5, 15, 20, 3, null, 0 ],
				[ 'dumbbell-hammer-curl',    'accessory',  6, 10, 15, 3, 2.0, 0 ],
			],
			'legs' => [
				[ 'barbell-squat',           'main',       1, 4, 6,   3, 2.0, 0 ],
				[ 'romanian-deadlift',       'secondary',  2, 8, 12,  3, 2.0, 0 ],
				[ 'leg-press',               'secondary',  3, 10, 15, 3, 2.0, 0 ],
				[ 'leg-curl-machine',        'accessory',  4, 12, 15, 3, 2.0, 0 ],
				[ 'hip-thrust',              'accessory',  5, 10, 15, 3, 2.0, 0 ],
				[ 'dumbbell-lateral-raise',  'shoulders',  6, 15, 20, 3, null, 0 ],
				[ 'calf-raise',              'accessory',  7, 15, 20, 3, null, 0 ],
			],
			'arms_shoulders' => [
				[ 'dumbbell-shoulder-press', 'main',       1, 8, 12,  3, 2.0, 0 ],
				[ 'barbell-curl',            'accessory',  2, 8, 12,  3, 2.0, 0 ],
				[ 'skull-crushers',          'accessory',  3, 8, 12,  3, 2.0, 0 ],
				[ 'dumbbell-hammer-curl',    'accessory',  4, 10, 15, 3, 2.0, 0 ],
				[ 'overhead-tricep-extension','accessory', 5, 10, 15, 3, 2.0, 0 ],
				[ 'dumbbell-lateral-raise',  'shoulders',  6, 15, 20, 3, null, 0 ],
				[ 'rear-delt-fly',           'shoulders',  7, 15, 20, 3, null, 0 ],
			],
		];

		foreach ( $days as [ $day_type, $order, $tier ] ) {
			// check if day already inserted for this template
			$day_id = $wpdb->get_var( $wpdb->prepare(
				"SELECT id FROM `$ptd` WHERE program_template_id=%d AND day_type=%s AND default_order=%d",
				$template_id, $day_type, $order
			) );

			if ( ! $day_id ) {
				$wpdb->insert( $ptd, [
					'program_template_id' => $template_id,
					'day_type'            => $day_type,
					'default_order'       => $order,
					'time_tier'           => $tier,
				] );
				$day_id = $wpdb->insert_id;
			}

			$exercises_for_day = $day_exercises[ $day_type ] ?? [];
			foreach ( $exercises_for_day as [ $slug, $slot, $prio, $rmin, $rmax, $sets, $rir, $opt ] ) {
				$ex_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM `$ex` WHERE slug=%s", $slug ) );
				if ( ! $ex_id ) {
					continue;
				}
				$exists = $wpdb->get_var( $wpdb->prepare(
					"SELECT id FROM `$pte` WHERE template_day_id=%d AND exercise_id=%d",
					$day_id, $ex_id
				) );
				if ( ! $exists ) {
					$wpdb->insert( $pte, [
						'template_day_id' => $day_id,
						'exercise_id'     => $ex_id,
						'slot_type'       => $slot,
						'priority'        => $prio,
						'rep_min'         => $rmin,
						'rep_max'         => $rmax,
						'sets_target'     => $sets,
						'rir_target'      => $rir,
						'optional'        => $opt,
					] );
				}
			}
		}
	}
}
