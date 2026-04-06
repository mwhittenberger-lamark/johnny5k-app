# Johnny5k Active Workout Screen Component Tree (Pure React)

This document defines the **Active Workout Screen** as a **pure React implementation spec** aligned with the Johnny5k tech stack:

- React front end
- WordPress backend and auth
- REST API communication
- Local client-side workout session state

This is intended to guide UI implementation, state architecture, and API integration for the workout experience.

---

# 1. Architecture Intent

The Active Workout Screen is the most important interaction surface in the app.

It must be:

- fast
- mobile-first
- one-hand usable
- resilient to temporary connectivity issues
- optimized for low-friction logging

The screen should separate concerns clearly into:

1. **Screen layer**
2. **Session/state layer**
3. **Presentation/UI layer**
4. **API integration layer**

---

# 2. Top-Level Pure React Structure

```plaintext
<WorkoutSessionScreen>
  <WorkoutSessionProvider>
    <WorkoutLayout>
      <WorkoutHeader />
      <WorkoutBody />
      <WorkoutFooter />
      <WorkoutModals />
    </WorkoutLayout>
  </WorkoutSessionProvider>
</WorkoutSessionScreen>
```

---

# 3. Screen Layer

## `<WorkoutSessionScreen>`

This is the route-level React screen.

### Responsibilities
- Load the current workout session from route params or workout context
- Trigger session bootstrap
- Render launch, loading, error, resume, and ready states
- Mount provider and layout

### Suggested route examples
- `/workout/session/:sessionId`
- `/workout/today`

### Behavior
- If no session exists yet, the screen renders the launch state for today's workout
- The launch state combines workout overview, readiness check, and time-tier selection into one screen
- If a session exists, it resumes the active session automatically
- If the session fails to load, show retry state

### Launch-State Rule
- Do not split orientation and pre-workout configuration into separate screens by default
- The route should feel like one continuous workout entry surface

---

# 4. Session and State Layer

## `<WorkoutSessionProvider>`

This is the main state boundary for the active workout experience.

### Responsibilities
- Hold current session state
- Manage exercise and set updates
- Handle optimistic UI updates
- Coordinate autosave
- Track modal state
- Track footer action state
- Expose screen-level actions to components

### Suggested internal concerns
- session metadata
- exercises and set rows
- active exercise reference
- timer state
- unsaved changes state
- save status
- modal visibility
- local recommendations/prompts

---

## Suggested State Shape

```ts
type WorkoutSessionState = {
  sessionId: string
  status: "idle" | "launch" | "loading" | "ready" | "saving" | "finishing" | "error"

  dayType: "push" | "pull" | "legs" | "arms_shoulders" | "cardio" | "rest"
  timeTier: "short" | "medium" | "full"
  sessionMode: "normal" | "maintenance"
  readinessLabel: "great" | "good" | "okay" | "tired"

  startedAt: string | null
  elapsedSeconds: number

  exercises: WorkoutExercise[]
  activeExerciseId: string | null
  resumable: boolean

  ui: {
    isSwapModalOpen: boolean
    isAddExerciseModalOpen: boolean
    isRestTimerModalOpen: boolean
    activeExerciseForModal: string | null
    pendingChanges: boolean
    lastSaveAt: string | null
    errorMessage: string | null
    undoToast: UndoToastState | null
  }
}

type UndoToastState = {
  actionType: "swap" | "add_abs" | "add_challenge"
  label: string
  expiresAt: string
}
```

---

## Suggested Actions

