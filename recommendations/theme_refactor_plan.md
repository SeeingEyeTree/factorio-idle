# Theme Toggle Refactor Plan — Factorio ↔ Caff-Infinite

Goal: a per-save setting that swaps every name + image between the original
Factorio-style theme and the Caff-Infinite rebrand, without splitting the codebase.

## Problem statement

Names and images are scattered across the codebase as direct string literals
and direct dict accesses:

- `ITEMS[k].name` / `ITEMS[k].img` in **data/recipes.js** (about 100 items)
- `BUILDING_DEFS[k].name` / `BUILDING_DEFS[k].icon` in **game.js** (~22 buildings)
- Hardcoded display strings in **game.js**: `buildingCard('🔥', 'Stone Furnace', ...)`
  called at ~19 sites
- Sprite paths in **game.js**: `_enemySprites`, `_oreImgs`, building map tiles
- Recipe display names duplicated in the recipe dicts in **data/recipes.js**
- Script-editor aliases auto-derived from camelCase recipe keys in **script.js**

You also have known name inconsistencies even within one theme:
- `BUILDING_DEFS.lab.name = 'Unpaid Interns'` vs `ITEMS.labItem.name = 'Unpaid Intern'`
- `BUILDING_DEFS.assembly.name = 'Assembling Machine Mk1'` vs `ITEMS.assemblyMachine1Item.name = 'Assembly Machine Mk1'`

If we don't fix the duplication first, the toggle will inherit the inconsistency.

## End state

A single `THEMES` object in `data/themes.js`:

```js
const THEMES = {
  factorio: {
    items: {
      ironOre:   { name: 'Iron Ore',     img: 'data/icon_imgs/iron_ore.png' },
      ironPlate: { name: 'Iron Plate',   img: 'data/icon_imgs/iron_plate.png' },
      // ... every item ...
    },
    buildings: {
      furnace:  { name: 'Stone Furnace',  icon: '🔥' },
      assembly: { name: 'Assembly Machine Mk1', icon: '🏭' },
      lab:      { name: 'Lab', icon: '🔬' },
      // ... every building ...
    },
    sprites: {
      // canvas-drawn assets used by the base-map renderer
      grass:   'data/map_imgs/grass.png',
      ore_iron:  'data/map_imgs/ore_patch_silver.png',
      // ...
      building_furnace: 'data/icon_imgs/stone_furnace.png',
      enemy_red_v1: 'data/map_imgs/enemy_red_v1.png',
      // ...
    },
    scriptAliases: {
      iron_plate: 'ironPlate',
      iron_gear:  'ironGear',
      furnace:    'furnace',
      // ... legacy names ...
    },
  },
  caffactory: {
    items: {
      ironOre:   { name: 'Crushed Cans',   img: 'data/icon_imgs/caffactory/crushed_cans.png' },
      ironPlate: { name: 'Aluminum Sheet', img: 'data/icon_imgs/caffactory/aluminum_sheet.png' },
      // ... every renamed item; items not in this map fall back to factorio ...
    },
    buildings: {
      furnace:  { name: 'Microwave', icon: '🔥' },
      lab:      { name: 'Unpaid Intern', icon: '🔬' },
      // ...
    },
    sprites: {
      // overlay caffactory sprites where they exist; fall back to factorio for the rest
      building_furnace: 'data/icon_imgs/caffactory/microwave.png',
      enemy_red_v1: 'data/icon_imgs/OSHA.png',  // OSHA inspectors
      // ...
    },
    scriptAliases: {
      // every legacy alias plus the new themed ones — never remove old ones
      iron_plate:    'ironPlate',
      aluminum_sheet:'ironPlate',
      microwave:     'furnace',
      // ...
    },
  },
};
```

Three tiny resolvers replace direct access:

```js
function itemDisplay(key) {
  const t = state?.settings?.theme ?? 'caffactory';
  return THEMES[t].items[key] ?? THEMES.factorio.items[key] ?? ITEMS[key];
}
function buildingDisplay(type) {
  const t = state?.settings?.theme ?? 'caffactory';
  return THEMES[t].buildings[type] ?? THEMES.factorio.buildings[type] ?? BUILDING_DEFS[type];
}
function spriteSrc(key) {
  const t = state?.settings?.theme ?? 'caffactory';
  return THEMES[t].sprites[key] ?? THEMES.factorio.sprites[key];
}
```

Note the **fallback chain**: caffactory falls back to factorio so partial
re-skins are fine. New themes can be added later without touching call sites.

## Phased rollout

### Phase 0 — fix known inconsistencies (one PR, ~30 min)

Before adding any abstraction, normalize the existing duplication.

- [ ] `BUILDING_DEFS.lab.name = 'Unpaid Intern'` (singular, match ITEMS)
- [ ] `BUILDING_DEFS.assembly.name = 'Assembly Machine Mk1'` (match ITEMS)
- [ ] `pumpjackItem.img` → fix wrong path pointing at oil_refinery.png
- [ ] Drop the `'⚡⛏️'` and `'⚡🔥'` double-emoji icons; pick one.

Doing this first means the rest of the refactor isn't carrying baggage.

### Phase 1 — build the theme system in parallel (don't switch anything yet)

