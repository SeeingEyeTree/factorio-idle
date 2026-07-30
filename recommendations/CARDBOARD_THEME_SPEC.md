# Caff-Infinit — "Cardboard & Sharpie" UI Theme — Implementation Spec

A handoff spec for Claude Code. Goal: replace the current generic dark UI with a warm
**corrugated-cardboard + Sharpie-marker** aesthetic, and rebuild the **Buildings tab** into a
flip-through catalog with a quick-place shelf and a (cosmetic) review system.

A working visual + interaction reference already exists in the repo:
**`Buildings — Cardboard.dc.html`** — open it in a browser to see the target look and behavior.
That file is a self-contained mock; this spec describes how to port it into the real
`index.html`, `style.css`, and `game.js`/`script.js`.

---

## 0. Scope

**In scope**
1. New global cardboard theme (tokens, fonts, surfaces) — affects all tabs.
2. Buildings tab rebuilt: paged "catalog" (no infinite scroll) + quick-place shelf + reviews.
3. Power-aware quick-place swap (recents ↔ generators).

**Out of scope / leave working as-is**
- Game simulation logic (production rates, power math, biters, saves).
- The in-game "Theme" setting (Caff-Infinit / Classic display names) — this is a **visual skin**, unrelated to that feature.
- Icons: keep the existing PNG `.item-icon` system. The mock uses emoji only as placeholders.

**Files to touch:** `style.css` (most work), `index.html` (Buildings tab markup), `game.js` (recents tracking, catalog render, power-swap), and a small new `reviews` helper (can live in `script.js` or a new `reviews.js`).

---

## 1. Visual design system

### 1.1 Fonts
Add to `<head>` of `index.html` (before `style.css`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Patrick+Hand&display=swap" rel="stylesheet">
```

- **`'Patrick Hand', cursive`** → body / general UI text (the everyday handwriting).
- **`'Permanent Marker', cursive`** → headings, titles, building names, buttons, stamps (the bold Sharpie).
- Keep `var(--font-mono)` (Cascadia/Fira) for the Script tab's code editor only — do **not** make code handwritten.

### 1.2 Color tokens — rewrite `:root` in `style.css`
Replace the existing dark palette variables with the cardboard palette. **Keep the same variable
names** so the hundreds of existing `var(--…)` references re-skin automatically with minimal edits.

```css
:root {
  /* Cardboard surfaces (was the dark navy set) */
  --bg:      #c8a877;   /* base corrugated cardboard */
  --surf:    #e0cfa1;   /* panel */
  --surf2:   #e9dbb8;   /* card */
  --surf3:   #f3ecd6;   /* inset / input / icon well (lightest) */
  --surf4:   #d8c697;
  --border:  #9a7c4a;   /* cardboard edge */
  --border2: #8a6c3e;

  /* legacy aliases used in a few places */
  --bg2: #dccb9a;  --bg3: #f3ecd6;  --bg0: #e9dbb8;

  /* Accents — Sharpie inks */
  --accent:  #3a2c1a;   /* primary "black" sharpie (was amber) */
  --accent2: #241a0e;
  --red:     #b23b2a;   /* red sharpie — alerts, stamps, the "review" CTA */
  --green:   #3a6b34;   /* place / running / OK */
  --green2:  #244a20;
  --blue:    #2f6aa8;   /* water */
  --amber:   #d98a1f;   /* star ratings ONLY */

  /* Text — brown ink on tan */
  --text:    #3a2c1a;
  --text2:   #241a0e;   /* strongest */
  --text1:   #241a0e;
  --text3:   #7a6440;
  --dim:     #7a6440;
  --dim2:    #5a4a30;

  /* Shadows: hard "marker drop" offsets, not soft glows */
  --shadow-sm: 2px 2px 0 rgba(58,44,26,.16);
  --shadow:    2px 3px 0 rgba(58,44,26,.18);
  --shadow-lg: 4px 6px 0 rgba(58,44,26,.20);
  --glow-accent: none;
  --glow-green:  none;

  --font: 'Patrick Hand', cursive;
  --font-marker: 'Permanent Marker', cursive;
  --font-mono: 'Cascadia Code', 'Fira Mono', monospace;
}
```

> ⚠️ After swapping tokens, **scan `style.css` for hard-coded dark hex values** that don't go
> through variables (e.g. `#0a0d0a`, `#161b22`, `#0d1017`, gradient stops like `#1e2530`,
> `rgba(244,168,58,…)` amber glows). Replace dark backgrounds with cardboard tones and delete
> the amber glow `box-shadow`s. Notable spots: `#titlebar`, `.game-header`, `.tab-nav`,
> `.power-bar`, `.modal`, `.script-textarea`/`.script-output` (these can stay darker — a code
> editor on cardboard reads fine as a "chalkboard"; your call), `#start-screen` gradients,
> `#meta-screen` gradients, scrollbars.