```ts
type WorkoutSessionActions = {
  bootstrapSession: (sessionId?: string) => Promise<void>
  startSession: () => Promise<void>
  resumeSession: () => Promise<void>
  applyReadiness: (label: "great" | "good" | "okay" | "tired") => void
  completeSet: (payload: CompleteSetPayload) => void
  updateSetField: (payload: UpdateSetFieldPayload) => void
  addSet: (exerciseId: string) => void
  removeSet: (setId: string) => void
  duplicateLastSet: (exerciseId: string) => void

  swapExercise: (payload: SwapExercisePayload) => Promise<void>
  addAbsExercise: () => Promise<void>
  addChallengeExercise: () => Promise<void>

  openSwapModal: (exerciseId: string) => void
  closeSwapModal: () => void
  undoLastReversibleAction: () => Promise<void>
  dismissUndoToast: () => void

  finishWorkout: () => Promise<void>
}

## Suggested State Rules

- If readiness is `tired`, starting the session should switch `sessionMode` to `maintenance`
- Maintenance mode means the bare minimum effective session for adherence:
  - reduce volume first
  - preserve the main lift or top-priority movement
  - strip optional add-ons by default
  - suppress aggressive progression prompts
- If a session already exists and is incomplete, `bootstrapSession()` should prefer resume over creating a new session

## Suggested State Transitions

```plaintext
idle -> launch
launch -> loading
loading -> ready
ready -> saving -> ready
ready -> finishing -> idle
any -> error

resume path:
idle -> loading -> ready

tired path:
launch + readiness=tired -> loading -> ready(sessionMode=maintenance)
```

---

# 5. Layout Layer

## `<WorkoutLayout>`

High-level visual layout wrapper for the screen.

```plaintext
<WorkoutLayout>
  <WorkoutHeader />
  <WorkoutBody />
  <WorkoutFooter />
  <WorkoutModals />
</WorkoutLayout>
```

### Responsibilities
- Manage vertical composition
- Respect safe areas on mobile
- Keep footer sticky
- Keep layout stable during live editing
- Support both launch-state and active-session-state composition without a route change

---

# 6. Header Layer

## `<WorkoutHeader>`

```plaintext
<WorkoutHeader>
  <WorkoutTitle />
  <WorkoutTimer />
  <FinishWorkoutButton />
</WorkoutHeader>
```

### Responsibilities
- Display workout identity
- Display live timer
- Provide workout completion action
- Reflect whether the session is in normal mode or maintenance mode

---

## `<WorkoutTitle>`
Displays:
- day type
- optional estimated duration
- optional micro-status like “In Progress”

Example:
- Push Day
- Pull Day
- Legs Day
- Push Day · Maintenance Mode

---

## `<WorkoutTimer>`
Displays:
- elapsed workout time
- continuously updated timer

Behavior:
- starts from session start time
- updates without forcing the whole screen to rerender

---

## `<FinishWorkoutButton>`
Triggers workout completion flow.

Behavior:
- If there are valid completed sets, proceed to finish flow
- If user has started but logged nothing, optionally show lightweight guardrail

---

# 7. Body Layer

## `<WorkoutBody>`

```plaintext
<WorkoutBody>
  <ExerciseList />
</WorkoutBody>
```

### Responsibilities
- Scrollable content area
- Hosts the exercise list
- Must work smoothly with sticky footer

---

## `<ExerciseList>`

```plaintext
<ExerciseList>
  <ExerciseCard />
  <ExerciseCard />
  <ExerciseCard />
</ExerciseList>
```

### Responsibilities
- Render all workout exercises in order
- Support dynamic insertion for abs/challenge additions
- Minimize rerenders when one set changes

### Notes
- Usually 4–8 exercises
- Virtualization is likely unnecessary initially, but memoization is important

---

# 8. Exercise Card Tree

## `<ExerciseCard>`

This is the core repeated unit of the screen.

```plaintext
<ExerciseCard>
  <ExerciseHeader />
  <ExerciseLastSession />
  <ExerciseTarget />
  <SetList />
  <ExerciseActions />
</ExerciseCard>
```

### Responsibilities
- Display one exercise and all related logging UI
- Surface prior performance
- Surface today’s target
- Allow rapid set entry
- Provide per-exercise quick actions
- Allow immediate reversible actions through undo toasts rather than blocking confirmations

---

## `<ExerciseHeader>`

```plaintext
<ExerciseHeader>
  <ExerciseName />
  <MuscleTag />
  <ExerciseMenuButton />
