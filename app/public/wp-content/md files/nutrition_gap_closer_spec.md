Here's a concrete product spec for the nutrition gap closer.

Core job

Answer this in under 5 seconds of user effort:

"Given how I've eaten today, what is the smartest next nutrition move?"

Not:

"Here are your macros" "Here are 10 recipes" "Let's have a conversation"

It should feel like a sharp coach recommendation with immediate action.

What inputs it should use

From the current app, the feature should pull from:

Daily nutrition state

Already available in the dashboard layer:

calories consumed protein consumed carbs consumed fat consumed fiber
sodium remaining calories / target context Goal context fat loss /
maintenance / gain calorie target macro targets likely
pace/aggressiveness of the goal Time context current local time meals
already logged today how much of the day is left whether the user still
has a planned workout whether they already trained today Food
availability context

Using existing and nearby systems:

pantry / food extraction saved meals recipe library grocery-gap support
AI meal planning actions User preference context preferred foods
disliked foods typical meals convenience vs cooking preference coaching
tone preference Pattern context common misses, like under-eating protein
early tendency to overeat at night recurring weekend drift whether the
user responds better to rescue mode or prevention mode Primary decision
logic

The feature should identify the single highest-priority nutrition gap
first.

Not all gaps are equal.

A simple priority model could look like this:

Tier 1: Adherence-critical gaps

These most strongly affect success today.

very low protein relative to remaining calories dangerously under-eating
late in the day massively over target and at risk of "screw it" eating
no meaningful meals logged by late afternoon Tier 2: Quality gaps

Important, but secondary.

low fiber poor meal structure high sodium / low produce balance low
satiety setup for the evening Tier 3: Tomorrow-risk gaps

These matter if today is mostly done.

no food prep for tomorrow pantry too weak to support targets pattern
suggests tomorrow will fail too

Then pick one primary gap and optionally one secondary note.

Recommended gap categories

These are the main modes the system should detect.

1.  Protein gap

Example:

user is 45g short on protein enough calories remain to fix it

Recommendation style:

give 2--3 realistic high-protein options one easiest option one "real
meal" option one pantry/store option 2. Calorie gap: under target

Example:

user has only eaten 1,100 calories by 6:30 PM target is 2,000

Recommendation style:

avoid "just snack more" suggest one real meal with protein anchor
explain that under-eating often backfires later 3. Calorie gap: over
target

Example:

user is already 400 over by dinner

Recommendation style:

no shame switch to damage-control mode lighter dinner guidance stop the
spiral prep tomorrow mentally 4. Meal-structure gap

Example:

user logged coffee, snack, snack, then huge dinner

Recommendation style:

identify pattern correct the next meal offer tomorrow structure
suggestion 5. Fiber / satiety gap

Example:

macros are decent, but fiber is very low and late-night hunger risk is
high

Recommendation style:

add produce, legumes, fruit, or high-volume foods frame it as hunger
control, not just "health points" 6. Pantry gap

Example:

user's likely best correction foods are not available

Recommendation style:

immediate "store list" quick order list pantry-based fallback if no
shopping 7. Tomorrow gap

Example:

today is mostly unrecoverable best move is to build tomorrow
breakfast/lunch now

Recommendation style:

explicitly pivot to tomorrow "win the next 12 hours" Suggested output
format

The card should be short and decisive.

Card anatomy

Headline Your biggest nutrition gap

Diagnosis One sentence, highly specific.

Recommendation One sentence, practical and coach-like.

Actions Up to 3 buttons.

Example 1: protein gap

Your biggest nutrition gap You're 48g short on protein with about 650
calories left. Best move: eat one real dinner built around lean protein,
then finish with a simple protein snack. Actions:

Show 3 meal options Use foods I have Build tonight's plan Example 2:
over-calorie rescue

Your biggest nutrition gap You're already over calories, so tonight is
about stabilizing, not making it perfect. Best move: keep dinner light,
high-protein, and low-chaos. Actions:

Show light dinner ideas Help me not spiral Build tomorrow reset Example
3: tomorrow gap

Your biggest nutrition gap Today is mostly spent. The smarter move is
setting up tomorrow so breakfast and lunch don't fail. Best move: lock
in two meals now. Actions:

Build tomorrow breakfast Build tomorrow lunch Quick grocery list
Suggested AI output contract

Instead of asking the model for a loose response, give it a tighter
structure like:

{ "gap_type": "protein_gap", "priority": "high", "diagnosis": "You are
48g short on protein with 650 calories left and no dinner logged yet.",
"recommendation": "Eat one protein-centered dinner and one simple
evening protein snack.", "tone_mode": "direct_supportive", "actions": \[
{ "type": "plan_next_meal", "label": "Show 3 meal options" }, { "type":
"use_pantry", "label": "Use foods I have" }, { "type":
"build_tomorrow_plan", "label": "Build tomorrow's breakfast" } \],
"secondary_note": "Fiber is also low, so include a fruit or vegetable
with dinner.", "confidence": 0.89 }

