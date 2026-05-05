# First 14 Days Implementation Checklist

This turns the first-14-days product spec into a build sequence tied to the current Johnny5k PWA structure.

Related spec:

- `docs/first-14-days-experience-prd.md`

## Current Seams Already In The Product

Use these instead of inventing a second system:

- onboarding flow: `src/screens/onboarding/OnboardingRoutes.jsx`
- IronQuest onboarding branch: `src/screens/onboarding/IronQuestOnboardingFlow.jsx`
- dashboard composition: `src/screens/dashboard/hooks/useDashboardViewModel.jsx`
- dashboard card registry: `src/screens/dashboard/dashboardCardRegistry.js`
- beginner education card: `src/screens/dashboard/components/dashboardEducationCards.jsx`
- coaching prompt builder: `src/lib/coaching/coachingSummaryPrompts.js`
- dashboard recommendation logic: `src/screens/dashboard/dashboardRecommendationHelpers.js`
- daily check-in inputs: `src/lib/dailyCheckIn.js`
- IronQuest hub and daily objectives: `src/screens/ironquest/IronQuestScreen.jsx`
- IronQuest missions content: `iron_quest/config/missions.json`

## Build Strategy

Do not build four disconnected onboarding systems.

Build one shared first-14-days layer with:

- `track`: `standard_beginner`, `standard_experienced`, `ironquest_beginner`, `ironquest_experienced`
- `day_index`: relative day since onboarding completion or trial start
- shared plan generation rules
- different copy, simplification, rewards, and mission framing by track

## Proposed New Shared Objects

## 1. `first14DayPlan`

This should become the structured source of truth for the daily guided experience.

Suggested fields:

```js
{
  track: 'standard_beginner',
  day_index: 3,
  phase: 'friction' | 'rhythm' | 'adaptation' | 'commitment',
  primary_goal: {
    title: 'Do the 18-minute starter workout',
    category: 'workout',
  },
  workout_assignment: {
    type: 'starter_full_body_a',
    duration_minutes: 18,
    time_window: '18:00',
    rescue_available: true,
    instruction_mode: 'guided',
  },
  nutrition_assignment: {
    target: 'Log 3 meals',
    next_meal_target: '30g protein at dinner',
  },
  recovery_assignment: {
    target_sleep_hours: 7.5,
    bedtime_target: '21:30',
  },
  backup_plan: {
    title: '8-minute rescue version',
    minimum_win: 'Rescue workout plus dinner log',
  },
  education_cards: ['set-effort', 'protein-basics'],
  reward_hooks: ['first_workout', 'meal_rhythm'],
  conversion_state: {
    trial_day: 3,
    paywall_window: false,
  },
}
```

## 2. `starterWorkoutTemplate`

Use this to avoid hard-coding one-off beginner sessions.

Suggested fields:

```js
{
  id: 'starter_full_body_a',
  audience: 'beginner',
  effort_cap: '2-3 reps left',
  estimated_minutes: 18,
  exercise_count: 3,
  substitutions: [],
  rescue_variant_id: 'starter_full_body_a_rescue',
  education_tags: ['tempo', 'effort', 'rest-times'],
}
```

## 3. `dailyPlanWalkthrough`

Use this for the guided "Johnny walks me through today" flow.

Suggested sections:

- main job
- workout
- next meal
- sleep close
- backup plan

## Phase 1: Foundation

## 1. Define Track Detection

Files:

- `src/screens/onboarding/OnboardingRoutes.jsx`
- `src/store/authStore.js`
- likely shared helper under `src/lib/`

Tasks:

- derive beginner vs experienced from `training_experience` and `workout_confidence`
- derive standard vs IronQuest from experience mode / IronQuest entitlement
- create one helper that returns the first-14-days track string
- make sure the resolved track is available on dashboard load and onboarding completion

Acceptance:

- every onboarded user resolves into one of the four tracks
- track resolution is inspectable and deterministic

## 2. Define Day Index

Files:

- onboarding completion path in `src/screens/onboarding/OnboardingRoutes.jsx`
- dashboard hydration path in `src/screens/dashboard/hooks/useDashboardViewModel.jsx`

Tasks:

- pick one canonical start date:
  - preferred: onboarding completion date
  - fallback: trial start date if available
- add a helper to compute relative day 1-14
- clamp values below 1 and above 14 cleanly

Acceptance:

- the app can compute a stable `day_index`
- existing users without a clean start date fall back predictably

## 3. Create First-14-Days Rules Module

New file suggestion:

- `src/lib/first14Days/first14DaysPlan.js`

Tasks:

- map `day_index` into 4 phases:
  - days 1-3 friction removal
  - days 4-7 rhythm
  - days 8-10 adaptation
  - days 11-14 commitment
