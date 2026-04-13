# Johnny5k: IronQuest - The Training Grounds

## Location Role

The Training Grounds is the true starter area for IronQuest. It introduces the player's class fantasy, basic mission flow, light travel, and the idea that workouts are quests before the world becomes dangerous in Grim Hollow Village.

### Design Goals

- Teach the core workout-to-mission loop
- Introduce light travel and cardio without punishing failure
- Give players a safe first boss before the darker world opens up

## Overview

| Attribute   | Detail                                   |
| ----------- | ---------------------------------------- |
| Name        | The Training Grounds                     |
| Theme       | Beginner-friendly, structured challenges |
| Tone        | Encouraging, disciplined, lightly heroic |
| Level range | Levels 1-2                               |

### Short Lore

> Before the cursed villages and broken fortresses, every adventurer begins here: under open sky, with rough gear, steady instruction, and just enough challenge to reveal who they might become.

## Map Position

| Connection Type | Location                       |
| --------------- | ------------------------------ |
| Connected from  | Onboarding and class selection |
| Unlocks toward  | Grim Hollow Village            |

## Travel Requirement

| Requirement                   | Value          |
| ----------------------------- | -------------- |
| Distance from onboarding camp | 1 travel point |

### Design Intent

- Let players learn steps and cardio as movement progression
- Keep HP pressure low while still making recovery understandable
- Build confidence before the first real danger spike

## Location Structure

| Content Type                | Count |
| --------------------------- | ----- |
| Standard missions           | 3     |
| Boss missions               | 1     |
| Easy workout missions       | 1     |
| Runner task cardio missions | 1     |

## Mission Breakdown

| Mission      | Type                   | Goal                                             | Threat                                     | Workout Feel              |
| ------------ | ---------------------- | ------------------------------------------------ | ------------------------------------------ | ------------------------- |
| Form Check   | Easy workout           | Learn the basic Johnny5k rhythm                  | Training dummies and instructor prompts    | 3 exercises only          |
| Marker Run   | Runner task            | Visit the outer flags and return before the bell | Short practice loop                        | Cardio challenge          |
| First Steel  | Intro combat           | Turn exercise into adventure fantasy             | Straw soldiers and light sparring partners | Controlled starter effort |
| Cadence Yard | Structured progression | Learn pacing, rests, and mission completion      | Drill captains and timed circuits          | Moderate mixed output     |

## Boss Mission

### Mission 5: Captain of the Yard

#### Unlock Conditions

- Complete all 4 prior missions
- Have at least 18 HP
- Carry starter supplies

#### Boss Narrative

> The captain does not want to break you. They want to know if you'll keep moving once your first confidence runs out.

#### Workout Mapping

- Short-form full workout with clear instruction and low punishment
- Final set acts as the player's first real "boss resolution" moment
- Built to teach confidence, not fear

#### Outcome Variants

| Outcome | Result                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| Victory | You earn your place beyond the yard and unlock the road to Grim Hollow Village.           |
| Partial | The captain sends you back for one more round of preparation, but your path remains open. |
| Failure | You recover, regroup, and try again with no major setback.                                |

## Rewards

### Standard Mission Rewards

| Reward Type | Value                                              |
| ----------- | -------------------------------------------------- |
| XP          | 60-100                                             |
| Gold        | 8-15                                               |
| Drop chance | Starter gear, simple supplies, minor recovery item |

### Boss Rewards

| Reward Type     | Value            |
| --------------- | ---------------- |
| XP              | 160              |
| Gold            | 20               |
| Guaranteed item | Initiate's Sigil |

### Full Clear Bonus

| Reward Type | Value                       |
| ----------- | --------------------------- |
| XP          | +30                         |
| Gold        | +15                         |
| Progression | Unlocks Grim Hollow Village |

## Class-Specific Flavor

### Warrior

- Tone: "Strength without discipline is just noise."
- Emphasis: clean force and confidence

### Ranger

- Tone: "Movement is your first weapon."
- Emphasis: rhythm, footwork, and travel

### Mage

- Tone: "Control starts small, then becomes power."
- Emphasis: consistency and precision

### Rogue

- Tone: "Fast is useful. Clean is better."
- Emphasis: efficiency and tempo

## AI Prompt Anchors

```json
{
  "location": "The Training Grounds",
  "theme": "open training yard, banners, wooden dummies, early adventure gear",
  "tone": "hopeful, structured, heroic beginnings",
  "enemyTypes": ["sparring partners", "drill captains", "training constructs"]
}
```

## Visual And UI Notes

### Map Node

- Banner-post icon
- Warm daylight palette
- Simple movement cues

### Completion State

- Banners rise higher
- Path to Grim Hollow lights up on the world map

## Tavern Integration

### Tavern Name

- The First Rest

### Tavern Tone

- Recruits
- Mentors
- Low-stakes optimism

### Tavern Flavor Text

> Everyone here is still becoming who they are.

### Tavern-Themed Actions

| Base Action | Themed Text                                                           |
| ----------- | --------------------------------------------------------------------- |
| Rest        | "You recover beside the practice fire."                               |
| Side job    | "An instructor offers coin for helping reset the yard."               |
| Rumors      | "Veterans talk quietly about the darkness gathering beyond the road." |

## Why This Location Works

- It teaches the full gameplay loop in a forgiving environment
- It gives each class a clean first identity beat
- It makes Grim Hollow feel like a real escalation instead of the tutorial wearing a new skin
