# IronQuest Onboarding Feature

## Current Product Position

IronQuest onboarding is now a secondary add-on flow layered on top of the main Johnny5k onboarding.

That means:

- Core Johnny5k onboarding still completes first
- Workout, nutrition, and daily-plan setup remain the source of truth
- IronQuest is offered after core onboarding for entitled users who want the quest layer

This keeps the primary onboarding lean while still letting IronQuest feel intentional.

## Live Entry Point

Current route tree:

- `/onboarding/*` handles the main Johnny5k onboarding
- `/onboarding/ironquest/*` handles the optional IronQuest follow-up

The IronQuest entry point is launched from the main onboarding completion screen, not mixed into the core intake steps.

## Implemented Flow

### Step 1: Intro

Purpose:

- Position IronQuest as an overlay on top of the plan Johnny already built
- Reduce anxiety by making it optional

Current copy direction:

- “You can enter IronQuest without changing your Johnny5k plan”
- “This is a secondary setup pass”

### Step 2: Class Selection

Current options:

- Warrior
- Ranger
- Mage
- Rogue

This sets the identity framing for the quest layer only.

### Step 3: Motivation Selection

Current options:

- Discipline
- Strength
- Transformation
- Redemption

This personalizes the tone of the quest identity while leaving the actual training plan unchanged.

### Step 4: Image / Starter Portrait

This is now part of the live onboarding flow.

Current behavior:

- User can upload a headshot
- User can optionally generate 1-2 stylized portrait variants from that headshot
- User can select either the raw headshot or one generated image as the starter portrait
- User can skip the image step entirely

Persistence:

- The chosen image is stored as `starter_portrait_attachment_id` in IronQuest identity

Important product behavior:

- Portrait is optional, not blocking
- The image system reuses the existing Johnny5k onboarding media pipeline
- No separate IronQuest-only upload system exists

### Step 5: Ready / Launch Screen

The live ready screen now shows:

- Chosen class
- Chosen motivation
- Current region
- First mission label
- Current starter resources
- Selected starter portrait, when one exists

CTA behavior:

- Open quest hub
- Open dashboard

## What Happens After Onboarding

The selected starter portrait now carries into the first visible IronQuest surfaces after onboarding.

Current live surfaces:

- IronQuest ready screen
- IronQuest hub hero
- Workout mission intro card when a workout-backed mission starts
- Workout completion reward reveal when that mission resolves

This gives the portrait real continuity instead of leaving it trapped inside onboarding.

## Current Workout Integration

When a workout starts and IronQuest is active:

- The workout session automatically starts the current IronQuest mission
- The active workout screen shows a mission intro moment tied to that run
- The starter portrait is used in that intro moment when available

When a workout completes:

- The mission resolves through the existing workout completion flow
- The workout completion review modal shows the IronQuest reward reveal
- The starter portrait is used again in that reward moment when available

## Intentional Non-Goals For The Current Version

The following ideas may still be useful later, but they are not live onboarding behavior and should not be documented as current state:

- Forced first-mission tutorial flow
- Mandatory portrait generation
- Guided first-set narrative beats unique to onboarding
- Store tutorial as part of onboarding
- Large upfront explanation of travel math, dice, HP, or deeper systems

## Product Rule

The onboarding goal remains:

- Hook
- Identity
- Optional portrait personalization
- Ready state
- Immediate transition into normal Johnny5k usage with IronQuest layered on top

The onboarding should not try to explain the whole game. It should make the user feel oriented, personalized, and ready to start training inside the quest layer.

## Onboarding Metrics To Watch

Track:

- Percent who upload face
- Percent who complete first mission
- Percent who return for second session
- Percent who reach boss

## One High-Impact Addition

### First Win Celebration

After the first mission:

- Slight animation
- Sound
- Visual reward

Make it feel like:

> A moment

## Biggest Mistake To Avoid

Do not overwhelm with:

- Menus
- Stats
- Explanations

## Final Flow Summary

- Hook
- Class
- Face
- Identity reveal
- First mission
- First win
- Light rewards
- Gradual system unlock

## Updated Onboarding Structure (With Training Center)

### Core Flow Change

Instead of:

- Start -> Grim Hollow

You now have:

- Start -> Training Grounds -> Travel -> Grim Hollow

This adds:
