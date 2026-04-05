# Johnny5k Detailed (Full Spec)

Feature modules
A. Authentication and account module

Purpose: front-end-only access with WordPress authentication.

Includes:

user signup / login / logout
password reset
session handling
profile editing
onboarding state
account deletion request
consent / disclaimer acceptance
app preferences

Notes:

WordPress handles user accounts
app-specific user data lives in custom tables
all business logic exposed via REST endpoints
no WP admin access for normal users
B. Onboarding and profile module

Purpose: collect enough data to personalize training, calories, meals, and AI advice.

Includes:

age, sex, height, bodyweight
goal: cut / maintain / gain / recomp
target pace
training experience
injuries / joint limitations
available equipment
preferred workout days
workout session length
food preferences / dislikes
common meals
sleep / step baseline
cardio baseline
optional baseline progress photos

Outputs:

initial calorie target
macro targets
first training split
first dashboard state
C. Training engine module

Purpose: generate, track, and adapt workouts.

Includes:

push / pull / legs split
one shoulder exercise included in each major day
bonus arms + shoulders day
optional abs add-ons
optional challenge exercises
exercise swap interface
age-aware exercise selection
exercise history-aware suggestions
progression logic
readiness-aware recommendations
tomorrow plan generator

Rules:

each session can be short / medium / full
recommended exercises consider:
age
injuries
equipment
last same-type session
recent performance
soreness / readiness
system tracks completed sets, reps, weights, RIR/RPE
D. Workout logging module

Purpose: make logging extremely fast on mobile.

Includes:

one-tap start session
exercise cards
last-session reference
recommended target weight/reps
quick +2.5 / +5 / -5 weight controls
duplicate prior set
mark complete
add/remove set
swap exercise
add abs / challenge exercise quickly
notes and pain flags
workout summary
E. Cardio, steps, and sleep tracking module

Purpose: capture recovery and activity inputs that influence recommendations.

Includes:

cardio type, duration, intensity
step count entry
sleep hours and quality
optional readiness rating
weekly trends
integration into tomorrow plan and calorie adjustment logic
F. Nutrition engine module

Purpose: compute targets, track meals, and support planning.

Includes:

daily calories/macros/micros targets
calorie adjustment algorithm
meal logging
saved foods
saved standard meals
meal plan templates
pantry items
recipe suggestions
grocery gap suggestions
modifications to saved meals
AI suggestions for healthier variations
G. Meal logging with AI vision module

Purpose: make meal logging fast and realistic.

Includes:

meal photo upload
AI meal recognition
user confirmation/edit flow
optional food label photo upload
label-to-JSON parsing
store reusable foods from labels
meal item breakdown
confidence score
final confirmed meal stored as truth

Key principle:

AI suggestion is not final until user confirms
H. Progress photo module

Purpose: allow periodic visual progress tracking with positive framing.

Includes:

upload front and side photos
compare with baseline
compare with previous check-in
AI-generated positive analysis
trend timeline
photo history
optional reminder cadence

Guardrails:

encouraging tone only
no shaming language
focus on consistency, posture, physique trend, and progress markers
I. Dashboard and gamification module

Purpose: make the app sticky and motivating.

Includes:

daily calories/macros/micros progress
weekly score
current streaks
badges / awards
leaderboard-style personal progress panel
workout status
sleep/steps/cardio status
tomorrow recommendation
encouragement snippets
milestone celebrations

Example awards:

7-day logging streak
all workouts completed
protein target hit 5 days in a row
first progress photo upload
10k steps 3 days in a row
first 5 lb bodyweight loss milestone
consistency comeback
J. AI coach / chat module

Purpose: provide personalized answers based on full user data.

Includes:

contextual AI chat
workout advice
calorie and macro explanations
substitution suggestions
meal suggestions from pantry
habit coaching
recovery recommendations
motivation / encouragement
“what should I do tomorrow?” advisor

Important:

AI should call backend tools instead of relying on long raw context
AI always has current user data access through tool endpoints
K. Recipe and pantry intelligence module

Purpose: help the user make good food decisions with minimal effort.

Includes:

pantry inventory
voice or text pantry input
recipe suggestions based on:
what is available
calories left
macros left
goal
grocery completion suggestions:
“spend $6 more to unlock these meals”
quick add to meal log
save recipe as standard meal
L. Content and motivation module

Purpose: keep AI encouragement and inspiration fresh.

Includes:

