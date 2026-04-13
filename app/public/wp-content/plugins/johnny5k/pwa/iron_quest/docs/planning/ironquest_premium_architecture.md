# IronQuest Premium Architecture

## Purpose

This document captures the full architecture recommendation for overlaying IronQuest on top of the current Johnny5k build as a premium feature.

Nothing important from the planning discussion should be treated as "implied" or left elsewhere.

## Executive Summary

IronQuest should not be built as a second standalone product hidden inside Johnny5k.

It should be built as a premium narrative and progression layer on top of Johnny5k's existing:

- onboarding
- dashboard
- workout flow
- rewards system
- AI coaching surfaces
- image generation pipeline

The defining rule is:

> IronQuest never blocks a workout. It only adds context, progression, bonuses, motivation, and cosmetic payoff.

That rule matters because the best version of IronQuest is the one that makes users want to:

- lift more consistently
- walk more
- do more cardio
- track meals more often
- track sleep more often

without making the core training product feel gated or burdensome.

## Original Review: What The Docs Already Do Well

The IronQuest docs are much stronger than a superficial theme layer. They already contain:

- coherent class fantasy
- a rich world and location structure
- repeatable mission framing
- onboarding philosophy that emphasizes identity and momentum
- a strong "story during rest only" pacing rule
- a thoughtful progression economy
- good ideas for boss pacing, rewards, and visual payoff

The most valuable parts of the design are not the whole RPG simulation. The most valuable parts are:

- identity
- story framing
- visible progression
- habit reinforcement
- rare visual payoff

These are what can improve retention inside Johnny5k.

## Original Review: Main Concerns Before The User Clarification

Before the clarified assumptions, there were several risks in implementing the docs literally.

### 1. The docs describe a full second product

The current documents define:

- a world map
- 25 named locations
- class and subclass systems
- travel points
- HP and recovery
- bosses
- stores
- supplies
- gear
- artifacts
- spells
- taverns
- finite mission pools
- class balance tuning

That amount of design is exciting, but taken literally it behaves more like a second app than a premium overlay.

### 2. Several systems looked like they could restrict training

The docs included ideas like:

- travel as a gate to locations
- supplies as "permission to play"
- HP thresholds for bosses
- fast-travel caps

In a normal RPG those are fine. In a fitness app they are dangerous if they delay or discourage someone who is ready to train right now.

### 3. The runtime state model was extremely heavy

The story-workout design expects the system to know and react to:

- class
- subclass
- level
- current HP
- max HP
- mission state
- encounter state
- story tension
- dice rolls
- gear effects
- spell effects
- set outcomes
- boss progress

That can be done, but it is too much to absorb in the first implementation pass.

### 4. The docs are rich but not yet normalized as product data

The content is strong, but much of it is still prose-first rather than system-first.

That creates several issues:

- content drift
- duplicated mechanics
- repeated schemas across many markdown files
- unclear separation between v1 and later-worldbuilding

## Clarified Assumption From The User

The user clarified several critical constraints that change the architecture in a positive direction:

- users can always revisit a mission and do workouts again
- gold rewards are intentionally generous
- the system should not restrict workouts
- the design should encourage more cardio and better meal and sleep tracking
- daily activities can and should grant small gold and XP awards

This changes the framing significantly.

## Updated Product Interpretation After Clarification

With the updated assumptions, IronQuest becomes a much better fit for Johnny5k.

It is no longer best understood as a resource-gated RPG.

It is better understood as:

- a motivation wrapper
- a behavior reinforcement layer
- a narrative progression shell
- a premium identity experience

In this model:

- workouts remain the core progression event
- daily behaviors support the workout loop
- cardio expands options and progression speed
- meal and sleep tracking improve rewards and readiness
- gold and XP reinforce healthy behavior instead of acting as access control

That is much more aligned with Johnny5k's core purpose.

## Non-Negotiable Product Rule

The system should adopt this rule explicitly:

> IronQuest may enhance a workout, multiply the payoff of a workout, or contextualize a workout, but it must never prevent a user from training.

That one sentence should govern:

- mission access
- travel
- HP
- supplies
- gear
- recovery systems
- premium reward loops

