'use strict';
// Script engine tests: tokenizer, parser/evaluator, game commands, memory.
// These load the real script.js (via load-game.js) and exercise it headlessly.
//
// Run with:  npm test   (or: node --test tests/)

const { test } = require('node:test');
const assert   = require('node:assert');
const { loadGame } = require('./helpers/load-game');

// Helpers
function clearOutput(g) { g.run('scriptOutput = []'); }
function getOutput(g)   { return g.run('scriptOutput'); }

// Run a script, return the output lines (clears previous output first).
function run(g, src) {
  clearOutput(g);
  g.get('_executeScript')(src);
  return getOutput(g);
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

test('tokenizer: identifiers, numbers and operators are recognized', () => {
  const g = loadGame(); g.newGame();
  const tokens = g.get('tokenize')('x = 42');
  assert.ok(tokens.some(t => t.type === 'NAME'   && t.value === 'x'));
  assert.ok(tokens.some(t => t.type === 'OP'     && t.value === '='));
  assert.ok(tokens.some(t => t.type === 'NUMBER' && t.value === 42));
});

test('tokenizer: keywords get their own token types', () => {
  const g = loadGame(); g.newGame();
  const tokens = g.get('tokenize')('if True:\n    pass');
  assert.ok(tokens.some(t => t.type === 'IF'));
  assert.ok(tokens.some(t => t.type === 'TRUE'));
  assert.ok(tokens.some(t => t.type === 'PASS'));
});

test('tokenizer: indented block produces INDENT then DEDENT', () => {
  const g = loadGame(); g.newGame();
  const tokens = g.get('tokenize')('if True:\n    x = 1\nx = 2');
  assert.ok(tokens.some(t => t.type === 'INDENT'));
  assert.ok(tokens.some(t => t.type === 'DEDENT'));
});

test('tokenizer: string literals are captured with quotes stripped', () => {
  const g = loadGame(); g.newGame();
  const tokens = g.get('tokenize')('"hello world"');
  const str = tokens.find(t => t.type === 'STRING');
  assert.ok(str, 'expected a STRING token');
  assert.strictEqual(str.value, 'hello world');
});

test('tokenizer: comment lines are ignored', () => {
  const g = loadGame(); g.newGame();
  const tokens = g.get('tokenize')('# a comment\nx = 1');
  assert.ok(!tokens.some(t => t.type === 'NAME' && t.value === 'a'));
  assert.ok(tokens.some(t => t.type === 'NAME' && t.value === 'x'));
});

test('tokenizer: two-character operators are parsed as single tokens', () => {
  const g = loadGame(); g.newGame();
  const tokens = g.get('tokenize')('x <= 10');
  assert.ok(tokens.some(t => t.type === 'OP' && t.value === '<='));
});

// ── Evaluator: Arithmetic ─────────────────────────────────────────────────────

test('evaluator: operator precedence (* before +)', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(2 + 3 * 4)');
  assert.strictEqual(out[0].text, '14');
});

test('evaluator: floor division and modulo', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(7 // 2)\nprint(7 % 3)');
  assert.strictEqual(out[0].text, '3');
  assert.strictEqual(out[1].text, '1');
});

test('evaluator: power operator', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(2 ** 10)');
  assert.strictEqual(out[0].text, '1024');
});

test('evaluator: division by zero returns 0 (does not throw)', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(5 / 0)');
  assert.strictEqual(out[0].text, '0');
  assert.strictEqual(out[0].type, 'info');
});

test('evaluator: string concatenation with + operator', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print("hello" + " " + "world")');
  assert.strictEqual(out[0].text, 'hello world');
});

test('evaluator: augmented assignment operators', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'x = 10\nx += 5\nx -= 2\nx *= 3\nprint(x)');
  assert.strictEqual(out[0].text, '39');   // ((10+5)-2)*3 = 39
});

test('evaluator: unary negation', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(-7)');
  assert.strictEqual(out[0].text, '-7');
});

// ── Evaluator: Comparisons & booleans ────────────────────────────────────────