### 1.3 Texture — the corrugated background
Apply the cardboard texture to `body` (and `#start-screen`, `#meta-screen` if you want them themed):

```css
body {
  background-color: var(--bg);
  background-image:
    repeating-linear-gradient(90deg, rgba(90,60,28,.13) 0 1px, rgba(255,238,205,.06) 1px 2px, transparent 2px 9px),
    radial-gradient(circle at 18% 25%, rgba(120,85,40,.10), transparent 42%),
    radial-gradient(circle at 85% 70%, rgba(120,85,40,.08), transparent 45%);
  color: var(--text);
  font-family: var(--font);
}
```

The vertical 9px stripe = corrugation ridges; the radials = subtle mottling. Keep it subtle so text stays readable.

### 1.4 Reusable visual motifs (used throughout)
- **Cards/panels**: `background: var(--surf2); border: 1.5px solid var(--border2); border-radius: 3px; box-shadow: var(--shadow);` — and **remove gradients** (the current cards use `linear-gradient(180deg, …)`; flatten to a solid tan).
- **Hard shadow, not soft**: offsets like `2px 3px 0` give the "thing sitting on cardboard" look. Avoid blur.
- **Slight rotations** for personality: headings/stamps/cards may use `transform: rotate(-1.5deg .. 1.5deg)`. Use sparingly and alternate sign so it looks hand-placed, not tilted. Don't rotate anything with an input the user types into mid-line (it's fine, just keep ≤1.5°).
- **Marker headings**: `font-family: var(--font-marker); color: var(--text2);`
- **Buttons** (`.btn-place`, `.btn-craft`, `.btn-research-tech`, `.btn-primary`): flatten gradients →
  - Primary action (place/craft/buy): `background: var(--green); border: 2px solid var(--green2); color: var(--surf3); font-family: var(--font-marker);`
  - Secondary: `background: rgba(255,245,220,.35); border: 2px solid var(--accent); color: var(--text2);`
  - Danger / review CTA: `background: var(--red); border: 2px solid #7e271b; color: var(--surf3);`
- **Stamps** (status badges like OK / running / "STAFF PICK" / wave warning): marker font, colored outline box, slight rotation, semi-transparent cardboard fill:
  ```css
  .stamp { font-family: var(--font-marker); font-size:.75rem; border:2.5px solid var(--red);
           color:var(--red); border-radius:5px; padding:2px 8px; transform:rotate(-3deg);
           background:rgba(243,236,214,.85); display:inline-block; }
  .stamp.ok { border-color:var(--green); color:var(--green); }
  ```
- **Packing tape** (decorative, optional): a translucent beige rectangle, rotated, with dashed side edges:
  ```css
  .tape { background:rgba(214,196,150,.55); box-shadow:0 1px 3px rgba(0,0,0,.12);
          border-left:1px dashed rgba(120,95,50,.4); border-right:1px dashed rgba(120,95,50,.4); }
  ```
- **Star ratings**: text `★`/`☆` in `color: var(--amber); letter-spacing:1px;`. This is the **only** place amber appears.

### 1.5 Active tab indicator
Current `.tab-btn.active` uses an amber underline. Change to the **red Sharpie circle** around the
active tab (see mock). Implementation: on the active tab, draw an oval via a pseudo-element:

```css
.tab-btn { font-family: var(--font); color: var(--dim2); border-bottom: none; }
.tab-btn.active { color: var(--text2); font-family: var(--font-marker); position: relative; }
.tab-btn.active::after {
  content:''; position:absolute; inset:2px -6px; border:2.5px solid var(--red);
  border-radius:50%; transform:rotate(-3deg); opacity:.85; pointer-events:none;
}
```
(Remove the old `.tab-btn.active { border-bottom-color }` rule and the amber `text-shadow`.)

---

## 2. Buildings tab rebuild

Reference: the `Buildings — Cardboard.dc.html` mock. Target the existing
`<section id="tab-buildings">` and its `.buildings-layout` grid.

