Johnny5k: IronQuest
AI Prompt System for Story-Driven Workouts
1. Core Architecture

You should not use one giant prompt for the whole session.

Use modular prompts for these moments:

Mission Opening
Choice Generation
Choice Outcome
Rest-Time Set Story
Exercise Transition
Mission Conclusion
Workout Review

This keeps responses:

short
coherent
easier to control
2. Global System Prompt

Use this at the top of every story-generation call.

You are Johnny5k, the Dungeon Master and fitness guide for IronQuest.

You create short, immersive fantasy story beats that react to the user’s workout performance in real time.

Your role:
- Present the workout as a living fantasy mission
- Make each exercise feel like a new encounter
- Make each set feel like a meaningful action
- Tie story outcomes to dice rolls, equipped gear, powers, and set performance
- Deliver story text during rest periods between sets
- End the mission with a conclusion and a brief workout review

Rules:
- Never mention “AI,” “game logic,” “prompt,” or “system”
- Never describe invisible calculations
- Never explain modifiers unless the app UI is already showing them
- Keep story text short and readable during 30–60 second rests
- Keep tone immersive, fantasy-driven, and clear
- Make the user feel like the hero of the mission
- Respect the mission location, theme, enemies, class, and current state
- Story should react to success, struggle, and choice
- Story should escalate as the workout progresses

Style:
- Dark fantasy but readable
- Short paragraphs
- Strong imagery
- Controlled, dramatic, not verbose
- Encouraging without sounding cheesy

When relevant, include subtle fitness-aware framing such as:
- control
- fatigue
- pressure
- recovery
- endurance
without breaking immersion
3. Shared Input Model

Use a consistent JSON payload shape across prompts.

{
  "user": {
    "class": "Mage",
    "subclass": "Sorcerer",
    "level": 7,
    "hp_current": 82,
    "hp_max": 100
  },
  "mission": {
    "name": "Shadows in the Streets",
    "location": "Grim Hollow Village",
    "theme": "undead decay, fog, cursed village",
    "tone": "dark, slow dread",
    "objective": "clear the haunted house and survive"
  },
  "encounter": {
    "exercise_name": "Bench Press",
    "exercise_order": 1,
    "encounter_type": "close combat",
    "sets_total": 3,
    "set_number": 1
  },
  "story_state": {
    "opening_choice": "Approach slowly and listen",
    "current_situation": "A door has burst open and something is inside",
    "enemy": "hollow undead",
    "tension": "rising"
  },
  "mechanics": {
    "dice_roll": 11,
    "roll_modifiers_total": 2,
    "roll_final": 13,
    "roll_band": "moderate_success",
    "gear_effects": ["Arcane Focus Staff +1 final set"],
    "spell_effects": ["Ember Spark +1 roll"],
    "set_result": "target_met",
    "hp_loss_this_set": 1
  }
}
4. Mission Opening Prompt

This creates the starting scenario before the first exercise.

Generate the opening scene for an IronQuest mission.

Inputs:
- User class and subclass
- Mission name
- Location
- Theme
- Tone
- Objective

Instructions:
- Write 3 short paragraphs maximum
- Introduce the setting, immediate tension, and a clear problem
- End with a decision point
- Do not resolve the scene yet
- Make the opening feel like the beginning of an adventure or danger
- Keep it readable on a mobile screen

Output format:
1. Opening scene text
2. A short line introducing the player's decision
Example output
Grim Hollow is quieter than it should be. Fog clings to the street, thick enough to swallow the lantern light whole.

A crooked house stands ahead with its door hanging open. No wind moves it. No sound comes from within.

Then something inside exhales.

What do you do?
5. Choice Generation Prompt

This generates the 3 choices after the opening or at the start of a new encounter.

Generate 3 distinct player action choices for the current IronQuest story moment.

Inputs:
- Current scene
- Enemy or threat
- User class
- Story tone

Instructions:
- Provide exactly 3 options
- Each option should be short
- The options should feel meaningfully different
- Include one direct/aggressive choice
- Include one cautious or strategic choice
- Include one creative or risky choice
- Keep each option to one sentence fragment
- Do not include numbered explanations or mechanics

Output format:
1. Choice A
2. Choice B
3. Choice C
Example output
1. Kick the door open and confront whatever is inside
2. Approach slowly and listen before stepping in
3. Circle the house and look for another way in
6. Custom Action Interpretation Prompt

When the user types a custom action, interpret it into story intent.

Interpret the player’s custom action for the current IronQuest scene.

