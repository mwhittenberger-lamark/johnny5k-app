# Johnny5k Code Review Findings

## Scope

This review covers the custom Johnny5k application code in the WordPress plugin and React PWA. It does not review WordPress core or bundled theme boilerplate except where it affects the app.

## Validation Summary

- `npm run build` succeeds for the PWA.
- PHP syntax checks pass across the custom plugin files.
- `npm run lint` fails with 27 errors and 14 warnings.

## Best 5 Things We Are Doing

1. We have a real domain model instead of a loose collection of WordPress options and post types.
   [class-schema.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/Database/class-schema.php) defines a coherent set of tables for profiles, goals, workouts, nutrition, AI threads, awards, and costs.

2. The training engine contains meaningful business logic, not just CRUD.
   [class-training-engine.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/Services/class-training-engine.php) handles session generation, progression, skip tracking, and PR snapshots in a way that reflects the actual product.

3. The auth model is relatively clean for a WordPress-backed app.
   [class-auth-controller.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/REST/class-auth-controller.php), [client.js](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/api/client.js), and [authStore.js](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/store/authStore.js) centralize cookie session validation, nonce refresh, and frontend auth persistence.

4. The AI implementation is deeper than a typical app-side wrapper.
   [class-ai-service.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php) persists threads, stores tool metadata, builds user context, records cost data, and supports structured actions.

5. Private media handling shows good security instincts.
   [class-onboarding-controller.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/REST/class-onboarding-controller.php) and [class-dashboard-controller.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/REST/class-dashboard-controller.php) mark sensitive uploads as private and serve them through authenticated endpoints.

## Worst 5 Things

1. There is a cron callback mismatch that is likely a production bug.
   [johnny5k.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/johnny5k.php) calls `Johnny5k\Services\AwardEngine::evaluate_all_users();`, but [class-award-engine.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/Services/class-award-engine.php) exposes `run_all()`, not `evaluate_all_users()`.

2. The frontend quality gate is currently broken.
   `npm run lint` fails with 27 errors and 14 warnings, including undefined variables, invalid effect patterns, and hook dependency problems in key screens such as dashboard, onboarding, admin, and body tracking.

3. Several files are acting like god objects.
   The largest examples are:
   - [class-ai-service.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php)
   - [class-ai-controller.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/REST/class-ai-controller.php)
   - [NutritionScreen.jsx](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/screens/nutrition/NutritionScreen.jsx)
   - [DashboardScreen.jsx](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/screens/dashboard/DashboardScreen.jsx)

4. There are no app-level automated tests in the custom code.
   The plugin and PWA have build and lint scripts, but no unit, integration, or end-to-end test setup for the application logic.

5. The frontend asset profile is heavier than it should be for a mobile-first fitness app.
   The build output includes multiple very large PNG assets and large route modules, which will hurt first-load performance on real devices.

## Ten Suggestions To Improve The App

1. Fix the cron bug in [johnny5k.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/johnny5k.php) immediately.

2. Make a clean ESLint run a required baseline before adding more features.

3. Split [class-ai-service.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/Services/class-ai-service.php) into focused services such as provider client, chat orchestration, nutrition analysis, follow-up management, and durable memory.

4. Break [NutritionScreen.jsx](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/screens/nutrition/NutritionScreen.jsx) into smaller components and hooks by feature area.

5. Break [DashboardScreen.jsx](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/screens/dashboard/DashboardScreen.jsx) into independent dashboard cards and data hooks.

6. Add backend tests around high-value logic first:
   - calorie adjustments
   - workout session generation
   - PR detection
   - award eligibility

7. Add API integration tests for the most important REST flows:
   - auth
   - onboarding
   - workout start and complete
   - meal logging
   - AI thread retrieval

8. Add stronger static analysis on the PHP side, such as PHPStan or Psalm, and keep the frontend lint rules strict.

9. Compress large images and move heavy visual assets to better formats such as WebP or AVIF where possible.

10. Formalize module boundaries by product area so files stop collapsing back into giant mixed-responsibility implementations.

## High-Signal Supporting Notes

- The workout session state handling in [workoutStore.js](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/store/workoutStore.js) is stronger than average and does a good job preserving in-progress workout state across refreshes.
- The dashboard store in [dashboardStore.js](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/pwa/src/store/dashboardStore.js) has a reasonable shared-cache pattern for repeated snapshot access.
- The migration story is incomplete. [class-migrator.php](/Users/mike/Local Sites/johnny5k/app/public/wp-content/plugins/johnny5k/includes/Database/class-migrator.php) exists, but the main plugin bootstrap currently relies on schema recreation and version updates rather than calling it directly.

## Overall Assessment

Johnny5k is much stronger as a product codebase than a typical early-stage WordPress application. The main weaknesses are not lack of ambition or lack of product logic. The main weaknesses are maintainability, missing automated tests, frontend discipline, and a few concrete correctness issues that now need tightening before the next layer of complexity gets added.