### 2.1 New layout
Two columns (keep the existing grid, adjust proportions):
- **Left (flex):** the **flip-through catalog** (replaces the stacked collapsible `.build-section`s).
- **Right (~310px):** the **quick-place shelf** (new) above the existing **Active Buildings** list.

```css
.buildings-layout { grid-template-columns: 1fr 320px; }
```

Keep `#active-buildings` and its search exactly as-is functionally — just re-skinned by the token swap. The quick-place shelf is **new** and sits at the top of the right column.

### 2.2 Catalog (replaces collapsible build sections)
The current build sections map 1:1 to **catalog pages**:

| Page | Title | Building `data-type`s (existing) |
|----:|-------|----------------------------------|
| 1 | MINING | `miner`, `electricMiner` |
| 2 | FURNACES | `furnace`, `steelFurnace`, `electricFurnace` |
| 3 | POWER | `offshoreP`, `boiler`, `steamEngine`, `solarPanel`, `accumulator`, `nuclearReactor` |
| 4 | PRODUCTION | `assembly`, `assembly2`, `assembly3` (the combined assembler card) |
| 5 | OIL & CHEM | `pumpjack`, `oilRefinery`, `chemicalPlant`, `centrifuge`, `rocketSilo` |
| 6 | RESEARCH | `lab`, `radar` |

**Behavior**
- Show **one page at a time**. A header row with ‹ / › arrow buttons, the page title, and a
  "page X of N" counter. Wrap around at the ends (next on last → first).
- Respect existing **tech gating**: cards with `data-requires-tech="…"` stay hidden until unlocked
  (reuse whatever logic currently shows/hides them). If a page ends up empty after gating, still
  show it with an "unlock more tech to fill this page" note, OR skip it in the page sequence — pick
  skip for cleanliness (compute the visible page list dynamically).
- **Do not remove** the existing functional bits inside each card: the recipe pickers
  (`.recipe-picker-host`), the drill/assembler sub-tabs (`.build-tab-row` / `setDrillTab` /
  `setAssemblyTab`), the count input (`.place-count`) and the `placeBuilding(type, btn, event)`
  call. Re-skin the card; keep its DOM hooks and handlers.
- Keep the **build-queue status** (`#placement-status`, `#place-queue-info`, `#place-progress`,
  Clear button) — move it to the top of the catalog column, above the page.

**Card re-skin** (`.buildable-card`): flat tan card per §1.4, marker building name (`h4`),
Patrick-Hand description, red cost line (`.card-cost { color: var(--red); }`), green PLACE button.
Add a **star rating line** under the name (see §2.4) and a **⭐ STAFF PICK** stamp on one featured
card per page (configurable; in the mock: Mining→`miner`, Furnaces→`steelFurnace`,
Power→`solarPanel`, Production→`assembly`, Oil→`oilRefinery`, Research→`lab`).

**Suggested catalog markup skeleton** (Claude Code: generate the page contents from the existing
cards rather than hand-duplicating):

```html
<div class="catalog">
  <div class="catalog-nav">
    <button class="catalog-arrow" onclick="catalogPrev()">‹</button>
    <div class="catalog-title">
      <div class="catalog-title-main">📚 The Parts Catalog</div>
      <div class="catalog-title-sub"><span id="catalog-page-title">MINING</span> · page <span id="catalog-page-num">1</span> of <span id="catalog-page-total">6</span></div>
    </div>
    <button class="catalog-arrow" onclick="catalogNext()">›</button>
  </div>
  <div class="catalog-page">
    <!-- the buildable-cards for the current page render here -->
  </div>
</div>
```

```css
.catalog-nav { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
.catalog-arrow { width:46px; height:46px; border:2.5px solid var(--accent); border-radius:50%;
  background:var(--surf2); cursor:pointer; font-family:var(--font-marker); font-size:1.4rem;
  color:var(--text2); box-shadow:var(--shadow-sm); }
.catalog-arrow:hover { background:var(--surf3); }
.catalog-title { flex:1; text-align:center; }
.catalog-title-main { font-family:var(--font-marker); font-size:1.2rem; color:var(--text2); }
.catalog-title-sub  { font-size:.95rem; color:var(--dim); }
.catalog-page { background:#efe2c0; border:1.5px solid var(--border); border-radius:4px;
  padding:18px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25), var(--shadow-lg);
  display:flex; flex-direction:column; gap:14px; }
```

**JS** (in `game.js`): a `BUILDINGS_CATALOG` array of `{title, types:[...], featured}`, a
`catalogPage` state int, and `catalogPrev()/catalogNext()/renderCatalog()`. `renderCatalog()` builds
the visible-types list for the current page (after tech gating) and renders the existing card
template for each type into `.catalog-page`. Persist `catalogPage` in the save object if you want it
to survive reload (optional).