- emit a structured `first14DayPlan`
- branch by track without duplicating the whole object

Acceptance:

- one function can generate a structured plan from current app state
- output can be rendered on dashboard without AI dependency

## Phase 2: Dashboard Anchor

## 4. Add `Johnny's Plan For Today` Dashboard Card

Files:

- `src/screens/dashboard/dashboardCardRegistry.js`
- `src/screens/dashboard/hooks/useDashboardViewModel.jsx`
- new component under `src/screens/dashboard/components/`

Tasks:

- add a new dashboard card id such as `first14_plan`
- place it at the top of `primary_main` for users in days 1-14
- render:
  - main job
  - workout time
  - next meal target
  - sleep close
  - backup plan CTA
  - ask Johnny CTA
- make the card collapse into the normal coaching stack after day 14

Acceptance:

- users in the first 14 days see a concrete day plan before generic coaching
- the card works in both standard and IronQuest modes

## 5. Upgrade Coaching Prompting To Use `first14DayPlan`

Files:

- `src/lib/coaching/coachingSummaryPrompts.js`
- `src/screens/dashboard/dashboardRecommendationHelpers.js`
- `src/screens/dashboard/hooks/useDashboardViewModel.jsx`

Tasks:

- add a starter prompt builder that includes:
  - track
  - day index
  - main job
  - backup plan
- make "Ask Johnny" for first-14-days users default to plan walkthrough prompts instead of generic summary prompts
- keep existing coaching summary prompts for post-day-14 flows

Acceptance:

- Johnny responses during the trial period start from today's plan, not generic open-ended coaching

## 6. Add Guided Walkthrough Flow

Files:

- new component under `src/components/ai/` or dashboard components
- `src/screens/dashboard/DashboardScreen.jsx`
- `src/components/ai/JohnnyAssistantDrawer.jsx` if needed for handoff

Tasks:

- add `Johnny Walk Me Through Today`
- make it a structured 3-5 panel flow, not a blank chat handoff
- panels:
  - main job
  - workout
  - food
  - sleep
  - backup plan
- allow one button to open workout or nutrition directly from each panel

Acceptance:

- a new beginner can tap once and understand the full day without reading multiple screens

## Phase 3: Beginner Safety And Fallbacks

## 7. Build Rescue Mode

Files:

- workout planning and/or store logic under `src/store/workoutStore.js`
- workout UI in `src/screens/workout/WorkoutScreen.jsx`
- dashboard helpers in `src/screens/dashboard/dashboardRecommendationHelpers.js`

Tasks:

- create a first-class rescue state for first-14-days users
- every beginner workout assignment needs:
  - full version
  - rescue version
  - explicit minimum win
- add dashboard CTA: `Use rescue version`
- add copy that preserves momentum instead of framing the day as failed

Acceptance:

- users can downgrade the day without abandoning it
- rescue completions still count for momentum logic and, in IronQuest, daily objectives where appropriate

## 8. Expand Beginner Teaching Layer

Files:

- `src/screens/dashboard/components/dashboardEducationCards.jsx`
- workout surface under `src/screens/workout/WorkoutScreen.jsx`
- nutrition surface under `src/screens/nutrition/NutritionScreen.jsx`

Tasks:

- reuse existing education card ids where possible
- add plan-linked education tags from `first14DayPlan`
- add compact beginner help blocks:
  - how hard should this feel
  - how to swap an exercise
  - what to eat after
  - what soreness is normal
  - what counts as enough today
- keep explanations short and local to the task

Acceptance:

- beginners do not have to leave the current task to understand what to do

## Phase 4: Starter Workout Library

## 9. Build The First 14-Day Starter Workout Set

Files:

- likely workout templates/config wherever current starter workout lives
- `src/screens/workout/WorkoutScreen.jsx`
- possibly `src/store/workoutStore.js`

Tasks:

- add the minimum set:
  - Full Body A
  - Full Body B
  - Full Body C
  - 8-Minute Rescue Workout
  - Low-Impact Cardio / Walk Day
  - Recovery Mobility Day
  - First Boss / Confidence Workout
- each workout needs:
  - time estimate
  - effort ceiling
  - substitutions
  - rescue version
  - clear completion criteria

Acceptance:

- the first two weeks do not rely on one repeated starter session
- beginner tracks can rotate structure without losing simplicity

## 10. Connect Daily Check-In To Plan Adaptation

Files:

- `src/lib/dailyCheckIn.js`
- dashboard hydration and recommendation logic
- workout plan resolution path

Tasks:

- keep existing daily check-in fields
- add one more practical constraint if needed:
  - time available today
