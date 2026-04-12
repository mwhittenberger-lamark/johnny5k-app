# Coaching Summary PRD

## Overview

Johnny5k already has useful product pieces: readiness, workout planning, post-workout review, body tracking, nutrition logging, and Johnny AI surfaces. The current gap is that users still have to connect those signals themselves.

The next product move is a cross-screen coaching summary layer that turns existing signals into one coherent coaching experience. Instead of separate modules that each explain one slice of behavior, the app should help the user answer three questions quickly:

- How am I doing right now?
- What is helping or hurting progress?
- What should I do next?

This feature should first behave like a product intelligence layer, not like a new standalone destination. The summary should appear in the dashboard, workout flow, body screen, nutrition screen, and Johnny prompt flow with a consistent voice and recommendation priority.

## Problem

Today, Johnny5k can show useful data and actions, but the user still has to perform manual interpretation across screens:

- Dashboard shows current status but not a durable coaching narrative.
- Workout has readiness and time-tiering but limited cross-screen context.
- Body trends are visible but not tightly tied back to adherence or nutrition.
- Nutrition shows logging and planning value but not enough linkage to results.
- Johnny AI can help, but it can feel like a separate assistant surface instead of the app's coaching layer.

That creates product friction:

- Users can miss trend changes until adherence is already slipping.
- Good streaks are not reinforced strongly enough.
- Recovery or consistency warnings can show up without a single next action.
- AI explanations risk feeling generic if they are not grounded in a shared coaching model.

## Product Goal

Create a shared coaching summary layer that translates recent activity into specific, evidence-based guidance with one prioritized next step.

The feature should move the app from "tracking and logging" toward "guiding and adapting."

## User Value

- Faster understanding of current status without reading multiple screens.
- More confidence in daily decisions like train, recover, reschedule, or tighten nutrition.
- Better adherence through earlier intervention on missed sessions and drift.
- Stronger continuity across dashboard, workout, body, nutrition, and Johnny.

## Jobs To Be Done

- Tell me whether my current plan is working.
- Show me what changed this week.
- Catch the biggest issue before it compounds.
- Explain what is going well so I keep doing it.
- Give me one clear next action I can take now.

## Guiding Principles

Every coaching summary should do three things:

1. Describe what happened.
2. Interpret why it matters.
3. Recommend what to do next.

Additional product rules:

- Specific beats motivational.
- Evidence beats generic AI language.
- One strong next action beats a long list of tips.
- Confidence should be visible when evidence is weak.
- Cross-screen consistency matters more than local cleverness.

## Non-Goals For V1

- Predictive training programming.
- Medical, injury, or diagnostic advice.
- Highly personalized psychology or habit coaching.
- Full natural-language generation without rule grounding.
- A brand-new analytics system.

## Feature Definition

The Coaching Summary is a normalized summary object plus a shared set of rendering patterns and prompt hooks. It should power:

- a weekly dashboard summary,
- contextual workout coaching cues,
- body trend interpretation,
- nutrition adherence interpretation,
- Johnny follow-up prompts seeded with the same summary context.

The coaching layer should not depend on the user opening a dedicated screen. A full-detail screen may exist, but it is secondary to the shared layer.

## Core Experience

### Primary Summary Structure

Each summary should render some or all of these sections depending on surface size:

- Status
- What is improving
- What is slipping
- Recovery cue
- Coach recommendation
- Next action

### Example Output

- "You completed 4 of 5 planned sessions this week. Consistency improved from last week."
- "You missed 2 lower-body sessions in the last 10 days, both on evenings."
- "Recovery has trended down for 3 straight days after harder training blocks."
- "Protein adherence held, but total nutrition logging dropped on rest days."
- "Next action: move tomorrow's session to the morning and keep effort moderate."

## Success Criteria

- Users can understand current status in under 10 seconds.
- Every problem-oriented summary includes one concrete action.
- Coaching language references real evidence and time windows.
- Recommendations are consistent across dashboard, workout, body, nutrition, and Johnny.
- Johnny follow-ups feel like an expansion of product coaching, not a separate analysis.

## Metrics

### Product Metrics

- Weekly workout completion rate
- Missed-session recovery rate
- Nutrition logging consistency
- Repeat dashboard engagement
- Johnny prompt opens from coaching surfaces

### Feature Metrics

- Coaching card view rate
- Coaching action click-through rate
- AI follow-up open rate from coaching summaries
- Percentage of summaries suppressed for low confidence
- Distribution of recommendation categories

## MVP Scope

V1 should ship as a rule-based coaching layer with optional AI expansion.