daily encouragement copy
curated inspirational stories
healthy tips
featured recipes
context-specific nudges
admin-managed content blocks

Best practice:

do not live-scrape on every page
curate, cache, or manually manage approved content
M. Admin and configuration module

Purpose: let the team control the app from WordPress admin.

Includes:

exercise library management
substitutions / movement groups
awards management
recipe library
challenge exercise library
prompt templates
AI model config
token cost monitoring
AI parse review tools
app settings
feature flags
2. DB schema

Use custom tables with a WordPress prefix, for example wp_fit_*.

A. User and profile tables
wp_fit_user_profiles
id bigint unsigned pk
user_id bigint unsigned unique
first_name varchar(100)
last_name varchar(100)
date_of_birth date
sex enum('male','female','other','prefer_not_to_say')
height_cm decimal(5,2)
starting_weight_lb decimal(6,2)
current_goal enum('cut','maintain','gain','recomp')
goal_rate enum('slow','moderate','aggressive')
training_experience enum('beginner','intermediate','advanced')
activity_level enum('sedentary','light','moderate','high','athlete')
available_time_default enum('short','medium','full')
timezone varchar(100)
units enum('imperial','metric')
created_at datetime
updated_at datetime
wp_fit_user_preferences
id bigint unsigned pk
user_id bigint unsigned unique
preferred_workout_days_json longtext
equipment_available_json longtext
exercise_preferences_json longtext
exercise_avoid_json longtext
food_preferences_json longtext
food_dislikes_json longtext
common_breakfasts_json longtext
notifications_enabled tinyint(1)
voice_input_enabled tinyint(1)
redo_onboarding_allowed tinyint(1)
created_at datetime
updated_at datetime
wp_fit_user_health_flags
id bigint unsigned pk
user_id bigint unsigned
flag_type enum('injury','pain','mobility','medical_note')
body_area varchar(100)
severity enum('low','medium','high')
notes text
active tinyint(1)
created_at datetime
updated_at datetime
B. Goal and body tracking tables
wp_fit_user_goals
id bigint unsigned pk
user_id bigint unsigned
goal_type enum('cut','maintain','gain','recomp')
start_date date
target_weight_lb decimal(6,2) null
target_calories int null
target_protein_g int null
target_carbs_g int null
target_fat_g int null
target_steps int null
target_sleep_hours decimal(4,2) null
active tinyint(1)
created_at datetime
updated_at datetime
wp_fit_body_metrics
id bigint unsigned pk
user_id bigint unsigned
metric_date date
weight_lb decimal(6,2)
waist_in decimal(5,2) null
body_fat_pct decimal(5,2) null
resting_hr int null
notes text null
created_at datetime
wp_fit_sleep_logs
id bigint unsigned pk
user_id bigint unsigned
sleep_date date
hours_sleep decimal(4,2)
sleep_quality enum('poor','fair','good','great') null
notes text null
created_at datetime
wp_fit_step_logs
id bigint unsigned pk
user_id bigint unsigned
step_date date
steps int
created_at datetime
wp_fit_cardio_logs
id bigint unsigned pk
user_id bigint unsigned
cardio_date date
cardio_type varchar(100)
duration_minutes int
intensity enum('light','moderate','hard')
distance decimal(6,2) null
estimated_calories int null
notes text null
created_at datetime
C. Exercise library and programming tables
wp_fit_exercises
id bigint unsigned pk
slug varchar(150) unique
name varchar(150)
movement_pattern varchar(100)
primary_muscle varchar(100)
secondary_muscles_json longtext
equipment varchar(100)
difficulty enum('beginner','intermediate','advanced')
age_friendliness_score tinyint unsigned
joint_stress_score tinyint unsigned
spinal_load_score tinyint unsigned
default_rep_min int
default_rep_max int
default_sets int
default_progression_type enum('double_progression','load_progression','top_set_backoff')
coaching_cues_json longtext
active tinyint(1)
created_at datetime
updated_at datetime
wp_fit_exercise_substitutions
id bigint unsigned pk
exercise_id bigint unsigned
substitute_exercise_id bigint unsigned
reason_code enum('equipment','joint_friendly','skill_level','variation')
priority int
created_at datetime
wp_fit_program_templates
id bigint unsigned pk
name varchar(150)
goal_type enum('cut','maintain','gain','recomp')
experience_level enum('beginner','intermediate','advanced')
active tinyint(1)
created_at datetime
updated_at datetime
wp_fit_program_template_days
id bigint unsigned pk
program_template_id bigint unsigned
day_type enum('push','pull','legs','arms_shoulders','cardio','rest')
default_order int
time_tier enum('short','medium','full')
notes text null
created_at datetime
wp_fit_program_template_exercises
id bigint unsigned pk
template_day_id bigint unsigned
exercise_id bigint unsigned
slot_type enum('main','secondary','shoulders','accessory','abs','challenge')
priority int
rep_min int
rep_max int
sets_target int
rir_target decimal(3,1) null
optional tinyint(1)
created_at datetime
D. User training plan and logs
wp_fit_user_training_plans
id bigint unsigned pk
user_id bigint unsigned
program_template_id bigint unsigned null
name varchar(150)
start_date date
end_date date null
active tinyint(1)
created_at datetime
updated_at datetime
wp_fit_user_training_days
id bigint unsigned pk
training_plan_id bigint unsigned
day_type enum('push','pull','legs','arms_shoulders','cardio','rest')
day_order int
time_tier enum('short','medium','full')
created_at datetime
updated_at datetime
wp_fit_user_training_day_exercises
id bigint unsigned pk
training_day_id bigint unsigned
exercise_id bigint unsigned
slot_type enum('main','secondary','shoulders','accessory','abs','challenge')
rep_min int
rep_max int
sets_target int
rir_target decimal(3,1) null
sort_order int
active tinyint(1)
created_at datetime
updated_at datetime
wp_fit_workout_sessions
id bigint unsigned pk
user_id bigint unsigned
session_date date
planned_day_type enum('push','pull','legs','arms_shoulders','cardio','rest')
actual_day_type enum('push','pull','legs','arms_shoulders','cardio','rest')
time_tier enum('short','medium','full')
readiness_score tinyint unsigned null
started_at datetime null
completed_at datetime null
duration_minutes int null
completed tinyint(1)
ai_summary text null
created_at datetime
updated_at datetime
wp_fit_workout_session_exercises
id bigint unsigned pk
session_id bigint unsigned
exercise_id bigint unsigned
slot_type enum('main','secondary','shoulders','accessory','abs','challenge')
planned_rep_min int
planned_rep_max int
planned_sets int
sort_order int
was_swapped tinyint(1)
original_exercise_id bigint unsigned null
notes text null
created_at datetime
wp_fit_workout_sets
id bigint unsigned pk
session_exercise_id bigint unsigned
set_number int
weight decimal(6,2)
reps int
rir decimal(3,1) null
rpe decimal(3,1) null
completed tinyint(1)
pain_flag tinyint(1)
notes text null
created_at datetime
updated_at datetime
wp_fit_exercise_performance_snapshots
id bigint unsigned pk
user_id bigint unsigned
exercise_id bigint unsigned
snapshot_date date
best_weight decimal(6,2) null
best_reps int null
best_volume int null
estimated_1rm decimal(7,2) null
notes text null
created_at datetime
E. Nutrition and meal tracking
wp_fit_foods
id bigint unsigned pk
user_id bigint unsigned null
canonical_name varchar(200)
brand varchar(150) null
serving_size varchar(100)
serving_grams decimal(6,2) null
calories int
protein_g decimal(6,2)
carbs_g decimal(6,2)
fat_g decimal(6,2)
fiber_g decimal(6,2) null
sugar_g decimal(6,2) null
sodium_mg decimal(8,2) null
micros_json longtext null
source enum('manual','label','ai_photo','recipe','system')
label_json longtext null
active tinyint(1)
created_at datetime
updated_at datetime
wp_fit_saved_meals
id bigint unsigned pk
user_id bigint unsigned
name varchar(150)
meal_type enum('breakfast','lunch','dinner','snack')
items_json longtext
calories int
protein_g decimal(6,2)
carbs_g decimal(6,2)
fat_g decimal(6,2)
micros_json longtext null
created_at datetime
updated_at datetime
wp_fit_meals
id bigint unsigned pk
user_id bigint unsigned
meal_datetime datetime
meal_type enum('breakfast','lunch','dinner','snack')
source enum('manual','saved_meal','photo','label','recipe')
ai_confidence decimal(4,3) null
confirmed tinyint(1)
notes text null
created_at datetime
updated_at datetime
wp_fit_meal_items
id bigint unsigned pk
meal_id bigint unsigned
food_id bigint unsigned null
food_name varchar(200)
serving_amount decimal(8,2)
serving_unit varchar(50)
calories int
protein_g decimal(6,2)
carbs_g decimal(6,2)
fat_g decimal(6,2)
fiber_g decimal(6,2) null
sugar_g decimal(6,2) null
sodium_mg decimal(8,2) null
micros_json longtext null
source_json longtext null
created_at datetime
wp_fit_pantry_items
id bigint unsigned pk
user_id bigint unsigned
item_name varchar(150)
quantity decimal(8,2) null
unit varchar(50) null
expires_on date null
created_at datetime
updated_at datetime
wp_fit_recipe_suggestions
id bigint unsigned pk
user_id bigint unsigned
recipe_name varchar(200)
ingredients_json longtext
instructions_json longtext
estimated_calories int
estimated_protein_g decimal(6,2)
estimated_carbs_g decimal(6,2)
estimated_fat_g decimal(6,2)
fits_goal tinyint(1)
created_at datetime
F. AI image and label parsing support
wp_fit_media_analysis_jobs
id bigint unsigned pk
user_id bigint unsigned
job_type enum('meal_photo','food_label','progress_photo')
attachment_id bigint unsigned null
input_metadata_json longtext null
raw_ai_response longtext null
parsed_json longtext null
status enum('pending','processing','completed','failed','needs_review')
created_at datetime
updated_at datetime
wp_fit_progress_photos
id bigint unsigned pk
user_id bigint unsigned
photo_date date
angle enum('front','side','back')
attachment_id bigint unsigned
analysis_json longtext null
comparison_first_json longtext null
comparison_previous_json longtext null
encouragement_text text null
created_at datetime
G. Gamification
wp_fit_awards
id bigint unsigned pk
code varchar(100) unique
name varchar(150)
description text
icon varchar(255) null
points int
active tinyint(1)
created_at datetime
updated_at datetime
wp_fit_user_awards
id bigint unsigned pk
user_id bigint unsigned
award_id bigint unsigned
awarded_at datetime
context_json longtext null
wp_fit_daily_scores
id bigint unsigned pk
user_id bigint unsigned
score_date date
nutrition_score int
training_score int
recovery_score int
consistency_score int
total_score int
created_at datetime
updated_at datetime
H. AI chat support
wp_fit_ai_threads
id bigint unsigned pk
user_id bigint unsigned
thread_key varchar(150) unique
summary_text text null
created_at datetime
updated_at datetime
wp_fit_ai_messages
id bigint unsigned pk
thread_id bigint unsigned
role enum('system','user','assistant','tool')
message_text longtext null
tool_name varchar(150) null
tool_payload_json longtext null
created_at datetime
3. REST endpoints