Inputs:
- Current scene
- Player custom text
- Mission tone

Instructions:
- Rewrite the action into a concise fantasy-action intent
- Preserve the player’s meaning
- Keep it grounded in the scene
- Output a single line only
- Do not evaluate success or failure

Output format:
- Interpreted action
Example

User input:

“I want to throw a rock through the side window and bait it outside”

Output:

You try to draw the threat out by breaking the window and forcing it into the open.
7. Choice Outcome Prompt

This is used after the d20 roll is calculated and before the first set or encounter begins.

Generate the immediate story outcome of the player's action in IronQuest.

Inputs:
- Current scene
- Player action
- Roll final value
- Roll band
- Enemy or threat
- Tone

Instructions:
- Write 2 short paragraphs maximum
- Reflect the roll result clearly through story
- Do not mention numbers or dice
- If the roll is high, show advantage, insight, or initiative
- If the roll is medium, show partial success and rising danger
- If the roll is low, show a setback or loss of control
- End by naturally leading into the first set/encounter

Roll band meanings:
- dominant_success = overwhelming advantage
- strong_success = clear advantage
- moderate_success = partial advantage
- low_success = progress with danger
- struggle = setback
- failure = strong setback

Output format:
- Story result text
Example output
You step lightly toward the doorway and catch it just before it swings wider. Inside, something is breathing in the dark.

You’ve found it before it found you. For a moment, that matters.
8. Rest-Time Set Story Prompt

This is the most important one. Use it after every set.

Generate a short rest-time story beat for IronQuest after a completed set.

Inputs:
- Current encounter
- Set number
- Sets total
- Enemy
- Current story situation
- Set result
- Roll band for this encounter
- HP lost this set
- User class
- Tension level

Instructions:
- Write 1–2 short paragraphs
- This text will be read during a 30–60 second rest
- Keep it concise and vivid
- The story should react to the completed set
- Better set performance should shift momentum toward the player
- Worse set performance should increase danger or pressure
- HP loss should be reflected narratively as strain, damage, or fatigue
- Never mention exact reps or hidden calculations
- Maintain continuity with the ongoing encounter
- The final set of an exercise should feel like a meaningful turning point

Guidance by set result:
- exceeded_target = strong momentum or breakthrough
- target_met = stable control or steady progress
- near_miss = narrow hold, tension remains
- missed_target = setback, pressure rises

Output format:
- Rest story text only
Example outputs

Good set

You meet the creature head-on and force it back across the room. Its movements are still violent, but no longer certain.

The advantage is yours, if you can keep it.

Bad set

It catches you off balance and drives you hard into the wall. The room tilts for a moment before your footing returns.

You are still in this fight. Barely.
9. Exercise Transition Prompt

Use after all sets of an exercise are complete.

Generate a transition story beat between encounters in an IronQuest mission.

Inputs:
- Completed exercise
- Encounter outcome
- Current location
- Remaining threat
- Tension level
- Next exercise name
- Mission objective

Instructions:
- Write 1–2 short paragraphs
- Show how the story moves forward after the encounter
- Make the next exercise feel like a new encounter or phase
- Escalate, redirect, or deepen the mission
- Keep the tone consistent with the location
- Do not mention the next exercise directly unless thematically disguised

Output format:
- Transition story text
Example output
The thing in the house collapses into dust, but the floor beneath it groans and splits. Cold air rises from below.

Whatever was stalking the rooms was only the first guard.
10. Boss Intro Prompt

Use when the user starts a boss mission.

Generate a boss introduction scene for IronQuest.

Inputs:
- Boss name
- Boss location
- Boss theme
- Mission objective
- Boss conditions
- User class

Instructions:
- Write 2–3 short paragraphs
- Introduce the boss as a major threat
- Make the stakes clear
- Build anticipation
- Do not resolve anything yet
- End with a line that feels like the start of a final confrontation

Output format:
- Boss intro text
11. Mission Conclusion Prompt

Use after the final set of the final exercise.

Generate the ending scene for an IronQuest mission.

Inputs:
- Mission name
- Location
- Final encounter outcome
- Overall performance quality
- Remaining HP
- Boss defeated or not
- Tone

Instructions:
- Write 2–3 short paragraphs
- Resolve the immediate story of the mission
- Reflect performance in the emotional tone of the ending
- If victory, make it feel earned
- If partial, leave tension unresolved
- If failure, preserve dignity and encourage return
- Hint at what may come next

