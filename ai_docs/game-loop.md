# Game Loop

## Two-Loop Architecture

The game runs two independent loops:

| Loop | Rate | Purpose |
|---|---|---|
| **Simulation** (`tick`) | 5 Hz (`TICK_MS = 200`) | All game logic — production, power, biters, research |
| **Render** (`renderUI`) | ~30 Hz (`setInterval(..., 33)`) | UI updates only, no game state changes |

Both start in `showGame()` (`game.js:6760`):
```js
gameLoopId = setInterval(tick, TICK_MS);   // simulation
startRenderLoop();                          // render (~30fps via setInterval)
```

Numbers displayed to the player are **extrapolated** between simulation ticks via `displayAmt(key)` (`game.js:2944`), which projects the current inventory value forward using the known `inventoryDelta` rate to make counters feel smooth.

---

## `tick()` — Execution Order

`tick()` lives at `game.js:1921`. Every call represents `dt = 0.2s` of game time (scaled by `state.devTickSpeed` in dev mode).

### 0. Guard + Setup
```
if (_gamePaused) return
dt = TICK_MS / 1000 * devTickSpeed
```

### 1. Auto-save
Fires every `state.settings.autoSaveInterval` seconds (default 300). Guarded by `state.settings.autoSave`.

### 2. `buildGroupMap()`
Builds a cached snapshot `groups` of every building entry with `count > 0`. The cache is dirty-flagged (`_groupsDirty`) and rebuilt only when buildings change. Each entry is `{ key, type, resource, recipe, count }`.

### 3. Power Demand
Sums `BUILDING_KW_TABLE[type] * metaEnergyMult * count` for all enabled electric buildings. Laser turrets during an active wave add extra demand. Result stored in `state.powerDemandKw`.

`powerRatio = min(1, state.powerKw / totalDemand)` — computed here using **last tick's** `powerKw`. Electric buildings scale their output by `powerRatio`; coal/burner buildings do not.

### 4. Production Phase (`if !state.allPaused`)

Buildings run **in this fixed order**:

| Step | Building | Source | Notes |
|---|---|---|---|
| Coal | Burner miners, furnaces, steel furnaces | — | Checked before the miner/furnace steps; sets `gs.starved` |
| Burner miners | Ore patches → inventory | — | Skipped if starved or patch empty |
| Electric miners | Ore patches → inventory | `ELECTRIC_MINER_SPEED` | Scaled by `powerRatio`; uranium ore also consumes sulfuric acid |
| Stone furnaces | `FURNACE_RECIPES` | `recipe.time` | Priority-sorted (high-priority groups consume inputs first) |
| Steel furnaces | `FURNACE_RECIPES` | `STEEL_FURNACE_SPEED` | Same pattern |
| Assembly Mk1 | `PLAYER_RECIPES` | `ASSEMBLY_SPEED` | Power-scaled |
| Assembly Mk2 | `PLAYER_RECIPES` | `ASSEMBLY2_SPEED` | Power-scaled |
| Assembly Mk3 | `PLAYER_RECIPES` | `ASSEMBLY3_SPEED` | Power-scaled |
| Electric furnaces | `FURNACE_RECIPES` | `ELECTRIC_FURNACE_SPEED` | Power-scaled |
| Pumpjacks | Crude oil patch → inventory | `PUMPJACK_SPEED` | Power-scaled, patch depletes |
| Oil refineries | `PLAYER_RECIPES` | `OIL_REFINERY_SPEED` | Power-scaled |
| Chemical plants | `PLAYER_RECIPES` | `CHEMICAL_PLANT_SPEED` | Power-scaled |
| Centrifuges | `PLAYER_RECIPES` | `CENTRIFUGE_SPEED` | Special cases (see below) |
| Rocket silos | `PLAYER_RECIPES` | `ROCKET_SILO_SPEED` | Power-scaled |
| Offshore pumps | → `state.water` | `OFFSHORE_PUMP_WATER_PER_SEC` | No power dependency |
| Boilers | Coal + water → steam | `BOILER_COAL_PER_SEC` | Sets `gs.starved`/`gs.noWater` |
| Power generation | Solar → Nuclear → Steam → Accumulators | — | See below |
| Radar | — | `RADAR_CHUNK_TIME` | Reveals map chunks, power-scaled |
| Labs | Science packs → research | `techData.timePerPack` | Power-scaled; calls `completeResearch` when done |
| Hand crafting | `state.craftQueue` → `state.craftActive` | `recipe.time` | One item at a time |

### 5. Mark Seen Items
Any inventory item with `count > 0` gets added to `state.seen`. Used by UI to unlock display of new items.

### 6. Rate Snapshot (every 5 seconds)
Every `RATE_WINDOW_SECS = 5` seconds, derives production/consumption rates from the explicit `state.itemsProduced` / `state.itemsConsumed` counters (not from inventory diff). Results go into:
- `state.inventoryDelta` — net rate per item per second
- `state.productionRates` / `state.consumptionRates` — raw per-item rates
- `state.productionHistory.samples` — rolling 120-sample window for graphs

