# Johnny5k Spec Compliance Checklist

This document is designed for an AI agent or QA system to verify that the Johnny5k application meets all required specifications.

---

# 1. Core Architecture

## Backend
- [ ] WordPress is used for authentication and admin
- [ ] Custom plugin exists for business logic
- [ ] Custom DB tables are used (not post meta)
- [ ] REST API namespace `/wp-json/fit/v1/` implemented
- [ ] Cron jobs exist for recalculations (calories, awards)

## Frontend
- [ ] Mobile-first PWA or React app
- [ ] Bottom-tab navigation implemented
- [ ] Offline support (queue or caching)

## AI Layer
- [ ] OpenAI Responses API integrated
- [ ] Function calling used for all mutations
- [ ] Structured JSON outputs enforced
- [ ] Image input supported (meals, labels, photos)

---

# 2. Authentication & User

- [ ] Signup / login / logout works
- [ ] Password reset works
- [ ] Profile editing works
- [ ] Onboarding state stored
- [ ] Preferences saved
- [ ] No WP admin exposure to users

---

# 3. Onboarding

- [ ] Body stats collected
- [ ] Goal collected
- [ ] Training experience collected
- [ ] Injuries collected
- [ ] Equipment collected
- [ ] Food preferences collected
- [ ] Baseline habits collected
- [ ] Outputs:
  - [ ] Calorie target
  - [ ] Macro targets
  - [ ] Training split generated

---

# 4. Training System

- [ ] Push/Pull/Legs split implemented
- [ ] Shoulder movement included each day
- [ ] Bonus arms/shoulders day exists
- [ ] Exercise substitution system works
- [ ] Progression logic implemented
- [ ] Readiness-aware logic implemented
- [ ] Tomorrow plan generator works

---

# 5. Workout Logging

- [ ] One-tap session start
- [ ] Exercise cards UI
- [ ] Last session reference shown
- [ ] Smart weight suggestions
- [ ] Quick weight controls (+/-)
- [ ] Add/remove sets
- [ ] Swap exercise
- [ ] Abs/challenge quick add
- [ ] Workout summary generated

---

# 6. Recovery Tracking

- [ ] Sleep logging works
- [ ] Step logging works
- [ ] Cardio logging works
- [ ] Trends calculated
- [ ] Data influences training + calories

---

# 7. Nutrition System

- [ ] Calorie targets stored
- [ ] Weekly adjustment algorithm implemented
- [ ] Meal logging works
- [ ] Saved foods exist
- [ ] Saved meals exist
- [ ] Pantry system exists
- [ ] Recipe suggestions work
- [ ] Grocery gap suggestions work

---

# 8. AI Meal & Label Processing

- [ ] Meal photo upload works
- [ ] AI returns structured food items
- [ ] User confirmation required
- [ ] Label parsing returns structured JSON
- [ ] Foods saved from labels reusable
- [ ] AI confidence tracked

---

# 9. Progress Photos

- [ ] Photo upload works
- [ ] Baseline comparison exists
- [ ] Previous comparison exists
- [ ] AI feedback is positive only
- [ ] Timeline view exists

---

# 10. Dashboard & Gamification

- [ ] Daily macros displayed
- [ ] Calories remaining shown
- [ ] Steps/sleep displayed
- [ ] Workout status shown
- [ ] Weekly score calculated
- [ ] Streaks tracked
- [ ] Awards system implemented

---

# 11. AI Coach

- [ ] Chat UI implemented
- [ ] AI uses backend tools (not raw prompts)
- [ ] Can access:
  - [ ] User profile
  - [ ] Goals
  - [ ] Nutrition
  - [ ] Workouts
  - [ ] Recovery data
- [ ] Returns structured responses when needed

---

# 12. Pantry & Recipes

- [ ] Pantry CRUD works
- [ ] Recipe suggestions use pantry
- [ ] Suggestions consider macros remaining
- [ ] Grocery gap suggestions exist

---

# 13. Admin System

- [ ] Exercise library editable
- [ ] Substitutions configurable
- [ ] Awards configurable
- [ ] Recipes manageable
- [ ] Prompt templates editable
- [ ] AI settings configurable
- [ ] Feature flags implemented

---

# 14. Database Integrity

- [ ] All wp_fit_* tables created
- [ ] Foreign keys consistent
- [ ] High-volume data not in postmeta
- [ ] AI outputs stored separately from confirmed data

---

# 15. REST API Coverage

- [ ] Auth endpoints
- [ ] Dashboard endpoints
- [ ] Goals/calories endpoints
- [ ] Body/sleep/steps/cardio endpoints
- [ ] Training endpoints
- [ ] Workout session endpoints
- [ ] Meal/food endpoints
- [ ] Pantry endpoints
- [ ] AI endpoints
- [ ] Awards endpoints

---

# 16. AI Safety & Rules

- [ ] AI never writes DB directly
- [ ] AI uses tool calls only
- [ ] AI does not invent user data
- [ ] AI asks for clarification when uncertain
- [ ] AI uses encouraging tone
- [ ] AI avoids harmful recommendations

---

# 17. Performance & UX

- [ ] Workout logging usable one-handed
- [ ] Actions < 1–2 taps
- [ ] Fast load times
- [ ] Cached state used
- [ ] Mobile-first design validated

---

# 18. Phased Delivery

## Phase 1
- [ ] Auth
- [ ] Onboarding
- [ ] Dashboard
- [ ] Training + logging
- [ ] AI chat basic

## Phase 2
- [ ] Meal AI
- [ ] Pantry + recipes
- [ ] Progress photos

## Phase 3
- [ ] Gamification expansion
- [ ] Grocery intelligence
- [ ] Advanced AI insights

---

# PASS CRITERIA

The system is considered compliant when:
- All critical boxes are checked
- No AI unsafe behaviors detected
- Core flows function end-to-end
