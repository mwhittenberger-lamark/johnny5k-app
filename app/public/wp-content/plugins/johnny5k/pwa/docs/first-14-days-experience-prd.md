# First 14 Days Experience PRD

## Goal

Use the free first 14 days to make the app feel like:

- someone is actually guiding the user,
- the right next action is always obvious,
- workouts and food decisions feel easier than doing nothing,
- progress shows up quickly enough that paying feels like the obvious next step.

This should not feel like "14 days of content."

It should feel like "Johnny took over the messy part of getting started."

## Product Position

The first 14 days should be treated as a guided activation program with four variants:

1. Standard New Beginner
2. Standard Experienced User
3. IronQuest Beginner
4. IronQuest Experienced User

The base behavior should stay shared wherever possible:

- same underlying workout plan engine
- same meal and sleep targets
- same coaching summary logic
- same daily check-in and reminders

The difference should be in framing, simplification, pacing, and reward treatment.

## Core Product Rule

For beginners, reduce uncertainty before trying to increase motivation.

A first-time exerciser does not mainly need hype. They need:

- to know what to do today,
- to know how hard to go,
- to know what counts as success,
- to know what to eat next,
- to know when to stop,
- to feel that a missed item does not break the plan.

IronQuest is especially strong for this because it can turn tiny wins into visible progress without requiring the user to already care about training metrics.

## Primary Bet

The strongest new feature is a guided daily-plan layer:

`Johnny's Plan For Today`

This should be a cross-screen orchestration feature that uses systems already present in the product:

- coaching summary
- workout planning
- nutrition logging
- sleep targets
- reminders
- daily objectives
- Johnny AI follow-ups

This should not be a separate chat toy.

It should be the app's main answer to: `What exactly do I do today?`

## Johnny's Plan For Today

### What it is

A generated but tightly structured daily plan card and flow that gives the user a complete day plan:

- today's workout or recovery assignment
- recommended workout time
- exact session type and expected duration
- today's meal structure
- next meal suggestion
- protein target framing
- water target
- sleep target and bedtime
- one fallback version for a messy day

### Output shape

Every day plan should answer these questions in plain language:

1. What is the main job today?
2. What time should I train?
3. What workout am I doing?
4. What should I eat next?
5. What does a good day look like?
6. What is the backup plan if the day falls apart?

### Example beginner output

- Main job: Do the 18-minute starter workout.
- Train at: 6:00 PM or earlier.
- Workout: 3 exercises, 2 sets each, stop with 2-3 reps left.
- Food: Hit 3 simple meals. Make the next meal contain at least 30g protein.
- Recovery: Aim for 7.5 hours. Start winding down by 9:30 PM.
- Backup plan: If you miss the full session, do the 8-minute rescue version and still log dinner and sleep.

### Why this matters

This solves the main early churn problem:

The app already has pieces of the answer, but the user still has to assemble them.

The first 14-day experience should remove assembly.

## Four-Track Structure

## 1. Standard Beginner

### Promise

`I can start without knowing anything.`

### Tone

- calm
- practical
- low shame
- concrete

### Product behavior

- fewer choices
- more education
- smaller workouts
- clearer fallback paths
- heavier use of "what this means" copy

### What success means in 14 days

- completes 4-6 workouts
- logs enough meals to understand the nutrition flow
- logs sleep several times
- stops feeling confused by the app
- believes they can keep going

## 2. Standard Experienced User

### Promise

`This gets organized fast and starts coaching me immediately.`

### Tone

- efficient
- higher agency
- less explanation
- more optimization

### Product behavior

- faster onboarding
- lets them confirm or edit training split quickly
- treats meal planning and recovery as performance support
- unlocks stronger summary and adjustment logic earlier

### What success means in 14 days

- completes their chosen split consistently
- logs enough nutrition to make coaching useful
- sees the app adapting to their actual behavior
- feels the product is saving them decision time

## 3. IronQuest Beginner

### Promise

`I can become the kind of person who works out.`

### Tone

- vivid
- identity-building
- protective
- beginner-safe

### Product behavior

- mission framing reduces intimidation
- daily objectives map to tiny real-world tasks
- visible rewards for meals, sleep, and starter sessions
- story language makes first efforts feel legitimate

### What success means in 14 days

- user finishes the starter arc
- user forms an identity attachment to character, map, and rewards
- user associates workouts with progress instead of dread
- user wants to see what happens next

## 4. IronQuest Experienced User

### Promise

`My real training now has a progression layer and campaign wrapper.`

### Tone

- sharper
- more consequential
- less tutorial-heavy

### Product behavior

- workout missions emphasize performance and progression
- rest days route through Tavern or recovery beats
- rewards lean on status, unlocks, and campaign momentum
- less hand-holding around exercise basics

### What success means in 14 days

- user feels campaign momentum attached to real training
- story does not slow logging
- rewards feel earned enough to retain interest

## First 14 Days Shape

The 14-day flow should have the same structural arc across all four variants:

### Days 1-3: Remove friction

Goals:

- get the user to complete one clear win quickly
- teach only the minimum needed for today
- make logging and session completion feel easy

