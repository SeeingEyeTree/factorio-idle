# Caff-Infinit — Steam Demo Release Plan

Target: **2 weeks from today, Fri Jul 31 → Fri Aug 14.**
Scope decided: metallic/industrial UI direction; demo covers the full current tech tree (no content cap) — the two weeks go toward stability and polish, not trimming.

## Definition of "finished demo"

A player can install the packaged build, play a full run — mining through the entire current tech tree, including at least one biter wave — without hitting a dead end, a silent data-loss bug, or an unstyled screen, and land on a run-end screen that points them to wishlist/Discord. `npm test` is green. The packaged `.exe` launches clean on a machine that's never had Node or Electron on it.

## The two tracks

Run these in parallel, not sequentially — the UI touches the whole app so it needs the full two weeks; the backend list is small enough for a Claude Code agent to clear in the first few days, then shift to support/QA for the rest of the sprint.

---

## Track A — UI (you), metallic/industrial

**Your deadline: UI feature-complete end of day Tue Aug 11.** That leaves Aug 12–14 as a joint bug-bash + packaging window before the Aug 14 ship date — don't eat into that buffer, it's where build-breaking surprises show up.

**Checkpoint: Wed Aug 6 (day 7).** By then you should have the shared palette done and 2–3 tabs fully reskinned. If you're not there, cut scope immediately (see below) rather than trying to make up time in week 2.

### Broad

- **One shared palette, not per-tab overrides.** `caffactory-theme.css` right now only styles `#tab-buildings` with hardcoded hex colors. Pull the metallic palette (steel, brushed-panel tan/white, the blue trim `#005082`/`#0088cc`) into CSS variables in `style.css`'s existing `:root` block — it already has ~2,300 lines built around `var(--bg)`, `var(--surf)`, `var(--accent)`, etc. Reusing those names means most of the app re-skins for free instead of needing a bespoke pass per tab.
- **Recommend keeping the dark chassis, not flipping it white.** Rather than replacing the dark UI outright, treat the current dark shell as the "machine housing" and the new light metallic panels as inset "screens" — closer to what the Buildings tab mock is already doing, much less rewrite than inverting the whole palette, and reads well for a factory game.
- **Cover the whole app, not just Buildings.** Base map chrome, Inventory, Crafting, Research, Defense, Recipes, Graph, Script, and Settings tabs are all still on the old plain dark look. Also don't forget the overlays that live outside the tab system: the wave-warning popup, run-end modal, tutorial popup, and the start screen — easy to miss since they're not under `#tab-buildings`.
- **If you're behind at the Aug 6 checkpoint, reskin by traffic, not by tab count.** Base, Buildings, Inventory, and Crafting are what a player stares at 90% of a run — finish those to a high bar and leave Graph/Script/Settings on the current clean dark theme rather than shipping a half-reskinned mess everywhere.

### Specific

1. `caffactory-theme.css` currently reskins the Buildings tab *shell* (section headers, card backgrounds) but the actual card contents — cost text, place button, inputs — are still using old dark-theme classes. Check contrast/readability now that the background went light.
2. The two background images (`metallic_panel_bg.jpg`, `panel_blue_trim.jpg`) are `background-attachment: fixed`, which can look broken once the panel scrolls or the window is resized — verify at real Electron window sizes before building the rest of the app around them.
3. Add a quick dev toggle (a body class you can flip from devtools, or bind to a key) to switch themes without restarting the game — worth 10 minutes now, saves a lot of reload cycles over the next two weeks.
4. Delete or move `recommendations/CARDBOARD_THEME_SPEC.md` and `Buildings - Cardboard.dc.html` out of the way (e.g. into an `unused/` folder) now that the metallic direction is chosen — leaving a fully-written competing spec in the repo root is an easy thing to build off by accident mid-sprint.
5. You'll need at least one tileable "brushed metal / chassis" background and one generic "inset screen/panel" treatment that isn't Buildings-tab-specific, so the other eight tabs don't each need a bespoke image.

---

## Track B — Claude Code agent (backend/content/stability)

Paste this to the agent directly. It's ordered — items 1–2 are urgent and small, do them first.

