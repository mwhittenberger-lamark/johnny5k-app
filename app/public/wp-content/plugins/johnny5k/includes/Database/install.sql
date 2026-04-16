-- Johnny5k Schema v1.0.0
-- Run directly: mysql -u root -proot -S /path/to/mysqld.sock local < install.sql

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `wp_fit_invite_codes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) NOT NULL,
  `created_by` bigint(20) unsigned NOT NULL DEFAULT 1,
  `used_by` bigint(20) unsigned DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `used_by` (`used_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_profiles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `first_name` varchar(100) NOT NULL DEFAULT '',
  `last_name` varchar(100) NOT NULL DEFAULT '',
  `date_of_birth` date DEFAULT NULL,
  `sex` enum('male','female','other','prefer_not_to_say') NOT NULL DEFAULT 'prefer_not_to_say',
  `height_cm` decimal(5,2) DEFAULT NULL,
  `starting_weight_lb` decimal(6,2) DEFAULT NULL,
  `current_goal` enum('cut','maintain','gain','recomp') NOT NULL DEFAULT 'maintain',
  `goal_rate` enum('slow','moderate','aggressive') NOT NULL DEFAULT 'moderate',
  `training_experience` enum('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  `activity_level` enum('sedentary','light','moderate','high','athlete') NOT NULL DEFAULT 'moderate',
  `available_time_default` enum('short','medium','full') NOT NULL DEFAULT 'medium',
  `rest_between_sets_min_seconds` int(11) NOT NULL DEFAULT 30,
  `rest_between_sets_max_seconds` int(11) NOT NULL DEFAULT 60,
  `rest_between_exercises_min_seconds` int(11) NOT NULL DEFAULT 60,
  `rest_between_exercises_max_seconds` int(11) NOT NULL DEFAULT 120,
  `phone` varchar(20) DEFAULT NULL,
  `timezone` varchar(100) NOT NULL DEFAULT 'America/New_York',
  `units` enum('imperial','metric') NOT NULL DEFAULT 'imperial',
  `onboarding_complete` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_preferences` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `preferred_workout_days_json` longtext DEFAULT NULL,
  `equipment_available_json` longtext DEFAULT NULL,
  `exercise_preferences_json` longtext DEFAULT NULL,
  `exercise_avoid_json` longtext DEFAULT NULL,
  `food_preferences_json` longtext DEFAULT NULL,
  `food_dislikes_json` longtext DEFAULT NULL,
  `common_breakfasts_json` longtext DEFAULT NULL,
  `notifications_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `voice_input_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `redo_onboarding_allowed` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_health_flags` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `flag_type` enum('injury','pain','mobility','medical_note') NOT NULL,
  `body_area` varchar(100) NOT NULL DEFAULT '',
  `severity` enum('low','medium','high') NOT NULL DEFAULT 'low',
  `notes` text DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `user_active` (`user_id`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_goals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `goal_type` enum('cut','maintain','gain','recomp') NOT NULL DEFAULT 'maintain',
  `start_date` date NOT NULL,
  `target_weight_lb` decimal(6,2) DEFAULT NULL,
  `target_calories` int(11) DEFAULT NULL,
  `target_protein_g` int(11) DEFAULT NULL,
  `target_carbs_g` int(11) DEFAULT NULL,
  `target_fat_g` int(11) DEFAULT NULL,
  `target_steps` int(11) DEFAULT NULL,
  `target_sleep_hours` decimal(4,2) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `user_active` (`user_id`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_body_metrics` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `metric_date` date NOT NULL,
  `weight_lb` decimal(6,2) NOT NULL,
  `waist_in` decimal(5,2) DEFAULT NULL,
  `body_fat_pct` decimal(5,2) DEFAULT NULL,
  `resting_hr` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_date` (`user_id`,`metric_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_sleep_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `sleep_date` date NOT NULL,
  `hours_sleep` decimal(4,2) NOT NULL,
  `sleep_quality` enum('poor','fair','good','great') DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_date` (`user_id`,`sleep_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_step_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `step_date` date NOT NULL,
  `steps` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_date` (`user_id`,`step_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_cardio_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `cardio_date` date NOT NULL,
  `cardio_type` varchar(100) NOT NULL DEFAULT '',
  `duration_minutes` int(11) NOT NULL DEFAULT 0,
  `intensity` enum('light','moderate','hard') NOT NULL DEFAULT 'moderate',
  `distance` decimal(6,2) DEFAULT NULL,
  `estimated_calories` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_date` (`user_id`,`cardio_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_exercises` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(150) NOT NULL,
  `name` varchar(150) NOT NULL,
  `movement_pattern` varchar(100) NOT NULL DEFAULT '',
  `primary_muscle` varchar(100) NOT NULL DEFAULT '',
  `secondary_muscles_json` longtext DEFAULT NULL,
  `equipment` varchar(100) NOT NULL DEFAULT 'barbell',
  `difficulty` enum('beginner','intermediate','advanced') NOT NULL DEFAULT 'intermediate',
  `age_friendliness_score` tinyint(3) unsigned NOT NULL DEFAULT 5,
  `joint_stress_score` tinyint(3) unsigned NOT NULL DEFAULT 3,
  `spinal_load_score` tinyint(3) unsigned NOT NULL DEFAULT 3,
  `default_rep_min` int(11) NOT NULL DEFAULT 8,
  `default_rep_max` int(11) NOT NULL DEFAULT 12,
  `default_sets` int(11) NOT NULL DEFAULT 3,
  `default_progression_type` enum('double_progression','load_progression','top_set_backoff') NOT NULL DEFAULT 'double_progression',
  `coaching_cues_json` longtext DEFAULT NULL,
  `day_types_json` longtext DEFAULT NULL,
  `slot_types_json` longtext DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `primary_muscle` (`primary_muscle`),
  KEY `equipment` (`equipment`),
  KEY `active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_exercise_substitutions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `exercise_id` bigint(20) unsigned NOT NULL,
  `substitute_exercise_id` bigint(20) unsigned NOT NULL,
  `reason_code` enum('equipment','joint_friendly','skill_level','variation') NOT NULL DEFAULT 'variation',
  `priority` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `exercise_id` (`exercise_id`),
  KEY `substitute_exercise_id` (`substitute_exercise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_program_templates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `goal_type` enum('cut','maintain','gain','recomp') NOT NULL DEFAULT 'maintain',
  `experience_level` enum('beginner','intermediate','advanced') NOT NULL DEFAULT 'intermediate',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `goal_experience` (`goal_type`,`experience_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_program_template_days` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `program_template_id` bigint(20) unsigned NOT NULL,
  `day_type` enum('push','pull','legs','full_body','arms_shoulders','chest','back','shoulders','arms','stretching','abs','cardio','rest') NOT NULL,
  `default_order` int(11) NOT NULL DEFAULT 1,
  `time_tier` enum('short','medium','full') NOT NULL DEFAULT 'medium',
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `program_template_id` (`program_template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_program_template_exercises` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `template_day_id` bigint(20) unsigned NOT NULL,
  `exercise_id` bigint(20) unsigned NOT NULL,
  `slot_type` enum('main','secondary','shoulders','accessory','abs','challenge') NOT NULL DEFAULT 'main',
  `priority` int(11) NOT NULL DEFAULT 1,
  `rep_min` int(11) NOT NULL DEFAULT 8,
  `rep_max` int(11) NOT NULL DEFAULT 12,
  `sets_target` int(11) NOT NULL DEFAULT 3,
  `rir_target` decimal(3,1) DEFAULT NULL,
  `optional` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `template_day_id` (`template_day_id`),
  KEY `exercise_id` (`exercise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_ironquest_profiles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `class_slug` varchar(100) NOT NULL DEFAULT '',
  `motivation_slug` varchar(100) NOT NULL DEFAULT '',
  `level` int(11) NOT NULL DEFAULT 1,
  `xp` int(11) NOT NULL DEFAULT 0,
  `gold` int(11) NOT NULL DEFAULT 0,
  `hp_current` int(11) NOT NULL DEFAULT 100,
  `hp_max` int(11) NOT NULL DEFAULT 100,
  `current_location_slug` varchar(150) NOT NULL DEFAULT '',
  `active_mission_slug` varchar(150) NOT NULL DEFAULT '',
  `starter_portrait_attachment_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `enabled` (`enabled`),
  KEY `current_location_slug` (`current_location_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_ironquest_mission_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `mission_slug` varchar(150) NOT NULL DEFAULT '',
  `location_slug` varchar(150) NOT NULL DEFAULT '',
  `run_type` varchar(50) NOT NULL DEFAULT 'workout',
  `source_session_id` varchar(191) NOT NULL DEFAULT '',
  `status` enum('active','completed','abandoned') NOT NULL DEFAULT 'active',
  `encounter_phase` varchar(100) NOT NULL DEFAULT '',
  `result_band` varchar(50) NOT NULL DEFAULT '',
  `xp_awarded` int(11) NOT NULL DEFAULT 0,
  `gold_awarded` int(11) NOT NULL DEFAULT 0,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_status_started` (`user_id`,`status`,`started_at`),
  KEY `mission_slug` (`mission_slug`),
  KEY `location_slug` (`location_slug`),
  KEY `source_session` (`source_session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_ironquest_unlocks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `unlock_type` varchar(100) NOT NULL DEFAULT '',
  `unlock_key` varchar(191) NOT NULL DEFAULT '',
  `source_run_id` bigint(20) unsigned DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_unlock` (`user_id`,`unlock_type`,`unlock_key`),
  KEY `source_run_id` (`source_run_id`),
  KEY `user_type_created` (`user_id`,`unlock_type`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_ironquest_daily_state` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `state_date` date NOT NULL,
  `meal_quest_complete` tinyint(1) NOT NULL DEFAULT 0,
  `sleep_quest_complete` tinyint(1) NOT NULL DEFAULT 0,
  `cardio_quest_complete` tinyint(1) NOT NULL DEFAULT 0,
  `steps_quest_complete` tinyint(1) NOT NULL DEFAULT 0,
  `workout_quest_complete` tinyint(1) NOT NULL DEFAULT 0,
  `travel_points_earned` int(11) NOT NULL DEFAULT 0,
  `bonus_state_json` longtext DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_state_date` (`user_id`,`state_date`),
  KEY `state_date` (`state_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_ironquest_activity_ledger` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `source_type` varchar(100) NOT NULL DEFAULT '',
  `source_key` varchar(191) NOT NULL DEFAULT '',
  `award_type` varchar(100) NOT NULL DEFAULT '',
  `payload_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_source_award` (`user_id`,`source_type`,`source_key`,`award_type`),
  KEY `user_created` (`user_id`,`created_at`),
  KEY `source_lookup` (`source_type`,`source_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_training_plans` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `program_template_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(150) NOT NULL DEFAULT 'My Plan',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `user_active` (`user_id`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_training_days` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `training_plan_id` bigint(20) unsigned NOT NULL,
  `day_type` enum('push','pull','legs','full_body','arms_shoulders','chest','back','shoulders','arms','stretching','abs','cardio','rest') NOT NULL,
  `day_order` int(11) NOT NULL DEFAULT 1,
  `time_tier` enum('short','medium','full') NOT NULL DEFAULT 'medium',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `training_plan_id` (`training_plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_training_day_exercises` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `training_day_id` bigint(20) unsigned NOT NULL,
  `exercise_id` bigint(20) unsigned NOT NULL,
  `slot_type` enum('main','secondary','shoulders','accessory','abs','challenge') NOT NULL DEFAULT 'main',
  `rep_min` int(11) NOT NULL DEFAULT 8,
  `rep_max` int(11) NOT NULL DEFAULT 12,
  `sets_target` int(11) NOT NULL DEFAULT 3,
  `rir_target` decimal(3,1) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 1,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `training_day_id` (`training_day_id`),
  KEY `exercise_id` (`exercise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_workout_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `session_date` date NOT NULL,
  `planned_day_type` enum('push','pull','legs','full_body','arms_shoulders','chest','back','shoulders','arms','stretching','abs','cardio','rest') NOT NULL,
  `actual_day_type` enum('push','pull','legs','full_body','arms_shoulders','chest','back','shoulders','arms','stretching','abs','cardio','rest') DEFAULT NULL,
  `time_tier` enum('short','medium','full') NOT NULL DEFAULT 'medium',
  `readiness_score` tinyint(3) unsigned DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT NULL,
  `estimated_calories` int(11) DEFAULT NULL,
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `skip_requested` tinyint(1) NOT NULL DEFAULT 0,
  `is_optional_session` tinyint(1) NOT NULL DEFAULT 0,
  `ai_summary` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_date` (`user_id`,`session_date`),
  KEY `user_completed` (`user_id`,`completed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_workout_session_exercises` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint(20) unsigned NOT NULL,
  `exercise_id` bigint(20) unsigned NOT NULL,
  `slot_type` enum('main','secondary','shoulders','accessory','abs','challenge') NOT NULL DEFAULT 'main',
  `planned_rep_min` int(11) NOT NULL DEFAULT 8,
  `planned_rep_max` int(11) NOT NULL DEFAULT 12,
  `planned_sets` int(11) NOT NULL DEFAULT 3,
  `sort_order` int(11) NOT NULL DEFAULT 1,
  `was_swapped` tinyint(1) NOT NULL DEFAULT 0,
  `original_exercise_id` bigint(20) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `session_id` (`session_id`),
  KEY `exercise_id` (`exercise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_workout_sets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_exercise_id` bigint(20) unsigned NOT NULL,
  `set_number` int(11) NOT NULL DEFAULT 1,
  `weight` decimal(6,2) NOT NULL DEFAULT 0.00,
  `reps` int(11) NOT NULL DEFAULT 0,
  `rir` decimal(3,1) DEFAULT NULL,
  `rpe` decimal(3,1) DEFAULT NULL,
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `pain_flag` tinyint(1) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `session_exercise_id` (`session_exercise_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_exercise_performance_snapshots` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `exercise_id` bigint(20) unsigned NOT NULL,
  `snapshot_date` date NOT NULL,
  `best_weight` decimal(6,2) DEFAULT NULL,
  `best_reps` int(11) DEFAULT NULL,
  `best_volume` int(11) DEFAULT NULL,
  `estimated_1rm` decimal(7,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_exercise` (`user_id`,`exercise_id`),
  KEY `user_exercise_date` (`user_id`,`exercise_id`,`snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_foods` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `canonical_name` varchar(200) NOT NULL DEFAULT '',
  `brand` varchar(150) DEFAULT NULL,
  `serving_size` varchar(100) NOT NULL DEFAULT '',
  `serving_grams` decimal(6,2) DEFAULT NULL,
  `calories` int(11) NOT NULL DEFAULT 0,
  `protein_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `carbs_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `fat_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `fiber_g` decimal(6,2) DEFAULT NULL,
  `sugar_g` decimal(6,2) DEFAULT NULL,
  `sodium_mg` decimal(8,2) DEFAULT NULL,
  `micros_json` longtext DEFAULT NULL,
  `is_beverage` tinyint(1) NOT NULL DEFAULT 0,
  `source` enum('manual','label','ai_photo','recipe','system','usda_ai_text','usda_ai_photo') NOT NULL DEFAULT 'manual',
  `label_json` longtext DEFAULT NULL,
  `source_json` longtext DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `canonical_name` (`canonical_name`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_saved_meals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `name` varchar(150) NOT NULL DEFAULT '',
  `meal_type` enum('breakfast','lunch','dinner','snack','beverage') NOT NULL DEFAULT 'lunch',
  `items_json` longtext DEFAULT NULL,
  `calories` int(11) NOT NULL DEFAULT 0,
  `protein_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `carbs_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `fat_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `micros_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_meals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `meal_datetime` datetime NOT NULL,
  `meal_type` enum('breakfast','lunch','dinner','snack','beverage') NOT NULL DEFAULT 'lunch',
  `source` enum('manual','saved_meal','photo','label','recipe') NOT NULL DEFAULT 'manual',
  `ai_confidence` decimal(4,3) DEFAULT NULL,
  `confirmed` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_datetime` (`user_id`,`meal_datetime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_meal_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `meal_id` bigint(20) unsigned NOT NULL,
  `food_id` bigint(20) unsigned DEFAULT NULL,
  `food_name` varchar(200) NOT NULL DEFAULT '',
  `serving_amount` decimal(8,2) NOT NULL DEFAULT 1.00,
  `serving_unit` varchar(50) NOT NULL DEFAULT 'serving',
  `calories` int(11) NOT NULL DEFAULT 0,
  `protein_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `carbs_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `fat_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `fiber_g` decimal(6,2) DEFAULT NULL,
  `sugar_g` decimal(6,2) DEFAULT NULL,
  `sodium_mg` decimal(8,2) DEFAULT NULL,
  `micros_json` longtext DEFAULT NULL,
  `is_beverage` tinyint(1) NOT NULL DEFAULT 0,
  `source_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `meal_id` (`meal_id`),
  KEY `food_id` (`food_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_hydration_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `log_date` date NOT NULL,
  `glasses` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `target_glasses` tinyint(3) unsigned NOT NULL DEFAULT 6,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_log_date` (`user_id`,`log_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_pantry_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `item_name` varchar(150) NOT NULL DEFAULT '',
  `quantity` decimal(8,2) DEFAULT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `expires_on` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_recipe_suggestions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `recipe_key` varchar(191) NOT NULL DEFAULT '',
  `meal_type` varchar(50) NOT NULL DEFAULT 'lunch',
  `recipe_name` varchar(200) NOT NULL DEFAULT '',
  `ingredients_json` longtext DEFAULT NULL,
  `instructions_json` longtext DEFAULT NULL,
  `estimated_calories` int(11) NOT NULL DEFAULT 0,
  `estimated_protein_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `estimated_carbs_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `estimated_fat_g` decimal(6,2) NOT NULL DEFAULT 0.00,
  `dietary_tags_json` longtext DEFAULT NULL,
  `why_this_works` text DEFAULT NULL,
  `source` varchar(50) NOT NULL DEFAULT 'generated',
  `image_url` text DEFAULT NULL,
  `is_cookbook` tinyint(1) NOT NULL DEFAULT 0,
  `fits_goal` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `user_recipe_key` (`user_id`,`recipe_key`),
  KEY `user_cookbook` (`user_id`,`is_cookbook`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_media_analysis_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `job_type` enum('meal_photo','food_label','progress_photo') NOT NULL,
  `attachment_id` bigint(20) unsigned DEFAULT NULL,
  `input_metadata_json` longtext DEFAULT NULL,
  `raw_ai_response` longtext DEFAULT NULL,
  `parsed_json` longtext DEFAULT NULL,
  `status` enum('pending','processing','completed','failed','needs_review') NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`),
  KEY `user_status` (`user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_progress_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `photo_date` date NOT NULL,
  `angle` enum('front','side','back') NOT NULL DEFAULT 'front',
  `attachment_id` bigint(20) unsigned NOT NULL,
  `analysis_json` longtext DEFAULT NULL,
  `comparison_first_json` longtext DEFAULT NULL,
  `comparison_previous_json` longtext DEFAULT NULL,
  `encouragement_text` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `user_date` (`user_id`,`photo_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_awards` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `name` varchar(150) NOT NULL DEFAULT '',
  `description` text DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `points` int(11) NOT NULL DEFAULT 10,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_user_awards` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `award_id` bigint(20) unsigned NOT NULL,
  `awarded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `context_json` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_award` (`user_id`,`award_id`),
  KEY `user_id` (`user_id`),
  KEY `award_id` (`award_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_daily_scores` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `score_date` date NOT NULL,
  `nutrition_score` int(11) NOT NULL DEFAULT 0,
  `training_score` int(11) NOT NULL DEFAULT 0,
  `recovery_score` int(11) NOT NULL DEFAULT 0,
  `consistency_score` int(11) NOT NULL DEFAULT 0,
  `total_score` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_date` (`user_id`,`score_date`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_behavior_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `event_name` varchar(100) NOT NULL,
  `screen` varchar(100) DEFAULT NULL,
  `context` varchar(100) DEFAULT NULL,
  `value_num` decimal(12,2) DEFAULT NULL,
  `metadata_json` longtext DEFAULT NULL,
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_time` (`user_id`,`occurred_at`),
  KEY `event_time` (`event_name`,`occurred_at`),
  KEY `screen_time` (`screen`,`occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_ai_threads` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `thread_key` varchar(150) NOT NULL,
  `summary_text` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `thread_key` (`thread_key`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_ai_messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `thread_id` bigint(20) unsigned NOT NULL,
  `role` enum('system','user','assistant','tool') NOT NULL,
  `message_text` longtext DEFAULT NULL,
  `tool_name` varchar(150) DEFAULT NULL,
  `tool_payload_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `thread_id` (`thread_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_api_cost_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `service` enum('openai','clicksend','gemini') NOT NULL DEFAULT 'openai',
  `endpoint` varchar(150) DEFAULT NULL,
  `tokens_in` int(11) DEFAULT NULL,
  `tokens_out` int(11) DEFAULT NULL,
  `units` decimal(10,4) DEFAULT NULL,
  `cost_usd` decimal(10,6) DEFAULT NULL,
  `metadata_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `service` (`service`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_sms_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `phone` varchar(30) NOT NULL DEFAULT '',
  `trigger_type` enum('workout_reminder','meal_reminder','sleep_reminder','weekly_summary','encouragement') NOT NULL,
  `message_preview` varchar(255) DEFAULT NULL,
  `status` enum('sent','failed','queued') NOT NULL DEFAULT 'queued',
  `cost_usd` decimal(8,6) DEFAULT NULL,
  `clicksend_message_id` varchar(100) DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `trigger_type` (`trigger_type`),
  KEY `sent_at` (`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_push_subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `endpoint` varchar(767) NOT NULL,
  `endpoint_hash` char(64) NOT NULL,
  `public_key` varchar(255) NOT NULL DEFAULT '',
  `auth_token` varchar(255) NOT NULL DEFAULT '',
  `content_encoding` varchar(50) NOT NULL DEFAULT '',
  `expiration_time` bigint(20) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `subscription_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_seen_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `disabled_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `endpoint_hash` (`endpoint_hash`),
  KEY `user_id` (`user_id`),
  KEY `user_active` (`user_id`,`disabled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wp_fit_coach_delivery_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `follow_up_id` varchar(64) DEFAULT NULL,
  `channel` enum('in_app','push','sms') NOT NULL DEFAULT 'in_app',
  `delivery_type` varchar(50) NOT NULL DEFAULT 'follow_up',
  `delivery_key` varchar(100) DEFAULT NULL,
  `title` varchar(150) DEFAULT NULL,
  `message_preview` varchar(255) DEFAULT NULL,
  `payload_json` longtext DEFAULT NULL,
  `status` enum('queued','sent','failed','suppressed','skipped') NOT NULL DEFAULT 'queued',
  `error_code` varchar(100) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `provider_message_id` varchar(150) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_time` (`user_id`,`created_at`),
  KEY `follow_up` (`follow_up_id`),
  KEY `channel_status_time` (`channel`,`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