Product moves:

- push one obvious workout
- give one obvious next meal target
- explain sleep target in one sentence
- show a backup version of the day plan
- celebrate completion in a measured way

### Days 4-7: Build rhythm

Goals:

- create the sense of "this is my routine now"
- show pattern recognition
- reduce drop-off after the first miss

Product moves:

- start reflecting recent behavior back to the user
- introduce streaks, momentum, or route progress
- use Johnny to say what changed and what to do next
- introduce "if today gets messy, do this instead"

### Days 8-10: Prove adaptation

Goals:

- show that the app notices what the user is actually doing
- make coaching feel personalized

Product moves:

- adjust workout recommendation based on adherence and recovery
- adjust food prompts based on logging gaps
- call out missed patterns like skipped evenings or low protein mornings
- for IronQuest, branch mission flavor around wins, struggle, and class style

### Days 11-14: Create commitment

Goals:

- make the user feel they have built something
- show what continues after the free phase
- make paying feel like continuity, not a restart

Product moves:

- preview next arc, next region, next training block, or next coaching level
- show progress recap from day 1 to day 14
- frame premium as keeping momentum alive
- avoid a hard sell until the user has seen evidence of value

## Detailed 14-Day Track Design

## Standard Beginner 14-Day Plan

### Week 1

- Day 1: Quick setup, first starter workout, first protein goal, first bedtime target
- Day 2: Recovery or walk day, simple meal logging walkthrough, reassurance that rest counts
- Day 3: Second starter workout, one form cue per exercise, no overload pressure
- Day 4: Easy cardio or walk assignment, hydration and meal rhythm coaching
- Day 5: Third workout, light progression if prior sessions were completed comfortably
- Day 6: Recovery day with "what a good rest day looks like"
- Day 7: Weekly recap, visible wins, one adjustment for week 2

### Week 2

- Day 8: Slightly more independent plan, but still one-tap choices
- Day 9: Add a simple education card around gym confidence or home setup
- Day 10: Introduce rescue workout logic more explicitly
- Day 11: Push the first "I can handle this" moment with a slightly fuller session
- Day 12: Meal consistency focus, not perfection
- Day 13: Recovery and sleep emphasis
- Day 14: Two-week recap and paid continuation prompt

## Standard Experienced 14-Day Plan

- Day 1: Confirm split, equipment, time windows, and target
- Day 2: Recovery and nutrition adherence summary
- Day 3: Training session with tighter readiness framing
- Day 4: Performance-support meal timing guidance
- Day 5: Coaching summary shows first patterns
- Day 6: Optional cardio or recovery
- Day 7: Week 1 recap with adjustment recommendation
- Day 8: Small program refinement based on compliance
- Day 9: Push workout-time optimization
- Day 10: Show training plus food plus sleep relationship
- Day 11: Momentum check
- Day 12: Stronger next-action recommendation
- Day 13: Preview next progression block
- Day 14: Two-week recap and conversion prompt

## IronQuest Beginner 14-Day Plan

### Week 1 arc

- Day 1: Class choice, first mission, one tiny victory
- Day 2: Tavern or camp recovery day, sleep checkpoint
- Day 3: Second mission, teach how sets/rest/story work together
- Day 4: Travel or cardio mission, keep intensity low
- Day 5: Third mission with first meaningful reward
- Day 6: Meal quest and recovery quest day
- Day 7: Region recap, title/reward, setup for first boss week

### Week 2 arc

- Day 8: Re-enter with a stronger sense of identity
- Day 9: Add a "Johnny explains today's quest in plain English" bridge
- Day 10: Low-risk challenge mission
- Day 11: Story branch that reflects consistency
- Day 12: Simple prep day for boss or capstone mission
- Day 13: Boss mission with very clear beginner-safe instruction
- Day 14: Campaign recap, region cleared, next road revealed behind paywall

## IronQuest Experienced 14-Day Plan

- Days 1-3: Rapid identity setup and early mission attachment
- Days 4-7: Standard mission cadence attached to real split
- Days 8-10: More reactive rewards, class bonuses, and route progression
- Days 11-14: Regional climax, stronger status rewards, next campaign hook

## What Beginners Need That Experienced Users Do Not

This is the most important product distinction.

Beginners need an explicit teaching layer for:

- what workout clothes/equipment are enough
- how hard to go
- what reps and sets mean in plain language
- how to stop a set safely
- how to swap an exercise
- how sore is normal
- what to eat after training
- why sleep matters
- what to do if they miss a day

The app should treat this as product behavior, not a long library.

### Beginner-support features to add

1. `What this means` micro-explainers on workout, meal, and recovery surfaces.
2. `Show me exactly what to do` mode on workout launch.
3. `Rescue version` for every beginner workout.
4. `Good enough today` badge when a fallback plan still preserves momentum.
5. `Johnny explains this exercise` one-tap helper with short plain-English form cues.
6. `Missed a day? Here is the exact recovery plan.` flow.

## Starter Workout Content Gap

One started workout is not enough for the first 14 days.