Namespace suggestion:

/wp-json/fit/v1/

A. Auth/session-adjacent endpoints

You may still use WP auth, but these are app convenience routes.

GET /me
returns app-ready profile, goals, dashboard summary
POST /onboarding/start
POST /onboarding/complete
POST /onboarding/restart
PUT /profile
PUT /preferences
B. Dashboard endpoints
GET /dashboard/today
calories, macros, micros, steps, sleep, planned workout, tomorrow plan, awards
GET /dashboard/week
weekly trends, score breakdown, streaks, compliance
GET /dashboard/leaderboard
personal leaderboard / milestones view
C. Goal and calorie endpoints
GET /goals/current
POST /goals
PUT /goals/{id}
POST /calories/recalculate-initial
based on onboarding/profile
POST /calories/adjust-weekly
runs adjustment algorithm
GET /calories/history
previous targets and reasons for changes

Response example:

{
  "current_target_calories": 2350,
  "current_macros": {
    "protein_g": 190,
    "carbs_g": 180,
    "fat_g": 75
  },
  "change_reason": "Weight loss slower than target over last 14 days with good adherence.",
  "prior_target_calories": 2500
}
D. Body, steps, sleep, cardio endpoints
POST /body-metrics
GET /body-metrics
GET /body-metrics/trends
POST /sleep
GET /sleep
GET /sleep/trends
POST /steps
GET /steps
GET /steps/trends
POST /cardio
GET /cardio
GET /cardio/trends
E. Training plan endpoints
GET /training-plan/current
POST /training-plan/generate
POST /training-plan/regenerate
PUT /training-plan/day/{id}
POST /training-plan/day/{id}/swap-exercise
POST /training-plan/day/{id}/add-abs
POST /training-plan/day/{id}/add-challenge
GET /training-plan/tomorrow
tomorrow’s recommendation and why
GET /exercises
GET /exercises/{id}
GET /exercises/{id}/history
GET /exercises/{id}/substitutions
F. Workout session endpoints
POST /workouts/session/start
GET /workouts/session/{id}
POST /workouts/session/{id}/complete
POST /workouts/session/{id}/exercise/add
PUT /workouts/session-exercise/{id}
DELETE /workouts/session-exercise/{id}
POST /workouts/session-exercise/{id}/sets
PUT /workouts/sets/{id}
DELETE /workouts/sets/{id}
POST /workouts/session/{id}/swap-exercise
POST /workouts/session/{id}/quick-add-abs
POST /workouts/session/{id}/quick-add-challenge
GET /workouts/history
GET /workouts/day-history/{dayType}
GET /workouts/recommendation/{dayType}
G. Foods, meals, pantry, planning
GET /foods/search
POST /foods
PUT /foods/{id}
GET /saved-meals
POST /saved-meals
PUT /saved-meals/{id}
DELETE /saved-meals/{id}
POST /meals
PUT /meals/{id}
GET /meals
GET /meals/day/{date}
DELETE /meals/{id}
POST /pantry-items
GET /pantry-items
PUT /pantry-items/{id}
DELETE /pantry-items/{id}
POST /meal-planner/suggest
POST /meal-planner/modify-standard-meal
POST /recipes/suggest-from-pantry
POST /recipes/grocery-gap-suggestions
H. AI image workflows
POST /ai/analyze-meal-photo
upload reference or media id
returns candidate foods and estimates
POST /ai/confirm-meal-photo
user confirms edited result
stores meal and items
POST /ai/parse-food-label
returns structured label JSON
POST /ai/confirm-food-label
stores reusable food item
POST /ai/analyze-progress-photo
processes new photos
GET /progress-photos
POST /progress-photos
GET /progress-photos/timeline
I. Awards and scoring
GET /awards
GET /awards/earned
GET /scores/daily
GET /scores/weekly
J. AI chat endpoints
POST /ai/chat
message in, structured AI response out
backend decides which internal tools to call
GET /ai/thread
POST /ai/thread/reset
GET /ai/daily-encouragement
GET /ai/screen-tip/{screen}
K. Admin-only operational endpoints