V1 deliverables:

1. Weekly coaching summary card on dashboard.
2. Post-workout coaching summary block in workout completion flow.
3. Body screen coaching callout tied to weight, sleep, steps, and recent workout context.
4. Nutrition screen coaching callout tied to adherence and outcome context.
5. A shared "recommended next action" object reused across surfaces.
6. Johnny starter prompts generated from the same coaching summary payload.

What V1 should not do:

- generate multiple competing recommendations,
- invent insights without sufficient evidence,
- expose every available metric in one surface,
- depend on a new backend system before basic value can ship.

## Data Inputs

The coaching layer should prefer existing sources before introducing new ones.

### Current App Sources

- `dashboardStore.snapshot`
- `dashboardApi.snapshot()`
- `dashboardApi.johnnyReview()`
- workout plan and history data already used in dashboard and workout flows
- body logs and metric series from `bodyApi`
- nutrition summary and logging data from `nutritionApi`
- post-workout review data already captured in workout flow

### V1 Input Categories

- planned workouts
- completed workouts
- skipped or missed workouts
- workout timing and time-tier behavior
- readiness or recovery flags
- sleep logs
- step logs
- cardio logs
- weight trend
- nutrition target adherence
- meal logging consistency
- protein adherence
- post-workout review effort and recovery notes if available

## Derived Metrics

The first pass should keep derivation simple and inspectable.

- 7-day workout adherence percent
- 14-day missed-session count
- best current streak
- best recent completion window by time of day or weekday
- 3-day to 7-day recovery trend
- 7-day nutrition logging consistency
- 7-day protein adherence rate
- 14-day or 28-day body trend direction
- current risk flag
- current momentum flag

## Recommendation Priority

When multiple issues exist, recommendation priority should stay fixed:

1. Recovery risk
2. Workout adherence drift
3. Nutrition inconsistency
4. Body trend stall
5. Positive momentum reinforcement

This prevents contradictory coaching across surfaces.

## Decision Rules

### Recovery Priority

If readiness is low for multiple days, sleep debt is elevated, or recovery flags are stacked:

- reduce training load,
- suggest a shorter session or recovery day,
- avoid pairing the summary with an aggressive progression message.

### Adherence Priority

If planned sessions are being missed:

- show count and recent pattern,
- identify the most common failure window if available,
- recommend rescheduling or lowering friction before suggesting harder training.

### Nutrition Priority

If nutrition adherence is inconsistent and body progress is flat:

- connect the two explicitly,
- recommend improving consistency before stronger plan changes.

### Body Trend Priority

If body trend is stalled but adherence is improving:

- avoid punitive language,
- reinforce training consistency,
- explain that nutrition or time horizon is the main open variable.

### Momentum Reinforcement

If all major signals are stable:

- reinforce streaks,
- keep the recommendation simple,
- avoid manufacturing a problem.

## Confidence Rules

Each insight should carry a confidence level:

- `high`: supported by clear recent data with stable evidence
- `medium`: directionally useful but based on a smaller window
- `low`: sparse or conflicting evidence

Low-confidence insights should usually be hidden from compact surfaces and replaced with a simpler status line.

## UX Surface Plan

## Dashboard

### Role

Main weekly summary surface and the default place where users see the coaching layer.

### V1 UI

- coaching summary card in `primary_main`
- optional supporting card or inline block in `primary_side`
- CTA to ask Johnny for explanation or next-week planning

### Notes For Current Architecture

The existing dashboard already supports card composition through `dashboardCardRegistry.js`, `DashboardCards.jsx`, and `useDashboardViewModel.jsx`. The coaching summary should plug into that pattern rather than bypass it.

Recommended additions:

- new card id like `coaching_summary`
- derived model builder in dashboard recommendation helpers or a dedicated coaching summary module
- card visibility and layout behavior consistent with the existing registry approach

## Workout

### Role

Translate readiness and session outcome into immediate coaching.

### V1 UI

- pre-workout coaching cue on launchpad when recovery risk is active
- post-workout coaching block in `WorkoutCompletionReviewModal.jsx`

### Example

- "You trained through a low-readiness day. Prioritize sleep tonight and keep tomorrow moderate."

## Body

### Role

Explain body trend in context rather than as isolated measurements.

### V1 UI

- compact callout near the top of `BodyScreen.jsx`
- body-specific interpretation using weight, sleep, steps, and recent workouts

### Example

- "Weight is stable over 2 weeks, but workout consistency improved. Nutrition consistency remains the larger gap."

## Nutrition

### Role