### 2.3 Quick-Place shelf (new, right column top)
A cardboard sub-panel above Active Buildings.

**Default state — "Last 4 Placed":** the 4 most-recently-placed building types, newest first, each a
compact card (icon + name + cost + PLACE). PLACE calls the same `placeBuilding(type)` path (count 1).

**Power-low state — "Generators":** when the base is **not at 100% power**, the shelf header turns
red, shows a warning, and the list swaps to power buildings:
`['boiler','steamEngine','solarPanel','offshoreP']` (filter to teched-unlocked; you can add
`accumulator`/`nuclearReactor` when unlocked).

**Power condition:** reuse the existing power model. Treat "not 100%" as
`POWER_DEMAND > POWER_GEN` (i.e. the satisfaction ratio < 1, the same condition that currently makes
the power readout go `.power-warn`). Expose a helper like `isPowerSatisfied()` and call it in the
shelf render. Re-render the shelf on the existing game tick (whatever updates `#power-bar`).

**Recents tracking:** in `placeBuilding(type, …)`, after a successful queue, push `type` to a
`recentlyPlaced` array (dedupe: remove existing, unshift, cap length 4). Persist in the save object.
Seed with `['miner','furnace','assembly','lab']` for new games so the shelf isn't empty.

```html
<div id="quick-place" class="quick-shelf">
  <div class="quick-title" id="quick-title">📋 Last 4 Placed</div>
  <div class="quick-hint" id="quick-hint">tap to re-place a recent build</div>
  <div id="quick-warn" class="quick-warn" style="display:none">⚠ Power below 100%! Slap down a generator.</div>
  <div id="quick-list"></div>
</div>
```
```css
.quick-shelf { background:#dccb9a; border:1.5px solid var(--border2); border-radius:4px;
  padding:14px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.18), var(--shadow-lg); margin-bottom:1rem; }
.quick-title { font-family:var(--font-marker); font-size:1rem; color:var(--green); margin-bottom:3px; }
.quick-shelf.power-low .quick-title { color:var(--red); }
.quick-hint { font-size:.82rem; color:var(--dim); margin-bottom:11px; }
.quick-warn { background:rgba(178,59,42,.12); border:2px dashed var(--red); border-radius:5px;
  padding:7px 10px; font-size:.85rem; color:var(--red); margin-bottom:11px; }
.quick-item { display:flex; align-items:center; gap:10px; background:var(--surf2);
  border:1.5px solid var(--border2); border-radius:3px; padding:9px 11px; margin-bottom:9px;
  box-shadow:var(--shadow-sm); }
.quick-item .item-icon, .quick-item .q-emoji { width:38px; height:38px; }
.quick-item .q-name { flex:1; font-size:.95rem; color:var(--text2); }
.quick-item .q-cost { font-size:.78rem; color:var(--dim); }
```

**JS:** `renderQuickPlace()` — if `!isPowerSatisfied()` add `.power-low`, set title/warn, list =
generators; else title "Last 4 Placed", list = `recentlyPlaced`. Call it on tick + after each place.