- let answers change:
  - workout assignment
  - rescue recommendation
  - tone of the day plan
- do not overcomplicate with too many branching questions

Acceptance:

- the user can say "low energy" or "stressed" and see the day plan change

## Phase 5: IronQuest Layer

## 11. Map `first14DayPlan` Into IronQuest Daily Objectives

Files:

- `src/screens/ironquest/IronQuestScreen.jsx`
- supporting IronQuest lib files as needed

Tasks:

- keep existing daily objectives:
  - workout mission
  - meal quest
  - recovery watch
  - cardio task
  - travel points
- add plan-aware copy so these feel like today's campaign jobs
- for beginner IronQuest users, make objective descriptions simpler and more protective

Acceptance:

- IronQuest daily objectives match the guided day plan instead of feeling disconnected

## 12. Extend Free-Arc Mission Content

Files:

- `iron_quest/config/missions.json`
- optional supporting docs under `iron_quest/docs/`

Tasks:

- expand the training grounds into a real 14-day free arc:
  - 5-7 training missions
  - 2 cardio/travel missions
  - 2 recovery/tavern days
  - 1 boss/capstone mission
- keep beginner missions low punishment and instruction-heavy
- ensure meals, sleep, steps, and rescue workouts advance progress visibly

Acceptance:

- beginner IronQuest feels like a mini-campaign, not just a mission demo

## 13. Add "Johnny Explains Today's Quest In Plain English"

Files:

- `src/screens/ironquest/IronQuestScreen.jsx`
- mission launch surface
- possibly prompt helpers tied to IronQuest story flow

Tasks:

- add a toggle or card that translates fantasy framing into plain-language action
- example:
  - quest copy: `Clear the Trial Lane`
  - plain English: `Do your 18-minute starter workout. Keep every set controlled.`

Acceptance:

- first-time exercisers can enjoy the theme without being confused about the real action

## Phase 6: Conversion

## 14. Build Day-14 Recap

Files:

- dashboard or dedicated modal/screen
- data assembly likely from dashboard/coaching summary sources

Tasks:

- show:
  - workouts completed
  - meals logged
  - sleep wins
  - consistency streaks
  - if IronQuest, region/missions/rewards completed
- compare day 1 vs day 14
- end with the next phase, not just a payment ask

Acceptance:

- the user sees evidence that they started building a real routine

## 15. Build Track-Specific Upgrade Framing

Files:

- wherever premium/trial messaging currently lives

Tasks:

- standard beginner:
  - keep Johnny planning the day
- standard experienced:
  - keep adaptive coaching and plan refinement
- IronQuest beginner:
  - keep the campaign moving and the day guided
- IronQuest experienced:
  - keep the progression layer and campaign rewards attached to real training

Acceptance:

- conversion messaging reflects why that user stayed engaged

## Suggested Delivery Order

## Sprint 1

- track detection
- day index
- `first14DayPlan` rules module
- `Johnny's Plan For Today` dashboard card

## Sprint 2

- coaching prompt upgrade
- guided walkthrough flow
- rescue mode

## Sprint 3

- starter workout library
- beginner teaching overlays
- daily check-in adaptation

## Sprint 4

- IronQuest plan mapping
- mission expansion
- plain-English quest bridge

## Sprint 5

- day-14 recap
- conversion framing
- tuning and analytics

## Analytics To Add

Track these from day 1:

- first-14-days card view rate
- walkthrough open rate
- workout CTA click-through from daily plan
- rescue mode usage rate
- rescue completion rate
- meal quest completion rate
- sleep checkpoint completion rate
- beginner education card interaction rate
- day 1, day 3, day 7, and day 14 retention
- trial-to-paid conversion by track

## Testing Checklist

## Logic

- track resolves correctly for all four variants
- day index is stable across timezone boundaries
- plan generation does not fail when logs are sparse
- rescue mode triggers correctly for low-readiness and low-time cases

## Dashboard

- first-14-days card appears only when eligible
- existing coaching summary still works after day 14
- beginner education card and first-14-days card do not conflict awkwardly

## Workout

- starter workout routing is deterministic
- rescue version is always available where promised
- beginner help text is shown only where appropriate

## IronQuest

- daily objectives mirror plan assignments
- plain-English quest helper does not break fantasy framing
- beginner and experienced IronQuest users get different complexity levels

## Conversion

- day-14 recap renders even with incomplete data
- premium framing switches by track

## Recommendation

The highest-leverage build path is:

1. Ship `Johnny's Plan For Today` on the dashboard.
2. Back it with a real `first14DayPlan` rules layer.
3. Add rescue mode and a starter workout library.
4. Then map the same system into IronQuest instead of building a separate onboarding campaign engine.
