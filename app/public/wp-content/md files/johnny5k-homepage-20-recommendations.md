# Johnny5k Homepage Recommendations

This document isolates the **20 homepage-related recommendations** for the Johnny5k dashboard/home screen.

Source material reviewed:
- `app/public/wp-content/md files/Johnny5k_style_guide.md`
- `app/public/wp-content/plugins/johnny5k/pwa/src/screens/dashboard/DashboardScreen.jsx`

These recommendations are split into:
- 10 UI/UX recommendations
- 10 branding and vision alignment recommendations

They assume a **mobile-first experience** and explicitly respect the constraint that the app should **not use oversized icons or overly large clickable elements**.

---

# 10 UI/UX Recommendations for the Homepage

## 1. Reduce the number of major homepage sections visible at once

### Current issue
The homepage currently stacks many sections:
- header
- target update notice
- hero section
- today at a glance
- micronutrients/tomorrow
- training/streaks/awards
- quick actions
- story/tip/win cards

### Why this matters
On mobile, that creates:
- a long initial scroll
- too many equal-priority blocks
- slower decision-making
- a homepage that feels feature-heavy instead of focused

### Recommendation
Reduce first-load density by:
- collapsing some lower-priority sections
- showing only one “story” or “tip” card at a time
- using “expand” patterns for less-critical information
- promoting only the most relevant modules above the fold

### Goal
Make the homepage feel faster, more intentional, and easier to scan in a few seconds.

---

## 2. Convert clickable div cards into semantic buttons or links

### Current issue
Several homepage cards are clickable `div`s with `onClick`.

### Why this matters
For mobile UX and accessibility, semantic interactive elements are better because they:
- improve tap behavior
- support focus and accessibility tools
- make interaction states more reliable
- feel more polished

### Recommendation
Convert tappable homepage cards to:
- `<button>` for action surfaces
- `<Link>` or accessible route-aware interactive elements for navigation

Also add:
- pressed states
- focus-visible states
- clearer tappable affordance

### Goal
Make homepage interactions feel more robust, accessible, and product-grade.

---

## 3. Simplify the hero card so it reads in one glance

### Current issue
The nutrition hero card includes:
- chip
- headline
- support line
- percentage orbit
- macro pills
- meal metadata

### Why this matters
The first visible card on the homepage should be instantly legible.
If it takes multiple passes to parse, it slows the whole dashboard.

### Recommendation
Restructure the hero into:
- one dominant status
- one short explanatory line
- one compact progress row
- one clear implied next action

### Goal
Make the top module feel immediate, useful, and fast to parse.

---

## 4. Make quick actions more compact and less icon-led

### Current issue
The quick action cards currently emphasize emoji plus title plus metadata.

### Why this matters
This creates a chunkier visual feel than necessary and conflicts with the desired compact mobile-first experience.

### Recommendation
Redesign quick actions as:
- compact action pills
- smaller rounded utility tiles
- short two-line action cards
- denser grouped controls

Replace emoji with a disciplined icon system.

### Goal
Keep the homepage fast and thumb-friendly without relying on oversized tiles.

---

## 5. Make the homepage more one-hand friendly

### Current issue
Important actions are spread across the screen in ways that may not fully respect one-thumb use.

### Why this matters
A mobile-first homepage should place the most common actions where they are easiest to reach during normal phone handling.

### Recommendation
Prioritize lower-screen placement for the most-used flows:
- log meal
- start workout
- ask Johnny
- add sleep/cardio

Move less-frequent admin actions and secondary insights higher or deeper.

### Goal
Make the homepage feel naturally mobile-native and easy to use in motion.

---

## 6. Differentiate informational cards from actionable cards

### Current issue
Many homepage cards are interactive, but their visual language does not always clearly communicate that.

### Why this matters
If everything looks equally tappable, users have to guess what is for action versus reading.

