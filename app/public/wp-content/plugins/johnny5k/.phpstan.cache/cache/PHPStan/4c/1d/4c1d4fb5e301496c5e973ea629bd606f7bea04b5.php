<?php declare(strict_types = 1);

// odsl-/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests
return \PHPStan\Cache\CacheItem::__set_state(array(
   'variableKey' => 'v1',
   'data' => 
  array (
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/AuthApiIntegrationTest.php' => 
    array (
      0 => 'c6b87d97268f7c00de8ef071613c9e2a87cff16e',
      1 => 
      array (
        0 => 'johnny5k\\tests\\authapiintegrationtest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_auth_register_then_validate_returns_authenticated_session_payload',
        1 => 'johnny5k\\tests\\test_auth_login_with_invalid_credentials_returns_401',
        2 => 'johnny5k\\tests\\test_auth_register_with_invalid_invite_code_returns_403',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/NutritionApiIntegrationTest.php' => 
    array (
      0 => 'f6d9337fc4f4dddb0a6d32492ef997c631c48894',
      1 => 
      array (
        0 => 'johnny5k\\tests\\nutritionapiintegrationtest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_meal_logging_creates_meal_and_items',
        1 => 'johnny5k\\tests\\test_meal_logging_with_malformed_items_returns_400',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/CalorieEngineTest.php' => 
    array (
      0 => '35502336604b5ec6136e178365f99302dcea772f',
      1 => 
      array (
        0 => 'johnny5k\\tests\\calorieenginetest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_calculate_initial_returns_expected_targets_for_moderate_cut',
        1 => 'johnny5k\\tests\\test_calculate_weekly_adjustment_uses_conservative_decrease_when_cut_is_stalled_and_recovery_is_poor',
        2 => 'johnny5k\\tests\\test_calculate_weekly_adjustment_returns_null_when_data_is_insufficient',
        3 => 'johnny5k\\tests\\test_calculate_weekly_adjustment_increases_calories_when_gain_progress_is_too_slow',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/AiThreadApiIntegrationTest.php' => 
    array (
      0 => '9a26e1473d563046f9cb6bb78dc505798a27b31a',
      1 => 
      array (
        0 => 'johnny5k\\tests\\aithreadapiintegrationtest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_ai_thread_retrieval_returns_messages_follow_ups_and_memory',
        1 => 'johnny5k\\tests\\test_ai_thread_permission_callback_requires_authentication',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/OnboardingApiIntegrationTest.php' => 
    array (
      0 => '97223c0d701af64237aa9b7af2348c5b1e3ba315',
      1 => 
      array (
        0 => 'johnny5k\\tests\\onboardingapiintegrationtest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_onboarding_complete_calculates_targets_marks_profile_and_returns_payload',
        1 => 'johnny5k\\tests\\test_onboarding_complete_with_missing_profile_fields_returns_400',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/bootstrap.php' => 
    array (
      0 => 'bb036b828d3e8ca3996b38a5ae56bddeb270679b',
      1 => 
      array (
        0 => 'wp_error',
        1 => 'wp_user',
        2 => 'wp_rest_request',
        3 => 'wp_rest_response',
      ),
      2 => 
      array (
        0 => '__construct',
        1 => 'get_error_message',
        2 => 'get_error_code',
        3 => '__construct',
        4 => '__construct',
        5 => 'get_param',
        6 => 'set_param',
        7 => 'get_params',
        8 => 'get_json_params',
        9 => 'get_file_params',
        10 => '__construct',
        11 => 'get_data',
        12 => 'get_status',
        13 => 'is_wp_error',
        14 => 'sanitize_text_field',
        15 => 'sanitize_email',
        16 => 'sanitize_textarea_field',
        17 => 'sanitize_key',
        18 => 'sanitize_user',
        19 => 'is_email',
        20 => 'wp_strip_all_tags',
        21 => 'wp_json_encode',
        22 => 'wp_timezone_string',
        23 => 'current_time',
        24 => '__return_true',
        25 => 'register_rest_route',
        26 => 'esc_sql',
        27 => 'is_ssl',
        28 => 'get_user_meta',
        29 => 'update_user_meta',
        30 => 'delete_user_meta',
        31 => 'do_action',
        32 => 'get_current_user_id',
        33 => 'wp_get_current_user',
        34 => 'wp_set_current_user',
        35 => 'is_user_logged_in',
        36 => 'wp_set_auth_cookie',
        37 => 'wp_clear_auth_cookie',
        38 => 'wp_logout',
        39 => 'email_exists',
        40 => 'wp_generate_password',
        41 => 'wp_insert_user',
        42 => 'wp_generate_uuid4',
        43 => 'sanitize_title',
        44 => 'get_user_by',
        45 => 'wp_signon',
        46 => 'user_can',
        47 => 'wp_create_nonce',
      ),
      3 => 
      array (
        0 => 'ABSPATH',
        1 => 'JF_REST_NAMESPACE',
        2 => 'OBJECT',
        3 => 'ARRAY_A',
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/WorkoutApiIntegrationTest.php' => 
    array (
      0 => '2c11f898d2a8603e3fcd730f2b979d708fe2efb1',
      1 => 
      array (
        0 => 'johnny5k\\tests\\workoutapiintegrationtest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_workout_start_creates_session_through_controller_flow',
        1 => 'johnny5k\\tests\\test_workout_complete_returns_summary_and_snapshots',
        2 => 'johnny5k\\tests\\test_workout_complete_with_unknown_session_returns_404',
        3 => 'johnny5k\\tests\\test_workout_log_set_creates_set_for_owned_session',
        4 => 'johnny5k\\tests\\test_workout_log_set_rejects_missing_session',
        5 => 'johnny5k\\tests\\test_workout_update_set_persists_mutated_fields',
        6 => 'johnny5k\\tests\\test_workout_delete_set_removes_row_and_resequences_remaining_sets',
        7 => 'johnny5k\\tests\\test_workout_swap_exercise_updates_session_exercise_and_returns_replacement',
        8 => 'johnny5k\\tests\\test_workout_skip_session_marks_skip_and_returns_warning_threshold',
        9 => 'johnny5k\\tests\\test_workout_restart_session_deactivates_and_deletes_active_session_records',
        10 => 'johnny5k\\tests\\test_workout_discard_session_deactivates_without_deleting_records',
        11 => 'johnny5k\\tests\\test_workout_undo_swap_restores_previous_exercise_state',
        12 => 'johnny5k\\tests\\test_workout_undo_quick_add_removes_added_exercise_and_sets',
        13 => 'johnny5k\\tests\\test_workout_update_history_session_updates_row_and_moves_snapshots',
        14 => 'johnny5k\\tests\\test_workout_delete_history_session_removes_snapshots_and_records',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/Support/FakeWpdb.php' => 
    array (
      0 => 'cbc82a6f11659a2df4dbd0cf7d53051859ed6497',
      1 => 
      array (
        0 => 'johnny5k\\tests\\support\\fakewpdb',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\support\\expectgetvar',
        1 => 'johnny5k\\tests\\support\\expectgetrow',
        2 => 'johnny5k\\tests\\support\\expectgetresults',
        3 => 'johnny5k\\tests\\support\\expectgetcol',
        4 => 'johnny5k\\tests\\support\\prepare',
        5 => 'johnny5k\\tests\\support\\get_var',
        6 => 'johnny5k\\tests\\support\\get_row',
        7 => 'johnny5k\\tests\\support\\get_results',
        8 => 'johnny5k\\tests\\support\\get_col',
        9 => 'johnny5k\\tests\\support\\insert',
        10 => 'johnny5k\\tests\\support\\replace',
        11 => 'johnny5k\\tests\\support\\update',
        12 => 'johnny5k\\tests\\support\\delete',
        13 => 'johnny5k\\tests\\support\\query',
        14 => 'johnny5k\\tests\\support\\resolve',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/Support/ApiIntegrationTestCase.php' => 
    array (
      0 => 'e5cdca9a2a73837b5fc16ed82f737fe272b9b417',
      1 => 
      array (
        0 => 'johnny5k\\tests\\support\\testworkoutcontroller',
        1 => 'johnny5k\\tests\\support\\testaimealcontroller',
        2 => 'johnny5k\\tests\\support\\apiintegrationtestcase',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\support\\build_training_session',
        1 => 'johnny5k\\tests\\support\\estimate_workout_session_calories',
        2 => 'johnny5k\\tests\\support\\record_training_snapshots',
        3 => 'johnny5k\\tests\\support\\evaluate_user_awards',
        4 => 'johnny5k\\tests\\support\\post_workout_summary',
        5 => 'johnny5k\\tests\\support\\grant_award',
        6 => 'johnny5k\\tests\\support\\mark_session_skipped',
        7 => 'johnny5k\\tests\\support\\sync_user_awards',
        8 => 'johnny5k\\tests\\support\\setup',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/Support/ServiceTestCase.php' => 
    array (
      0 => '43d3ce0d5d205c855fb1236fd77db631d1e0f842',
      1 => 
      array (
        0 => 'johnny5k\\tests\\support\\servicetestcase',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\support\\setup',
        1 => 'johnny5k\\tests\\support\\wpdb',
        2 => 'johnny5k\\tests\\support\\invokeprivatestatic',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/AwardEngineTest.php' => 
    array (
      0 => '9215df90324a4a885d54fcfb8015d02850554d83',
      1 => 
      array (
        0 => 'johnny5k\\tests\\awardenginetest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_workouts_week_complete_is_earned_when_completed_sessions_match_plan_days',
        1 => 'johnny5k\\tests\\test_workouts_week_complete_is_not_earned_when_plan_requirement_is_missed',
        2 => 'johnny5k\\tests\\test_first_pr_is_earned_when_snapshot_exists',
        3 => 'johnny5k\\tests\\test_calorie_target_week_is_earned_when_five_days_land_inside_tolerance',
        4 => 'johnny5k\\tests\\test_grant_returns_false_when_award_is_already_held',
      ),
      3 => 
      array (
      ),
    ),
    '/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/tests/TrainingEngineTest.php' => 
    array (
      0 => 'a8c0cf3423230f94259fc9df2aa8cdc1f7402911',
      1 => 
      array (
        0 => 'johnny5k\\tests\\trainingenginetest',
      ),
      2 => 
      array (
        0 => 'johnny5k\\tests\\test_preview_session_builds_a_push_day_blueprint',
        1 => 'johnny5k\\tests\\test_record_snapshots_marks_a_new_pr_and_grants_the_first_pr_award',
        2 => 'johnny5k\\tests\\test_recommended_progression_adds_weight_when_recent_sets_are_near_failure',
        3 => 'johnny5k\\tests\\test_recommended_progression_holds_weight_when_recent_rir_is_comfortable',
        4 => 'johnny5k\\tests\\test_record_snapshots_does_not_grant_pr_award_when_estimated_1rm_does_not_improve',
      ),
      3 => 
      array (
      ),
    ),
  ),
));