Connect logging behavior to results and recovery.

### V1 UI

- compact coaching callout within `TodayNutritionView` or planning summary area
- CTA to Johnny for deeper explanation

### Example

- "Protein target held on most training days, but logging dropped on rest days. Recovery support is solid, overall consistency is not."

## Johnny AI

### Role

Expand the shared coaching summary, not replace it.

### V1 UI

- starter prompt generated from current coaching summary
- actions like "Explain this summary", "What should I change next week?", or "Why am I stalling?"

### Notes For Current Architecture

`AiScreen.jsx` is effectively a route that opens the Johnny drawer and redirects. The coaching layer should pass starter prompts and summary context into that existing flow instead of creating a separate AI screen implementation.

## Frontend Architecture Proposal

## Recommended Module Shape

Create a small coaching summary module owned by derivation logic, separate from rendering:

- `src/lib/coaching/buildCoachingSummary.js`
- `src/lib/coaching/coachingSummaryRules.js`
- `src/lib/coaching/coachingSummaryFormatters.js`
- `src/lib/coaching/coachingSummaryPrompts.js`
- `src/lib/coaching/coachingSummary.test.js`

If the team prefers staying near dashboard helpers at first, the first pass can live beside `dashboardRecommendationHelpers.js`, but it should be extracted once workout, body, and nutrition consume the same logic.

## Recommended Summary Shape

```ts
export type CoachingSummaryStatus = 'improving' | 'steady' | 'at_risk'

export type CoachingInsightType =
  | 'adherence'
  | 'recovery'
  | 'body'
  | 'nutrition'
  | 'streak'
  | 'schedule_pattern'

export type CoachingActionType =
  | 'reschedule_workout'
  | 'reduce_intensity'
  | 'take_recovery_day'
  | 'stay_the_course'
  | 'improve_nutrition_consistency'
  | 'resume_logging'

export type CoachingConfidence = 'low' | 'medium' | 'high'

export type CoachingInsight = {
  id: string
  type: CoachingInsightType
  title: string
  message: string
  evidence: string[]
  confidence: CoachingConfidence
  priority: number
}

export type CoachingAction = {
  type: CoachingActionType
  title: string
  message: string
  ctaLabel: string
  href?: string
  state?: Record<string, unknown>
  prompt?: string
}

export type CoachingSummary = {
  period: 'day' | 'week'
  status: CoachingSummaryStatus
  headline: string
  subhead?: string
  wins: string[]
  risks: string[]
  insights: CoachingInsight[]
  nextAction: CoachingAction | null
  starterPrompt: string
  confidence: CoachingConfidence
  generatedFrom: string[]
}
```

## Input Adapter Shape

Normalize raw app data before applying rules. That makes the coaching layer easier to test and stops UI code from owning business logic.

```ts
export type CoachingSummaryInput = {
  snapshot: Record<string, unknown> | null
  workoutHistory: Array<Record<string, unknown>>
  bodyMetrics: {
    weight: Array<Record<string, unknown>>
    sleep: Array<Record<string, unknown>>
    steps: Array<Record<string, unknown>>
    cardio: Array<Record<string, unknown>>
  }
  nutrition: {
    summary: Record<string, unknown> | null
    meals: Array<Record<string, unknown>>
    weeklyReview?: Record<string, unknown> | null
  }
  reviewContext?: {
    latestWorkoutReview?: Record<string, unknown> | null
  }
}
```

## Derivation Flow

1. Gather raw data from current screen or shared store.
2. Normalize into `CoachingSummaryInput`.
3. Compute derived metrics.
4. Run recommendation priority rules.
5. Build summary copy and Johnny starter prompt.
6. Render screen-specific slices of the same summary object.

## Current Repo Integration Plan

### Shared State

Preferred near-term approach:

- keep `dashboardStore.snapshot` as the common base input,
- compute the summary client-side for dashboard first,
- extend the same builder to accept workout/body/nutrition local data where needed.

Longer-term approach:

- add a backend summary payload to `/dashboard` or a dedicated coaching endpoint once the rules stabilize.

### Hooks

Recommended hooks:

- `src/screens/dashboard/hooks/useCoachingSummary.js`
- `src/screens/workout/hooks/useWorkoutCoachingSummary.js`
- `src/screens/nutrition/hooks/useNutritionCoachingSummary.js`
- `src/screens/body/hooks/useBodyCoachingSummary.js`

These can all delegate to the same builder and just adapt local data.

### Components

Recommended component map:

- `src/screens/dashboard/components/CoachingSummaryCard.jsx`
- `src/screens/workout/components/WorkoutCoachingCallout.jsx`
- `src/screens/workout/components/WorkoutPostSessionCoaching.jsx`
- `src/screens/body/components/BodyCoachingCallout.jsx`
- `src/screens/nutrition/components/NutritionCoachingCallout.jsx`
- `src/components/ai/CoachingPromptActions.jsx`

Compact variants can share one presentational primitive later, but V1 should optimize for shipping with each screen's current layout.

## Dashboard Implementation Notes

Recommended dashboard implementation order:

1. Add a new dashboard card definition.
2. Add a coaching summary builder that reads `snapshot`.
3. Render the summary card in `DashboardCards.jsx` or a nearby dashboard component file.
4. Reuse the summary's `nextAction` routing object for primary CTA.
5. Reuse the summary's `starterPrompt` for Johnny drawer entry.

Suggested card placement:

- bucket: `primary_main`
- label: `Coaching summary`
- behavior: visible by default

This card should not replace `best_next_move` immediately. It can either:

- absorb that role and eventually replace it, or
- coexist during rollout while the team compares engagement.

The cleaner long-term direction is to merge "Best next move" into the coaching summary once confidence is high.

## Workout Implementation Notes

Recommended touch points:

- `WorkoutLaunchpad.jsx` for pre-session cue
- `WorkoutCompletionReviewModal.jsx` for post-session summary
- `useWorkoutSessionController.js` for passing the latest review context if needed

The workout version should use a compact slice of the summary and never overload the session flow with too much text.

## Body Implementation Notes

Recommended touch points:

- `BodyScreen.jsx` for rendering
- local metric state already loaded in `refreshBodyData()`

The body callout should focus on explanation, not duplicate raw metric cards that the screen already shows.

## Nutrition Implementation Notes

Recommended touch points:

- `NutritionScreen.jsx`
- `NutritionFeatureViews.jsx` for placement inside the active nutrition experience

The nutrition callout should emphasize consistency and relationship to outcomes, not just macro totals.

## AI Prompting Strategy

The coaching layer should generate short prompt starters from the current summary.

Examples:

- "Explain my coaching summary and tell me what matters most this week."
- "Why is my progress flat even though workouts are improving?"
- "Help me fix the missed-session pattern showing up in my weekly summary."

The prompt should include summary context behind the scenes where possible, so Johnny does not need to infer state again from scratch.

## MVP Delivery Phases

### Phase 1: Dashboard Summary

- build shared summary derivation
- ship dashboard card
- ship Johnny follow-up prompt actions
- instrument usage

### Phase 2: Workout Coaching

- add pre-workout recovery cue
- add post-workout summary block
- reuse `nextAction` rules for workout-specific guidance

### Phase 3: Body And Nutrition Callouts

- add compact screen-specific coaching blocks
- tune copy so summaries stay consistent but contextual

### Phase 4: Consolidation

- evaluate whether `best_next_move` should merge into coaching summary
- decide whether backend-generated summary is worth adding
- unify presentation primitives if reuse is high

## Risks

### Generic Copy

If the summary reads like motivational filler, the feature will fail even if the logic is technically correct.

Mitigation:

- require evidence in every nontrivial insight
- keep time windows explicit
- show only top insights

### Conflicting Recommendations

If dashboard says "push" while workout says "recover," trust drops fast.

Mitigation:

- enforce fixed recommendation priority
- derive all actions from one normalized summary object

### Sparse Data

Some users will not log enough sleep, weight, or nutrition data for full coaching.

Mitigation:

- degrade gracefully to simple adherence coaching
- suppress low-confidence insights

### Scope Drift

The feature can easily become a new analytics platform.

Mitigation:

- keep V1 rule-based
- keep V1 to one summary object and a small set of recommendation types

## Open Questions

- Should V1 coexist with `best_next_move`, or should the coaching summary replace it immediately?
- Is the first summary period always weekly, or should dashboard also support a daily compact variant?
- Does enough post-workout review data already exist to support meaningful workout coaching copy, or does that need a small model extension?
- Should the first backend integration be a dedicated coaching endpoint or an extension of `/dashboard`?

## Recommended First Build

If engineering starts now, the highest-leverage first build is:

1. Add a client-side `buildCoachingSummary()` utility based on `dashboardStore.snapshot`.
2. Ship a dashboard coaching summary card with one CTA and Johnny prompt actions.
3. Reuse the same summary builder for a post-workout block.

That path is small enough to validate quickly and strong enough to prove whether the coaching layer increases clarity and action-taking before expanding it across every screen.