These may be internal only, not public app routes.

POST /admin/exercises/import
POST /admin/awards/recompute
POST /admin/calories/recompute-all
GET /admin/ai-jobs
POST /admin/ai-jobs/{id}/retry
4. Screen-by-screen UX

The front end should be a bottom-tab mobile app layout.

Suggested tabs:

Home
Workout
Nutrition
Progress
Coach
A. Splash / auth screens
1. Welcome screen

Purpose:

clear value proposition
login / create account

Elements:

app logo
short headline
“Log In”
“Create Account”
disclaimer link
2. Login screen

Elements:

email
password
forgot password
sign in
create account link
3. Signup screen

Elements:

name
email
password
accept terms
continue to onboarding
B. Onboarding flow
4. Onboarding step 1: body basics

Fields:

age
sex
height
current weight
5. Onboarding step 2: goal

Fields:

lose fat
maintain
gain muscle
recomposition
target pace
6. Onboarding step 3: training background

Fields:

beginner/intermediate/advanced
days per week
typical session length
confidence with lifting
7. Onboarding step 4: injuries and limits

Fields:

shoulders / knees / back / elbows etc.
movement discomfort
exercises to avoid
8. Onboarding step 5: equipment

Fields:

full gym
dumbbells only
machines
home gym
bodyweight only
9. Onboarding step 6: food habits

