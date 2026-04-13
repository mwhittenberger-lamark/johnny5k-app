# Johnny5k Style Guide

## Design Direction

Johnny5k uses a **retro-future mobile product system**.

The visual tone is:

- optimistic
- energetic
- touch-first
- readable
- slightly playful
- structured, not clinical

The practical shorthand is:

**space-age fitness utility**

That means bright light surfaces, rounded geometry, expressive accents, and mobile-first interaction patterns without novelty styling.

---

## Current Design Tokens

These values should be treated as the source of truth because they match the live PWA tokens.

### Backgrounds

- `--bg`: `#E6F3FD`
- `--bg2`: `#FFFFFF`
- `--bg3`: `#CCE6F8`

### Text

- `--text`: `#0F1F55`
- `--text-muted`: `#5878A0`

### Accents

- `--accent`: `#FF5530`
- `--accent2`: `#00BCDE`
- `--accent3`: `#FF38A0`
- `--yellow`: `#FFD000`
- `--success`: `#22C47E`
- `--danger`: `#FF2E50`

### Borders and Effects

- `--border`: `#A8D4F0`
- `--focus-ring`: `0 0 0 3px rgba(0, 188, 222, 0.22)`
- `--shadow-xs`: `0 1px 6px rgba(15, 31, 85, 0.05)`
- `--shadow-sm`: `0 2px 10px rgba(15, 31, 85, 0.07)`
- `--shadow`: `0 4px 24px rgba(15, 31, 85, 0.10)`
- `--shadow-lg`: `0 12px 30px rgba(15, 31, 85, 0.14)`

---

## Typography

### Font Stack

- Heading / action font: `Exo 2`
- Body / utility font: `Nunito`

### Usage

- `Exo 2` is used for headings, nav labels, buttons, chips, and branded UI emphasis.
- `Nunito` is used for body copy, forms, descriptive text, and most app content.

### Typography Rules

- Prioritize clarity over decorative type treatment.
- Headings should feel confident and slightly stylized.
- Body copy should stay soft and readable.
- Numeric readouts should be visually prominent and easy to scan.

---

## Spacing and Radius

Johnny5k uses a 4px-derived spacing scale.

### Common Spacing Tokens

- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-7`: `32px`
- `--space-8`: `40px`

### Radius Tokens

- `--radius-sm`: `12px`
- `--radius-md`: `16px`
- `--radius`: `18px`
- `--radius-lg`: `24px`
- `--radius-xl`: `28px`

### Shape Rules

- Cards should feel rounded and soft.
- Primary buttons should be pill-shaped.
- Chips should stay pill-shaped.
- Inputs should avoid sharp corners.

---

## Core Surface Patterns

### Light Utility Cards

Use:

- white or lightly tinted surfaces
- soft blue borders
- low-contrast shadows
- rounded corners

These are used for standard content areas like meals, settings sections, library lists, and planning cards.

### Dark Coach Cards

Use:

- deep blue gradients
- light text
- teal-highlighted borders
- stronger emphasis for coaching content

These are used for:

- coaching summary surfaces
- Beverage Board
- Today coaching utilities

### Accent Gradients

Gradients are allowed, but only with discipline.

Use them for:

- primary call-to-action buttons
- hero cards
- coaching or emphasis panels

Do not use them everywhere.

---

## Chips

### Base Chip Pattern

Chips are compact, uppercase, rounded labels used for:

- card labels
- state markers
- context metadata
- AI or nutrition callouts

### Nutrition Screen Overrides

Nutrition now overrides some shared chip colors for readability.

- AI chips on Nutrition use a lighter cyan-tinted treatment with very light text.
- Standard Nutrition chips use white backgrounds with dark text for contrast.
- Subtle chips on dark coaching cards stay translucent with light text.

If adding new chips inside dark Nutrition surfaces, test contrast first instead of inheriting shared dashboard chip colors blindly.

---

## Buttons

### Primary Buttons

- gradient background from orange to pink
- white text
- pill shape
- bold `Exo 2` label

Use for:

- primary save or confirm actions
- key next-step CTAs

### Secondary Buttons

- white or lightly tinted surface
- dark text
- blue border
- pill shape

Use for:

- alternate actions
- support actions
- navigation helpers

### Outline Buttons

Use for secondary emphasis inside coaching surfaces.

On dark coaching cards, outline buttons must be overridden to:

- light text
- brighter border
- slightly translucent background

This is currently required for the `Ask Johnny` CTA inside dark coaching panels.

---

## Inputs

Inputs should feel:

- touch-friendly
- wide
- clean
- easy to scan quickly

Rules:

- use white backgrounds by default
- use light blue borders
- maintain generous vertical padding
- keep labels concise and readable

---

## Mobile Navigation

The mobile menu is a **sheet-style dialog**, not a tiny dropdown.

### Current Behavior

- fixed-position menu sheet
- internal scrolling on the full sheet
- backdrop behind the menu
- close button in the menu header
- primary nav links first
- global actions like `Ask Johnny` and `Sign out` at the bottom

### Important Rule

The whole mobile menu sheet must scroll, not just the link grid. This prevents lower actions from becoming unreachable on smaller phones.

---

## Nutrition Screen Rules

Nutrition is now one of the strongest references for the live design language.

It should feel:

- practical
- bright
- organized
- supportive
- easy to use quickly on mobile

### Today View

The Today view currently includes:

- a bright hero card
- macro summary cards
- a micronutrient accordion
- a Beverage Board accordion
- a Coaching Read accordion
- weekly calorie summary
- prompt-based `Ask Johnny` coaching card

### Accordion Pattern

Use controlled accordions for dense secondary content.

Current Nutrition accordion usage includes:

- micronutrient detail
- Beverage Board
- Coaching Read
- planning filters and recipe sections

Accordion triggers should:

- summarize the content clearly
- show compact metadata in the kicker row
- use clear `+` / `−` state treatment
- remain easy to tap on mobile

### Beverage Board

The Beverage Board is a dark coaching-style module with:

- drink search and logging
- water tracking
- 7-day beverage review

Rules:

- keep water interactions visually immediate
- keep drink logging quick and suggestion-driven
- preserve strong contrast inside the dark surface

### Nutrition Contrast Rules

The Nutrition page now has local contrast overrides that should be preserved:

- AI chips use high-contrast light text
- standard Nutrition chips use white backgrounds
- coaching outline buttons use light text on dark surfaces

Any new Nutrition feature should be checked against those overrides before shipping.

---

## Coaching Panels

Coaching panels should feel high-value, not noisy.

Use:

- dark blue gradient surfaces
- clear hierarchy
- strong section labels
- readable action buttons
- concise summaries first, detail below

Avoid:

- weak contrast
- low-emphasis CTAs
- overly dense text blocks without grouping

---

## Dashboard and Shared Patterns

The dashboard still defines many shared primitives:

- chip base styles
- card spacing rhythm
- status modules
- celebratory accents

When a screen needs higher contrast than the shared default, prefer **local screen-level overrides** over changing the whole app without reason.

---

## Motion

Motion should remain:

- quick
- soft
- informative

Use motion for:

- accordion open/close state shifts
- menu sheet entrance
- toast feedback
- lightweight view transitions

Avoid:

- long ornamental transitions
- constant animated decoration
- effects that block touch speed

---

## Accessibility Rules

- Contrast wins over palette purity.
- Primary interactions must remain reachable on smaller phones.
- Mobile menus and modal sheets must scroll correctly.
- Chips and coaching CTAs on dark surfaces must be tested visually, not assumed.
- Touch targets should generally stay at or above compact button height tokens.

---

## Do Not Do These Things

- do not revert to generic SaaS neutrals
- do not make dark coaching surfaces low-contrast
- do not hide lower mobile menu actions below a non-scrolling sheet
- do not add new accent colors without checking token alignment
- do not let retro flavor override utility
- do not introduce tiny action targets

---

## Current Shorthand

Johnny5k should look and feel like:

**optimistic retro-future fitness software with disciplined mobile UX**

The three most important practical rules are:

- keep it readable
- keep it touch-first
- keep the personality controlled