test('evaluator: comparison operators all work', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, [
    'print(1 == 1)',
    'print(1 != 2)',
    'print(2 > 1)',
    'print(1 < 2)',
    'print(2 >= 2)',
    'print(1 <= 2)',
  ].join('\n'));
  for (const line of out) assert.strictEqual(line.text, 'True', line.text);
});

test('evaluator: not operator inverts truthiness', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(not False)\nprint(not 0)\nprint(not 1)');
  assert.strictEqual(out[0].text, 'True');
  assert.strictEqual(out[1].text, 'True');
  assert.strictEqual(out[2].text, 'False');
});

test('evaluator: and returns last evaluated value', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(1 and 2)\nprint(0 and 2)');
  assert.strictEqual(out[0].text, '2');
  assert.strictEqual(out[1].text, '0');
});

test('evaluator: or returns first truthy value', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(0 or 3)\nprint(1 or 99)');
  assert.strictEqual(out[0].text, '3');
  assert.strictEqual(out[1].text, '1');
});

// ── Evaluator: Control flow ───────────────────────────────────────────────────

test('evaluator: if/elif/else selects the correct branch', () => {
  const g = loadGame(); g.newGame();
  const out = run(g,
    'x = 2\n' +
    'if x == 1:\n' +
    '    print("one")\n' +
    'elif x == 2:\n' +
    '    print("two")\n' +
    'else:\n' +
    '    print("other")'
  );
  assert.strictEqual(out[0].text, 'two');
});

test('evaluator: while loop with break', () => {
  const g = loadGame(); g.newGame();
  const out = run(g,
    'x = 0\n' +
    'while True:\n' +
    '    x += 1\n' +
    '    if x >= 3:\n' +
    '        break\n' +
    'print(x)'
  );
  assert.strictEqual(out[0].text, '3');
});

test('evaluator: for loop over range(n) sums correctly', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'total = 0\nfor i in range(5):\n    total += i\nprint(total)');
  assert.strictEqual(out[0].text, '10');   // 0+1+2+3+4 = 10
});

test('evaluator: range(start, stop) works', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'total = 0\nfor i in range(2, 5):\n    total += i\nprint(total)');
  assert.strictEqual(out[0].text, '9');    // 2+3+4 = 9
});

test('evaluator: range(start, stop, step) works', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'total = 0\nfor i in range(0, 10, 2):\n    total += i\nprint(total)');
  assert.strictEqual(out[0].text, '20');   // 0+2+4+6+8 = 20
});

test('evaluator: continue skips the rest of the loop body', () => {
  const g = loadGame(); g.newGame();
  const out = run(g,
    'total = 0\n' +
    'for i in range(5):\n' +
    '    if i == 2:\n' +
    '        continue\n' +
    '    total += i\n' +
    'print(total)'
  );
  assert.strictEqual(out[0].text, '8');    // 0+1+3+4 = 8 (skips 2)
});

test('evaluator: subscript access on an array literal', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'arr = [10, 20, 30]\nprint(arr[1])');
  assert.strictEqual(out[0].text, '20');
});

test('evaluator: out-of-bounds subscript returns None', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'arr = [1, 2]\nprint(arr[99])');
  assert.strictEqual(out[0].text, 'None');
});

// ── Evaluator: Functions ──────────────────────────────────────────────────────

test('evaluator: function definition and call with return value', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'def double(x):\n    return x * 2\nprint(double(7))');
  assert.strictEqual(out[0].text, '14');
});

test('evaluator: recursive function (fibonacci)', () => {
  const g = loadGame(); g.newGame();
  const out = run(g,
    'def fib(n):\n' +
    '    if n <= 1:\n' +
    '        return n\n' +
    '    return fib(n - 1) + fib(n - 2)\n' +
    'print(fib(7))'
  );
  assert.strictEqual(out[0].text, '13');
});

test('evaluator: function with multiple parameters', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'def add(a, b):\n    return a + b\nprint(add(3, 4))');
  assert.strictEqual(out[0].text, '7');
});

// ── print formatting ──────────────────────────────────────────────────────────