- [ ] Create `data/themes.js`
- [ ] Define the full `factorio` theme by copying current values from
      `ITEMS[k].name/img` and `BUILDING_DEFS[k].name/icon`
- [ ] Define the `caffactory` theme using the rebrand spreadsheet — items
      without a caffactory rename simply omit the key (fallback handles it)
- [ ] Add the three resolver functions to game.js
- [ ] Load `data/themes.js` from index.html before game.js
- [ ] Add `state.settings.theme = 'caffactory'` to `createState()` and the
      `applyStateFromEnvelope()` migration

Nothing should change visually yet — call sites still use ITEMS/BUILDING_DEFS.

### Phase 2 — migrate the worst call sites first (one subsystem per session)

The `buildingCard()` refactor is the biggest single win — ~19 call sites all
take hardcoded `(emoji, name)` pairs today.

- [ ] Change signature from `buildingCard(icon, name, count, ...)` to
      `buildingCard(type, count, ...)`. Inside, call `buildingDisplay(type)`.
- [ ] Update each call site (sed-friendly: `buildingCard('🔥', 'Stone Furnace', count` → `buildingCard('furnace', count`)
- [ ] Same pattern for any other hardcoded UI strings I find with grep

After this, the building tab is theme-aware. Toggle the theme and the
building cards instantly re-skin.

### Phase 3 — items + recipes

- [ ] Replace `ITEMS[k].name` reads → `itemDisplay(k).name`
- [ ] Replace `ITEMS[k].img` reads → `itemDisplay(k).img`
- [ ] Update `itemIcon(key)` helper to use `itemDisplay`
- [ ] Recipe-display routines (`buildCurrentRecipeDisplay`, recipe picker, etc.)

### Phase 4 — script editor aliases

The script.js auto-generates aliases from camelCase recipe keys. Today it
exposes only `iron_plate`. After this phase it exposes both `iron_plate` and
`aluminum_sheet` regardless of which theme is active — players can type either
in their scripts and pasted scripts from another player work on both themes.

- [ ] In `script.js`'s `SCRIPT_RECIPE_MAP` / `SCRIPT_TYPE_ALIASES`, merge
      `THEMES.factorio.scriptAliases` AND `THEMES.caffactory.scriptAliases` —
      both directions always available
- [ ] Document this in the script-editor help: "Either Factorio or Caff-Infinite
      names work; the theme setting only affects display."

### Phase 5 — canvas / base map

- [ ] Sprite path lookups in `_enemySprites`, `_oreImgs`, building map tiles
      → call `spriteSrc(key)` instead of hard-coding the path
- [ ] Image preloader: when theme changes, reload sprite cache
- [ ] In caffactory theme, biter sprites → use OSHA.png as base (we already have one)
- [ ] Building sprites on the base map: each building type needs a caffactory
      sprite path; fall back to the factorio sprite if missing

### Phase 6 — settings UI

- [ ] Add a `Theme` dropdown to the in-game Settings tab (per-save)
- [ ] On change, `state.settings.theme = newTheme; renderUI(); updateMap();`
- [ ] Persist via existing save flow (already saves `state.settings`)
- [ ] Optional: a one-time popup on first launch asking "Which theme?"

## Testing strategy

After each phase: open one save, toggle the theme, eyeball that all the
strings/images on the active tab change. Specifically check:

- Inventory tab — item names + icons
- Buildings tab — building cards + tooltips
- Research tab — research names + costs (uses item names)
- Recipes tab — recipe names + ingredient lists
- Defense tab — turret + wall names
- Base map canvas — buildings + enemies + ore patches
- Script editor — type `place(furnace, iron_plate, 1)` AND `place(microwave, aluminum_sheet, 1)` in both themes, both should work

## Files touched, by phase

| Phase | Files |
|---|---|
| 0 | game.js, data/recipes.js |
| 1 | NEW data/themes.js, index.html, game.js (resolvers + state init) |
| 2 | game.js (buildingCard + call sites) |
| 3 | game.js (renderInventory, recipe display, itemIcon), data/recipes.js |
| 4 | script.js (SCRIPT_RECIPE_MAP / SCRIPT_TYPE_ALIASES), data/themes.js |
| 5 | game.js (canvas drawing functions), preloader |
| 6 | index.html (Settings tab markup), game.js (renderSettings, save migration) |

## What NOT to do

- **Don't fork the recipe data.** Recipes (inputs/outputs/times) stay shared.
  Only display layer (names/icons/sprites) is theme-aware.
- **Don't store theme on each save.** Wait, actually — DO store it per save.
  Different saves can have different themes. State-level setting.
- **Don't strip old aliases from the script editor.** Always accept both names
  regardless of theme. Backward compat for saved scripts is non-negotiable.
- **Don't try to do all six phases in one session.** Each phase ships
  independently — the game stays playable between phases.

## Quick wins not on the plan

While doing Phase 0, also fix these (each ~5 min):

- `buildingCard` already takes a hardcoded emoji — once it's a `type` lookup,
  it'll auto-fix the building-tab-shows-emoji-not-image bug from the Code
  Issues sheet
- `gunTurretItem`, `laserTurretItem`, `artilleryTurretItem`, `stoneWall`
  don't have ITEMS entries at all — add them with both names so the toggle
  has something to switch