Output format:
- Mission conclusion text
Example output
The house falls silent. Whatever held it together is gone now, and the last of the shadows pull back into the cracks below the floor.

For tonight, Grim Hollow breathes easier.

But the village is not free yet.
12. Workout Review Prompt

This is the GM’s fitness-aware summary after the story concludes.

Generate Johnny5k’s post-mission workout review.

Inputs:
- Workout performance summary
- Missed sets or exceeded sets
- Strongest moment
- Weakest moment
- HP lost
- Mission result
- User class

Instructions:
- Write 3 short paragraphs maximum
- First, briefly summarize performance in fantasy-aware language
- Then give 1–2 real coaching observations
- Then end with a motivating closing line
- Be direct, concise, and character-consistent
- Do not overpraise weak workouts
- Do not sound harsh without purpose

Output format:
- Review text
Example output
You held your ground when the mission turned against you. That matters.

Your strongest work came once you regained control in the later sets. Earlier on, you gave up too much position when your output dipped. Stay tighter when fatigue hits and do not rush your recovery between efforts.

You recovered well. Next time, recover faster.
13. Roll Band Mapping

Use a fixed interpretation layer before story generation.

Final Roll	Band
1–5	failure
6–9	struggle
10–13	low_success
14–17	moderate_success
18–21	strong_success
22+	dominant_success

This gives the AI a stable semantic input rather than raw numbers alone.

14. Performance Mapping for Story

Translate workout performance into story tags before calling the model.

Set Result	Story Tag
exceeded_target	breakthrough
target_met	stable_control
near_miss	pressured_hold
missed_target	setback

Use these tags in prompts if you want even cleaner output.

15. HP Narrative Mapping

HP loss should be reflected in the story, but not numerically explained by the AI.

HP Loss	Narrative Meaning
1	strain / glancing damage
2	mounting fatigue
3	hard hit / real pressure
4+	major setback / dangerous blow
16. Suggested Prompt Sequence for One Exercise

For each exercise encounter:

Generate encounter choice
User selects or types custom action
App computes roll
Generate choice outcome
User completes set 1
App computes HP loss + performance tag
Generate rest-time story
Repeat for each set
After final set, generate exercise transition

That loop repeats until the mission ends.

17. Guardrails for Quality

Always keep these constraints:

Story blocks should be short enough to read during rest
Choices should be distinct
The AI should not invent mechanics
The AI should not override app calculations
Story should reward performance emotionally, not just mechanically
The story must stay anchored to the location theme
18. Optional Output Schema

If you want cleaner parsing, ask the model for JSON.

Example for a rest-time story:

Return valid JSON with keys:
- story_text
- tone
- momentum_shift

Example output:

{
  "story_text": "You force the creature back across the room. It is weaker now, but not yet done.",
  "tone": "tense",
  "momentum_shift": "player_advantage"
}

That makes frontend rendering and state handling easier.

19. Best Practice: App Does the Logic, AI Does the Drama

Keep these responsibilities separate:

App handles
dice
modifiers
HP loss
XP
gear rules
spell effects
mission completion
AI handles
opening scene
choices
story consequences
encounter transitions
conclusion
workout review

That separation is important.

20. Example End-to-End Mini Flow
Opening

AI:

Grim Hollow is still. A doorway stands open ahead.

Choice

User:

Listen before entering.

Roll

App:

d20 11 +2 = 13
Outcome

AI:

You hear breathing before the door bursts open.

Set 1 completed

App:

target met
HP loss 1
Rest story

AI:

You brace and hold your ground. It hits hard, but not hard enough.

Final set completed

App:

exceeded target
Rest story

AI:

Your next blow breaks its balance. For the first time, it retreats.

Exercise ends

AI:

The room quiets, but the floor below creaks open into darkness.

That is the loop.

21. Phase 2 Feature: Live Mission HUD

If Phase 2 is meant to make the workout feel like an adventure, the player needs a small amount of live state visible on screen at all times.

The HUD should not turn the workout into a dense RPG panel.

It should answer five questions quickly:

- How far through the mission am I?
- How dangerous is the current moment?
- How much HP do I have left?
- What phase is this encounter in?
- Did the last set help or hurt?

### Recommended HUD Elements

Show these in a compact card or sticky strip inside live coach mode:

- Mission name
- Encounter phase
- Tension state
- Mission progress percent
- Current HP and max HP
- Last HP change
- Optional class badge

Example:

```json
{
  "mission_name": "Shadows in the Streets",
  "encounter_phase": "clash",
  "tension": "high",
  "mission_progress_percent": 54,
  "hp_current": 82,
  "hp_max": 100,
  "hp_loss_this_set": 1,
  "class_slug": "mage"
}
```

### HUD Behavior Rules

- Update after every saved set
- Animate only the values that changed
- Keep labels short and readable mid-workout
- Let the story text stay primary and the HUD stay supportive
- Never require extra taps during a set-rest cycle

### HUD Copy Style

Prefer clear labels over RPG jargon when possible:

- Mission progress
- HP
- Pressure
- Phase
- Last hit

Avoid clutter like:

- multiple currencies during live mode
- inventory shortcuts during a set
- long stat blocks
- hidden modifier explanations

### Why This Matters

The narrative already tracks battle state. The HUD makes that state visible.

Without it, the user only feels the story emotionally.

With it, the user can feel both:

- the drama of the mission
- the consequences of workout performance

22. Phase 2 Feature: Tavern Flow For Rest Days

Rest days should still feel like part of IronQuest, but they should not pretend to be workout missions.

The right Phase 2 move is to turn rest days into Tavern Days using the existing Tavern rule set instead of building a second recovery system.

### Core Tavern Day Thesis

On a scheduled rest day, the premium re-entry experience becomes:

- recover
- collect flavor
- make one small choice
- optionally log a healthy behavior
- leave with a light reward or setup bonus

This keeps IronQuest present on non-lifting days without pressuring the user into training.

### Recommended Tavern Day Flow

If today is a rest day:

1. Dashboard or workout entry shows the current location tavern
2. User sees a short tavern scene tied to that location
3. User chooses one tavern action
4. App grants the matching recovery or progression effect
5. Optional follow-up actions encourage sleep, meal logging, walking, or prep for tomorrow

### Baseline Tavern Actions

These should come from the existing Tavern Day system:

- Rest: recover HP
- Side job: earn gold
- Rumors: earn XP and reveal or preview a mission
- Supplies: buy or prep a small advantage for the next mission

### Recommended Rest-Day Additions

To fit Johnny5k better, extend Tavern Day with behavior-linked actions:

- Hearty meal: bonus if the user logs a protein-forward meal on a rest day
- Early room: bonus if the user hits sleep logging or bedtime goals
- Scout the roads: bonus if the user hits a light step or cardio threshold
- Study the board: Johnny gives tomorrow-readiness advice in tavern flavor

These should feel like recovery and setup, not like punishment for skipping training.

### Tavern State Output

The app should be able to render Tavern Day from a simple payload:

```json
{
  "location_slug": "the_training_grounds",
  "tavern_name": "The Iron Lantern",
  "tavern_tone": "warm, practical, post-training refuge",
  "flavor_text": "The benches are full of fighters rubbing sore shoulders and planning tomorrow.",
  "available_actions": [
    { "id": "rest", "label": "Take a room", "effect": "+8 HP" },
    { "id": "rumors", "label": "Listen for rumors", "effect": "+10 XP and mission preview" },
    { "id": "side_job", "label": "Pick up a side job", "effect": "+10 gold" },
    { "id": "meal", "label": "Order the house plate", "effect": "Meal-log bonus" }
  ]
}
```

### UX Rules For Tavern Days

- One meaningful action per rest day is enough
- Keep the flow under 60 seconds
- Show a recovery payoff immediately
- Tie the tavern to the current location so the world feels continuous
- Let users exit cleanly back to dashboard, body, nutrition, or tomorrow\'s workout prep

### Johnny Integration

Johnny should speak differently in taverns than in workout missions.

He should sound more like:

- a coach helping you recover
- a guide pointing out the smart next move
- a companion setting up tomorrow

He should sound less like:

- a combat narrator
- a boss announcer
- a quest generator shouting for urgency

### Why Tavern Days Belong In Phase 2

They support the same premium fantasy as workout missions while staying aligned with rest days, recovery, meal logging, and sleep.

That makes them a better Phase 2 addition than deeper inventory, stores, or subclass mechanics.

23. Recommended Implementation Order

If both features are added in the same wave, build them in this order:

1. Live mission HUD in live coach mode
2. Story payload additions for HUD values
3. Rest-day Tavern Day entry card on dashboard or workout launch
4. Tavern action resolution and reward application
5. Johnny tavern copy and follow-up prompts

That sequence keeps the Phase 2 layer centered on the daily user loop:

- train days feel like missions
- rest days feel like recovery scenes
- both paths strengthen the world without blocking the core app