### Recommendation
Introduce a clearer distinction:
- actionable cards get subtle affordance
- passive cards remain visually quieter
- utility/action modules look more purposeful

Possible UI signals:
- chevrons
- action labels
- pressed-state visuals
- consistent edge treatment for interactive cards

### Goal
Make the homepage easier to understand at a glance.

---

## 7. Reduce metadata density inside stat cards

### Current issue
Homepage stat cards include label, value, and metadata lines that sometimes combine multiple ideas.

### Why this matters
On mobile, too much metadata weakens the visual priority of the number.

### Recommendation
Keep stat cards focused on:
- one label
- one strong value
- one short support line

Push extra detail to destination screens instead of packing it into the homepage.

### Goal
Improve scanability and make key numbers feel more important.

---

## 8. Rebalance coaching copy and utility

### Current issue
The homepage includes multiple layers of coaching-like text:
- coach line
- tip card
- story card
- small win
- tomorrow recommendation

### Why this matters
Warmth is good, but too much narrative slows the homepage.
The homepage should help users act first, then reflect.

### Recommendation
Keep one strong coaching message visible.
Reduce or rotate the rest:
- one story module at a time
- one tip block at a time
- lower-priority guidance collapsed or secondary

### Goal
Preserve personality while keeping the homepage practical and fast.

---

## 9. Shorten body copy to avoid heavy wrapping

### Current issue
Some homepage copy blocks are long enough to wrap across multiple lines on small devices.

### Why this matters
That creates:
- uneven card heights
- more visual noise
- slower reading
- less polished rhythm

### Recommendation
Trim homepage copy to:
- one short sentence
- one strong insight
- one clean action prompt

### Goal
Create a tighter and more premium mobile reading experience.

---

## 10. Add a clear “best next move” module

### Current issue
The homepage offers many options, but not always one clearly prioritized next step.

### Why this matters
A coaching-style homepage should reduce decision fatigue.

### Recommendation
Introduce a dynamic “best next move” module based on live user state, such as:
- log first meal
- start planned workout
- recover steps deficit
- fix protein gap
- add missing recovery input

### Goal
Make the homepage feel smarter, clearer, and more coach-like.

---

# 10 Branding and Vision Alignment Recommendations for the Homepage

## 1. Replace emoji quick actions with a real icon system

### Current issue
Quick actions use emoji rather than a disciplined product icon set.

### Why this matters
Emoji weaken the “modern product discipline” side of the Johnny5k brand.

### Recommendation
Use a small rounded icon system such as:
- Phosphor
- Lucide

Keep icons:
- compact
- consistent
- secondary to the label

### Goal
Make the homepage feel more premium, cohesive, and on-brand.

---

## 2. Make the homepage feel like a daily home base, not a feature catalog

### Current issue
Because the homepage includes many content types, it can drift toward looking like an app overview rather than a true home screen.

### Why this matters
The style guide wants the dashboard to feel:
- uplifting
- organized
- digestible

### Recommendation
Refocus the homepage around:
- current status
- next best action
- a small number of supportive insight modules

### Goal
Make the homepage feel like “your day in Johnny5k,” not “everything Johnny5k can do.”

---

## 3. Let typography carry more of the brand personality

### Current issue
A lot of the homepage warmth currently comes from generated copy.

### Why this matters
The style guide wants headings to provide personality while body UI stays clear and usable.

### Recommendation
Use typography more intentionally:
- stronger heading rhythm
- cleaner section titling
- less reliance on long explanatory body copy

### Goal
Make the homepage feel designed, not just populated with smart text.

---

## 4. Keep Johnny 5000’s presence focused and premium

### Current issue
The homepage includes both a dedicated Johnny card and multiple Johnny-like coaching messages elsewhere.

### Why this matters
If Johnny’s voice is spread everywhere in equal intensity, his identity becomes diluted.

### Recommendation
Concentrate Johnny’s strongest presence in:
- the AI card
- one premium daily insight
- one best-next-move prompt if needed