## Core Product Thesis

The best premium version of IronQuest is not "Johnny5k plus a giant RPG."

It is:

> Johnny5k with a living world attached to the behaviors we already want users to do.

That means:

- workouts advance missions
- cardio fuels travel and special encounters
- steps contribute to movement and map progress
- meal logging grants gold, buffs, or daily quest completion
- sleep logging improves readiness, recovery, and bonus outcomes
- streaks become narrative and cosmetic milestones

## Existing Johnny5k Surfaces That Make This Feasible

The current build already has much of the platform required.

### 1. App routing and shell surfaces

The app already has established product areas for:

- dashboard
- workout
- rewards
- onboarding
- settings
- AI

This means IronQuest can integrate into existing surfaces rather than requiring a separate shell.

### 2. Live workout mode already exists

The current live workout surface already supports:

- workout timing
- rest timing
- coaching messages
- voice playback
- live visual frames
- state transitions during a workout

This is the natural place to overlay mission narration.

### 3. AI transport already exists

The app already has REST transport for:

- AI chat
- speech synthesis
- AI analysis flows
- thread and memory handling

That means IronQuest narration can reuse the current AI transport layer rather than inventing a second AI stack.

### 4. Generated image support already exists

The current onboarding and profile surfaces already support:

- headshot upload
- generated images
- image favoriting
- gallery display
- image rotation into live workout mode

This is a major advantage because the "identity payoff" part of IronQuest is one of its strongest premium hooks.

### 5. Rewards and momentum surfaces already exist

The current rewards board already shows:

- earned awards
- locked awards
- weekly rhythm
- streak context

That makes it a strong starting point for IronQuest progression without requiring a whole new progression UI on day one.

## High-Level Premium Positioning

IronQuest Premium should be sold and designed as:

- a premium identity layer
- a premium mission mode
- a premium progression fantasy
- a premium visual reward system

It should not be sold or designed primarily as:

- a complex inventory simulator
- a punishing resource economy
- a game that replaces the training app

## Product Model

IronQuest Premium should be structured in five layers.

### 1. Identity Layer

This is where the premium experience begins.

Includes:

- class selection
- motivation selection
- optional headshot upload
- starter portrait generation
- title and progression identity

The purpose of this layer is to make the user feel:

> "This is my character."

not:

> "I turned on a theme pack."

### 2. Mission Layer

Every relevant Johnny5k activity can map to an IronQuest activity.

Recommended mapping:

- full workout -> standard mission
- short workout -> quick mission
- cardio session -> runner task / travel mission
- steps -> travel progress
- recovery day -> tavern/rest event
- meal log -> daily quest completion
- sleep log -> recovery buff or daily quest completion

Important rule:

- mission replay is always allowed
- no mission is a one-time lockout in a way that removes training options

Finite mission pools can still exist for progression flavor, but replayable fallback missions should always be available.

### 3. Progression Layer

The progression layer gives meaning to consistent behavior.

Core progression currencies:

- XP
- gold
- level
- titles
- milestone unlocks

Recommended interpretation:

- workouts are the primary source of meaningful progression
- daily activities grant smaller but steady reinforcement
- cardio and steps accelerate world movement
- meal and sleep tracking improve readiness, bonuses, buffs, or payout quality

This creates a layered motivation system without devaluing the workout itself.

### 4. Narrative Layer

The narrative layer is the heart of the premium workout experience.

It should provide:

- mission intro
- optional pre-workout choice
- short rest-time story beats
- encounter transitions
- mission debrief

The narrative should be:

- short
- mobile-readable
- rest-time only
- never in the user's way while lifting

The narrative should never require the user to play a game while trying to train.

### 5. Cosmetic Payoff Layer

This is where premium value becomes visible and shareable.

Includes:

- starter character portrait
- milestone portraits
- boss victory portraits
- world-themed live workout imagery
- mission result cards
- profile gallery

This is likely one of the strongest retention and monetization hooks in the system.

## Updated System Philosophy

The philosophy of the system should now be:

- workouts are always available
- replayable missions ensure no dead ends
- gold is generous enough to feel rewarding
- cardio, meals, sleep, and steps increase momentum
- story adds meaning during rest, not friction during effort
- world progression should make users want to engage with more healthy behaviors
- logging sleep should directly restore HP and can also grant extra recovery-related bonuses

