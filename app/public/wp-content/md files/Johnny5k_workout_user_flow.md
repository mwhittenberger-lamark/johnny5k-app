# Johnny5k Workout User Flow

## Core UX Principles

- Zero friction to start
- One-hand usable
- No thinking required mid-set
- Everything editable, nothing fragile
- Momentum over perfection

---

## Entry Points

Users can start a workout from:

1. Home Dashboard → "Start Workout"
2. Workout Tab → Tap today’s workout
3. AI Coach → CTA to begin workout

---

## Overall Flow

Home / Workout Tab  
↓  
Workout Launch Screen  
↓  
Active Workout Logging (Core Screen)  
↓  
Exercise Swap (Modal) / Undo Toasts  
↓  
Workout Summary  
↓  
Return to Dashboard  

---

## 1. Workout Launch Screen

### Purpose
Combine orientation and quick pre-session adjustments into one fast screen.

### Content

- Today’s workout (e.g., Push, 45 min)
- Confidence note (based on recovery)
- Exercise preview list
- Tomorrow preview
- Time tier selector
- Readiness check:
  - Great
  - Good
  - Okay
  - Tired
- Last session references

### Actions

- Start Workout (primary)
- Swap day
- Shorten session
- Regenerate

### Behavior

- If readiness is `Great`, `Good`, or `Okay`, the workout starts in normal mode.
- If readiness is `Tired`, the workout starts in `maintenance mode`.
- Maintenance mode means the bare minimum effective session:
  - reduce the session to the minimum viable volume for the day
  - keep main movement quality high
  - remove non-essential accessories first
  - do not auto-add abs or challenge work
  - bias prompts toward technical execution, not progression pushes
- The launch screen and the active screen are the same route family. The user should not feel like they are moving through two separate setup screens.

### Actions

- Start session
- Swap exercises
- Add abs
- Add challenge

---

## 2. Active Workout Logging Screen (Core)

### Purpose
Main interaction screen for the workout.

### Layout

#### Top Bar
- Timer
- Day type
- Finish button

#### Exercise Cards

Each card includes:
- Exercise name and muscle group
- Last session performance
- Today’s recommendation
- Set rows (weight, reps, completion)

#### Controls

- Quick weight adjust (+2.5 / +5 / -5)
- Duplicate last set
- Add/remove sets
- Mark set complete

#### Bottom Sticky Bar

- Add set
- Swap exercise
- Add abs
- Add challenge
- Finish workout

---

### UX Rules

- No navigation during session
- No interruptions
- Instant updates
- One-hand operation
- The user can leave the session at any time and come back without losing progress.

### Resume Rules

- If a workout session already exists and is not completed, entering `/workout` or tapping today’s workout should resume that session.
- The app should restore:
  - active session id
  - logged sets
  - current exercise position
  - time tier
  - readiness mode
- Resume should be automatic. Do not ask the user to choose between resume and restart unless they explicitly request a reset.

---

## 3. Exercise Swap Modal

### Purpose
Replace exercises intelligently.

### Content

- List of alternatives
- Reason tags:
  - Easier on joints
  - Equipment available
  - Similar stimulus

### Behavior

- Tap = instant swap
- No confirmation step
- Show an undo toast immediately after swap
- Undo should restore the prior exercise in place without losing the rest of the session state

---

## 4. Undo Toasts

### Purpose

Support fast actions without fragile state.

### Trigger actions

- Swap exercise
- Add abs
- Add challenge

### Behavior

- These actions apply immediately
- After application, show a toast with `Undo`
- Undo should be available for a short window and revert only the last reversible action
- Undo should not interrupt lifting flow or force a modal confirmation

---

## 5. Mid-Workout Smart Behaviors

### Examples

- Auto-progression suggestions
- Fatigue detection
- Time-based session adjustments

### Maintenance Mode Rules

- If the session started in maintenance mode, prompts should reinforce completion of the minimum viable work only
- Progression suggestions should be conservative
- Challenge work should stay hidden or heavily de-emphasized
- Completion should still count fully for consistency, streaks, and adherence

---

## 6. Workout Summary Screen

### Content

- Duration
- Total sets and volume
- PR highlights
- AI summary
- Recovery recommendation
- Tomorrow’s workout preview

### Actions

- Return to dashboard
- View progress
- Ask AI

---

## 7. Return to Dashboard

### Updates

- Workout marked complete
- Streak updated
- Score updated
- Encouragement message shown

---

## Hidden System Behavior

- Session saved continuously
- Performance tracked
- Progression updated
- Tomorrow plan recalculated
- Gamification triggered

---

## Key UX Decisions

- Logging must be frictionless
- Smart defaults reduce input
- AI supports but does not interrupt
- Undo preferred over confirmation

---

## Screen Summary

1. Workout Launch Screen  
2. Active Workout Screen  
3. Swap Exercise Modal / Undo Toasts  
4. Workout Summary  

