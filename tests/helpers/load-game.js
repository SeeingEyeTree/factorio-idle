'use strict';
// Test harness: loads the real game code (data/*.js + game.js) into a vm
// context with just enough browser stubs that game logic runs headless.
//
// Usage:
//   const { loadGame } = require('./helpers/load-game');
//   const g = loadGame();                 // fresh isolated game instance
//   g.newGame();                          // create a real game state
//   g.get('fightBiterWave')();            // call real game functions

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const NUL  = String.fromCharCode(0);

// Scripts in the same order index.html loads them (script.js/calculator.js
// are UI-only and not needed for logic tests).
const SCRIPTS = [
  'data/recipes.js',
  'data/themes.js',
  'data/tech.js',
  'data/technologies.js',
  'game.js',
  'script.js',
];

function makeStubElement() {
  const el = {
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    style: {},
    dataset: {},
    children: [],
    textContent: '',
    innerHTML: '',
    value: '',
    src: '',
    offsetWidth: 0,
    appendChild() { return el; },
    removeChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return makeStubElement(); },
    querySelectorAll() { return []; },
    setAttribute() {},
    getAttribute() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    focus() {},
    click() {},
    closest() { return null; },
    insertAdjacentHTML() {},
    scrollIntoView() {},
  };
  return el;
}

function makeSandbox() {
  const storage = new Map();
  const localStorage = {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
    clear: () => storage.clear(),
  };

  const document = {
    addEventListener() {},
    removeEventListener() {},
    // Return null so functions with `if (!el) return` guards no-op cheaply.
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return makeStubElement(); },
    createTextNode() { return {}; },
    body: makeStubElement(),
    documentElement: makeStubElement(),
    hidden: false,
  };

  const sandbox = {
    console,
    document,
    localStorage,
    performance: { now: () => Date.now() },
    requestAnimationFrame: fn => setTimeout(fn, 0),
    cancelAnimationFrame: id => clearTimeout(id),
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: { userAgent: 'test' },
    alert() {}, confirm() { return true; },
    Image: function Image() { return makeStubElement(); },
    Audio: function Audio() { return { play() {}, pause() {} }; },
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function loadGame() {
  const context = vm.createContext(makeSandbox());
  for (const rel of SCRIPTS) {
    // Strip NUL padding that can appear as a file-sync artifact.
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(NUL).join('');
    vm.runInContext(code, context, { filename: rel });
  }

  const g = {
    context,
    /** Evaluate an expression/statement inside the game realm and return it. */
    run(code) { return vm.runInContext(code, context); },
    /** Get a top-level binding (function, let, const) from the game realm. */
    get(name) { return vm.runInContext(name, context); },
    /** Convenience: current `state` object (live reference). */
    get state() { return vm.runInContext('state', context); },

    /**
     * Create a fresh game state exactly like a new run, with biters on.
     * Returns the live state object.
     */
    newGame(settingsOverride = {}) {
      const settings = Object.assign(
        { biters: true, density: 'normal', tutorialEnabled: false, autoSave: false },
        settingsOverride,
      );
      context.__settings = settings;
      vm.runInContext('state = createState(__settings)', context);
      return this.state;
    },

    /**
     * Advance real game time by calling the actual tick() loop.
     * Runs the same fixed timestep the game uses (TICK_MS).
     */
    advance(seconds) {
      const TICK_MS = this.get('TICK_MS');
      const ticks = Math.round((seconds * 1000) / TICK_MS);
      const tick = this.get('tick');
      for (let i = 0; i < ticks; i++) tick();
    },
  };
  return g;
}

module.exports = { loadGame };
