# Johnny5k: IronQuest - The Astral Library

## Location Role

The Astral Library closes the mage-focused group with disciplined grandeur. It is less chaotic than Voidrift, but far less forgiving.

## Overview

| Attribute   | Detail                             |
| ----------- | ---------------------------------- |
| Name        | The Astral Library                 |
| Theme       | Knowledge, discipline, precision   |
| Tone        | Noble, silent, severe and luminous |
| Level range | Levels 43-47                       |

### Short Lore

> Every book in the Astral Library records a victory, a mistake, or the cost of confusing the two.

## Map Position

| Connection Type | Location         |
| --------------- | ---------------- |
| Connected from  | Voidrift Chamber |
| Unlocks toward  | Verdant Expanse  |

## Travel Requirement

| Requirement                 | Value            |
| --------------------------- | ---------------- |
| Distance from previous node | 20 travel points |

## Location Structure

| Content Type                   | Count |
| ------------------------------ | ----- |
| Standard missions              | 8     |
| Boss missions                  | 1     |
| Easy workout missions          | 1     |
| Runner task cardio missions    | 1     |
| Abs-only town defense missions | 1     |

## Mission Breakdown

| Mission           | Type                | Goal                                     | Threat                    | Workout Feel                 |
| ----------------- | ------------------- | ---------------------------------------- | ------------------------- | ---------------------------- |
| Quiet Stacks      | Easy workout        | Learn the Library's discipline           | Hovering index spirits    | 3 exercises only             |
| Index Relay       | Runner task         | Return a stolen codex page               | Long radial archive route | Cardio challenge             |
| Shelfguard Sweep  | Town defense        | Clear nearby raiders preying on scholars | Book-thieves              | Abs-only challenge           |
| Margin of Error   | Control mission     | Maintain perfect pacing                  | Scribe constructs         | Precision sets               |
| Starlit Aisle     | Endurance route     | Cross the upper vault                    | Falling constellations    | Long calm effort             |
| Closed Section    | Pressure chamber    | Secure restricted knowledge              | Bound horrors             | Mid-high technical intervals |
| Librarian's Trial | Discipline test     | Prove worth to enter the core archive    | Silent sentinels          | High-focus output            |
| Final Citation    | Pre-boss escalation | Reach the forbidden desk                 | Astral wardens            | Severe finish                |

## Boss Mission

### Mission 9: The Curator of Silence

#### Unlock Conditions

- Complete all 8 prior missions
- Have at least 82 HP
- Carry clarity and warding supplies

#### Boss Narrative

> The Curator does not attack first. It waits to see if you understand how much of yourself must remain quiet to win.

## Metadata Completion

### Design Goals

- Close the mage group with discipline instead of chaos
- Make restraint feel just as demanding as aggression

### Design Intent

- Reward focus, silence, and exact pacing
- End the arc on earned control rather than spectacle

### Boss Workout Mapping

- Full workout with deliberate pacing and shrinking margin for error
- Final set resolves a test of patience and precision
- Rewards mastery of rhythm and restraint

### Boss Outcome Variants

| Outcome | Result                                                                              |
| ------- | ----------------------------------------------------------------------------------- |
| Victory | The stacks fall still and the Library grants you passage without resistance.        |
| Partial | The Curator withdraws deeper into the archive and only the outer knowledge is safe. |
| Failure | The silence closes around you and the upper stacks refuse your return.              |

### Rewards

### Standard Mission Rewards

| Reward Type | Value                                 |
| ----------- | ------------------------------------- |
| XP          | 380-440                               |
| Gold        | 58-66                                 |
| Drop chance | Scholar gear, astral scripts, potions |

### Boss Rewards

| Reward Type     | Value          |
| --------------- | -------------- |
| XP              | 635            |
| Gold            | 96             |
| Guaranteed item | Curator's Seal |

#### Example Boss Item

| Item           | Effect                                                    | Flavor                                       |
| -------------- | --------------------------------------------------------- | -------------------------------------------- |
| Curator's Seal | Slightly improves rewards from precision-focused missions | A pale insignia that quiets when held firmly |

### Full Clear Bonus

| Reward Type | Value                                                 |
| ----------- | ----------------------------------------------------- |
| XP          | +125                                                  |
| Gold        | +72                                                   |
| Progression | Unlocks the ranger-path world beyond the arcane chain |

### Class-Specific Flavor

### Warrior

- Tone: "Strength is most frightening when it does not need to shout."
- Emphasis: controlled force

### Ranger

- Tone: "Move like you belong between the shelves."
- Emphasis: graceful pacing

### Mage

- Tone: "This is the exam your whole path has been leading toward."
- Emphasis: precision and mastery

### Rogue

- Tone: "Silence is still a weapon if you know where to place it."
- Emphasis: efficiency and subtlety

### AI Prompt Anchors

```json
{
  "location": "The Astral Library",
  "theme": "endless shelves, floating candles, star maps, quiet gold light",
  "tone": "noble, disciplined, sacred",
  "enemyTypes": ["book-thieves", "bound horrors", "astral wardens"]
}
```

### Visual And UI Notes

#### Map Node

- Open book icon with star points
- Soft white-gold glow

#### Completion State

- Forbidden shelves unlock
- The archive map resolves into clear constellated paths

### Tavern Integration

#### Tavern Name

- The Margin

#### Tavern Tone

- Scholars
- Keepers
- People who lower their voices out of habit

#### Tavern Flavor Text

> Even the cups are set down quietly here.

#### Tavern-Themed Actions

| Base Action | Themed Text                                                                |
| ----------- | -------------------------------------------------------------------------- |
| Rest        | "You recover in an alcove lit by star-lamps and gentle page-glow."         |
| Side job    | "Archivists pay for sorting sealed texts and returning borrowed volumes."  |
| Rumors      | "Whispers say the Curator already knows who will fail before they arrive." |

## Why This Location Works

- It gives the mage arc a refined and satisfying finale
- It proves quiet pressure can be as intense as open chaos
- It sets up the ranger arc as a breath of fresh air that is still harder