```
1. Fix two regressed bugs in game.js. Both were previously fixed and documented
   in recommendations/biter_bug_report.md (2026-07-14), but the fixes are gone
   from the current committed game.js and their regression tests are failing
   (2 of 107 tests fail on `npm test` right now — tests/biters.test.js lines
   242 and 262):

   a. Line ~1103: `if (state.biterThreatPoints > 5 && !state.research?.done?.rainbowScience)`
      checks the wrong key. The tech is registered as `rainbowSciencePack` in
      data/technologies.js (not `rainbowScience`). As written, this condition
      is always true post-rainbow, so it divides biterThreatPoints by 500 on
      EVERY load once past 5 points — silently resetting late-game difficulty
      each time the save is loaded. Fix the key to `rainbowSciencePack`.

   b. Line ~3978, inside `_showWaveWarningPopup()`: `state.biterWaveCount`
      does not exist on state; the real field is `state.biterWaveNumber`
      (used correctly everywhere else in the file). This makes the wave
      warning popup always show "Wave #1". Fix the reference.

   Run `npm test` after and confirm all tests pass (currently 105/107).

2. Normalize line endings. game.js, style.css, index.html, script.js, and
   several data/*.js files currently have inconsistent CRLF/LF and a stray
   BOM, which makes `git diff` show the entire file as changed on any edit
   (confirmed: current `git status` shows ~16,000 changed lines across 5
   files with zero real content changes). Add a .gitattributes pinning these
   to LF, run a one-time re-normalize, and commit it alone with no other
   changes, so diffs are meaningful for the rest of the sprint.

3. Full-tech-tree playtest pass. The demo scope is the entire current tech
   tree with no cap, so this is the main risk area. Use the existing script
   engine (tests/script.test.js shows the harness) to write an automation
   script that plays from a fresh save through every current technology,
   including triggering and surviving at least one biter wave. Flag: any
   unreachable tech, any recipe with a broken/unaffordable cost, any
   softlock, any place where required resources run out with no recovery
   path. Log findings rather than silently fixing balance — some of this
   needs a human call.

4. From recommendations/biter_bug_report.md's "Questionable behaviors"
   section — these were flagged but left for a decision. Given the demo
   now includes the full tree (so biters/combat get real playtime), please
   fix these two which are outright bugs rather than design questions:
     - Atomic bomb irradiation adds to biterThreatPoints with no cap, so it
       can push threat past the intended 1.0 linear cap pre-rainbow.
     - simulateNextWaveOutcome (wave preview) doesn't match how real waves
       resolve (different force-finalize timing, ignores artillery damage
       already dealt) — align the preview with actual resolution logic.
   Leave the other items (ammo/DPS during a wave, walls never breaking,
   OSHA enemy tier mapping) as a documented list for after the demo ships —
   they're balance/design calls, not bugs, and lower priority for two weeks.

5. Save-system stress test. This is a real Steam demo, so treat save/load
   like it'll hit players' actual files: test old-save migration paths,
   import/export, and autosave across a fresh run through the full tree.
   Confirm nothing in the migration logic silently drops or corrupts state
   (see bug #1 above for why this matters — it already happened once).

6. Packaging pass close to the end of the sprint (coordinate timing with me,
   ideally Aug 12-13): run `npm run compress-images` then `npm run dist`,
   install the packaged .exe on a clean Windows environment with no dev
   tools, and confirm it launches without console errors, dev-only UI
   (devMode toggle etc.) is off by default, and no dev-only folders
   (temp_python_scripts, examples, caffactory_rebrand.xlsx, .claude) made
   it into the package — package.json's --ignore list already tries to
   exclude these, just verify.

7. Add a Steam wishlist link. There's currently only a Discord link on the
   start screen (index.html line ~28) and no wishlist CTA anywhere,
   including on the run-end modal (handleRunEnd/showRunEndModal in game.js)
   where a player just finished a run and is most likely to click through.
   Add a wishlist link there once we have the Steam page URL.
```

---

## Final 3 days (Aug 12–14) — joint

- Bug bash: you play through on the new UI, agent (or you, feeding it findings) fixes anything logic-side that surfaces.
- Full packaged build installed fresh, played start-to-finish on a machine with no dev environment.
- `npm test` green, `git status` clean, tag the commit you're shipping.

## Verification before you commit to this plan

I found and confirmed two real regressions (item 1 above) by actually running `npm test` and reading the flagged lines in `game.js` — not guessing. Worth having the agent re-run the test suite as its very first action so you both start from the same "current broken state," not the assumption that last commit was clean.