</ExerciseHeader>
```

### Subcomponents

#### `<ExerciseName>`
Displays the exercise name:
- Incline DB Press
- Machine Chest Press
- Seated Cable Row

#### `<MuscleTag>`
Displays a compact muscle/category tag:
- Chest / Shoulders
- Back
- Quads
- Triceps

#### `<ExerciseMenuButton>`
Provides secondary actions:
- Swap exercise
- Remove exercise
- Add note
- View cues later if desired

---

## `<ExerciseLastSession>`

Displays the user’s previous comparable performance.

Example:
```plaintext
Last session:
70 x 10
70 x 9
65 x 11
```

### Purpose
- reduce cognitive load
- help user know what to aim for
- reinforce progression continuity

---

## `<ExerciseTarget>`

```plaintext
<ExerciseTarget>
  <TargetWeight />
  <TargetRepRange />
  <ProgressionHint />
</ExerciseTarget>
```

### Displays
- recommended working weight
- rep range
- concise coaching hint

Example:
- Today target: 75 lbs
- Reps: 8–10
- Hint: Try to match or beat last week

---

# 9. Set Entry Layer

## `<SetList>`

```plaintext
<SetList>
  <SetRow />
  <SetRow />
  <SetRow />
</SetList>
```

### Responsibilities
- Render ordered set rows
- Keep interactions extremely fast
- Support instant add/remove/edit

---

## `<SetRow>`

```plaintext
<SetRow>
  <SetNumber />
  <WeightInput />
  <RepsInput />
  <CompleteSetButton />
</SetRow>
```

### Responsibilities
- represent one logged set
- allow fast updates
- allow immediate completion

---

## `<SetNumber>`
Displays:
- Set 1
- Set 2
- Set 3

Keep visually compact.

---

## `<WeightInput>`
### Responsibilities
- numeric entry for weight
- quick editing
- support auto-fill from previous set

### UX expectations
- large tap target
- easily editable
- numeric keypad on mobile
- default to previous or recommended weight

---

## `<RepsInput>`
### Responsibilities
- numeric entry for reps
- fast tap-first experience

### UX expectations
- auto-focus intelligently
- use numeric keypad
- support quick progression through fields

---

## `<CompleteSetButton>`
### Responsibilities
- mark set complete
- trigger autosave pathway
- optionally trigger progression/fatigue hints

### UX expectations
- obvious completion affordance
- thumb friendly
- immediate visual feedback

---

# 10. Per-Exercise Actions

## `<ExerciseActions>`

```plaintext
<ExerciseActions>
  <WeightAdjustButtons />
  <DuplicateLastSetButton />
  <AddSetButton />
</ExerciseActions>
```

### Purpose
Reduce typing and speed up logging.

---

## `<WeightAdjustButtons>`
Buttons:
- `+2.5`
- `+5`
- `-5`

### Behavior
- applies to selected or most recent editable set
- should not require extra confirmation

---

## `<DuplicateLastSetButton>`
Copies previous set values into a new or current row.

### Use case
Common when user repeats same weight across working sets.

---

## `<AddSetButton>`
Adds a new set row immediately.

### Behavior
- new row should inherit sensible defaults
- should appear instantly

---

# 11. Sticky Footer Layer

## `<WorkoutFooter>`

```plaintext
<WorkoutFooter>
  <AddSetGlobalButton />
  <SwapExerciseGlobalButton />
  <AddAbsButton />
  <AddChallengeButton />
  <FinishWorkoutButton />
</WorkoutFooter>
```

### Responsibilities
- provide session-wide high-frequency actions
- remain reachable by thumb at all times
- avoid requiring scroll to act
- stay consistent whether the session started fresh or was resumed

### Notes
This footer is one of the most important speed layers in the product.

---

## `<AddSetGlobalButton>`
Adds a set to the currently active exercise.

---

## `<SwapExerciseGlobalButton>`
Opens swap flow for currently active exercise.

---

## `<AddAbsButton>`
Adds one or more optional ab exercises.

### Behavior
- should use recommendation logic where possible
- should not derail the main flow

---

## `<AddChallengeButton>`
Adds an optional challenge finisher or add-on.

### Behavior
- used sparingly
- should feel optional, not mandatory

---

## `<FinishWorkoutButton>`
This may also exist in the header, but footer placement is usually more thumb-friendly.

### Recommendation
Use one primary footer completion action and keep header action visually lighter if both are present.

---

# 12. Modals Layer

## `<WorkoutModals>`

```plaintext
<WorkoutModals>
  <SwapExerciseModal />
  <AddExerciseModal />
  <RestTimerModal />
  <UndoToastLayer />
