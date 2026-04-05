# Johnny5k Overview

## Architecture Overview

- WordPress as the authenticated backend and admin
- Custom DB tables for fitness/nutrition data
- Custom REST API endpoints

### Front-End Options
- PWA inside WordPress  
- React / Next.js mobile web app consuming WordPress REST API  

---

## AI Layer

Use OpenAI Responses API with:
- Image input (meals, labels, progress photos)
- Function calling for app actions
- Structured JSON outputs  

---

## Product Structure

### 1. Training Engine
- Push / Pull / Legs split
- Shoulder work included daily
- Bonus arms + shoulders
- Abs + challenges
- Exercise substitutions
- Age-aware programming
- Progress tracking
- Next-day workout suggestions  

### 2. Nutrition Engine
- Calorie targets
- Weekly adjustments
- Meal logging
- Photo analysis
- Label parsing
- Saved foods/meals
- Pantry-based suggestions
- Recipe recommendations
- Grocery gap suggestions  

### 3. Recovery + Activity Engine
- Cardio logging
- Steps tracking
- Sleep tracking
- Readiness scoring
- Impact on training and calories  

### 4. Motivation + AI Coach
- AI chat
- Progress summaries
- Daily encouragement
- Gamification
- Awards / leaderboard / streaks
- Contextual advice  

---

## Core Stack

### WordPress
Used for:
- Authentication
- Admin settings
- Content management
- Recipes / articles / badges
- Prompt templates
- Feature flags  

### Custom Plugin
Handles:
- DB tables
- REST API
- AI orchestration
- Scheduled jobs
- Business logic  

---

## Database Design

Use custom tables for performance and scalability.

### Core Tables (examples)
- users_profile
- user_goals
- body_metrics
- sleep_logs
- step_logs
- cardio_logs
- workout_plans
- workout_days
- exercises
- workout_sessions
- workout_sets
- meals
- meal_items
- saved_foods
- saved_meals
- pantry_items
- progress_photos
- ai_conversations
- ai_messages
- awards / user_awards
- daily_scores  

---

## Calorie Adjustment Algorithm

Hybrid model:
- Baseline (BMR + activity + goal)
- Weekly adaptive adjustments  

---

## Training Logic

- Dynamic workout generation
- Smart substitutions
- Fatigue-aware rotation
- Progressive overload system  

---

## Mobile UX

### Workout Logging
- Fast input UI
- One-tap logging
- Preloaded data
- Smart suggestions  

### Meal Logging
- Photo input
- Saved meals
- Manual entry  

---

## Progress Photos

- Positive tone
- Trend comparisons
- Consistency tracking  

---

## AI Chat System

Tool-based approach:
- analyze_meal_photo
- generate_tomorrow_plan
- log_workout_set
- suggest_meal_from_pantry
- compare_progress_photos  

---

## Main Screens

### Dashboard
- Calories, macros, steps, sleep
- Daily plan
- Streaks and awards  

### Workout
- Session UI
- Logging tools  

### Nutrition
- Meal tracking
- Suggestions  

### Progress
- Trends
- Photos  

### AI Coach
- Chat
- Daily guidance  