test('print: None, True, False format like Python', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(None)\nprint(True)\nprint(False)');
  assert.strictEqual(out[0].text, 'None');
  assert.strictEqual(out[1].text, 'True');
  assert.strictEqual(out[2].text, 'False');
});

test('print: multiple arguments are space-joined', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'print(1, 2, 3)');
  assert.strictEqual(out[0].text, '1 2 3');
});

// ── Error handling ────────────────────────────────────────────────────────────

test('calling a non-function is caught and logged as an error', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'not_a_function()');
  assert.strictEqual(out[0].type, 'error');
  assert.ok(out[0].text.includes('not a function'),
    `unexpected error message: ${out[0].text}`);
});

test('syntax errors in the script are caught and logged', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'if:\n    pass');   // missing condition
  assert.strictEqual(out[0].type, 'error');
});

test('while loop exceeding 10 000 iterations produces an error', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'while True:\n    pass');
  assert.strictEqual(out[0].type, 'error');
  assert.ok(out[0].text.includes('10 000'),
    `unexpected error message: ${out[0].text}`);
});

test('one script error does not prevent a second clean run', () => {
  const g = loadGame(); g.newGame();
  run(g, 'bad_call()');                  // first run fails
  const out = run(g, 'print("ok")');    // second run should succeed
  assert.strictEqual(out[0].type, 'info');
  assert.strictEqual(out[0].text, 'ok');
});

// ── Script context: inventory ─────────────────────────────────────────────────

test('buildScriptContext exposes inventory as SCREAMING_SNAKE_CASE', () => {
  const g = loadGame();
  const st = g.newGame();
  st.inventory.ironOre = 250;
  const ctx = g.get('buildScriptContext')();
  assert.strictEqual(ctx.IRON_ORE, 250);
});

test('buildScriptContext floors fractional inventory quantities', () => {
  const g = loadGame();
  const st = g.newGame();
  st.inventory.ironPlate = 99.9;
  const ctx = g.get('buildScriptContext')();
  assert.strictEqual(ctx.IRON_PLATE, 99);
});

test('buildScriptContext exposes power and water state', () => {
  const g = loadGame();
  const st = g.newGame();
  st.powerKw       = 1000;
  st.powerDemandKw = 800;
  const ctx = g.get('buildScriptContext')();
  assert.strictEqual(ctx.POWER_GEN,    1000);
  assert.strictEqual(ctx.POWER_DEMAND, 800);
});

test('buildScriptContext: placed furnace count is exposed as FURNACES', () => {
  const g = loadGame();
  const st = g.newGame();
  st.buildings['furnace:ironPlate'] = { type: 'furnace', recipe: 'ironPlate', count: 5 };
  const ctx = g.get('buildScriptContext')();
  assert.strictEqual(ctx.FURNACES, 5);
});

test('buildScriptContext: math helpers are present and callable', () => {
  const g = loadGame(); g.newGame();
  const ctx = g.get('buildScriptContext')();
  assert.strictEqual(ctx.floor(3.9), 3);
  assert.strictEqual(ctx.ceil(3.1),  4);
  assert.strictEqual(ctx.min(5, 3),  3);
  assert.strictEqual(ctx.max(5, 3),  5);
  assert.strictEqual(ctx.abs(-7),    7);
});

// ── Game commands inside scripts ──────────────────────────────────────────────

test('craft: unknown recipe emits a warning', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'craft("totally_fake_item", 1)');
  assert.strictEqual(out[0].type, 'warn');
  assert.ok(out[0].text.toLowerCase().includes('unknown recipe'));
});

test('craft: known unlocked recipe is queued in craftQueue', () => {
  const g = loadGame();
  const st = g.newGame();
  run(g, 'craft("iron_gear", 3)');
  // ironGear is not gated by any technology, so it is always unlocked
  assert.strictEqual(st.craftQueue.filter(e => e.key === 'ironGear').length, 3);
});

test('give: emits a warning when dev mode is off', () => {
  const g = loadGame();
  const st = g.newGame();
  st.devMode = false;
  const out = run(g, 'give("iron_ore", 100)');
  assert.strictEqual(out[0].type, 'warn');
  assert.ok(out[0].text.includes('dev mode'));
});

