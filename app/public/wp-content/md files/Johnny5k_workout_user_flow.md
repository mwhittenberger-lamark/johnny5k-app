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
Workout Plan Overview  
↓  
Pre-Workout (Start Screen)  
↓  
Active Workout Logging (Core Screen)  
↓  
Exercise Swap (Modal)  
↓  
Workout Summary  
↓  
Return to Dashboard  

---

## 1. Workout Plan Overview Screen

### Purpose
Quick orientation. No decisions required.

### Content

- Today’s workout (e.g., Push, 45 min)
- Confidence note (based on recovery)
- Exercise preview list
- Tomorrow preview

### Actions

- Start Workout (primary)
- Swap day
- Shorten session
- Regenerate

---

## 2. Pre-Workout / Start Screen

### Purpose
Quick adjustments before starting.

### Content

- Day type and duration
- Optional readiness check:
  - Great
  - Good
  - Okay
  - Tired
- Exercise list preview
- Last session references

### Behavior

- Adjusts workout if user reports fatigue

### Actions

- Start session
- Swap exercises
- Add abs
- Add challenge

---

## 3. Active Workout Logging Screen (Core)

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

---

## 4. Exercise Swap Modal

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

---

## 5. Mid-Workout Smart Behaviors

### Examples

- Auto-progression suggestions
- Fatigue detection
- Time-based session adjustments

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

1. Workout Plan Overview  
2. Pre-Workout Screen  
3. Active Workout Screen  
4. Swap Exercise Modal  
5. Workout Summary  

