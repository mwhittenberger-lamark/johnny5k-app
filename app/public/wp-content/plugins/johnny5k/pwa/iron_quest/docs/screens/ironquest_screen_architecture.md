# Johnny5k: IronQuest
## Phase 2 Screen Architecture

This document describes the actual Phase 2 product shell inside the Johnny5k PWA and WordPress plugin.

It replaces the older "full RPG shell" screen plan as the source of truth for current architecture.

## Product Rule

IronQuest can deepen motivation, identity, progression, and reward payoff.

It must never make the user fight the workout app to train.

## What Phase 2 Is

Phase 2 is:

- a quest layer on top of the existing Johnny5k workout product
- a campaign shell that makes workouts, recovery, travel, and rewards feel connected
- a guided motivation system with portraits, world art, rival beats, and mission progression

Phase 2 is not:

- a full inventory RPG
- a separate combat client
- a spell-management app
- an equipment-grid game

## Core Experience Model

The player loop is:

1. see current campaign state on the IronQuest hub
2. review missions on the hub or map
3. start a workout-attached mission from the workout flow
4. get story, progress, and mission payoff without slowing logging
5. return to hub, tavern, store, or character sheet with updated state

Support loops:

- rest days route through Tavern Day
- gold routes through the General Store
- rewards route into the Character Sheet and gallery/history surfaces
- world art and portraits reinforce location and progression identity

## Screen Inventory

### 1. IronQuest Onboarding Flow

Purpose:

- enable IronQuest
- pick class and motivation
- generate a starter portrait
- hand the user into the first campaign state

Includes:

- class selection
- motivation selection
- face upload / portrait generation
- reveal screen

Notes:

- this is a premium extension of the main product, not a second app shell
- a user can continue without a generated portrait if needed

### 2. IronQuest Hub

Purpose:

- primary campaign home
- fastest answer to "where am I, what matters now, what should I do next?"

Includes:

- current mission summary
- daily objective status
- route and travel progress
- active consequences
- rival state when present
- recent mission update / "new since last mission"
- direct actions to workout, map, character sheet, tavern, and settings

Notes:

- this is the home of mission-board clarity, not a passive dashboard only
- mission preview is embedded here rather than being a separate mandatory screen

### 3. Map Screen

Purpose:

- show route progression and location identity
- let the player inspect regions, missions, and travel status

Includes:

- region nodes and unlock paths
- current location highlight
- mission previews for the selected region
- fast travel / normal travel actions
- location art hooks:
  - tavern scene
  - store owner portrait
  - mission card art

Notes:

- the map is a progression and inspection surface, not a standalone game board
- location preview is expandable in-place instead of routing through a separate "location detail" screen

### 4. Workout Launchpad

Purpose:

- bridge normal workout planning into IronQuest mission context

Includes:

- normal Johnny5k workout setup
- queued next-mission modifiers
- mission intro framing
- rest-day tavern framing when appropriate

Notes:

- this is where mission start clarity lives in practice
- there is no separate mandatory "mission preview" route before every workout

### 5. Live Workout / Mission Overlay

Purpose:

- keep mission state readable during training without competing with set logging

Includes:

- mission intro and story choices
- compact HUD
- rest-window narrative beats
- story progress after set saves

Notes:

- the workout remains the primary interaction surface
- there is no separate dice overlay screen in the current product
- roll/result feedback is integrated into the mission narrative flow

### 6. Mission Result / Reward Reveal

Purpose:

- turn workout completion into campaign payoff

Includes:

- mission outcome
- XP and gold
- first-clear or replay framing
- rival outcome when present
- applied and consumed modifiers
- portrait/reward reveal
- route and unlock carry-through

Notes:

- this currently lives inside the workout completion flow rather than as a separate permanent route
- boss payoff uses the same result flow with stronger reward treatment, not a separate boss-result architecture

### 7. Character Sheet

Purpose:

- permanent home for identity, owned rewards, active effects, and campaign context

Includes:

- starter portrait and current-form portrait
- class, motivation, title, level, HP, gold, XP
- current region and mission
- active consequence ledger
- relic, consumable, title, portrait, and journal collections
- recent history

Notes:

- this is where inventory-like ownership lives in Phase 2
- there is no separate gear screen or deep inventory route in the current architecture

### 8. General Store

Purpose:

- convert gold into readable, next-mission preparation

Includes:

- region-specific merchant identity
- shared merchant portrait art
- recommendation line
- active consequence ledger
- category-based stock:
  - recovery goods
  - mission prep
  - utility charms
  - inventory sellback

Notes:

- the store is deliberately narrow
- there is no large gear catalog in the current product

### 9. Tavern Day

Purpose:

- make rest days feel like part of the campaign

Includes:

- tavern scene art
- one action choice per day
- Johnny tavern line
- mission rumor preview
- clear consequence display for what resolved now and what lasts until daily reset

Current action shape:

- rest
- side job
- rumors

Notes:

- Tavern Day is the rest-day counterpart to workout missions
- it is intentionally short and light

### 10. WP Plugin Admin: IronQuest Admin

Purpose:

- support, debugging, recovery, and admin-only generation controls

Location:

- `WP Admin -> Johnny5k -> IronQuest Admin`

Includes:

- user lookup
- profile snapshot
- route / daily / mission / unlock state
- image regeneration actions
- recovery actions for stuck mission or route state
- analytics and failure review

Notes:

- this is part of the Phase 2 architecture even though it is not player-facing
- support tooling belongs in WordPress admin, not in the PWA

## Shared Cross-Screen Systems

These are not standalone screens, but they are part of the architecture:

### Active Consequences

Used on:

- hub
- store
- tavern flow
- character sheet
- workout launchpad

Purpose:

- show what is active
- show where it applies
- show when it expires

### Recent Mission Update

Used on:

- hub
- map
- store
- tavern / workout launchpad

Purpose:

- show "new since last mission"
- carry mission-result state across surfaces without manual refresh

### Shared World Art

Types:

- tavern scene
- store owner portrait
- mission card art

Used on:

- tavern
- store
- map
- mission previews

### Reward Portraits

Types:

- starter portrait
- current-form portrait
- milestone and victory portraits

Used on:

- onboarding
- character sheet
- mission result flow
- reward/gallery surfaces

### Rival Layer

Used on:

- hub mission board
- map previews
- mission intros
- mission result flow

Purpose:

- create continuity across missions and regions without adding a new combat system

## Explicit Non-Screens In Phase 2

The following are not part of the current architecture and should not be treated as active Phase 2 requirements:

- standalone Inventory & Gear screen
- equipped weapon / armor / accessory screen
- spells or abilities screen
- standalone dice-roll overlay screen
- mandatory standalone mission preview route before workout start
- separate boss-result screen hierarchy

If these appear in older docs, treat them as future-state exploration only.

## Data Ownership

### Backend owns:

- mission state
- reward resolution
- route progression
- active modifiers and expiry
- world art registry
- portrait generation state
- rival state
- analytics and failure logging

### Frontend owns:

- rendering
- screen composition
- local reveal and sync behavior
- fail-soft placeholders for missing art or delayed generation

## Acceptance Standard For Docs

Any IronQuest screen doc is current only if it matches all of the following:

- it does not require a separate RPG shell outside Johnny5k
- it does not assume a gear-grid or spell-management system in Phase 2
- it maps to an actual current surface in the PWA or WP plugin admin
- it preserves workout speed as the primary constraint