### 2.4 Reviews (cosmetic, fun)
Per-building star rating + written reviews. **No gameplay effect.** Store in `localStorage`
(separate from saves so it's shared across runs), keyed by building type.

- Each catalog card shows: a **seed rating** (e.g. `★★★★★ 4.6 · 23 reviews`) computed from a static
  seed table + any user reviews. The featured card's reviews are shown in a **reviews block** at the
  bottom of the catalog page (handwritten "index-card" notes with a tape strip, slight rotation,
  alternating sign).
- A **"✎ Leave a review"** form under the notes: a 5-star clickable picker, an optional name input,
  a "hot take" text input, and a red **PIN IT 📌** button. On submit: validate non-empty text,
  prepend `{name||'Anonymous', stars, text}` to that building's reviews in localStorage, clear the
  inputs, reset stars to 5, and show a toast "📌 review pinned. thanks!". Re-render the notes.

```js
// reviews.js (or in script.js)
const REVIEW_KEY = 'caffReviews';
function loadReviews(){ try { return JSON.parse(localStorage.getItem(REVIEW_KEY)) || {}; } catch { return {}; } }
function saveReviews(o){ localStorage.setItem(REVIEW_KEY, JSON.stringify(o)); }
function addReview(type, {name, stars, text}){ const o=loadReviews(); (o[type]=o[type]||[]).unshift({name:name||'Anonymous', stars, text}); saveReviews(o); }
// seed ratings table: { miner:{r:4.6,c:23}, steelFurnace:{r:4.9,c:14}, solarPanel:{r:4.2,c:28}, ... }
function starStr(r){ const f=Math.round(r); return '★★★★★'.slice(0,f)+'☆☆☆☆☆'.slice(0,5-f); }
```

Seed a handful of funny reviews (see the mock's `state.reviews` for copy you can reuse, e.g. Solar
Panel: *"does absolutely nothing at 3am when the biters show up >:("*). These can be hard-coded
defaults merged with localStorage on load.

```css
.review-note { width:228px; background:#f6efd5; border:1px solid #cdb888; border-radius:2px;
  padding:11px 13px 12px; box-shadow:1px 2px 4px rgba(0,0,0,.14); position:relative; }
.review-note::before { content:''; position:absolute; top:-8px; left:50%; margin-left:-26px;
  width:52px; height:16px; background:rgba(214,196,150,.65); box-shadow:0 1px 2px rgba(0,0,0,.12); }
.review-note .rn-stars { color:var(--amber); letter-spacing:1px; }
.review-note .rn-text  { font-size:.95rem; color:var(--text); line-height:1.35; margin:4px 0 6px; }
.review-note .rn-name  { font-family:var(--font-marker); font-size:.78rem; color:var(--dim); }
.review-form { background:var(--surf3); border:2px dashed var(--border); border-radius:6px; padding:13px 15px; margin-top:14px; }
.review-form input { background:#fffdf2; border:2px solid var(--accent); border-radius:5px;
  padding:6px 9px; font-family:var(--font); font-size:.95rem; color:var(--text); }
.star-pick button { background:none; border:none; cursor:pointer; font-size:1.5rem; color:var(--amber); padding:0 1px; }
```

(Optional but nice: a small reusable **toast** — fixed top-center, pale-yellow sticky note, used for
both "review pinned" and "X added to the build queue". See the mock's `@keyframes toastPop`.)

---

## 3. Other tabs (global re-skin only)
No structural changes — the §1 token swap does most of it. Spot-check and fix any hard-coded darks:

- **Header / titlebar / tab-nav / power-bar:** flatten dark gradients to tan; drop amber glows; active tab = red circle (§1.5).
- **Crafting / Recipes / Research / Defense / Graph / Inventory:** cards inherit the flat-tan + hard-shadow treatment via tokens. Marker font on section labels and card titles.
- **Tech tree** (`.tech-node`): flat tan nodes; `node-current`/`node-done` use red/green outlines instead of amber glow; connector SVG lines can become brown.
- **Script tab:** leave the code `textarea`/output dark ("chalkboard") for readability, OR theme to a manila notepad — implementer's choice. Keep `--font-mono` for code.
- **Start screen / Meta screen:** swap the radial dark gradients for the cardboard texture; title in `--font-marker`.
- **Modals, scrollbars, notifications:** retan backgrounds; flatten.

---

## 4. Acceptance checklist
- [ ] Fonts load; headings render in Permanent Marker, body in Patrick Hand.
- [ ] Whole app reads as cardboard; no leftover navy panels or amber glows (amber only on ★ ratings).
- [ ] Active tab shows the red Sharpie circle.
- [ ] Buildings tab shows **one catalog page at a time**; ‹ › cycle through 6 pages with a working counter; no long scroll.
- [ ] Each building card keeps its recipe picker / sub-tabs / count input / Place behavior.
- [ ] Tech-locked buildings still hidden until unlocked; empty pages skipped.
- [ ] Quick-place shelf shows last 4 placed; placing a building updates it (newest first, max 4); persists in save.
- [ ] When power demand exceeds generation, shelf swaps to generators with red header + warning; reverts at 100%.
- [ ] Reviews: seed ratings show on cards; featured building shows notes; leaving a review pins a note and persists in localStorage; no gameplay effect.
- [ ] Active Buildings list and build queue still function unchanged.

## 5. Reference
- Visual + interaction target: **`Buildings — Cardboard.dc.html`** (open in browser).
- The four explored directions (for context): **`UI Style Options.dc.html`** — we chose option 02, Cardboard.
- Mock copy for seed reviews and exact colors/rotations lives inside `Buildings — Cardboard.dc.html` (`BUILD`, `RATING`, `state.reviews`, inline styles).