</WorkoutModals>
```

### Responsibilities
- centralize modal rendering
- prevent deep nesting inside exercise cards
- keep modal state coordinated through provider/store

---

## `<SwapExerciseModal>`

```plaintext
<SwapExerciseModal>
  <ModalHeader />
  <SwapOptionList />
</SwapExerciseModal>
```

### Purpose
Replace current exercise quickly with a smart alternative.

---

## `<SwapOptionList>`

```plaintext
<SwapOptionItem>
  <SwapExerciseName />
  <ReasonTags />
</SwapOptionItem>
```

### Displays
- alternative exercise name
- reason tags such as:
  - Easier on shoulders
  - Lower back friendly
  - Similar stimulus
  - Equipment available

### UX rule
Tap should replace instantly. Prefer no extra confirmation step.

### Recovery rule
After a swap succeeds optimistically, show an undo toast immediately.

---

## `<AddExerciseModal>`
Optional modal for broader additions beyond predefined abs/challenge flows.

Potential use cases:
- add accessory movement
- add missed movement
- insert manual exercise

For quick abs and challenge actions, prefer immediate add plus undo toast over an extra confirmation modal.

---

## `<RestTimerModal>`
Optional enhancement.

### Possible responsibilities
- show rest countdown
- allow skip
- restart timer
- surface next set suggestion

This can be deferred until later implementation if needed.

## `<UndoToastLayer>`

Purpose:
- support reversible high-speed interactions without blocking the user

Responsibilities:
- show the last reversible action
- expose a single-tap `Undo`
- expire automatically after a short window

---

# 13. Hook and Store Layer

These are not visual components, but they define how the screen should work in pure React.

## `useWorkoutSessionStore()`
Central source of workout session state.

Recommended implementation:
- Zustand for performance and low ceremony

Responsibilities:
- local state
- mutations
- selectors
- save flags
- modal control state

---

## `useWorkoutSession()`
Convenience hook used by components to read and mutate workout session state.

Responsibilities:
- expose session data
- expose actions
- expose derived values

---

## `useWorkoutTimer()`
Isolated timer logic hook.

Responsibilities:
- derive elapsed time
- update on interval
- avoid excessive rerenders

---

## `useWorkoutAutoSave()`
Handles persistence behavior.

Responsibilities:
- debounce updates
- batch writes where appropriate
- retry on failure
- mark unsaved changes
- coordinate optimistic UI
- restore resumable sessions after refresh or re-entry

---

## `useProgressionHints()`
Produces smart suggestions based on current session behavior and history.

Example outputs:
- try increasing load
- hold weight steady
- fatigue detected
- shorten session suggestion

---

## `useWorkoutPrompts()`
Surfaces subtle, non-intrusive prompts.

Examples:
- “Nice—try 80 lbs next set?”
- “Want to shorten and finish strong?”
- “You may be fatiguing—drop 5 lbs?”

These should feel supportive, not interruptive.

In maintenance mode, prompts should bias toward completion and technical quality rather than load progression.

---

# 14. API Integration Layer

The React app should call WordPress REST endpoints directly.

## Suggested client API module
`workoutApi.ts`

### Likely methods
- `startWorkoutSession()`
- `getWorkoutSession(sessionId)`
- `updateWorkoutSet()`
- `createWorkoutSet()`
- `deleteWorkoutSet()`
- `swapWorkoutExercise()`
- `addAbsExercise()`
- `addChallengeExercise()`
- `finishWorkoutSession()`

---

## Example interaction flow: completing a set

```plaintext
User taps CompleteSetButton
→ local state updates immediately
→ set marked complete in UI
→ autosave queue schedules API write
→ API call persists set
→ response reconciles server/local state
→ progression hints update if needed
```

---

## Example interaction flow: swapping an exercise

```plaintext
User taps SwapExerciseGlobalButton
→ SwapExerciseModal opens
→ user selects alternative
→ local UI updates optimistically
→ API call persists swap
→ undo toast appears
→ exercise card rerenders with new metadata and target