test('give: adds items to inventory when dev mode is on', () => {
  const g = loadGame();
  const st = g.newGame();
  st.devMode = true;
  run(g, 'give("iron_ore", 100)');
  assert.strictEqual(st.inventory.ironOre, 100);
});

test('give: unknown item name emits a warning even in dev mode', () => {
  const g = loadGame();
  const st = g.newGame();
  st.devMode = true;
  const out = run(g, 'give("completely_fake_item_xyz", 1)');
  assert.ok(out.some(l => l.type === 'warn'));
});

test('place: unknown building type emits a warning', () => {
  const g = loadGame(); g.newGame();
  const out = run(g, 'place("imaginary_machine", None, 1)');
  assert.strictEqual(out[0].type, 'warn');
  assert.ok(out[0].text.includes('unknown building type'));
});

test('limit: warns when no groups of that type have been placed', () => {
  const g = loadGame(); g.newGame();
  // No furnaces placed → no groups → limit warns
  const out = run(g, 'limit(furnace, 5)');
  assert.strictEqual(out[0].type, 'warn');
  assert.ok(out[0].text.toLowerCase().includes('no furnace'));
});

test('limit: applies to all matching groups when they exist', () => {
  const g = loadGame();
  const st = g.newGame();
  // Seed two furnace groups
  st.groupSettings['furnace:ironPlate']   = { enabled: true, limit: 100 };
  st.groupSettings['furnace:copperPlate'] = { enabled: true, limit: 100 };
  run(g, 'limit(furnace, 7)');
  assert.strictEqual(st.groupSettings['furnace:ironPlate'].limit,   7);
  assert.strictEqual(st.groupSettings['furnace:copperPlate'].limit, 7);
});

// ── Script memory ─────────────────────────────────────────────────────────────

test('MEM_ variables are saved into state.scriptMemory', () => {
  const g = loadGame();
  const st = g.newGame();
  run(g, 'MEM_counter = 42');
  assert.strictEqual(st.scriptMemory['MEM_counter'], 42);
});

test('MEM_ variables from a previous run are visible in the next run', () => {
  const g = loadGame();
  const st = g.newGame();
  st.scriptMemory['MEM_saved'] = 99;
  const out = run(g, 'print(MEM_saved)');
  assert.strictEqual(out[0].text, '99');
});

test('non-MEM_ variables do not persist to state.scriptMemory', () => {
  const g = loadGame();
  const st = g.newGame();
  run(g, 'local_var = 10');
  assert.ok(!('local_var' in st.scriptMemory));
});

// ── camelToSnake and recipe alias maps ───────────────────────────────────────

test('camelToSnake converts camelCase to snake_case', () => {
  const g = loadGame(); g.newGame();
  const c = g.get('camelToSnake');
  assert.strictEqual(c('ironGear'),             'iron_gear');
  assert.strictEqual(c('electronicCircuit'),    'electronic_circuit');
  assert.strictEqual(c('advancedOilProcessing'),'advanced_oil_processing');
});

test('SCRIPT_RECIPE_MAP contains auto-generated entries from PLAYER_RECIPES', () => {
  const g = loadGame(); g.newGame();
  const map = g.get('SCRIPT_RECIPE_MAP');
  assert.strictEqual(map['iron_gear'],   'ironGear',   'iron_gear → ironGear');
  assert.ok('iron_plate'    in map, 'iron_plate should be in the map');
  assert.ok('copper_plate'  in map, 'copper_plate should be in the map');
});

test('SCRIPT_RECIPE_EXTRA_ALIASES contain the documented shorthand names', () => {
  const g = loadGame(); g.newGame();
  const aliases = g.get('SCRIPT_RECIPE_EXTRA_ALIASES');
  assert.strictEqual(aliases.gear,    'ironGear');
  assert.strictEqual(aliases.cable,   'copperCable');
  assert.strictEqual(aliases.belt,    'transportBelt');
  assert.strictEqual(aliases.circuit, 'electronicCircuit');
  assert.strictEqual(aliases.lds,     'lowDensityStructure');
});