## Behavioral Design Goals

The system should make these behaviors more attractive:

- doing planned workouts
- doing extra cardio
- walking more
- logging meals
- logging sleep
- sustaining streaks

The system should avoid rewarding:

- gaming the economy instead of training
- passive behavior replacing workouts
- complexity that makes new users feel behind

## Guardrails

These guardrails should be treated as design constraints.

### Workout Guardrails

- A user can always start a workout.
- A user can always replay a mission.
- If no premium mission is ready, the app should provide a fallback replayable mission automatically.
- Bosses can be optional higher-value loops, not hard gates to continue training.

### Economy Guardrails

- Gold should reward behavior, not function as a training toll.
- Generous gold is good as long as spend choices still feel meaningful.
- The store should provide convenience, preparation, cosmetics, or mild boosts.
- Store purchases should not determine whether a user is allowed to engage the core workout loop.

### Readiness Guardrails

- HP should flavor outcomes and affect bonuses, not stop training.
- Meal and sleep tracking should create reward advantages and recovery advantages.
- Low readiness should change narrative tone and optional reward quality, not tell the user they cannot lift.

### Complexity Guardrails

- New users should not see the full system immediately.
- The first session should be guided and easy.
- Early premium experience should emphasize identity and momentum.
- Full world complexity should be revealed gradually.

## Recommended Interpretation Of Specific Systems

### Travel

Travel should unlock:

- new locations
- new mission themes
- higher-reward routes
- optional variety

Travel should not:

- block a workout
- strand a user
- create a feeling that a user must grind before training

Recommended rule:

- every location has replayable local missions
- travel opens additional locations and special opportunities

### HP

HP should represent:

- fatigue
- readiness
- narrative wear
- bonus state

HP should influence:

- reward multipliers
- story tone
- boss confidence
- recommendations from Johnny

HP should not hard-stop core training access.

### Supplies

If supplies are used at all in early versions, they should be reframed.

Bad framing:

- supplies are permission to play

Better framing:

- supplies are optional prep that improves odds, rewards, or special encounter access

### Gold

Gold should be generous enough that users feel reinforced for tracking daily life correctly.

Recommended gold uses:

- fast travel convenience
- cosmetic unlocks
- reward boosters
- boss prep
- optional consumables
- premium item flavor

Gold should not become so abundant that store decisions feel meaningless, but abundance is preferable to scarcity if the alternative is user friction.

### XP

XP should remain primarily workout-centric.

Recommended balance:

- workouts are the main XP driver
- cardio, meals, sleep, and steps create smaller bonus XP
- premium daily quests encourage whole-lifestyle compliance

This preserves the importance of training while making auxiliary behaviors feel worthwhile.

## Recommended V1 Premium Scope

The v1 premium release should be much smaller than the full document corpus.

### Include In V1

- premium toggle or entitlement gate
- class selection
- motivation selection
- optional headshot upload
- starter portrait generation
- 3 starter locations
- replayable missions
- mission framing on dashboard
- mission overlay in workout flow
- AI rest-time narration
- XP and gold progression
- daily quest bonuses for:
  - meals
  - sleep
  - cardio
  - steps
- rewards screen integration
- image gallery integration

### Do Not Include In V1

- full 25-location world campaign
- complete inventory/store simulation
- subclass tree depth
- spell loadout system
- full gear optimization system
- complex visible boss math
- resource gating on standard missions

## Recommended Starter Content Set

Only a small world slice should be seeded first.

Suggested starter set:

- Training Grounds
- Grim Hollow Village
- Emberforge
- Whispering Wilds

Why this set:

- it provides onboarding
- it covers early fantasy variety
- it supports multiple class fantasies
- it keeps scope manageable
- it creates enough content to feel premium without requiring full-campaign implementation

## How Activities Should Map To IronQuest

This mapping should drive system design.

### Workout Activity Mapping

- Full workout -> standard mission completion
- Short workout -> quick mission completion
- Strong performance -> better mission outcome band
- Completed workout -> main XP event

