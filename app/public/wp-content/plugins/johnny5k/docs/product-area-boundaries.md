# Product Area Boundaries

## Intent

This codebase should organize transport, UI, and business logic by product area instead of growing shared catch-all files.

## Frontend Rules

- `pwa/src/api/core/` owns transport concerns only: nonce refresh, request wrappers, auth redirect behavior, blob helpers, and WordPress core media URL wiring.
- `pwa/src/api/modules/` owns REST clients by product area: `auth`, `onboarding`, `dashboard`, `body`, `training`, `workout`, `nutrition`, `ai`, `admin`, and `media`.
- `pwa/src/api/client.js` is a compatibility barrel. New code should prefer direct imports from `pwa/src/api/modules/<area>.js`.
- Screen feature folders should keep their own `components/`, `hooks/`, and screen orchestrator file together. Avoid pushing feature-specific helpers back into shared global folders unless they are reused across product areas.

## Backend Direction

- `includes/REST/` controllers should stay route-focused. Product-area orchestration should move downward into `includes/Services/` instead of accumulating inside controllers.
- New backend work should prefer product-area helpers over expanding existing cross-area controllers like `class-ai-controller.php`.
- Test coverage should mirror product areas: auth, onboarding, workout, nutrition, AI thread, dashboard, and admin.

## Current Applied Boundary

- Frontend REST access is now split by product area under `pwa/src/api/modules/`.
- Dashboard and Nutrition already have feature-local hooks/components folders under their screen directories.
- Backend API integration tests are split by product area under `tests/`.

## Next Targets

- Move dashboard model builders out of `DashboardScreen.jsx` into a dashboard models module.
- Continue carving nutrition helpers out of `NutritionScreen.jsx` by planning and meal-log subfeatures.
- Split backend cross-area controllers into route layer plus service layer by product area when touching those flows next.