Fields:

preferred foods
disliked foods
common breakfast/lunch options
meal frequency
10. Onboarding step 7: baseline habits

Fields:

average sleep
average steps
cardio frequency
11. Onboarding step 8: optional progress photos

Fields:

upload front
upload side
12. Onboarding summary screen

Shows:

starting calorie target
macro target
first week workout split
first suggested meals
encouraging AI message
“Start My Plan”
C. Home tab
13. Home dashboard

This is the primary screen.

Top section:

greeting
small encouraging AI line
today’s date

Main cards:

calories remaining
protein/carbs/fat progress
key micros summary
steps today
sleep last night
today’s planned session
tomorrow’s recommendation
weekly score
streaks and recent award

Quick actions:

log meal
start workout
add sleep
add cardio
ask AI

Bottom content:

“Healthy story / inspiration”
“Today’s tip”
“Suggested small win”
D. Workout tab
14. Workout plan overview

Shows:

current week layout
today highlighted
tomorrow preview
reschedule day option
regenerate plan option
15. Start workout screen

Shows:

day type
estimated time
exercises list
optional abs/challenge additions
readiness check prompt

Buttons:

start session
swap exercise
shorten session
add abs
add challenge
16. Active workout logging screen

This is the most important UX screen.

For each exercise card:

exercise name
tiny muscle tag
last session performance
today recommendation
set rows with large inputs
quick controls for weight
rep input
rir optional
complete button