### Cardio Activity Mapping

- Cardio session -> travel progress or runner task mission
- Same-day cardio + workout -> combo bonus
- Cardio streaks -> travel or encounter bonuses

### Step Activity Mapping

- daily steps -> travel progress
- movement streaks -> exploration or route bonuses

### Meal Tracking Mapping

- meal log -> daily quest completion
- full-day meal compliance -> bonus gold / XP / drop chance
- protein or calorie target hit -> class-appropriate buff flavor

### Sleep Tracking Mapping

- sleep log -> recovery event and direct HP restoration
- high-quality sleep -> larger HP restoration, readiness improvement, or extra recovery bonus
- sleep streak -> bonus outcomes or support rewards

## Progression Logic

Progression should be understandable and rewarding.

Recommended hierarchy:

- workouts are the core mission progression
- daily behaviors are supporting progression
- consistency across behaviors creates multipliers

This means:

- a user cannot replace training with passive logging
- a user who trains and tracks well feels significantly more momentum

## Dashboard Architecture Recommendation

The dashboard should become the premium re-entry hub for IronQuest.

Recommended premium dashboard cards:

- current mission card
- current location card
- travel progress card
- daily quest card
- IronQuest readiness card
- recent rewards / relics teaser
- Johnny image gallery card

The dashboard should answer:

- Where am I?
- What is my next mission?
- What can I do today for progress?
- How did my cardio / meals / sleep help me?

## Workout Architecture Recommendation

Workout remains Johnny5k's existing engine.

IronQuest overlays the workout instead of replacing the underlying structure.

### Recommended Workout Flow

1. User opens workout as normal.
2. If premium is enabled, the selected mission attaches to the workout session.
3. User sees:
   - mission title
   - short setup beat
   - optional choice or stance
4. During rest periods only:
   - short story beat
   - encounter update
   - outcome flavor
5. After workout:
   - mission result
   - XP
   - gold
   - possible item or portrait trigger

### Important UX Rules

- Never interrupt active lifting with narrative.
- Never make logging slower.
- Never require several taps per set just to advance story.
- Story must be skippable or minimally invasive.

## Rewards Architecture Recommendation

The existing rewards area should become the first progression shell for IronQuest.

Recommended extensions:

- IronQuest XP display
- level display
- class title display
- earned relics or milestone unlocks
- portrait history or premium milestone gallery
- IronQuest-specific awards

This avoids building a brand-new progression screen too early.

## Onboarding Architecture Recommendation

IronQuest onboarding should be an extension of Johnny5k onboarding, not a totally separate funnel.

### Recommended Premium Onboarding Flow

1. Complete base Johnny5k onboarding.
2. Premium user sees IronQuest identity setup.
3. User selects:
   - class
   - motivation
4. User optionally uploads a face image.
5. Character portrait is generated.
6. User receives a starter mission.
7. First premium workout is guided and forgiving.

### Important Onboarding Principle

The system should create:

> Hook -> Identity -> First win -> Momentum

not:

> explanation overload

## AI Architecture Recommendation

IronQuest should reuse Johnny5k's existing AI transport and thread infrastructure.

Recommended new AI mode:

- `ironquest`

Recommended generated content types:

- mission opening
- choice generation
- choice outcome
- rest beat
- encounter transition
- mission debrief

### AI Constraints

- content must be short
- mobile readable
- generated during rest windows only
- lightweight and state-bounded
- grounded in the workout and current mission state

### Important State Strategy

Do not try to model the entire future IronQuest universe in v1.

For v1, the AI only needs bounded context such as:

- user class
- mission name
- location slug
- encounter phase
- exercise name
- set number
- set result band
- readiness / HP flavor state

This is enough to generate compelling narration without building the entire advanced RPG simulation immediately.

## Image Architecture Recommendation

Image generation is a major premium differentiator and should be central to the product.

Recommended image triggers:

- first character awakening
- first location clear
- major streak milestones
- boss victories
- notable progression moments later

### Why Images Matter So Much

They deliver:

- identity reinforcement
- memory anchoring
- social shareability
- visible premium value

### Image Principles

- use images rarely enough to feel valuable
- tie each image to a real effort moment
- avoid turning the feature into an unlimited image toy

