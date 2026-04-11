# Test Gap Checklist

This checklist ranks missing automated coverage by risk and change frequency so the next test work lands where regressions are most likely.

## P0: Add Next

- Johnny action parsing and sanitization in `includes/Services/class-ai-service.php`
  - Risk: malformed or unsupported model actions can break navigation, saved-meal drafts, or workflow execution.
  - Minimum coverage: structured reply parsing, unsupported action rejection, payload sanitization, queued follow-up persistence.
- SMS reminder lifecycle in `includes/Services/class-sms-service.php`
  - Risk: reminders can be scheduled incorrectly, fail silently, or show stale state in Profile.
  - Minimum coverage: schedule, cancel, overdue reconciliation, response formatting, invalid time handling.
- Dashboard recommendation logic in `pwa/src/screens/dashboard/dashboardRecommendationHelpers.js`
  - Risk: homepage coaching cards, backup actions, reminder cards, and time-window logic are pure logic with no safety net.
  - Minimum coverage: training card state, backup routing, reminder queue sorting, inspirational time windows.
- Workout preview persistence in `pwa/src/store/workoutStore.js`
  - Risk: discard/restart and preview drafts can leave stale state that keeps deleted sessions visible.
  - Minimum coverage: preview draft persistence, 404/410 bootstrap clearing, discard/reset transitions.

## P1: High Value After P0

- Support and prompt assembly in `includes/Services/class-support-guide-service.php` and `includes/Services/class-ai-prompt-service.php`
  - Minimum coverage: guide selection, screen/context injection, prompt block shaping.
- Body and dashboard REST flows in `includes/REST/class-body-metrics-controller.php` and `includes/REST/class-dashboard-controller.php`
  - Minimum coverage: happy-path payload shape, auth/permission failures, invalid input handling.
- Johnny drawer and structured action rendering in `pwa/src/components/ai/JohnnyAssistantDrawer.jsx`
  - Minimum coverage: action card rendering, auto-navigation handling, follow-up queue actions.
- Nutrition parsing helpers in `pwa/src/screens/nutrition/NutritionScreen.jsx`
  - Minimum coverage: quantified serving parsing, saved-food normalization, grocery-gap dedupe helpers.

## P2: Broader Surface

- Admin and analytics REST controllers in `includes/REST/class-admin-api-controller.php` and `includes/REST/class-analytics-controller.php`.
- Push flows in `includes/Services/class-push-service.php` and `pwa/src/lib/pushNotifications.js`.
- Personal exercise library flows in `includes/Services/class-exercise-library-service.php` and related PWA swap UI modules.
- Settings/profile reminder UI in `pwa/src/screens/settings/SettingsScreen.jsx`.

## Current Baseline

- Backend coverage exists for auth, onboarding, nutrition, workout, AI thread retrieval, and a few domain services.
- Frontend currently had no automated tests before this pass.
- The biggest remaining blind spots are AI orchestration, reminders, dashboard decision logic, and workout client-state recovery.