Sticky controls:

add set
swap exercise
add abs
add challenge
finish workout

Must be optimized for one-hand tapping.

17. Exercise swap modal

Shows:

recommended substitutions
reason tags like:
easier on shoulders
equipment available
lower back friendly
similar stimulus
18. Workout summary screen

Shows:

completed exercises
total sets
volume summary
PRs or improvements
AI recap
next recommendation
E. Nutrition tab
19. Nutrition dashboard

Shows:

today’s meals
calories/macros remaining
meal plan suggestions
saved meals shortcuts
pantry-based suggestions

Quick actions:

photo meal
saved meal
manual entry
scan label
20. Meal photo capture screen
camera or upload
meal type select
capture button
21. Meal AI review screen

Shows:

detected meal items
estimated portions
calories/macros
edit each item
confirm meal

Buttons:

add missing item
edit serving
remove item
confirm and save
22. Food label scan screen
capture label photo
crop if needed
analyze
23. Label review screen

Shows:

product name
serving size
calories/macros/micros JSON converted to form fields
confirm and save reusable food
24. Saved meals screen

Shows:

standard meals list
one-tap log
edit meal
duplicate
AI healthier variation suggestion
25. Pantry screen

Shows:

pantry items
add via typing
add via voice
expiring soon
recipe suggestions based on pantry
26. Recipe suggestions screen

Shows:

recipes based on pantry and macros left
estimated prep effort
grocery gap tag if needed
27. Grocery completion screen

Shows:

what user has
what small purchase unlocks
grocery list
meal suggestions unlocked
F. Progress tab
28. Body progress screen

Shows:

weight trend graph
weekly averages
calories target history
adherence summary
29. Recovery trends screen

Shows:

sleep trend
steps trend
cardio consistency
workout compliance
30. Progress photos screen

Shows:

baseline vs latest
previous vs latest
AI encouraging analysis
upload new check-in
31. Awards screen

Shows:

badges earned
next possible awards
personal milestones
G. Coach tab
32. AI coach chat screen

Shows:

chat history
suggestions chips:
what should I eat tonight
what should I lift tomorrow
can I swap this exercise
why did my calories change
what should I buy at the grocery store

AI should respond with context-aware answers grounded in user data.

33. AI action response cards

Some answers should render as structured cards, not plain chat text:

workout suggestion card
grocery list card
recipe card
calorie explanation card
recovery suggestion card
H. Utility screens
34. Notifications/reminders screen
workout reminders
meal reminders
progress photo reminders
sleep logging reminders
35. Settings screen
units
AI chat tone
preferences
privacy settings
redo onboarding
log out
5. AI tools/prompts

The AI should not directly write arbitrary DB rows. It should call internal app tools.

A. Core AI tools

These are conceptual tool definitions your backend exposes internally.

Profile/context tools
get_user_profile(user_id)
get_user_goal_state(user_id)
get_dashboard_context(user_id, date)
get_recent_adherence(user_id, days)
Training tools
get_recent_workout_history(user_id, day_type, limit)
get_exercise_history(user_id, exercise_id, limit)
generate_workout_day(user_id, day_type, time_tier)
swap_exercise(user_id, session_id, exercise_id, reason)
suggest_abs_exercises(user_id, day_type, intensity)
suggest_challenge_exercises(user_id, day_type, intensity)
recommend_next_load(user_id, exercise_id)
Recovery tools
get_sleep_trend(user_id, days)
get_steps_trend(user_id, days)
get_cardio_trend(user_id, days)
get_readiness_snapshot(user_id)
Nutrition tools
get_daily_nutrition_status(user_id, date)
search_foods(user_id, query)
get_saved_meals(user_id)
suggest_meal_modification(user_id, saved_meal_id, modification_text)
suggest_recipes_from_pantry(user_id)
suggest_grocery_gap_meals(user_id)
calculate_macro_targets(user_id)
adjust_calorie_target(user_id)
Image analysis tools
analyze_meal_photo(user_id, attachment_id)
parse_food_label(user_id, attachment_id)
analyze_progress_photo(user_id, attachment_ids[])
Logging tools
log_workout_set(user_id, session_exercise_id, weight, reps, rir, rpe)
log_cardio(user_id, payload)
log_sleep(user_id, payload)
log_steps(user_id, payload)
create_meal_from_confirmed_items(user_id, payload)
Motivation/gamification tools
get_user_awards(user_id)
get_weekly_score(user_id)
evaluate_new_awards(user_id)
B. System prompt for the AI coach

