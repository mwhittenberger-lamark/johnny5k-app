# Johnny5k Exercise Card Component Spec

## Purpose

The Exercise Card is the core unit of the Active Workout Screen.

It presents:

- the current exercise
- the user’s previous performance
- today’s recommendation
- set-by-set logging controls
- fast adjustment actions

The component must be:

- fast to scan
- touch-friendly
- visually warm
- aligned with the Johnny5k retro/modern style direction

---

## Visual Intent

The card should feel like:

- a friendly, polished workout tool
- modern and efficient
- warm instead of sterile
- slightly playful without becoming gimmicky

---

## Component Hierarchy

```plaintext
ExerciseCard
├── ExerciseHeader
│   ├── ExerciseName
│   ├── MuscleTag
│   └── ExerciseMenuButton
├── ExerciseLastSession
├── ExerciseTarget
│   ├── TargetWeight
│   ├── TargetRepRange
│   └── ProgressionHint
├── SmartPrompt
├── SetList
│   ├── SetRow
│   ├── SetRow
│   └── SetRow
└── ExerciseActions
    ├── WeightAdjustButtons
    ├── DuplicateLastSetButton
    └── AddSetButton
```

---

## Card Container

### Style
- Background: `#FFFFFF`
- Border radius: `16px` to `24px`
- Shadow:
```css
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
```
- Internal padding: `16px`
- Margin bottom: `12px` to `16px`

### Optional Accent
A teal accent strip at the top of the card may be used to reinforce active state and brand style.

- Accent color: `#2FA4A9`

---

## ExerciseHeader

### Purpose
Identify the exercise quickly and provide access to secondary actions.

### Layout
- Exercise name on the left
- Overflow/menu button on the right
- Muscle tag below or adjacent

### ExerciseName
Examples:
- Incline DB Press
- Machine Chest Press
- Seated Cable Row

### Style
- Font: Poppins
- Weight: 600 or 700
- Size: `16px` to `20px`
- Color: `#1F2A2E`

### MuscleTag
Examples:
- Chest / Shoulders
- Back
- Quads
- Triceps

### Style
- Background: `#F0ECE4`
- Text color: `#5C6B70`
- Pill shape
- Compact padding

### ExerciseMenuButton
Used for:
- swap exercise
- remove exercise
- add note
- future coaching/cues access

The icon should be simple and visually quiet.

---

## ExerciseLastSession

### Purpose
Give the user a fast reference point for progression.

### Example
```plaintext
Last:
70 x 10   70 x 9   65 x 11
```

### Style
- Smaller text size than title
- Muted color: `#5C6B70`
- Clean spacing, no heavy borders

### UX Rule
This should help the user orient quickly without taking visual focus away from current input.

---

## ExerciseTarget

### Purpose
Show the user what today’s working goal is.

### Content
- target weight
- target rep range
- short progression cue

### Example
```plaintext
75 lbs      8–10 reps
Try to beat last week
```

### TargetWeight Style
- Larger than body text
- Font weight: bold
- Color: `#1F2A2E`

### TargetRepRange Style
- Medium emphasis
- Slightly smaller than target weight

### ProgressionHint Style
- Small and muted
- Supportive, not technical

---

## SmartPrompt

### Purpose
Surface helpful, non-intrusive training nudges.

### Example
```plaintext
Try 80 lbs next set
```

### Style
- Background: `#FFF4D6`
- Rounded pill or rounded mini-card
- Short copy
- Optional small icon

### Rules
- should be brief
- should be positive
- should never interrupt data entry

---

## SetList

### Purpose
Display all working sets for the exercise.

A typical exercise card will show 2–5 sets.

---

## SetRow

### Purpose
Allow fast entry and completion of a single set.

### Layout
```plaintext
[Set #] [Weight Input] [Reps Input] [Complete Button]
```

### Example
```plaintext
[1] [ 75 ] [ 8 ] [ ✓ ]
```

### Row Style
- Background: `#F9F6F0`
- Border radius: `10px` to `14px`
- Padding: `8px` to `10px`
- Minimal border use

---

## SetNumber

### Style
- Compact
- High contrast
- Easy to scan

### Role
Help orient the user quickly without taking up much space.

---

## WeightInput

### Requirements
- large tap target
- numeric keyboard on mobile
- centered text
- easy to edit rapidly

### Style
- Background: white
- Border: `1px` or `2px` solid `#E7E0D6`
- Rounded corners
- Bold numeric text

---

## RepsInput

### Requirements
- same general treatment as WeightInput
- optimized for fast repeated entry
- should support smooth keyboard flow

### Style
- same as WeightInput for consistency

---

## CompleteButton

### Purpose
Mark the set as done.

### Default State
- white or neutral fill
- light border

### Completed State
- Fill: `#F25F5C`
- Check icon: white

### Interaction
- immediate visual response
- should feel satisfying but subtle
- optional haptic feedback on supported devices

---

## Completed Row State

When a set is completed, the row may show:

- a soft visual fade
- a coral accent
- a slightly altered background or left-edge highlight

The completed state should be easy to recognize without overpowering the rest of the card.

---

## ExerciseActions

### Purpose
Reduce typing and speed up logging.

### Typical Actions
- `+2.5`
- `+5`
- `-5`
- `Duplicate`
- `+ Set`

---

## WeightAdjustButtons

### Style
- Pill shape
- Background: `#F0ECE4`
- Text color: `#1F2A2E`

### Use
These allow fast weight modification without manual typing.

---

## DuplicateLastSetButton

### Purpose
Quickly clone the previous set values.

### Style
- Same family as secondary pill buttons
- Slightly wider than weight controls

---

## AddSetButton

### Purpose
Insert a new set row quickly.

### Style
- Background: `#2FA4A9`
- Text color: white
- Rounded pill shape

### Behavior
- should insert instantly
- should use sensible defaults when possible

---

## Example Content Snapshot

```plaintext
Incline DB Press
Chest / Shoulders

Last:
70 x 10   70 x 9   65 x 11

75 lbs      8–10 reps
Try to beat last week

Try 80 lbs next set

[1] [75] [8] [✓]
[2] [75] [ ] [ ]
[3] [75] [ ] [ ]

[+2.5] [+5] [-5] [Duplicate] [+ Set]
```

---

## Accessibility Notes

The component should support:

- large tap targets
- high contrast text
- visible focus states
- screen reader-friendly control labels
- numeric inputs that are easy to understand

### Minimum guidance
- interactive controls should not feel cramped
- button labels should remain legible at mobile sizes
- state changes should not rely on color alone

---

## Performance Notes

The Exercise Card will render many times in the session.

### Recommendations
- memoize where appropriate
- avoid rerendering all cards when one set changes
- isolate timer updates from the full card tree
- keep local interactions responsive even when persistence is in flight

---

## Design Summary

The Exercise Card should feel like:

- the center of the workout experience
- warm and clean
- easy to scan at a glance
- fast enough to use during a live lifting session
- visually aligned with the retro/modern Johnny5k design language

The shorthand is:

**rounded, warm, thumb-friendly, and fast**
