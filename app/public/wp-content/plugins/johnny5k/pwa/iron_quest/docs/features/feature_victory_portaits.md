# Johnny5k: IronQuest - Victory Portraits

## Core Concept

After key moments such as boss fights and progression milestones, generate an AI portrait of the user as their IronQuest character in the scene they just completed.

Core inputs:

- User face upload
- Current class and subclass
- Equipped gear
- Location theme
- Mission outcome

## Trigger Rules

This feature should stay rare enough to feel valuable.

Primary triggers:

- Boss victories
- Level milestones such as 5, 10, and 20
- First location completion

Possible later triggers:

- Major PR or breakthrough moments

## Why It Works

### Identity Reinforcement

- Turns the player into the hero of the world
- Makes class choice and progression feel personal

### Memory Anchoring

- Connects the portrait to a specific workout
- Helps users remember effort, context, and achievement

### Shareability

- Creates social-ready content
- Supports organic marketing and retention loops

## System Design

### Input Payload

Use a structured prompt payload like this:

```json
{
  "userFaceImage": "uploaded_image_url",
  "class": "Warrior",
  "subclass": "Gladiator",
  "gear": ["iron greatsword", "battle-worn armor"],
  "location": "Grim Hollow Village",
  "theme": "undead decay, dark fog, burning ruins",
  "enemyDefeated": "Necromancer",
  "pose": "victorious stance, weapon raised",
  "mood": "dark, cinematic, heroic"
}
```

### Output Goals

- Stylized portrait
- Consistent art direction
- Composition that feels like a game splash screen, trading card, or poster

## Future Expansion: Battle Evolution

Generate a progression series instead of a single portrait:

- First portrait: beginner gear
- Mid-game portrait: upgraded gear and stronger stance
- Final portrait: fully powered version

This creates a strong side-by-side payoff around visible progress.

## First-Time Experience: Character Awakening

This can be a separate onboarding moment that happens before the first logged workout.

### When It Happens

- Right after account creation
- After class selection
- After optional face upload

### Target Flow

Keep the full flow within 60-90 seconds.

1. Class selection
2. Quick flavor choice
3. Optional face upload
4. Generation moment
5. Reveal screen
6. Johnny5k introduction
7. Immediate call to action

### Step Details

#### 1. Class Selection

- Warrior
- Ranger
- Mage
- Rogue

#### 2. Quick Flavor Choice

Prompt: "What drives you?"

- Power
- Survival
- Discipline
- Freedom

This choice can shape pose, tone, and subtle prompt flavoring.

#### 3. Face Upload

Suggested positioning:

"See yourself in IronQuest"

This should remain optional, but strongly encouraged.

#### 4. Generation Moment

Suggested loading copy:

"Johnny5k is forging your identity..."

Recommended presentation:

- Subtle animation
- Optional loading bar
- 3-5 second perceived wait, or async delivery if generation takes longer

#### 5. Reveal Screen

The image should appear as the main payoff moment.

Suggested overlay copy:

"You have entered IronQuest."

Follow-up line:

"You are a [Class]. Your journey begins now."

#### 6. Johnny5k Introduction

Suggested tone:

"You are untested... but not without potential. Your path will be shaped by your actions. Begin."

#### 7. Immediate Call To Action

Do not end the flow without momentum.

Suggested button:

"Begin First Quest"

## Prompt Strategy

The first generated portrait should feel calmer and more introductory than later reward portraits.

Base prompt structure:

```text
Fantasy character portrait, cinematic lighting, high detail,
based on user's face, wearing starter gear,
class: Warrior (or chosen class),
environment: neutral fantasy setting (stone ruins, soft fog),
pose: confident but unproven,
mood: beginning of a journey, restrained power
```

## Class Visual Identity

### Warrior

- Armor
- Visible weapon
- Grounded stance

### Ranger

- Cloak
- Outdoor setting hints
- Lighter gear

### Mage

- Robes
- Faint glow or visible magic
- Calm posture

### Rogue

- Hood
- Shadowed lighting
- Agile stance

## Optional Enhancements

### Save As Profile Avatar

- Use the generated portrait as in-app identity art

### One Free Regeneration

- Let the player reroll once
- Possible CTA: "Refine your form"

### Tease Future Forms

- Level 5 Form
- Boss Slayer Form

Keep these locked at first so they act as forward-looking motivation.