## Data Modeling Recommendation

IronQuest should be its own product area in the codebase.

Do not spread its persistence and logic randomly across existing unrelated areas.

### Recommended Backend Services

- `includes/Services/class-ironquest-progression-service.php`
- `includes/Services/class-ironquest-mission-service.php`
- `includes/Services/class-ironquest-narrative-service.php`
- `includes/Services/class-ironquest-reward-service.php`

### Recommended REST Controllers

- `includes/REST/class-ironquest-controller.php`
- `includes/REST/class-ironquest-admin-controller.php`

### Suggested Database Tables

#### `wp_fit_ironquest_profiles`

Purpose:

- persistent IronQuest identity and progression per user

Suggested fields:

- `user_id`
- `enabled`
- `class`
- `subclass`
- `motivation`
- `level`
- `xp`
- `gold`
- `hp_current`
- `hp_max`
- `current_location_slug`

#### `wp_fit_ironquest_mission_runs`

Purpose:

- track mission instances tied to workouts or cardio sessions

Suggested fields:

- `id`
- `user_id`
- `mission_slug`
- `location_slug`
- `run_type`
- `workout_session_id`
- `status`
- `result_band`
- `xp_awarded`
- `gold_awarded`
- `created_at`
- `completed_at`

#### `wp_fit_ironquest_unlocks`

Purpose:

- record progression unlocks

Suggested content:

- completed locations
- cleared bosses
- relics
- portraits
- title milestones

#### `wp_fit_ironquest_daily_state`

Purpose:

- store derived daily progression modifiers

Suggested content:

- travel points earned today
- meal quest completion flags
- sleep quest completion flags
- cardio completion flags
- streak-derived daily bonuses

#### Inventory Tables

Recommendation:

- defer true inventory tables for v1 unless absolutely necessary

For v1, many "items" can be represented as unlocks, passive bonuses, or reward artifacts instead of full inventory objects.

## Content Modeling Recommendation

Do not parse markdown files as the runtime source of truth.

Instead:

- convert v1 content into structured seed data
- use JSON or PHP config registries for:
  - locations
  - missions
  - reward tables
  - class data
  - portrait triggers

### Why This Matters

The docs are excellent planning assets, but runtime needs:

- stable schemas
- validation
- easier editing
- predictable API responses
- lower risk of content drift

## Frontend Architecture Recommendation

IronQuest should become a first-class product area in the PWA, but most of its value should still surface inside existing screens.

### Recommended Frontend Module Structure

- `pwa/src/api/modules/ironquest.js`
- `pwa/src/screens/ironquest/IronQuestHubScreen.jsx`
- `pwa/src/screens/ironquest/components/*`
- `pwa/src/lib/ironquest/*`

### Recommended Routes

- `/ironquest`
- `/ironquest/map`
- `/ironquest/journal`

However, route creation should not be mistaken for the primary value.

Most value should come from integrations into:

- dashboard
- workout
- rewards
- onboarding

## Integration Strategy By Existing Product Area

### Dashboard

Dashboard should become the premium control center.

Add:

- current mission card
- travel card
- daily quest card
- image gallery card
- progression summary card

### Workout

Workout should receive:

- mission setup
- optional choice
- rest-time narration
- post-workout mission result

### Rewards

Rewards should receive:

- IronQuest XP
- class progression
- milestone unlocks
- IronQuest-specific awards

### Onboarding

Onboarding should receive:

- class selection
- motivation selection
- portrait generation
- first mission handoff

### Settings Or Profile

Settings or Profile should receive:

- premium enable/disable state
- class display
- image gallery management
- favoriting of portraits

## Economy Recommendation

The economy should remain generous.

That is acceptable and even desirable if:

- it reinforces daily behavior
- it still leaves meaningful optional spend decisions
- it does not act as an access toll

### Good Uses For Generous Gold

- travel convenience
- temporary prep boosts
- cosmetic unlocks
- portrait rerolls or premium visual actions later
- optional boss support

### Bad Uses For Gold

- mandatory cost to do standard training
- punishing scarcity loops
- hard gating of core sessions

## Daily Quest Recommendation