Keep the rest of the homepage supportive but lighter.

### Goal
Make Johnny feel distinct, embedded, and premium.

---

## 5. Strengthen the homepage card system as a visual signature

### Current issue
The homepage already uses many cards, but the brand payoff depends on their consistency.

### Why this matters
Cards are meant to be one of the app’s signature visual patterns.

### Recommendation
Standardize across homepage cards:
- border radius
- shadow depth
- padding rhythm
- chip placement
- heading spacing
- action treatment

### Goal
Make the homepage feel unmistakably like Johnny5k.

---

## 6. Make cream and warm neutrals do more of the visual work

### Current issue
If the homepage styling uses too much plain white or cool gray, it will feel generic.

### Why this matters
The style guide specifically says cream should dominate the app background to preserve warmth.

### Recommendation
Use:
- cream as the page canvas
- white for primary card surfaces
- warm neutral tints for secondary surfaces
- restrained accent colors

### Goal
Make the homepage feel warmer, friendlier, and more visually distinct.

---

## 7. Soften evaluative language and framing

### Current issue
Modules like “Weekly score” are useful but can feel slightly judgment-heavy if overemphasized.

### Why this matters
The product is supposed to feel:
- encouraging
- calm
- motivating
- not punishing

### Recommendation
Keep performance indicators, but present them with:
- warmer labels
- contextual support
- constructive framing
- less scoreboard energy

### Goal
Keep the homepage supportive instead of evaluative.

---

## 8. Use chips with more restraint

### Current issue
There are many chip-style labels across the homepage.

### Why this matters
Too many chips can make the homepage feel busier and more system-labeled than warm and elegant.

### Recommendation
Reserve chips for:
- true status states
- important category emphasis
- moments that benefit from quick scanning

Do not default to chips on every card.

### Goal
Create a calmer, more refined homepage.

---

## 9. Keep the retro-modern feel abstract, not literal

### Current issue
The Johnny5k brand includes retro warmth, but that can become gimmicky if interpreted too literally.

### Why this matters
The style guide explicitly rejects novelty-retro execution.

### Recommendation
Express the retro-modern identity through:
- rounded geometry
- warm palette
- optimistic tone
- softness and approachability

Avoid:
- novelty references
- diner-style theming
- vintage gimmicks
- ornamental retro flourishes on workflow surfaces

### Goal
Keep the homepage tasteful, modern, and brand-consistent.

---

## 10. Make story and tip content feel lighter and more editorial

### Current issue
The story, tip, and small-win cards are on-brand in concept, but they may be visually weighted too similarly to functional cards.

### Why this matters
These should add:
- warmth
- personality
- optimism

without competing with the homepage’s operational UI.

### Recommendation
Visually differentiate these cards by making them:
- softer
- quieter
- slightly more editorial
- less utility-card-like

Possible treatments:
- warmer tint backgrounds
- lighter hierarchy
- smaller footprint
- rotator/carousel instead of three equal blocks

### Goal
Let these modules support brand tone without crowding the homepage.

---

# Final Homepage Priorities

If the homepage is refined in stages, the highest-impact order is:

## Priority 1
Replace emoji quick actions and reduce their visual bulk.

## Priority 2
Reduce homepage density and limit the number of equally weighted visible sections.

## Priority 3
Introduce a clear “best next move” block.

## Priority 4
Reduce copy overload and keep only the strongest coaching narrative visible.

## Priority 5
Strengthen card consistency and interaction clarity.

---

# Mobile-first Homepage Principle

The right homepage target for Johnny5k is:

- compact, not cramped
- touch-friendly, not chunky
- warm, not gimmicky
- actionable, not overloaded
- optimistic, not noisy
- one-hand friendly, not oversized

The practical rule:

**Make the homepage easy to act on with one thumb, without solving mobile usability by making everything physically large.**