Use a stable system prompt like this:

You are the user's supportive AI fitness, nutrition, and recovery coach inside a mobile app.

Your job is to provide practical, accurate, personalized guidance based on the user's real tracked data.

You must:
- Use available tools before making claims about the user's recent workouts, meals, bodyweight, calories, sleep, steps, cardio, or progress.
- Prioritize safety, especially for users with age-related considerations, injuries, fatigue, or pain flags.
- Be encouraging, positive, and specific.
- Explain recommendations simply.
- Recommend gradual adjustments, not extreme ones.
- Treat user-confirmed app data as the source of truth.
- When discussing calories, use the app's adjustment logic and recent adherence/trend data.
- When suggesting workouts, account for recent same-day training history, recovery, equipment, and exercise variations.
- When suggesting substitutions, prefer movements with similar training effect and lower injury risk where appropriate.
- When analyzing progress photos, be uplifting and avoid shaming, harsh judgment, or extreme body commentary.
- When meal photos or label scans are uncertain, ask the user to confirm or correct the items rather than pretending certainty.

You must not:
- Invent user data that has not been retrieved.
- Recommend dangerous or reckless dieting or training.
- Present AI-estimated meal or photo analysis as final until confirmed by the user.
- Override confirmed user records silently.
C. Prompt for generating tomorrow’s workout plan
Generate tomorrow's recommended plan for the user.

Inputs to consider:
- current goal
- current calorie target
- recent workout completion
- today's and yesterday's training
- recent sleep, steps, cardio, and readiness
- recent same-split session history
- age and injury flags
- available session duration

Rules:
- choose one of: push, pull, legs, arms_shoulders, cardio, rest
- include one shoulder exercise if the day is push, pull, or legs
- prefer low-risk, age-appropriate choices when needed
- avoid repeating the exact same pattern too aggressively when recent fatigue or pain exists
- include optional abs and challenge suggestions if appropriate
- output a short rationale the user can understand

Suggested output schema:

{
  "recommended_day_type": "push",
  "time_tier": "medium",
  "reasoning_summary": "You slept well, steps were solid, and your last pull session was yesterday, so push is the best fit.",
  "main_exercises": [],
  "optional_abs": [],
  "optional_challenge": [],
  "recovery_note": ""
}
D. Prompt for calorie adjustment
Review the user's recent bodyweight trend, adherence, logged calories, cardio, steps, and workout completion.

Determine whether calorie targets should stay the same, increase slightly, or decrease slightly.

Rules:
- use weekly averages, not single weigh-ins
- do not reduce calories if adherence is too low to judge effectiveness
- prefer small changes, usually 100 to 150 kcal
- protect recovery and protein intake
- explain the reason in plain language
- do not make aggressive changes unless specifically configured by the system

Output schema:

{
  "action": "decrease",
  "delta_calories": 150,
  "new_target_calories": 2350,
  "macro_targets": {
    "protein_g": 190,
    "carbs_g": 180,
    "fat_g": 75
  },
  "reason": "Your average weight loss has been slower than target for two weeks, and your adherence is strong, so a small reduction is appropriate."
}
E. Prompt for workout recommendation by day type
Build a workout for the requested day type.

Constraints:
- output 5 to 6 exercises for full sessions
- 4 to 5 for medium sessions
- 3 to 4 for short sessions
- include one shoulder exercise on push, pull, and legs
- consider age, joint stress, injury flags, equipment, and recent session history
- avoid poor exercise redundancy with the previous same-day session
- include set and rep targets
- include optional abs and challenge movements when appropriate
- keep the plan practical for mobile display

Output schema:

{
  "day_type": "pull",
  "time_tier": "medium",
  "exercises": [
    {
      "exercise_id": 12,
      "slot_type": "main",
      "sets": 3,
      "rep_min": 6,
      "rep_max": 8,
      "target_note": "Aim to match or beat last week's top set."
    }
  ],
  "optional_abs": [],
  "optional_challenge": []
}
F. Prompt for meal photo analysis
Analyze the meal image and estimate likely food items, approximate portion sizes, and nutrition.