You need a starter workout library that covers the first two weeks without asking a beginner to repeat the exact same session too often.

### Minimum beginner starter set

1. Full Body A
2. Full Body B
3. Full Body C
4. 8-Minute Rescue Workout
5. Low-Impact Cardio / Walk Day
6. Recovery Mobility Day
7. First Boss / Confidence Workout

### Why

- repetition is useful, but exact repetition can feel like the app is thin
- a beginner needs familiarity plus novelty
- the app should have planned answers for low-energy days

### Structure rule

Each starter workout should include:

- clear time estimate
- intensity ceiling
- exercise substitutions
- form help
- a rescue version
- explicit completion criteria

## IronQuest Mission Content Gap

The current starter location structure is strong.

To support a real 14-day free arc, beginner IronQuest needs enough content to feel like a mini-campaign, not a demo.

### Recommended v1 free arc content

- 5-7 starter training-ground missions
- 2 cardio/travel missions
- 2 recovery/tavern story days
- 1 meaningful boss mission by days 10-14
- 1 region-complete payoff

### Important rule

Meals, sleep, steps, and recovery should also move campaign state.

If IronQuest is made for first-time exercisers, then the game cannot only care about workouts.

It should reward:

- logging breakfast or dinner when that is the real hard thing
- getting to bed on time
- taking the walk on a non-lifting day
- choosing the rescue workout instead of skipping completely

## Recommended New Feature Set

## Must-build

### 1. Johnny's Plan For Today

This is the anchor feature for the first 14 days.

It should live on the dashboard and flow into workout, nutrition, and recovery surfaces.

### 2. Rescue Mode

A first-class fallback system:

- shortened workout
- adjusted meal minimum
- essential sleep target
- phrased as preserving the day, not failing the day

### 3. Beginner Teaching Layer

Short explainers, exercise help, and "what to do next" support across the first two weeks.

### 4. Two-Week Arc Logic

Content and coaching should change across days 1-14 instead of staying static.

### 5. Two-Week Recap And Continuation Screen

Before paywall pressure, show:

- workouts completed
- meals logged
- sleep wins
- character or campaign progress
- what the next block unlocks

## High-value additions

### 6. Daily Check-In That Changes The Plan

Ask:

- how the body feels
- how the head feels
- how much time is available

Then update today's plan live.

### 7. Smart Time Windows

Recommend a workout time based on when the user actually completes workouts, not just their original preference.

### 8. "Johnny Walk Me Through Today"

A guided flow with 3-5 screens:

- today's main job
- workout plan
- food plan
- sleep plan
- backup plan

This is more useful than dropping the user into open chat.

### 9. Beginner Confidence Events

Examples:

- first workout complete
- first week with 3 logged meals on a day
- first full week with sleep logged
- first rescue day recovered instead of skipped

These should get stronger reward treatment than routine completions.

## What not to do

- do not make the first 14 days rely on long chat sessions
- do not ask beginners to choose between too many workout options
- do not hide the backup plan
- do not make IronQuest feel like a second app with duplicate setup
- do not wait until day 14 to show progress
- do not paywall essential beginner understanding before habit value is felt

## Conversion Strategy

The free period should end after the user has built continuity, not after they have merely looked around.

### The user should reach the paywall feeling:

- the app knows my routine now
- I have a real plan
- I already started something
- I want the next phase

### Paywall framing should differ by track

#### Standard Beginner

`Keep Johnny planning your days, adjusting your workouts, and walking you through meals and recovery.`

#### Standard Experienced

`Keep adaptive coaching, plan adjustments, and integrated training/nutrition guidance.`

#### IronQuest Beginner

`Keep your campaign moving, finish the next region, and keep Johnny guiding the whole day.`

#### IronQuest Experienced

`Keep your progression layer, next missions, and campaign rewards attached to your real training.`

## Recommended Build Order

### Phase 1

- define the 4 first-14-day tracks
- build day-state logic for days 1-14
- ship Johnny's Plan For Today card
- ship rescue mode

### Phase 2

- expand starter workout library
- add beginner teaching overlays
- add 14-day recap and conversion flow

### Phase 3

- deepen IronQuest free arc
- attach meals, sleep, and recovery more strongly to campaign progress
- add dynamic branching and smarter adaptation

## Practical Implementation Notes

You likely do not need a brand-new backend concept for v1.

This can be built by combining:

- onboarding experience level
- experience mode: standard vs ironquest
- relative day index since onboarding completion or trial start
- coaching summary payload
- daily objectives payload
- existing workout/nutrition/recovery state

The main new object is probably:

`first14DayPlan`

Suggested fields:

- `track`
- `day_index`
- `primary_goal`
- `workout_assignment`
- `nutrition_assignment`
- `recovery_assignment`
- `backup_plan`
- `education_cards`
- `reward_hooks`
- `conversion_state`

## Recommendation

If you only do three things, do these:

1. Build `Johnny's Plan For Today`.
2. Build a real beginner starter workout library plus rescue versions.
3. Build a 14-day progression framework with separate beginner and experienced variants, then skin it into IronQuest rather than inventing four disconnected systems.
