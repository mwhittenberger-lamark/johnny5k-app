# Johnny5k: IronQuest
## Full App Screen Architecture (v1)

---

# CORE SCREEN ARCHITECTURE

## 1. Onboarding / Entry Flow

### Purpose
Create identity + hook

### Includes
- Title / entry screen  
- Class selection (Warrior / Ranger / Mage / Rogue)  
- Motivation selection (optional)  
- Face upload (Gemini integration)  
- Character reveal screen  

### Key Elements
- Large visual focus (portrait)
- Minimal text
- “Start Training” CTA

---

## 2. Training Grounds Screen

### Purpose
Safe onboarding gameplay

### Includes
- Current mission (training)
- Start workout button
- Simple Johnny5k guidance
- No HP (or hidden)

### Key Elements
- Clean UI (low complexity)
- Progress indicator (training completion)
- Light narrative

---

## 3. Main Hub / Dashboard

### Purpose
Home screen

### Includes

#### Top Section
- Character portrait (dynamic)
- Level + title
- HP bar
- XP bar

#### Middle Section
- Current location
- Active mission or objective
- “Continue Mission” or “Start Mission”

#### Bottom Section (Actions)
- Map
- Inventory
- Store
- Tavern
- Chat with Johnny5k

### Key Elements
- Everything important at a glance
- Fast re-entry into gameplay

---

## 4. Map Screen

### Purpose
Progression + motivation

### Includes
- Visual map (nodes / paths)
- Current location highlighted
- Locked locations (with travel requirements)
- Completed locations (marked)

### Interaction
- Tap location → view missions
- Shows:
  - Travel points required
  - Available missions
  - Boss availability

### Key Elements
- Travel options:
  - Walk
  - Cardio
  - Spend gold

---

## 5. Mission Preview Screen

### Purpose
Set expectations before workout

### Includes
- Mission name
- Location flavor text
- Difficulty
- Modifiers (heavier lifts, HP penalties)
- Rewards preview (XP / gold / item)

### Key Elements
- “Start Mission” CTA
- Johnny5k narrative line

---

## 6. Workout / Live Mission Screen

### Purpose
Core experience

### Layout

#### TOP
- HP bar
- Progress (mission % or boss %)
- Current encounter name

#### MIDDLE
- Story text (updates after roll + sets)
- Choices (before encounter)
- Dice result feedback

#### BOTTOM
- Exercise name
- Set tracker
- Input reps / weight
- “Log Set” button

### During Rest
- Story updates
- 30–60 sec rest timer
- Subtle animation

### Flow
1. Story → choice  
2. Roll  
3. Log set  
4. Story update  
5. Repeat  

### Key Elements
- Fast logging
- Clean UI
- Readable story

---

## 7. Dice Roll Overlay

### Purpose
Make randomness exciting

### Includes
- d20 animation
- Modifier breakdown:
  - Base roll
  - Gear
  - Spells
  - Performance

### Output
- Final result (e.g., Strong Success)

### Key Elements
- Fast (<2 sec)
- Skippable

---

## 8. Mission Complete Screen

### Purpose
Reward + closure

### Includes
- Final story
- XP gained
- Gold gained
- HP remaining

### Optional
- Item drop
- Portrait trigger

### Key Elements
- Emotional payoff
- Clear progress

---

## 9. Boss Result Screen

### Includes
- Cinematic outcome
- Big reward reveal
- Artifact animation
- Victory portrait

### Key Elements
- High impact
- Shareable

---

## 10. Inventory & Gear Screen

### Purpose
Ownership + strategy

### Includes

#### Equipped
- Weapon
- Armor
- Accessory

#### Inventory
- All gear
- Consumables

### Interactions
- Equip
- Compare
- Sell

### Key Elements
- Simple UI
- Visual feedback

---

## 11. Store (General Goods)

### Purpose
Economy decisions

### Sections
- Supplies
- Potions
- Gear
- Sell

### Includes
- Gold balance
- Item effects
- Buy / sell

### Key Elements
- Suggested items
- Fast purchasing

---

## 12. Tavern Screen

### Purpose
Recovery + flavor

### Includes
- Sleep logging
- Recovery bonuses
- Streak tracking
- Narrative

### Optional
- Social features

---

## 13. Spells / Abilities Screen

### Purpose
Customization

### Includes
- Equipped spells
- Spell list
- Unlock requirements
- Purchase options

### Key Elements
- Clear effects
- Easy equip

---

## 14. Johnny5k Chat Screen

### Purpose
AI assistant

### Includes
- Chat UI
- Input field
- Suggested prompts:
  - Create workout
  - Log meal
  - What next

### Key Elements
- Companion feel
- Simple UX

---

## 15. Profile / Progress Screen

### Purpose
Long-term motivation

### Includes
- Stats (workouts, XP, steps)
- Achievements
- Progress history
- Portrait timeline

---

# CRITICAL UX FLOWS

## Daily Loop
Dashboard → Mission → Workout → Rewards → Dashboard

## Progression Loop
Dashboard → Map → Travel → New Location → Mission

## Economy Loop
Mission → Rewards → Store → Gear → Mission

## Identity Loop
Workout → XP → Level → Gear → Portrait

---

# MOST IMPORTANT SCREEN

Workout / Live Mission Screen

Must be:
- Fast
- Clear
- Immersive

---

# DESIGN PRINCIPLES

## 1. Fast Logging > Everything

## 2. Story Fits Rest Time

## 3. Simple Choices

## 4. Immersion First

---

# SUMMARY

The app structure supports:

- Gameplay loop
- Fitness tracking
- RPG immersion
- Long-term retention