This matters because the app already appears to support structured AI
actions and parsing, so this feature should stay machine-readable and
product-safe rather than relying on raw prose .

UX states State 1: strong clear gap

The easiest and best case.

one obvious problem one obvious correction

This should be most days.

State 2: multiple moderate gaps

Example:

protein low fiber low calories okay

System behavior:

pick one main gap include one short secondary note do not overwhelm
State 3: low-confidence data

Example:

only one partial meal logged food analysis uncertain likely missing
entries

System behavior:

say so cleanly ask for one clarifying input or offer a low-friction
fallback: "Log dinner first" "Estimate what you ate" "Want me to work
with rough numbers?" State 4: irrecoverable day

Example:

massively over target late at night multiple poor meals already logged

System behavior:

no fake precision pivot to damage control or tomorrow planning State 5:
day already on track

Example:

calories and protein are in a strong place

System behavior:

affirm briefly suggest a simple finishing move avoid inventing problems
Decision tree at a high level

A simple version could work like this:

Compute remaining calorie and macro gaps Check current time and meals
logged Check if there is still enough day left to "fix" today Rank gap
categories by coaching importance Decide mode: fix today stabilize
tonight prepare tomorrow Generate: diagnosis recommendation 2--3 actions
optional secondary note

Pseudo-logic:

if low confidence in intake data: ask for quick clarification or use
rough-mode recommendation else if over calories late in day: mode =
stabilize_tonight else if protein gap is high and enough calories
remain: mode = fix_today_protein else if calories too low late in day:
mode = finish_with_real_meal else if pantry likely weak: mode =
grocery_gap else: mode = tomorrow_prep What the action buttons should do

These should open direct, useful flows.

Show 3 meal options

Uses current gaps + preferences + time of day Output:

3 practical meals calories / protein effort level best choice badge Use
foods I have

Uses pantry-aware generation Output:

2--3 meals from available ingredients one likely best fit Quick grocery
list

Uses grocery-gap support Output:

minimal list for tonight or tomorrow organized by simplest essentials
Build tonight's plan

Turns guidance into a mini plan:

dinner snack cutoff hydration reminder Build tomorrow's breakfast/lunch

Useful when today is mostly done Output:

1--2 locked-in meals optionally saved for reuse Help me not spiral

Special behavior for over-target days:

reduce guilt language narrow focus stabilize evening prevent further
overeating Sample rules that would make it feel smart Protein-first rule

If protein is materially behind and calories remain, protein usually
becomes the main gap.

Late-day realism rule

At 8:30 PM, stop pretending the day can be engineered perfectly.

Spiral prevention rule

If the user is already over target, recommendation quality matters more
than target perfection.

Satiety rule

If evening risk is high, favor volume and fiber over pure macro math.

Tomorrow-protection rule

If today is mostly lost, move to tomorrow setup quickly.

Simplicity rule

Prefer one meal plus one snack over 4 tiny optimization suggestions.

What would make it feel human

The best version does not sound like a calculator.

Bad:

"You have 43.2g protein remaining and 612 kcal available."

Better:

"You're still pretty light on protein, but this is fixable with one
solid dinner."

Bad:

"Fiber intake is below recommendation."

Better:

"Your macros are decent, but tonight needs something with actual volume
so you're not hungry later."

Bad:

"You exceeded calories."

Better:

"You're already over. Don't chase perfect now --- just keep dinner calm
and keep the night from unraveling."

That tone difference is a big part of the feature's value.

Best MVP version

If you wanted to launch this fast, the MVP would be:

one dashboard card one ranked gap type one diagnosis line one
recommendation line three actions max: show meal ideas use pantry build
tomorrow plan

No need to solve every nutrition case on day one.

Best fuller version

A stronger phase-two version would add:

recurring pattern detection confidence handling for incomplete logs
pantry + saved meals + recipe ranking smarter "damage control" mode
reminder integration later in the day learning from accepted suggestions
Success metrics I'd watch tap-through rate on the card percentage of
users taking one suggested action meal logging after card exposure
protein target completion rate next-day return rate reduction in
late-day "nothing logged" situations acceptance rate by gap type My
recommendation for implementation order

Build it in this sequence:

gap detection logic dashboard card structured recommendation payload
action routing to meal / pantry / tomorrow flows tone refinement pattern
detection later

That gets real user value into the app quickly without overbuilding.

I can turn this into a developer-facing implementation spec next.