Important rules:
- provide best estimates, not false certainty
- return confidence by item
- identify ambiguities clearly
- produce structured meal items the user can confirm or edit
- if the image is not clear, say so

Output schema:

{
  "meal_type_guess": "lunch",
  "overall_confidence": 0.78,
  "items": [
    {
      "name": "grilled chicken breast",
      "estimated_serving": "6 oz",
      "calories": 280,
      "protein_g": 53,
      "carbs_g": 0,
      "fat_g": 6,
      "confidence": 0.83
    }
  ],
  "uncertainties": [
    "Possible oil or dressing not clearly visible."
  ]
}
G. Prompt for food label parsing
Extract the nutrition facts and product identity from the food label image.

Return a clean structured result that can be stored for reuse.

If fields are unclear, leave them null and note uncertainty rather than guessing.

Output schema:

{
  "product_name": "Low Carb Wrap",
  "brand": "Example Brand",
  "serving_size": "1 wrap",
  "serving_grams": 45,
  "calories": 70,
  "protein_g": 5,
  "carbs_g": 16,
  "fat_g": 2,
  "fiber_g": 11,
  "sugar_g": 1,
  "sodium_mg": 210,
  "micros": {},
  "confidence": 0.92
}
H. Prompt for progress photo analysis
Compare the user's new progress photos with the earliest baseline and the previous check-in.

Focus on:
- positive visual trends
- posture
- consistency indicators
- general physique changes
- encouraging observations

Do not shame, criticize harshly, or make medical claims.
Do not overstate certainty.
Keep the tone warm, supportive, and uplifting.

Output schema:

{
  "summary": "You look noticeably more consistent and a bit tighter through the midsection compared with your baseline.",
  "baseline_comparison": [
    "Posture appears slightly more upright.",
    "Your waist area looks a bit leaner from the side view."
  ],
  "previous_comparison": [
    "Changes are subtle but moving in a positive direction."
  ],
  "encouragement": "This is the kind of steady progress that usually comes from showing up consistently. Keep stacking weeks like this."
}
I. Prompt for saved meal modification suggestions
The user has a standard meal and may want a healthier, lower-calorie, higher-protein, or more varied version.

Use the current meal composition and the user's goal to suggest one smart modification.

Keep it practical and realistic.

Output schema:

{
  "modification_type": "higher_protein",
  "suggestion": "Keep the two eggs and wrap, but add 100 g of egg whites for more protein with minimal extra calories.",
  "estimated_delta": {
    "calories": 50,
    "protein_g": 10,
    "carbs_g": 0,
    "fat_g": 0
  }
}
J. Prompt for pantry-based suggestions
Given what the user has on hand, what calories/macros remain today, and the user's current goal, suggest meals or snacks.

Prefer:
- meals using what they already have
- realistic prep effort
- strong protein alignment
- good fit with remaining calories/macros

Optionally include low-cost grocery additions if a small purchase would unlock better options.

Output schema:

{
  "suggestions": [
    {
      "name": "Greek yogurt berry bowl",
      "uses_pantry_items": ["greek yogurt", "berries"],
      "estimated_calories": 240
    }
  ],
  "small_purchase_options": [
    {
      "item": "bagged salad mix",
      "estimated_cost": 4.5,
      "unlocks": ["chicken salad wrap", "high-volume side salad"]
    }
  ]
}
Recommended implementation order
Phase 1
auth
onboarding
bodyweight / sleep / steps / cardio logging
calorie engine
training plan generation
workout logging
dashboard
AI chat with user-context tools
Phase 2
saved meals
meal logging
meal photo analysis
label parsing
pantry and recipes
progress photo module
Phase 3
deeper gamification
grocery gap intelligence
richer recovery scoring
advanced AI summaries
content/inspiration management
Final architecture summary
Front end
React mobile PWA
bottom-tab navigation
camera support
fast forms and cached state
mobile-first UX
Backend
WordPress plugin
custom DB tables
REST API routes
WP auth
media library for images
cron jobs for score/award recalculation
AI integration
OpenAI API
structured outputs
image analysis
internal tool orchestration
prompt templates managed in admin

If you want, the next useful step is for me to turn this into a plugin folder architecture + endpoint contract spec + React screen/component map.