---

## Example interaction flow: resuming a session

```plaintext
User leaves the app mid-session
→ local session state persists
→ user returns to /workout
→ bootstrapSession detects active incomplete session
→ existing session loads
→ active exercise, logged sets, mode, and timer context are restored
```
```

---

# 15. Suggested Pure React Folder Structure

```plaintext
src/
  app/
    router/
      AppRouter.tsx

  screens/
    WorkoutSessionScreen/
      WorkoutSessionScreen.tsx
      WorkoutSessionScreen.types.ts
      WorkoutSessionScreen.styles.ts

  components/
    workout/
      WorkoutLayout.tsx
      WorkoutHeader.tsx
      WorkoutBody.tsx
      WorkoutFooter.tsx
      ExerciseList.tsx
      ExerciseCard.tsx
      ExerciseHeader.tsx
      ExerciseLastSession.tsx
      ExerciseTarget.tsx
      SetList.tsx
      SetRow.tsx
      ExerciseActions.tsx

    modals/
      SwapExerciseModal.tsx
      AddExerciseModal.tsx
      RestTimerModal.tsx

  store/
    workoutSessionStore.ts

  hooks/
    useWorkoutSession.ts
    useWorkoutTimer.ts
    useWorkoutAutoSave.ts
    useProgressionHints.ts
    useWorkoutPrompts.ts

  api/
    workoutApi.ts
    authApi.ts

  types/
    workout.ts
```

---

# 16. Final Flattened Component Tree

```plaintext
WorkoutSessionScreen
└── WorkoutSessionProvider
    └── WorkoutLayout
        ├── WorkoutHeader
        │   ├── WorkoutTitle
        │   ├── WorkoutTimer
        │   └── FinishWorkoutButton
        │
        ├── WorkoutBody
        │   └── ExerciseList
        │       ├── ExerciseCard
        │       │   ├── ExerciseHeader
        │       │   │   ├── ExerciseName
        │       │   │   ├── MuscleTag
        │       │   │   └── ExerciseMenuButton
        │       │   ├── ExerciseLastSession
        │       │   ├── ExerciseTarget
        │       │   │   ├── TargetWeight
        │       │   │   ├── TargetRepRange
        │       │   │   └── ProgressionHint
        │       │   ├── SetList
        │       │   │   ├── SetRow
        │       │   │   │   ├── SetNumber
        │       │   │   │   ├── WeightInput
        │       │   │   │   ├── RepsInput
        │       │   │   │   └── CompleteSetButton
        │       │   │   └── (repeated)
        │       │   └── ExerciseActions
        │       │       ├── WeightAdjustButtons
        │       │       ├── DuplicateLastSetButton
        │       │       └── AddSetButton
        │       └── (repeated)
        │
        ├── WorkoutFooter
        │   ├── AddSetGlobalButton
        │   ├── SwapExerciseGlobalButton
        │   ├── AddAbsButton
        │   ├── AddChallengeButton
        │   └── FinishWorkoutButton
        │
        └── WorkoutModals
            ├── SwapExerciseModal
            │   ├── ModalHeader
            │   └── SwapOptionList
            │       └── SwapOptionItem
            │           ├── SwapExerciseName
            │           └── ReasonTags
            ├── AddExerciseModal
            └── RestTimerModal
```

---

# 17. Implementation Guidance Summary

The pure React version of this screen should be built with these rules:

- keep session logic out of presentation components
- use a dedicated client-side store for workout state
- favor optimistic updates
- favor large tap targets and minimal typing
- keep logging actions reachable without scrolling
- let AI/recommendation logic support the experience without interrupting it
- use WordPress REST endpoints as the source of persistence
- treat the screen as a high-speed logging surface, not a traditional form

---

# 18. Recommended Next Step

After this component tree, the next most valuable spec would be one of these:

1. **TypeScript interfaces for workout session state**
2. **Zustand store design**
3. **Exact API contract for workout-session interactions**
4. **Wireframe-level layout spec for the Active Workout Screen**
