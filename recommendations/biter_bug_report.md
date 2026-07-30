# Biter Code Review — Bugs & Recommendations (2026-07-14)

## Fixed in this pass

1. **Wave warning popup always showed "Wave #1"** — `_showWaveWarningPopup` read `state.biterWaveCount`, which doesn't exist (the real field is `biterWaveNumber`). Fixed, plus a regression test guards against reintroduction.

2. **Post-rainbow saves lost their threat scaling on every load** — the save migration in `applyStateFromEnvelope` checked `research.done.rainbowScience`, but the tech key is `rainbowSciencePack`. Any post-rainbow save with threat > 5 was divided by 500 on *every* load, silently resetting late-game difficulty. This was probably the most impactful bug. Fixed + two tests (rainbow saves preserved, old-scale saves still migrated).

3. **Wave popup never showed your defenses** — it counted lasers/artillery from `state.buildings` under types `laserTurret`/`artilleryTurret`, which are never placed there; perimeter defenses live in `state.perimeter.laserTurrets` / `.artillery`. Fixed to read from the perimeter.

## Questionable behaviors (your call — not changed)

- **One magazine = unlimited firepower during a wave.** `calcDefenseDPS` gives full gun DPS whenever inventory has ≥ 1 magazine; ammo is only consumed (capped at inventory) when the wave finalizes. A player holding exactly 1 magazine gets a whole wave of full DPS for ~1 magazine. Consider consuming ammo during `tickActiveWave` and zeroing gun DPS when it runs out.
- **Walls are never destroyed.** Wave combat depletes a wall-HP pool, but `perimeter.walls` is never decremented, even after full breach + overflow. If intended (walls as rechargeable HP), fine — otherwise walls should be lost on breach.
- **Space science shows the "OSHA" enemy tier before rainbow.** `getBiterEnemyTier` indexes `BITER_TIERS` by pack index, so `spaceScience` (index 6) maps to the final OSHA tier, which otherwise represents rainbow/endgame. Probably want space → 'Angry Bee' (index 5 cap pre-rainbow).
- **Atomic bomb irradiation bypasses the 1.0 linear threat cap.** `finalizeWave` adds `irradiationLevel × 0.001` directly to `biterThreatPoints` with no `Math.min(cap, …)`, so nuking pre-rainbow can push threat past the linear cap.
- **Preview vs. reality mismatch:** `simulateNextWaveOutcome` runs up to 3× the wave interval, but real waves force-finalize at 2×; the preview also ignores accumulated artillery damage, so it can predict losses for a wave artillery has already killed.
- **Dead code:** `getBiterTierData()` is never called.
- Typos in tutorial text (`carft`, `scailing`, `exponitially`, `unitl`) in the final tutorial goal.

## Unit tests added

- `tests/helpers/load-game.js` — harness that loads the real `data/*.js` + `game.js` into a Node `vm` with DOM stubs; gives each test a fresh, isolated game instance with `newGame()` and `advance(seconds)` (runs the actual `tick()` loop).
- `tests/biters.test.js` — 18 tests: wave stat scaling, science-tier detection, threat progression (linear rate, difficulty mult, 1.0 cap, rainbow exponential), dormancy until red science, wave scheduling through the real game loop, grace period, defended/undefended wave resolution, ammo cap, artillery pre-kill + no shell waste, `simulateNextWaveOutcome` purity, and regression tests for the fixed bugs.

Run with `npm test` (uses Node's built-in runner; no new dependencies). `tests` is excluded from the packaged build.