Every 60 seconds, an all-time snapshot is also pushed to `state.productionHistory.allTimeSamples`.

### 7. Auto-script
If `scriptAutoRun`, accumulates time and fires `runAutoScript()` every `SCRIPT_AUTO_INTERVAL = 10s`.

### 8. Biters
- Activates on first red science produced (with a configurable grace period).
- Ticks artillery damage accumulator between waves.
- Ticks `tickActiveWave(dt)` during an active wave.
- Refreshes wave-outcome simulation cache every 20s.
- On `biterTimer >= biterInterval()`: calls `fightBiterWave()`.
- At 30s warning: shows popup or notify.

### 9. Death Check
If biters enabled and all buildings destroyed → `handleRunEnd('death')`.

### 10. Tutorial Goals
Advances `state.tutorial.goalIndex` while `goal.check(state)` passes.

### 11. Auto-open Chests
`tickAutoOpenChests()` drains available chests if the setting is on.

---

## Key Patterns

### Group State (`gs = getGS(key)`)
Each building group has a persistent state object on `state.buildings[key]`. Common fields:

| Field | Meaning |
|---|---|
| `gs.acc` | Fractional production accumulator (integer floors trigger output) |
| `gs.coalAcc` | Fractional coal consumption accumulator |
| `gs.prodFrac[k]` | Fractional output for productivity bonus (avoids lost fractions) |
| `gs.progress` | Production cycles in progress (capped at `count * 4`) |
| `gs.activeCount` | How many buildings are actively working this tick |
| `gs.starved` | No fuel / no input |
| `gs.noPower` | Power ratio < 1 |
| `gs.limit` | Output cap (stops production when inventory hits this) |
| `gs.priority` | If true, this group is sorted before lower-priority groups when consuming shared inputs |

### Recipe Building Pattern
All recipe buildings (furnaces, assembly, refinery, etc.) follow the same pattern:

```
progress += activeCount * speedMult * powerRatio * BUILDING_SPEED / recipe.time * dt
cycles = floor(progress)
if cycles > 0:
    afford = howManyCanAfford(recipe.inputs, cycles)
    actual = min(afford, byLimit, cycles)      // also clamped by U-235 reserve
    consume inputs * actual
    produce outputs * actual * (1 + prodBonus) // accumulate fractions via prodFrac
    progress -= actual
```

`howManyCanAfford` (`game.js:1486`) returns how many full recipe cycles current inventory supports.

`clampByU235Reserve` (`game.js:1495`) keeps ≥50 U-235 in inventory as a buffer (so Kovarex always has seed material).

### Power Generation Order (`game.js:2570`)
1. **Solar** — always produces `count * SOLAR_PANEL_KW`, no fuel.
2. **Nuclear** — consumes uranium fuel cells at `NUCLEAR_FUEL_INTERVAL`; adds `count * NUCLEAR_REACTOR_KW`.
3. **Steam engines** — cover the remaining shortfall (`totalDemand * 1.05 - currentPowerKw`). Consume steam proportionally; idle (standby) if solar+nuclear already exceed demand.
4. **Accumulators** — charge from surplus, discharge into deficit.

### Recording Production/Consumption
`recordProduced(key, n)` and `recordConsumed(key, n)` (`game.js` ~line 1508) update both `state.inventory[key]` and the cumulative `state.itemsProduced[key]` / `state.itemsConsumed[key]` counters. The counters are used for rate calculation; inventory is what buildings actually run on.

### Centrifuge Special Cases
- **Uranium processing** (`uraniumProcessing` recipe): uses a 1-in-143 cycle counter stored in `state.uraniumProcessingCount` to produce U-235 vs U-238 (not a recipe ratio).
- **Kovarex** (`kovarexEnrichment` recipe): inputs and outputs both contain U-235, so only the **net** amounts are recorded to `itemsProduced`/`itemsConsumed` to avoid misleading stats.

### Priority Sort
Recipe buildings process groups sorted by `gs.priority` — high-priority groups consume their inputs first each tick. This lets the player ensure e.g. blue science assemblers always get iron plates before lower-priority groups.

---

## Files

| File | Relevance |
|---|---|
| `game.js:1921` | `tick()` — entire simulation function |
| `game.js:2929` | `startRenderLoop()` / `stopRenderLoop()` |
| `game.js:2944` | `displayAmt(key)` — smooth extrapolation for UI |
| `game.js:1457` | `buildGroupMap()` — cached building snapshot |
| `game.js:1486` | `howManyCanAfford()` |
| `game.js:1495` | `clampByU235Reserve()` |
| `game.js:6760` | `showGame()` — starts both loops |
| `game.js:5` | `TICK_MS = 200` |
| `game.js:1917` | `RATE_WINDOW_SECS = 5` |