Daily quests are one of the best bridges between IronQuest and Johnny5k's real goals.

Recommended daily quest categories:

- meal logged
- protein target hit
- sleep logged
- step target hit
- cardio completed
- workout completed

These should award:

- small gold
- small XP
- combo bonuses
- occasional rare rewards

### Daily Quest Philosophy

Daily quests should encourage:

- whole-life consistency

without:

- overshadowing workouts as the main premium event

## Class System Recommendation

The class system is compelling, but v1 should keep it shallow.

### V1 Class Use

Class should mainly influence:

- flavor
- portrait styling
- mission tone
- small reward bias
- mild progression identity

### Do Not Do In V1

- deep subclass trees
- dozens of active passives
- full spell-equipping system
- heavy cross-class balance tuning

The docs for classes are useful, but most of that depth is later-stage content.

## Replayability Recommendation

Replayability is a strength, not a compromise.

Replayable missions help the system avoid friction and support training-first design.

Recommended replay model:

- every location has at least one replayable mission
- completed missions remain available with scaled or repeat rewards
- special first-clear rewards are separate from repeat rewards
- boss rematches can exist but should be optional

This supports:

- consistency
- user freedom
- lower frustration
- long-term content value

## Rollout Plan

IronQuest should be delivered in phases.

### Phase 1: Identity And Progression Foundation

Build:

- premium entitlement integration
- IronQuest profile model
- class and motivation selection
- starter portrait generation
- starter progression values
- dashboard and rewards integration

Goal:

- make premium feel real before full mission complexity exists

### Phase 2: Narrative Workout Overlay

Build:

- mission assignment
- workout mission context
- rest-time AI narration
- post-workout mission resolution

Goal:

- create the premium "this workout is an adventure" experience

### Phase 3: Travel And Daily Quest Layer

Build:

- travel progress
- cardio and steps integration
- meal and sleep quest bonuses
- location unlocking

Goal:

- reward more total healthy behavior, not just isolated workouts

### Phase 4: Bosses, Relics, And Premium Milestones

Build:

- boss mission loops
- relic rewards
- milestone portraits
- stronger map identity

Goal:

- increase long-term retention and premium distinctiveness

### Phase 5: Deeper RPG Systems If Still Warranted

Possible later additions:

- inventory
- expanded store
- subclass depth
- spells
- larger world campaign

These should only happen after validating that the lighter premium overlay truly improves retention and engagement.

## Success Metrics

IronQuest Premium should be evaluated primarily by behavioral outcomes, not by feature count.

Recommended metrics:

- premium workout frequency
- cardio frequency
- step completion frequency
- meal logging frequency
- sleep logging frequency
- streak retention
- workout completion rate
- repeat usage of live workout mode
- portrait generation engagement
- premium retention compared with non-premium users

## Failure Signals

Watch for:

- users feeling blocked from training
- premium complexity causing drop-off
- workouts feeling slower or more annoying
- daily quests overshadowing the workout loop
- economy inflation making rewards meaningless
- users ignoring the world layer because it feels like too much management

## Final Product Position

The correct north star is:

> Build IronQuest Premium so that users feel like they are living inside a fantasy journey because they are training, moving, eating, and recovering consistently.

not:

> Build a fantasy game and hope users tolerate the training parts.

## Final Architecture Recommendation

IronQuest Premium should feel like:

- Johnny5k with a world attached
- Johnny5k with identity and narrative payoff
- Johnny5k with visible premium motivation loops

It should not feel like:

- a separate game
- a gatekeeping resource simulator
- a layer that turns working out into homework

## Immediate Next Step Recommendation

The next planning artifact after this document should be a concrete implementation checklist broken into:

- backend schema and services
- REST endpoints
- frontend screens and integrations
- seed content
- entitlement gating
- analytics
- test coverage

That checklist should follow this architecture rather than the full world design corpus, because v1 success depends more on focused execution than on total feature completeness.

## One-Sentence Product Rule To Preserve

If only one line from this document is carried forward into every implementation decision, it should be this:

> IronQuest Premium should enhance the motivation to train and reinforce healthy behaviors, but it must never take control away from the user when they are ready to work out.
