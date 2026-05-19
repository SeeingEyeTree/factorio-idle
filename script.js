'use strict';

// ── Building alias maps derived from BUILDING_DEFS (game.js must load first) ──

// Maps script alias string → internal type key (e.g. 'am1' → 'assembly')
const SCRIPT_TYPE_ALIASES = Object.fromEntries(
  Object.entries(BUILDING_DEFS)
    .filter(([, v]) => v.scriptAlias)
    .map(([k, v]) => [v.scriptAlias, k])
);

// Maps script alias string → display name (e.g. 'am1' → 'Assembling Machine Mk1')
const SCRIPT_TYPE_DISPLAY = Object.fromEntries(
  Object.entries(BUILDING_DEFS)
    .filter(([, v]) => v.scriptAlias)
    .map(([k, v]) => [v.scriptAlias, v.name])
);

// ── Recipe alias maps derived from PLAYER_RECIPES + FURNACE_RECIPES ───────────
// Any new recipe added to recipes.js is automatically usable in scripts.

// Converts camelCase key to snake_case script identifier.
function camelToSnake(str) {
  return str.replace(/([A-Z])/g, m => '_' + m.toLowerCase());
}

// Auto-generated map: snake_case identifier → camelCase recipe key.
// One canonical alias per recipe — adding a recipe here propagates everywhere.
const SCRIPT_RECIPE_MAP = (function() {
  const map = {};
  const allRecipes = { ...FURNACE_RECIPES, ...PLAYER_RECIPES };
  for (const camelKey of Object.keys(allRecipes)) {
    map[camelToSnake(camelKey)] = camelKey;
  }
  return map;
})();

// Auto-generates snake_case aliases from the active theme's item and building names.
// Called at script execution time when `state` is available.
// Returns { itemAliases: {snake → camelItemKey}, buildingAliases: {snake → buildingType} }
function _buildThemeAliases() {
  const _s = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const theme = THEMES?.[state?.settings?.theme] ?? {};
  const itemAliases     = {};
  const buildingAliases = {};
  for (const [key, ov] of Object.entries(theme.items ?? {})) {
    if (ov.name) itemAliases[_s(ov.name)] = key;
  }
  for (const [type, ov] of Object.entries(theme.buildings ?? {})) {
    if (ov.name) buildingAliases[_s(ov.name)] = type;
  }
  return { itemAliases, buildingAliases };
}

// Shorthand / legacy aliases that supplement the auto-generated canonical names.
// Format: script identifier → camelCase recipe key.
// Add new shorthands here; the canonical snake_case name is always available too.
const SCRIPT_RECIPE_EXTRA_ALIASES = {
  // Shorthands (shorter than the full canonical name)
  gear:                'ironGear',            // canonical: wooden_gear
  cable:               'copperCable',
  belt:                'transportBelt',
  engine:              'engineUnit',
  electric_engine:     'electricEngineUnit',    // canonical: electric_engine_unit
  plastic:             'plasticBar',
  circuit:             'electronicCircuit',      // canonical: electronic_circuit
  green_circuit:       'electronicCircuit',
  red_circuit:         'advancedCircuit',
  blue_circuit:        'processingUnit',
  lds:                 'lowDensityStructure',
  ammo:                'firearmMagazine',
  piercing:            'piercingRoundsMag',      // canonical: piercing_rounds_mag
  piercing_rounds:     'piercingRoundsMag',
  construction_robot:  'constructionRobotItem',  // canonical: construction_robot_item
  kovarex:             'kovarexEnrichment',       // canonical: kovarex_enrichment
  // Oil-processing friendly names
  basic_oil:           'basicOilProcessing',     // canonical: basic_oil_processing
  advanced_oil:        'advancedOilProcessing',  // canonical: advanced_oil_processing
  // solid_fuel defaults to the light-oil variant; use canonical names for others
  solid_fuel:          'solidFuelLight',         // canonical: solid_fuel_light
  // Science pack legacy / Factorio internal names
  science_pack_1:      'redScience',
  science_pack_2:      'greenScience',
  science_pack_3:      'blueScience',
  military_science:    'blackScience',
  production_science:  'purpleScience',
  utility_science:     'yellowScience',
};

// ── Tokenizer ─────────────────────────────────────────────────

function tokenize(src) {
  const KEYWORDS = {
    if:'IF', elif:'ELIF', else:'ELSE', while:'WHILE', for:'FOR',
    in:'IN', and:'AND', or:'OR', not:'NOT',
    pass:'PASS', break:'BREAK', continue:'CONTINUE',
    True:'TRUE', False:'FALSE', None:'NONE',
    def:'DEF', return:'RETURN',
  };
  const tokens = [];
  const lines = src.replace(/\t/g, '    ').split('\n');
  const stack = [0];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.trimStart().startsWith('#')) continue;

    let indent = 0;
    while (indent < line.length && line[indent] === ' ') indent++;

    if (indent > stack[stack.length - 1]) {
      stack.push(indent);
      tokens.push({ type: 'INDENT' });
    } else {
      while (indent < stack[stack.length - 1]) { stack.pop(); tokens.push({ type: 'DEDENT' }); }
    }

    let pos = indent;
    while (pos < line.length) {
      if (line[pos] === ' ') { pos++; continue; }
      if (line[pos] === '#') break;

      if (line[pos] === '"' || line[pos] === "'") {
        const q = line[pos++]; let s = '';
        while (pos < line.length && line[pos] !== q) s += line[pos++];
        if (pos < line.length) pos++;
        tokens.push({ type: 'STRING', value: s }); continue;
      }

      if (/\d/.test(line[pos])) {
        let s = '';
        while (pos < line.length && /[\d.]/.test(line[pos])) s += line[pos++];
        tokens.push({ type: 'NUMBER', value: parseFloat(s) }); continue;
      }

      if (/[a-zA-Z_]/.test(line[pos])) {
        let s = '';
        while (pos < line.length && /[a-zA-Z0-9_]/.test(line[pos])) s += line[pos++];
        const kw = KEYWORDS[s];
        tokens.push(kw ? { type: kw } : { type: 'NAME', value: s }); continue;
      }

      const two = line.slice(pos, pos + 2);
      if (['<=', '>=', '==', '!=', '**', '//', '+=', '-=', '*=', '/='].includes(two)) {
        tokens.push({ type: 'OP', value: two }); pos += 2; continue;
      }
      tokens.push({ type: 'OP', value: line[pos++] });
    }
    tokens.push({ type: 'NEWLINE' });
  }

  while (stack.length > 1) { stack.pop(); tokens.push({ type: 'DEDENT' }); }
  tokens.push({ type: 'EOF' });
  return tokens;
}

// ── Parser ────────────────────────────────────────────────────

class ScriptParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos    = 0;
  }

  peek()    { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }

  eat(type, value) {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value))
      throw new Error(`Expected ${type}${value !== undefined ? ' "' + value + '"' : ''}, got ${t.type}${t.value !== undefined ? ' "' + t.value + '"' : ''}`);
    return this.advance();
  }

  eatNewlines() { while (this.peek().type === 'NEWLINE') this.advance(); }

  parseProgram() {
    this.eatNewlines();
    const body = [];
    while (this.peek().type !== 'EOF') {
      body.push(this.parseStatement());
      this.eatNewlines();
    }
    return { type: 'program', body };
  }

  parseBlock() {
    this.eat('NEWLINE');
    this.eat('INDENT');
    const body = [];
    this.eatNewlines();
    while (this.peek().type !== 'DEDENT' && this.peek().type !== 'EOF') {
      body.push(this.parseStatement());
      this.eatNewlines();
    }
    if (this.peek().type === 'DEDENT') this.advance();
    return body;
  }

  parseStatement() {
    const t = this.peek();

    if (t.type === 'PASS')     { this.advance(); this.eat('NEWLINE'); return { type: 'pass' }; }
    if (t.type === 'BREAK')    { this.advance(); this.eat('NEWLINE'); return { type: 'break' }; }
    if (t.type === 'CONTINUE') { this.advance(); this.eat('NEWLINE'); return { type: 'continue' }; }

    if (t.type === 'DEF')    return this.parseFuncDef();
    if (t.type === 'RETURN') return this.parseReturn();
    if (t.type === 'IF')    return this.parseIf();
    if (t.type === 'WHILE') return this.parseWhile();
    if (t.type === 'FOR')   return this.parseFor();

    // Assignment, augmented assignment, or expression statement
    if (t.type === 'NAME') {
      const next = this.tokens[this.pos + 1];
      if (next?.type === 'OP' && next.value === '=') {
        const name = this.advance().value;
        this.advance();
        const value = this.parseExpr();
        this.eat('NEWLINE');
        return { type: 'assign', name, value };
      }
      if (next?.type === 'OP' && ['+=', '-=', '*=', '/='].includes(next.value)) {
        const name = this.advance().value;
        const op   = this.advance().value;
        const value = this.parseExpr();
        this.eat('NEWLINE');
        return { type: 'augassign', name, op, value };
      }
      // Subscript assignment: name[idx] = val
      if (next?.type === 'OP' && next.value === '[') {
        const savedPos = this.pos;
        const name = this.advance().value;
        this.advance(); // consume '['
        const idx = this.parseExpr();
        this.eat('OP', ']');
        if (this.peek().type === 'OP' && this.peek().value === '=') {
          this.advance();
          const value = this.parseExpr();
          this.eat('NEWLINE');
          return { type: 'subscript_assign', name, idx, value };
        }
        this.pos = savedPos; // not an assignment, fall through
      }
    }

    const expr = this.parseExpr();
    this.eat('NEWLINE');
    return { type: 'expr', value: expr };
  }

  parseIf() {
    this.eat('IF');
    const test = this.parseExpr();
    this.eat('OP', ':');
    const body = this.parseBlock();
    this.eatNewlines();

    // Collect elif / else
    const elifs = [];
    while (this.peek().type === 'ELIF') {
      this.advance();
      const etest = this.parseExpr();
      this.eat('OP', ':');
      const ebody = this.parseBlock();
      this.eatNewlines();
      elifs.push({ type: 'if', test: etest, body: ebody, orelse: [] });
    }
    let elsePart = [];
    if (this.peek().type === 'ELSE') {
      this.advance();
      this.eat('OP', ':');
      elsePart = this.parseBlock();
      this.eatNewlines();
    }

    // Chain: elif N's orelse = elif N+1 (or else body)
    let orelse = elsePart;
    for (let i = elifs.length - 1; i >= 0; i--) {
      elifs[i].orelse = orelse;
      orelse = [elifs[i]];
    }
    return { type: 'if', test, body, orelse };
  }

  parseWhile() {
    this.eat('WHILE');
    const test = this.parseExpr();
    this.eat('OP', ':');
    const body = this.parseBlock();
    return { type: 'while', test, body };
  }

  parseFor() {
    this.eat('FOR');
    const target = this.eat('NAME').value;
    this.eat('IN');
    const iter = this.parseExpr();
    this.eat('OP', ':');
    const body = this.parseBlock();
    return { type: 'for', target, iter, body };
  }

  parseFuncDef() {
    this.eat('DEF');
    const name = this.eat('NAME').value;
    this.eat('OP', '(');
    const params = [];
    while (!(this.peek().type === 'OP' && this.peek().value === ')')) {
      params.push(this.eat('NAME').value);
      if (this.peek().type === 'OP' && this.peek().value === ',') this.advance();
    }
    this.eat('OP', ')');
    this.eat('OP', ':');
    const body = this.parseBlock();
    return { type: 'funcdef', name, params, body };
  }

  parseReturn() {
    this.eat('RETURN');
    let value = null;
    if (this.peek().type !== 'NEWLINE' && this.peek().type !== 'EOF') {
      value = this.parseExpr();
    }
    this.eat('NEWLINE');
    return { type: 'return', value };
  }

  parseExpr()    { return this.parseOr(); }

  parseOr() {
    let left = this.parseAnd();
    while (this.peek().type === 'OR') {
      this.advance();
      left = { type: 'boolop', op: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.peek().type === 'AND') {
      this.advance();
      left = { type: 'boolop', op: 'and', left, right: this.parseNot() };
    }
    return left;
  }

  parseNot() {
    if (this.peek().type === 'NOT') {
      this.advance();
      return { type: 'unop', op: 'not', operand: this.parseNot() };
    }
    return this.parseCompare();
  }

  parseCompare() {
    let left = this.parseAdd();
    const CMP = ['==', '!=', '<', '>', '<=', '>='];
    while (this.peek().type === 'OP' && CMP.includes(this.peek().value)) {
      const op    = this.advance().value;
      const right = this.parseAdd();
      left = { type: 'compare', op, left, right };
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    while (this.peek().type === 'OP' && ['+', '-'].includes(this.peek().value)) {
      const op    = this.advance().value;
      const right = this.parseMul();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    while (this.peek().type === 'OP' && ['*', '/', '//', '%'].includes(this.peek().value)) {
      const op    = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'binop', op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (this.peek().type === 'OP' && this.peek().value === '-') {
      this.advance();
      return { type: 'unop', op: '-', operand: this.parsePower() };
    }
    return this.parsePower();
  }

  parsePower() {
    const base = this.parseAtom();
    if (this.peek().type === 'OP' && this.peek().value === '**') {
      this.advance();
      return { type: 'binop', op: '**', left: base, right: this.parseUnary() };
    }
    return base;
  }

  parseAtom() {
    const t = this.peek();

    if (t.type === 'NUMBER') { this.advance(); return { type: 'num',  n: t.value }; }
    if (t.type === 'STRING') { this.advance(); return { type: 'str',  s: t.value }; }
    if (t.type === 'TRUE')   { this.advance(); return { type: 'bool', b: true  }; }
    if (t.type === 'FALSE')  { this.advance(); return { type: 'bool', b: false }; }
    if (t.type === 'NONE')   { this.advance(); return { type: 'none' }; }

    // Array literal: [expr, expr, ...]
    if (t.type === 'OP' && t.value === '[') {
      this.advance();
      const elems = [];
      while (!(this.peek().type === 'OP' && this.peek().value === ']')) {
        elems.push(this.parseExpr());
        if (this.peek().type === 'OP' && this.peek().value === ',') this.advance();
      }
      this.eat('OP', ']');
      return { type: 'array', elems };
    }

    if (t.type === 'NAME') {
      this.advance();
      let node;
      if (this.peek().type === 'OP' && this.peek().value === '(') {
        this.advance();
        const args = [];
        while (!(this.peek().type === 'OP' && this.peek().value === ')')) {
          args.push(this.parseExpr());
          if (this.peek().type === 'OP' && this.peek().value === ',') this.advance();
        }
        this.eat('OP', ')');
        node = { type: 'call', func: t.value, args };
      } else {
        node = { type: 'name', id: t.value };
      }
      // Subscript access: node[idx][idx]...
      while (this.peek().type === 'OP' && this.peek().value === '[') {
        this.advance();
        const idx = this.parseExpr();
        this.eat('OP', ']');
        node = { type: 'subscript', obj: node, idx };
      }
      return node;
    }

    if (t.type === 'OP' && t.value === '(') {
      this.advance();
      const expr = this.parseExpr();
      this.eat('OP', ')');
      return expr;
    }

    throw new Error(`Unexpected token: ${t.type}${t.value !== undefined ? ' "' + t.value + '"' : ''}`);
  }
}

// ── Evaluator ─────────────────────────────────────────────────

const _BREAK    = Symbol('break');
const _CONTINUE = Symbol('continue');
const _RETURN   = Symbol('return');

class ScriptEvaluator {
  constructor(context, funcs) {
    this.ctx   = context;
    this.vars  = {};
    this.funcs = funcs ?? {};
    this.steps = 0;
  }

  step() {
    if (++this.steps > 100000) throw new Error('Script exceeded step limit — possible infinite loop');
  }

  lookup(name) {
    if (name in this.vars)  return this.vars[name];
    if (name in this.funcs) return this.funcs[name];
    if (name in this.ctx)   return this.ctx[name];
    return 0;
  }

  assign(name, value) {
    this.vars[name] = value;
    if (name.startsWith('MEM_') && state?.scriptMemory != null)
      state.scriptMemory[name] = value;
    if (name === 'VERBOSE') _scriptVerbose = value;
  }

  execProgram(ast) { return this.execBlock(ast.body); }

  execBlock(stmts) {
    for (const stmt of stmts) {
      const r = this.execStmt(stmt);
      if (r === _BREAK || r === _CONTINUE || r === _RETURN) return r;
    }
    return null;
  }

  execStmt(stmt) {
    this.step();
    switch (stmt.type) {
      case 'pass':     return null;
      case 'break':    return _BREAK;
      case 'continue': return _CONTINUE;
      case 'program':  return this.execBlock(stmt.body);

      case 'assign': {
        this.assign(stmt.name, this.evalExpr(stmt.value));
        return null;
      }

      case 'subscript_assign': {
        const obj = this.lookup(stmt.name);
        const idx = this.evalExpr(stmt.idx);
        const val = this.evalExpr(stmt.value);
        if (Array.isArray(obj) || (typeof obj === 'object' && obj !== null)) obj[idx] = val;
        return null;
      }

      case 'funcdef': {
        const ev = this;
        this.funcs[stmt.name] = function(...args) {
          const child = new ScriptEvaluator(ev.ctx, ev.funcs);
          child.steps = ev.steps;
          for (let i = 0; i < stmt.params.length; i++) {
            child.vars[stmt.params[i]] = args[i] ?? null;
          }
          child.execBlock(stmt.body);
          ev.steps = child.steps;
          return child._returnValue ?? null;
        };
        return null;
      }

      case 'return': {
        this._returnValue = stmt.value ? this.evalExpr(stmt.value) : null;
        return _RETURN;
      }

      case 'augassign': {
        const cur = this.lookup(stmt.name);
        const rhs = this.evalExpr(stmt.value);
        let v;
        switch (stmt.op) {
          case '+=': v = cur + rhs; break;
          case '-=': v = cur - rhs; break;
          case '*=': v = cur * rhs; break;
          case '/=': v = rhs !== 0 ? cur / rhs : 0; break;
          default:   v = cur;
        }
        this.assign(stmt.name, v);
        return null;
      }

      case 'expr': {
        this.evalExpr(stmt.value);
        return null;
      }

      case 'if': {
        if (this.truthy(this.evalExpr(stmt.test)))
          return this.execBlock(stmt.body);
        if (stmt.orelse?.length) {
          if (stmt.orelse.length === 1 && stmt.orelse[0]?.type === 'if') return this.execStmt(stmt.orelse[0]);
          return this.execBlock(stmt.orelse);
        }
        return null;
      }

      case 'while': {
        let iters = 0;
        while (this.truthy(this.evalExpr(stmt.test))) {
          this.step();
          if (++iters > 10000) throw new Error('while loop exceeded 10 000 iterations');
          const r = this.execBlock(stmt.body);
          if (r === _BREAK) break;
          if (r === _RETURN) return _RETURN;
          // _CONTINUE just falls through to next iteration
        }
        return null;
      }

      case 'for': {
        const it = this.evalExpr(stmt.iter);
        if (!Array.isArray(it)) throw new Error(`for: expected list, got ${typeof it}`);
        for (const item of it) {
          this.step();
          this.assign(stmt.target, item);
          const r = this.execBlock(stmt.body);
          if (r === _BREAK) break;
          if (r === _RETURN) return _RETURN;
        }
        return null;
      }

      default: throw new Error(`Unknown statement: ${stmt.type}`);
    }
  }

  evalExpr(expr) {
    this.step();
    switch (expr.type) {
      case 'num':  return expr.n;
      case 'str':  return expr.s;
      case 'bool': return expr.b;
      case 'none': return null;
      case 'name': return this.lookup(expr.id);

      case 'call': {
        const fn = this.lookup(expr.func);
        if (typeof fn !== 'function') throw new Error(`${expr.func} is not a function`);
        return fn(...expr.args.map(a => this.evalExpr(a)));
      }

      case 'binop': {
        const l = this.evalExpr(expr.left);
        const r = this.evalExpr(expr.right);
        switch (expr.op) {
          case '+':  return (typeof l === 'string' || typeof r === 'string') ? String(l ?? '') + String(r ?? '') : l + r;
          case '-':  return l - r;
          case '*':  return l * r;
          case '/':  return r !== 0 ? l / r : 0;
          case '//': return r !== 0 ? Math.floor(l / r) : 0;
          case '%':  return r !== 0 ? ((l % r) + r) % r : 0;
          case '**': return Math.pow(l, r);
          default:   return 0;
        }
      }

      case 'unop': {
        const v = this.evalExpr(expr.operand);
        if (expr.op === '-')   return -v;
        if (expr.op === 'not') return !this.truthy(v);
        return v;
      }

      case 'compare': {
        const l = this.evalExpr(expr.left);
        const r = this.evalExpr(expr.right);
        switch (expr.op) {
          case '==': return l == r;   // loose equality, matches Python behaviour for 0 == False
          case '!=': return l != r;
          case '<':  return l < r;
          case '>':  return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          default:   return false;
        }
      }

      case 'boolop': {
        const lv = this.evalExpr(expr.left);
        if (expr.op === 'and') return this.truthy(lv) ? this.evalExpr(expr.right) : lv;
        if (expr.op === 'or')  return this.truthy(lv) ? lv : this.evalExpr(expr.right);
        return false;
      }

      case 'array': return expr.elems.map(e => this.evalExpr(e));

      case 'subscript': {
        const obj = this.evalExpr(expr.obj);
        const idx = this.evalExpr(expr.idx);
        if (Array.isArray(obj)) return (idx >= 0 && idx < obj.length) ? obj[idx] : null;
        if (typeof obj === 'string') return obj[idx] ?? null;
        if (typeof obj === 'object' && obj !== null) return obj[idx] ?? null;
        return null;
      }

      default: throw new Error(`Unknown expression: ${expr.type}`);
    }
  }

  truthy(v) { return v !== null && v !== undefined && v !== false && v !== 0 && v !== ''; }
}

// ── Script Context Builder ─────────────────────────────────────

function _camelToScream(str) {
  return str.replace(/([A-Z])/g, '_$1').toUpperCase();
}

function buildScriptContext() {
  const inv      = state.inventory       ?? {};
  const delta    = state.inventoryDelta  ?? {};
  const bldgs    = state.buildings       ?? {};
  const p        = state.perimeter       ?? {};
  const research = state.research        ?? {};
  const pq       = placeQueue.slice(_placeHead);

  const countType  = t => Object.values(bldgs).filter(g => g.type === t).reduce((s, g) => s + g.count, 0);
  const countMiner = (t, r) => bldgs[`${t}:${r}`]?.count ?? 0;

  // Aliases derived from the active theme's item/building names — auto-update when themes.js changes.
  const { itemAliases: _tItems, buildingAliases: _tBldgs } = _buildThemeAliases();

  const ctx = {};

  // ── Inventory + delta (all ITEMS)
  for (const key of Object.keys(ITEMS ?? {})) {
    const v = _camelToScream(key);
    ctx[v]          = Math.floor(inv[key] ?? 0);
    ctx['DELTA_' + v] = delta[key] ?? 0;
  }

  // ── Themed inventory variables: e.g. BLAST_FURNACE → stoneFurnaceItem count
  for (const [alias, key] of Object.entries(_tItems)) {
    const v = alias.toUpperCase();
    ctx[v]            = Math.floor(inv[key] ?? 0);
    ctx['DELTA_' + v] = delta[key] ?? 0;
    ctx[alias]        = alias;  // snake_case identifier for craft()/give() calls
  }
  // Themed building identifiers: e.g. blast_furnace → resolves to 'furnace' in place()/limit()
  for (const alias of Object.keys(_tBldgs)) {
    ctx[alias] = alias;
  }

  // ── Building counts
  ctx.MINERS_IRON     = countMiner('miner', 'ironOre');
  ctx.MINERS_COPPER   = countMiner('miner', 'copperOre');
  ctx.MINERS_COAL     = countMiner('miner', 'coal');
  ctx.MINERS_STONE    = countMiner('miner', 'stone');
  ctx.E_MINERS_IRON   = countMiner('electricMiner', 'ironOre');
  ctx.E_MINERS_COPPER = countMiner('electricMiner', 'copperOre');
  ctx.E_MINERS_COAL   = countMiner('electricMiner', 'coal');
  ctx.E_MINERS_STONE  = countMiner('electricMiner', 'stone');
  ctx.FURNACES          = countType('furnace');
  ctx.STEEL_FURNACES    = countType('steelFurnace');
  ctx.ELECTRIC_FURNACES = countType('electricFurnace');
  ctx.ASSEMBLERS   = countType('assembly');
  ctx.ASSEMBLERS2  = countType('assembly2');
  ctx.ASSEMBLERS3  = countType('assembly3');
  ctx.LABS         = countType('lab');
  ctx.BOILERS      = countType('boiler');
  ctx.STEAM_ENGINES = countType('steamEngine');
  ctx.PUMPS        = countType('offshoreP');
  ctx.RADARS       = countType('radar');
  ctx.SOLAR_PANELS  = countType('solarPanel');
  ctx.ACCUMULATORS  = countType('accumulator');
  ctx.PUMPJACKS     = countType('pumpjack');
  ctx.OIL_REFINERIES  = countType('oilRefinery');
  ctx.CHEMICAL_PLANTS = countType('chemicalPlant');
  ctx.CENTRIFUGES   = countType('centrifuge');
  ctx.ROCKET_SILOS  = countType('rocketSilo');
  ctx.NUCLEAR_REACTORS = countType('nuclearReactor');
  ctx.CHUNKS_EXPLORED  = state.chunksRevealed ?? 0;

  // ── Inventory building item counts (how many of each building you have in stock, not placed)
  for (const [type, def] of Object.entries(BUILDING_DEFS)) {
    const itemKey = getBuildingItemKey(type);
    if (itemKey) {
      const varName = 'INV_' + type.replace(/([A-Z])/g, '_$1').toUpperCase();
      ctx[varName] = Math.floor(inv[itemKey] ?? 0);
    }
  }
  // Short-name backwards-compat aliases (no INV_ prefix) for common building types
  ctx.ELECTRIC_MINER    = Math.floor(inv.electricMinerItem    ?? 0);
  ctx.BURNER_MINER      = Math.floor(inv.burnerMinerItem      ?? 0);
  ctx.STONE_FURNACE     = Math.floor(inv.stoneFurnaceItem     ?? 0);
  ctx.STEEL_FURNACE_INV = Math.floor(inv.steelFurnaceItem     ?? 0);  // STEEL_FURNACE already used for placed count
  ctx.ELEC_FURNACE      = Math.floor(inv.electricFurnaceItem  ?? 0);
  ctx.ASSEMBLY_ITEM     = Math.floor(inv.assemblyMachine1Item ?? 0);
  ctx.ASSEMBLY2_ITEM    = Math.floor(inv.assemblyMachine2Item ?? 0);
  ctx.ASSEMBLY3_ITEM    = Math.floor(inv.assemblyMachine3Item ?? 0);
  ctx.LAB_ITEM          = Math.floor(inv.labItem              ?? 0);
  ctx.BOILER_ITEM       = Math.floor(inv.boilerItem           ?? 0);
  ctx.STEAM_ENGINE_ITEM = Math.floor(inv.steamEngineItem      ?? 0);
  ctx.OFFSHORE_P_ITEM   = Math.floor(inv.offshorePumpItem     ?? 0);
  ctx.RADAR_ITEM        = Math.floor(inv.radarItem            ?? 0);
  ctx.SOLAR_PANEL_ITEM  = Math.floor(inv.solarPanelItem       ?? 0);
  ctx.ACCUMULATOR_ITEM  = Math.floor(inv.accumulatorItem      ?? 0);
  ctx.OIL_REFINERY_ITEM = Math.floor(inv.oilRefineryItem      ?? 0);
  ctx.CHEM_PLANT_ITEM   = Math.floor(inv.chemicalPlantItem    ?? 0);
  ctx.CENTRIFUGE_ITEM   = Math.floor(inv.centrifugeItem       ?? 0);
  ctx.ROCKET_SILO_ITEM  = Math.floor(inv.rocketSiloItem       ?? 0);
  ctx.PUMPJACK_ITEM     = Math.floor(inv.pumpjackItem         ?? 0);
  ctx.NUCLEAR_REACTOR_ITEM = Math.floor(inv.nuclearReactorItem ?? 0);
  ctx.GUN_TURRET_ITEM   = Math.floor(inv.gunTurretItem        ?? 0);
  ctx.LASER_TURRET_ITEM = Math.floor(inv.laserTurretItem      ?? 0);

  // ── Modules (in inventory, not installed)
  ctx.SPEED_MODULE   = Math.floor(inv.speedModule            ?? 0);
  ctx.SPEED_MODULE_2 = Math.floor(inv.speedModule2           ?? 0);
  ctx.SPEED_MODULE_3 = Math.floor(inv.speedModule3           ?? 0);
  ctx.PROD_MODULE    = Math.floor(inv.productivityModule      ?? 0);
  ctx.PROD_MODULE_2  = Math.floor(inv.productivityModule2    ?? 0);
  ctx.PROD_MODULE_3  = Math.floor(inv.productivityModule3    ?? 0);
  ctx.GAMER_MODULE   = Math.floor(inv.gamerModule            ?? 0);

  // ── Power
  ctx.POWER_GEN       = state.powerKw         ?? 0;
  ctx.POWER_DEMAND    = state.powerDemandKw   ?? 0;
  ctx.POWER_RATIO     = state.powerRatio      ?? 1;
  ctx.ACCUMULATOR_CHARGE = state.accumulatorCharge ?? 0;
  ctx.ACCUMULATOR_MAX    = countType('accumulator') * ACCUMULATOR_CAPACITY;
  ctx.WATER = Math.floor(state.water ?? 0);
  ctx.STEAM = Math.floor(state.steam ?? 0);

  // ── Biters / perimeter
  ctx.BITER_WAVE  = state.biterWaveNumber ?? 0;
  ctx.BITER_TIMER = state.biterTimer      ?? 0;
  const pSide = p.sideLength ?? 10;
  ctx.PERIMETER_SIDE          = pSide;
  ctx.PERIMETER_CONCRETE_COST = (2 * pSide + 1) * 10;  // concrete needed for next expansion
  ctx.PERIMETER_WALLS         = p.walls          ?? 0;
  ctx.PERIMETER_GUN_TURRETS   = p.gunTurrets      ?? 0;
  ctx.PERIMETER_LASER_TURRETS = p.laserTurrets    ?? 0;
  ctx.PERIMETER_TILES         = 4 * pSide;
  ctx.PERIMETER_MAX_WALLS     = 4 * pSide * WALLS_PER_TILE;
  ctx.PERIMETER_MAX_TURRETS   = 4 * pSide * TURRETS_PER_TILE;

  // ── Research levels
  ctx.ROBOT_SPEED_LEVEL  = research.robotSpeedLevel  ?? 0;
  ctx.ROBOT_CARGO_LEVEL  = research.robotCargoLevel  ?? 0;
  ctx.MINING_PROD_LEVEL  = research.miningProdLevel  ?? 0;
  ctx.GUN_DAMAGE_LEVEL   = research.gunDamageLevel   ?? 0;
  ctx.LASER_DAMAGE_LEVEL = research.laserDamageLevel ?? 0;

  // ── Build queue variables
  ctx.Q_len    = pq.reduce((s, b) => s + b.count, 0);
  ctx.Q_miners = pq.filter(b => b.type === 'miner' || b.type === 'electricMiner').reduce((s, b) => s + b.count, 0);
  const { batch: placeBatchSize } = computePlaceTimeSec();
  ctx.PLACE_BATCH = placeBatchSize;  // buildings placed per placement interval

  // ── Persistent script memory (MEM_*)
  for (const [k, v] of Object.entries(state.scriptMemory ?? {})) {
    ctx[k] = v;
  }

  // ── Verbosity flag (VERBOSE = 0 suppresses "Queued N×" output lines)
  ctx.VERBOSE = 1;

  // ── Math helpers
  ctx.floor = Math.floor;
  ctx.ceil  = Math.ceil;
  ctx.round = Math.round;
  ctx.abs   = Math.abs;
  ctx.min   = Math.min;
  ctx.max   = Math.max;
  ctx.sqrt  = Math.sqrt;
  ctx.pow   = Math.pow;

  // ── range(n) / range(a, b) / range(a, b, step)
  ctx.range = function(a, b, step) {
    const arr = [];
    if (b === undefined) { for (let i = 0; i < a; i++) arr.push(i); }
    else {
      const s = step ?? 1;
      if (s > 0) for (let i = a; i < b; i += s) arr.push(i);
      else if (s < 0) for (let i = a; i > b; i += s) arr.push(i);
    }
    return arr;
  };

  // ── print
  ctx.print = function(...args) {
    const fmt  = a => a === null || a === undefined ? 'None' : a === true ? 'True' : a === false ? 'False' : String(a);
    const text = args.map(fmt).join(' ');
    scriptOutput.push({ type: 'info', text });
  };

  // ── Building type aliases (allow bare identifiers: place(e_drill, coal))
  ctx.e_drill = 'e_drill'; ctx.electric_drill = 'e_drill'; ctx.electric_miner = 'e_miner'; ctx.e_miner = 'e_miner';
  ctx.miner = 'miner'; ctx.burner = 'miner'; ctx.burner_miner = 'miner';
  ctx.furnace = 'furnace'; ctx.stone_furnace = 'furnace';
  ctx.steel_furnace = 'steel_furnace'; ctx.electric_furnace = 'electric_furnace';
  ctx.assembler = 'assembly'; ctx.assembly = 'assembly';
  ctx.am1 = 'am1'; ctx.am2 = 'am2'; ctx.am3 = 'am3';
  ctx.lab = 'lab'; ctx.boiler = 'boiler'; ctx.steam_engine = 'steamEngine';
  ctx.pump = 'pump'; ctx.offshore_pump = 'pump';
  ctx.radar = 'radar'; ctx.solar = 'solarPanel'; ctx.solar_panel = 'solarPanel';
  ctx.accumulator = 'accumulator'; ctx.pumpjack = 'pumpjack';
  ctx.oil_refinery = 'oilRefinery'; ctx.refinery = 'oilRefinery';
  ctx.chemical_plant = 'chemicalPlant'; ctx.chem = 'chemicalPlant';
  ctx.centrifuge = 'centrifuge';
  ctx.rocket_silo = 'rocketSilo'; ctx.silo = 'rocketSilo';
  ctx.nuclear_reactor = 'nuclearReactor'; ctx.reactor = 'nuclearReactor';
  // Resource aliases (for place/limit with miners)
  ctx.iron = 'iron'; ctx.iron_ore = 'iron_ore';
  ctx.copper = 'copper'; ctx.copper_ore = 'copper_ore';
  ctx.coal = 'coal'; ctx.stone = 'stone';
  ctx.oil = 'oil'; ctx.crude_oil = 'crude_oil';
  ctx.uranium = 'uranium'; ctx.uranium_ore = 'uranium_ore';
  // Recipe aliases — auto-generated from PLAYER_RECIPES + FURNACE_RECIPES.
  // Any new recipe added to recipes.js is automatically available as a script identifier.
  for (const snakeKey of Object.keys(SCRIPT_RECIPE_MAP)) {
    ctx[snakeKey] = snakeKey;
  }
  // Extra shorthand / legacy aliases (defined in SCRIPT_RECIPE_EXTRA_ALIASES above).
  for (const aliasKey of Object.keys(SCRIPT_RECIPE_EXTRA_ALIASES)) {
    ctx[aliasKey] = aliasKey;
  }

  // ── expand(n=1) — expand perimeter n times using concrete
  ctx.expand = function(n) {
    const times = typeof n === 'number' ? Math.max(1, Math.floor(n)) : 1;
    let expanded = 0;
    for (let i = 0; i < times; i++) {
      const sl      = state.perimeter?.sideLength ?? 10;
      const newSL   = sl + 1;
      const needed  = newSL * newSL;
      const chunks  = state.chunksRevealed ?? 0;
      if (chunks < needed) {
        if (expanded === 0) scriptOutput.push({ type: 'warn', text: `expand: need ${needed - chunks} more explored chunks (for side ${newSL})` });
        break;
      }
      const concreteCost = (2 * sl + 1) * 10;
      if ((state.inventory.concrete ?? 0) < concreteCost) {
        if (expanded === 0) scriptOutput.push({ type: 'warn', text: `expand: need ${concreteCost} concrete (have ${Math.floor(state.inventory.concrete ?? 0)})` });
        break;
      }
      expandPerimeter();
      expanded++;
    }
    if (expanded > 0)
      scriptOutput.push({ type: 'info', text: `Expanded ×${expanded} → side ${state.perimeter.sideLength}` });
  };

  // ── devmode() — toggle dev mode
  ctx.devmode = function() {
    const on = !state.devMode;
    toggleDevMode(on);
    scriptOutput.push({ type: 'info', text: on ? '🛠 Dev mode enabled' : 'Dev mode disabled' });
  };

  // ── give(item, n=1) — add items (dev mode only)
  ctx.give = function(item, n) {
    if (!state.devMode) { scriptOutput.push({ type: 'warn', text: 'give: dev mode required' }); return; }
    const GIVE_MAP = {
      iron_ore: 'ironOre', iron: 'ironOre', copper_ore: 'copperOre', copper: 'copperOre',
      coal: 'coal', stone: 'stone', crude_oil: 'crudeOil', oil: 'crudeOil',
      uranium_ore: 'uraniumOre', uranium: 'uraniumOre',
      iron_plate: 'ironPlate', copper_plate: 'copperPlate', stone_brick: 'stoneBrick',
      steel: 'steel', iron_gear: 'ironGear', gear: 'ironGear',
      copper_cable: 'copperCable', cable: 'copperCable',
      pipe: 'pipe', iron_stick: 'ironStick',
      circuit: 'electronicCircuit', green_circuit: 'electronicCircuit', electronic_circuit: 'electronicCircuit',
      advanced_circuit: 'advancedCircuit', red_circuit: 'advancedCircuit',
      processing_unit: 'processingUnit', blue_circuit: 'processingUnit',
      inserter: 'inserter', transport_belt: 'transportBelt', belt: 'transportBelt',
      engine_unit: 'engineUnit', engine: 'engineUnit',
      electric_engine: 'electricEngineUnit', electric_engine_unit: 'electricEngineUnit',
      flying_robot_frame: 'flyingRobotFrame',
      plastic_bar: 'plasticBar', plastic: 'plasticBar',
      sulfur: 'sulfur', sulfuric_acid: 'sulfuricAcid',
      battery: 'battery', lubricant: 'lubricant', explosives: 'explosives',
      solid_fuel: 'solidFuel', rocket_fuel: 'rocketFuel',
      low_density_structure: 'lowDensityStructure', lds: 'lowDensityStructure',
      rocket_control_unit: 'rocketControlUnit', rocket_part: 'rocketPart',
      science_pack_1: 'redScience', red_science: 'redScience',
      science_pack_2: 'greenScience', green_science: 'greenScience',
      science_pack_3: 'blueScience', blue_science: 'blueScience',
      military_science: 'blackScience', black_science: 'blackScience',
      production_science: 'purpleScience', purple_science: 'purpleScience',
      utility_science: 'yellowScience', yellow_science: 'yellowScience',
      space_science: 'spaceScience',
      uranium235: 'uranium235', uranium238: 'uranium238',
      uranium_fuel_cell: 'uraniumFuelCell', nuclear_fuel: 'nuclearFuel',
      concrete: 'concrete',
      firearm_magazine: 'firearmMagazine', ammo: 'firearmMagazine',
      piercing_rounds: 'piercingRoundsMag', piercing: 'piercingRoundsMag',
      heavy_oil: 'heavyOil', light_oil: 'lightOil', petroleum_gas: 'petroleumGas',
      water: 'water', steam: 'steam',
    };
    const raw    = String(item ?? '');
    const camel  = raw.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const key    = GIVE_MAP[raw] ?? _tItems[raw] ?? (ITEMS[camel] ? camel : raw);
    const count  = typeof n === 'number' ? Math.max(1, Math.floor(n)) : 1;
    if (!key) { scriptOutput.push({ type: 'warn', text: 'give: item name required' }); return; }
    if (!ITEMS[key]) { scriptOutput.push({ type: 'warn', text: `give: unknown item "${key}"` }); return; }
    state.inventory[key] = (state.inventory[key] ?? 0) + count;
    if (count > 0) state.seen[key] = true;
    scriptOutput.push({ type: 'info', text: `Gave ${count.toLocaleString()}× ${ITEMS[key].name}` });
  };

  // ── place(type, arg, n=1, module=null)
  ctx.place = function(type, arg, n, mod) {
    scriptPlaceBuilding(String(type ?? ''), arg != null ? String(arg) : null, n, mod != null ? String(mod) : null);
  };

  // ── research(name)
  ctx.research = function(name) {
    if (name == null) return;
    scriptDoResearch(String(name));
  };

  // ── craft(item, n=1)
  ctx.craft = function(item, n) {
    const count = typeof n === 'number' ? Math.max(1, Math.floor(n)) : 1;
    scriptDoCraft(String(item ?? ''), count);
  };

  // ── fortify(type, n=1)
  ctx.fortify = function(type, n) {
    const typeMap = {
      walls: 'walls', wall: 'walls', stone_wall: 'walls',
      gun: 'gunTurrets', gun_turret: 'gunTurrets', gun_turrets: 'gunTurrets',
      laser: 'laserTurrets', laser_turret: 'laserTurrets', laser_turrets: 'laserTurrets',
    };
    const realType = typeMap[String(type ?? '')] ?? String(type ?? '');
    const amount   = typeof n === 'number' ? Math.max(1, Math.floor(n)) : 1;
    addPerimeterDefense(realType, amount);
  };

  // ── limit(type, amount) or limit(type, recipe, amount)
  ctx.limit = function(type, recipeOrAmount, amount) {
    // Extended alias map: covers multi-word and legacy aliases beyond SCRIPT_TYPE_ALIASES
    const TYPE_MAP = {
      ..._tBldgs,            // theme building name aliases (lowest priority)
      ...SCRIPT_TYPE_ALIASES,
      burner_miner: 'miner', burner: 'miner',
      electric_drill: 'electricMiner', electric_miner: 'electricMiner', e_miner: 'electricMiner',
      stone_furnace: 'furnace',
      electric_furnace: 'electricFurnace',
      assembly: 'assembly', assembler: 'assembly', am1: 'assembly', assembly1: 'assembly',
      assembly2: 'assembly2', assembler2: 'assembly2',
      assembly3: 'assembly3', assembler3: 'assembly3',
      steam_engine: 'steamEngine', solar_panel: 'solarPanel',
      acc: 'accumulator',
      offshore_pump: 'offshoreP', offshore: 'offshoreP',
      oil_pump: 'pumpjack',
      oil_refinery: 'oilRefinery',
      chemical_plant: 'chemicalPlant', chem_plant: 'chemicalPlant',
      rocket_silo: 'rocketSilo',
      nuclear_reactor: 'nuclearReactor', nuclear: 'nuclearReactor',
    };
    const RECIPE_MAP = { ...SCRIPT_RECIPE_MAP, ...SCRIPT_RECIPE_EXTRA_ALIASES };
    const RESOURCE_MAP = {
      iron: 'ironOre', iron_ore: 'ironOre', copper: 'copperOre', copper_ore: 'copperOre',
      coal: 'coal', stone: 'stone', oil: 'crudeOil', crude_oil: 'crudeOil',
      uranium: 'uraniumOre', uranium_ore: 'uraniumOre',
    };

    const realType = TYPE_MAP[String(type ?? '')] ?? String(type ?? '');

    if (amount === undefined) {
      // 2-arg form: limit(type, n) — apply to all existing groups of this type
      const n = typeof recipeOrAmount === 'number' ? Math.max(0, recipeOrAmount) : 0;
      let count = 0;
      for (const [key, gs] of Object.entries(state.groupSettings ?? {})) {
        if (key === realType || key.startsWith(realType + ':')) {
          gs.limit = n;
          count++;
        }
      }
      if (count > 0)
        scriptOutput.push({ type: 'info', text: `limit: ${realType} → ${n} (${count} group${count !== 1 ? 's' : ''})` });
      else
        scriptOutput.push({ type: 'warn', text: `limit: no ${realType} groups placed yet` });
    } else {
      // 3-arg form: limit(type, recipe, n) — set specific group
      const n       = typeof amount === 'number' ? Math.max(0, amount) : 0;
      const argStr  = String(recipeOrAmount ?? '');
      const realArg = RECIPE_MAP[argStr] ?? RESOURCE_MAP[argStr] ?? argStr;
      const key     = `${realType}:${realArg}`;
      getGS(key).limit = n;
      scriptOutput.push({ type: 'info', text: `limit: ${key} → ${n}` });
    }
  };

  return ctx;
}

// ── scriptPlaceBuilding ───────────────────────────────────────

function scriptPlaceBuilding(type, arg, n, moduleType) {
  const MODULE_ALIAS = {
    speed_module: 'speedModule',   speed1: 'speedModule',   speed_1: 'speedModule',
    speed_module_2: 'speedModule2', speed2: 'speedModule2',  speed_2: 'speedModule2',
    speed_module_3: 'speedModule3', speed3: 'speedModule3',  speed_3: 'speedModule3',
    productivity_module: 'productivityModule',   prod1: 'productivityModule',  prod_1: 'productivityModule',
    productivity_module_2: 'productivityModule2', prod2: 'productivityModule2', prod_2: 'productivityModule2',
    productivity_module_3: 'productivityModule3', prod3: 'productivityModule3', prod_3: 'productivityModule3',
  };
  if (moduleType) {
    moduleType = MODULE_ALIAS[moduleType] ?? moduleType;
    if (!MODULE_DATA[moduleType]) {
      scriptOutput.push({ type: 'warn', text: `place: unknown module "${moduleType}"` });
      moduleType = null;
    }
  }
  // Extended alias map: covers multi-word and legacy aliases beyond the single SCRIPT_TYPE_ALIASES entry per type
  const TYPE_MAP = {
    ..._buildThemeAliases().buildingAliases,  // theme building name aliases (lowest priority)
    ...SCRIPT_TYPE_ALIASES,
    burner_miner: 'miner', burner: 'miner',
    electric_drill: 'electricMiner', electric_miner: 'electricMiner', e_miner: 'electricMiner',
    stone_furnace: 'furnace',
    electric_furnace: 'electricFurnace',
    assembly: 'assembly', assembler: 'assembly', am1: 'assembly', assembly1: 'assembly',
    assembly2: 'assembly2', assembler2: 'assembly2',
    assembly3: 'assembly3', assembler3: 'assembly3',
    steam_engine: 'steamEngine', steamengine: 'steamEngine',
    solar_panel: 'solarPanel', solar: 'solarPanel',
    acc: 'accumulator',
    offshore_pump: 'offshoreP', offshore: 'offshoreP',
    oil_pump: 'pumpjack',
    oil_refinery: 'oilRefinery',
    chemical_plant: 'chemicalPlant', chem_plant: 'chemicalPlant',
    rocket_silo: 'rocketSilo',
    nuclear_reactor: 'nuclearReactor', nuclear: 'nuclearReactor',
  };

  const RESOURCE_MAP = {
    iron: 'ironOre', iron_ore: 'ironOre',
    copper: 'copperOre', copper_ore: 'copperOre',
    coal: 'coal',
    stone: 'stone',
    oil: 'crudeOil', crude_oil: 'crudeOil',
    uranium: 'uraniumOre', uranium_ore: 'uraniumOre',
  };

  // Combined recipe map: canonical auto-generated names + extra shorthands.
  const RECIPE_MAP = { ...SCRIPT_RECIPE_MAP, ...SCRIPT_RECIPE_EXTRA_ALIASES };

  const realType = TYPE_MAP[type] ?? type;
  const costs    = BUILDING_COSTS[realType];

  if (!costs) {
    scriptOutput.push({ type: 'warn', text: `place: unknown building type "${type}"` });
    return;
  }
  const _displayName = BUILDING_DEFS[realType]?.name ?? realType;

  if (!isUnlocked('building', realType)) {
    scriptOutput.push({ type: 'warn', text: `place: ${_displayName} is locked (research required)` });
    return;
  }

  // Allow place(type, count) for buildings that don't take a recipe/resource arg
  const NO_ARG_TYPES = new Set(['boiler','steamEngine','offshoreP','radar','solarPanel',
                                'accumulator','nuclearReactor','lab','pumpjack']);
  if (n == null && arg != null && NO_ARG_TYPES.has(realType) && /^\d+(\.\d+)?$/.test(arg)) {
    n = parseFloat(arg);
    arg = null;
  }

  const count = typeof n === 'number' ? Math.max(1, Math.floor(n)) : 1;
  const pr    = state.placementRecipes ?? defaultPlacementRecipes();

  // Miners: per-item loop (checks drillCountForResource cap each iteration)
  if (realType === 'miner' || realType === 'electricMiner') {
    const resource = (arg ? (RESOURCE_MAP[arg] ?? arg) : null) ?? pr[realType] ?? 'ironOre';
    let actualCount = 0;
    for (let i = 0; i < count; i++) {
      if (!canAfford(costs)) { if (i === 0) scriptOutput.push({ type: 'warn', text: `place: can't afford ${_displayName}` }); break; }
      if (drillCountForResource(resource) + actualCount >= maxDrillsForResource(resource)) {
        if (i === 0) scriptOutput.push({ type: 'warn', text: `place: max drills reached for ${resource}` });
        break;
      }
      spend(costs);
      actualCount++;
    }
    if (actualCount > 0) {
      const t = { type: realType, resource, count: actualCount };
      if (moduleType) t.initModuleType = moduleType;
      placeQueue.push(t);
      if (_scriptVerbose !== 0) scriptOutput.push({ type: 'info', text: `Queued ${actualCount}× ${_displayName}` });
      if (!placing) processNextPlacement();
    }
    return;
  }

  // All other types: batch — one queue entry for all N, spend all at once
  const actualCount = howManyCanAfford(costs, count);
  if (actualCount === 0) {
    scriptOutput.push({ type: 'warn', text: `place: can't afford ${_displayName}` });
    return;
  }
  if (actualCount < count) {
    scriptOutput.push({ type: 'warn', text: `place: can only afford ${actualCount}/${count} ${_displayName}` });
  }

  // Validate recipe before spending
  let recipe = null;
  if (BUILDING_DEFS[realType]?.hasRecipe) {
    recipe = (arg ? (RECIPE_MAP[arg] ?? arg) : null) ?? pr[realType] ?? '';
    if (recipe && !isUnlocked('recipe', recipe)) {
      scriptOutput.push({ type: 'warn', text: `place: recipe "${recipe}" is locked` });
      return;
    }
  }

  // Batch spend
  for (const [k, qty] of Object.entries(costs)) {
    state.inventory[k] = (state.inventory[k] ?? 0) - qty * actualCount;
  }

  const target = { type: realType, count: actualCount };
  if (realType === 'pumpjack') target.resource = 'crudeOil';
  else if (recipe !== null)    target.recipe   = recipe;
  if (moduleType) target.initModuleType = moduleType;

  placeQueue.push(target);
  scriptOutput.push({ type: 'info', text: `Queued ${actualCount}× ${_displayName}` });
  if (!placing) processNextPlacement();
}

// ── scriptDoResearch ──────────────────────────────────────────

function scriptDoResearch(name) {
  const lower = name.toLowerCase().trim();

  // Infinite tech direct key
  if (INFINITE_TECH_PREREQS?.[name]) { startInfiniteTech(name); return; }

  // Infinite tech aliases
  const INF_ALIAS = {
    'robot speed': 'robot:speed', 'robot:speed': 'robot:speed', 'robotspeed': 'robot:speed',
    'worker robot speed': 'robot:speed',
    'robot cargo': 'robot:cargo', 'robot:cargo': 'robot:cargo', 'robotcargo': 'robot:cargo',
    'worker robot cargo size': 'robot:cargo',
    'mining productivity': 'mining:productivity', 'mining:productivity': 'mining:productivity',
    'gun damage': 'gun:damage', 'gun:damage': 'gun:damage', 'physical projectile damage': 'gun:damage',
    'laser damage': 'laser:damage', 'laser:damage': 'laser:damage', 'laser weapons damage': 'laser:damage',
  };
  const infKey = INF_ALIAS[lower];
  if (infKey) { startInfiniteTech(infKey); return; }

  // Regular tech by key
  if (TECHNOLOGIES?.[name]) { startResearch(name); return; }

  // Regular tech by display name (case-insensitive)
  for (const [key, tech] of Object.entries(TECHNOLOGIES ?? {})) {
    if (tech.name?.toLowerCase() === lower) { startResearch(key); return; }
  }

  scriptOutput.push({ type: 'warn', text: `research: unknown tech "${name}"` });
}

// ── scriptDoCraft ─────────────────────────────────────────────

function scriptDoCraft(item, n) {
  const ALIAS = {
    iron_gear: 'ironGear', gear: 'ironGear',
    copper_cable: 'copperCable', cable: 'copperCable',
    pipe: 'pipe', iron_stick: 'ironStick',
    circuit: 'electronicCircuit', green_circuit: 'electronicCircuit', electronic_circuit: 'electronicCircuit',
    advanced_circuit: 'advancedCircuit', red_circuit: 'advancedCircuit',
    processing_unit: 'processingUnit', blue_circuit: 'processingUnit',
    iron_plate: 'ironPlate', copper_plate: 'copperPlate', stone_brick: 'stoneBrick', steel: 'steel',
    engine_unit: 'engineUnit', engine: 'engineUnit',
    electric_engine: 'electricEngineUnit', electric_engine_unit: 'electricEngineUnit',
    flying_robot_frame: 'flyingRobotFrame', robot_frame: 'flyingRobotFrame',
    construction_robot: 'constructionRobotItem',
    red_science: 'redScience', green_science: 'greenScience', blue_science: 'blueScience',
    black_science: 'blackScience', purple_science: 'purpleScience', yellow_science: 'yellowScience',
    plastic: 'plasticBar', plastic_bar: 'plasticBar',
    battery: 'battery', lubricant: 'lubricant', sulfur: 'sulfur', sulfuric_acid: 'sulfuricAcid',
    explosives: 'explosives', solid_fuel: 'solidFuelLight', rocket_fuel: 'rocketFuel',
    inserter: 'inserter', transport_belt: 'transportBelt', belt: 'transportBelt',
    low_density_structure: 'lowDensityStructure', lds: 'lowDensityStructure',
    concrete: 'concrete', landfill: 'landfill', rail: 'rail', repair_pack: 'repairPack',
    firearm_magazine: 'firearmMagazine', ammo: 'firearmMagazine',
    piercing_rounds: 'piercingRoundsMag', piercing: 'piercingRoundsMag',
    uranium_rounds: 'uraniumRoundsMag',
    uranium_fuel_cell: 'uraniumFuelCell', nuclear_fuel: 'nuclearFuel',
    stone_furnace: 'stoneFurnaceItem', steel_furnace: 'steelFurnaceItem',
    electric_furnace: 'electricFurnaceItem', burner_miner: 'burnerMinerItem',
    electric_miner: 'electricMinerItem',
    assembly_machine: 'assemblyMachine1Item', am1: 'assemblyMachine1Item',
    assembly_machine2: 'assemblyMachine2Item', am2: 'assemblyMachine2Item',
    assembly_machine3: 'assemblyMachine3Item', am3: 'assemblyMachine3Item',
    offshore_pump: 'offshorePumpItem', boiler: 'boilerItem', steam_engine: 'steamEngineItem',
    solar_panel: 'solarPanelItem', accumulator: 'accumulatorItem',
    radar: 'radarItem', lab: 'labItem', pumpjack: 'pumpjackItem',
    oil_refinery: 'oilRefineryItem', chemical_plant: 'chemicalPlantItem',
    centrifuge: 'centrifugeItem', rocket_silo: 'rocketSiloItem',
    nuclear_reactor: 'nuclearReactorItem',
    heat_pipe: 'heatPipeItem', heat_exchanger: 'heatExchangerItem', steam_turbine: 'steamTurbineItem',
    speed_module: 'speedModule', speed_module2: 'speedModule2', speed_module3: 'speedModule3',
    productivity_module: 'productivityModule', productivity_module2: 'productivityModule2',
    productivity_module3: 'productivityModule3',
    beacon: 'beaconItem',
    grenade: 'grenade', slowdown_capsule: 'slowdownCapsule', poison_capsule: 'poisonCapsule',
    artillery_shell: 'artilleryShell', atomic_bomb: 'atomicBomb',
    satellite: 'satellite', spidertron: 'spidertron',
    locomotive: 'locomotive', artillery_wagon: 'artilleryWagon',
    gun_turret: 'gunTurretItem', laser_turret: 'laserTurretItem',
    stone_wall: 'stoneWall',
  };

  const key = ALIAS[item] ?? _buildThemeAliases().itemAliases[item] ?? item;
  if (!PLAYER_RECIPES?.[key]) {
    scriptOutput.push({ type: 'warn', text: `craft: unknown recipe "${item}"` });
    return;
  }
  if (!isUnlocked('recipe', key)) {
    scriptOutput.push({ type: 'warn', text: `craft: recipe "${key}" is locked` });
    return;
  }

  for (let i = 0; i < n; i++) state.craftQueue.push({ key });
  if (_scriptVerbose !== 0) scriptOutput.push({ type: 'info', text: `Queued ${n}× ${PLAYER_RECIPES[key].name}` });
}

// ── Runner helpers ────────────────────────────────────────────

function _executeScript(src) {
  _scriptVerbose = 1;
  try {
    const tokens    = tokenize(src);
    const ast       = new ScriptParser(tokens).parseProgram();
    const ctx       = buildScriptContext();
    const evaluator = new ScriptEvaluator(ctx);
    evaluator.execProgram(ast);
  } catch (err) {
    scriptOutput.push({ type: 'error', text: String(err?.message ?? err) });
  }
}

function runScriptOnce() {
  const src = document.getElementById('script-manual-editor')?.value ?? '';
  if (!src.trim()) {
    scriptOutput.push({ type: 'warn', text: 'Script is empty.' });
    renderScript();
    return;
  }
  _executeScript(src);
  renderScript();
}

function runAutoScript() {
  const src = document.getElementById('script-auto-editor')?.value ?? '';
  if (src.trim()) {
    _executeScript(src);
    renderScript();
  }
  // AI bridge — silently ignored if server is not running
  try {
    const ctx = buildScriptContext();
    fetch('http://localhost:5001/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...ctx,
        _research:  state.research,
        _inventory: state.inventory,
        _buildings: Object.entries(state.buildings).map(([key, g]) => ({ key, ...g })),
        _patches:   state.patches,
        _perimeter: state.perimeter,
        _chunks:    state.chunksRevealed,
      }),
    }).then(r => r.json())
      .then(({ cmd }) => { if (cmd) { _executeScript(cmd); renderScript(); } })
      .catch(() => {});
  } catch(e) {}
}

// ── Script UI ─────────────────────────────────────────────────

function switchScriptTab(tab) {
  scriptActiveTab = tab;
  const manual = document.getElementById('script-manual-wrap');
  const auto   = document.getElementById('script-auto-wrap');
  const mBtn   = document.getElementById('script-tab-manual');
  const aBtn   = document.getElementById('script-tab-auto');

  if (tab === 'auto') {
    manual?.classList.add('hidden');
    auto?.classList.remove('hidden');
    mBtn?.classList.remove('script-tab-active');
    aBtn?.classList.add('script-tab-active');
    syncScriptHighlight(document.getElementById('script-auto-editor'), document.getElementById('script-auto-hl'));
  } else {
    auto?.classList.add('hidden');
    manual?.classList.remove('hidden');
    aBtn?.classList.remove('script-tab-active');
    mBtn?.classList.add('script-tab-active');
    syncScriptHighlight(document.getElementById('script-manual-editor'), document.getElementById('script-manual-hl'));
  }
}

function toggleScriptAuto() {
  scriptAutoRun   = !scriptAutoRun;
  scriptAutoTimer = 0;
  const btn = document.getElementById('script-auto-btn');
  if (!btn) return;
  btn.textContent = scriptAutoRun ? 'Auto ON' : 'Auto OFF';
  if (scriptAutoRun) { btn.classList.remove('btn-secondary'); btn.classList.add('btn-primary'); }
  else               { btn.classList.remove('btn-primary');   btn.classList.add('btn-secondary'); }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Syntax highlighting ───────────────────────────────────────

let _scriptVerbose = 1;      // reset to 1 before each script run; set via VERBOSE = 0/1 in scripts
let _scriptVerboseUI = true; // UI toggle — filters "Queued N×" lines from the output panel

const SH_KEYWORDS = new Set(['if','else','elif','for','in','and','or','not','while','break','continue','pass','return','True','False','None','def']);
const SH_BUILTINS = new Set(['place','craft','print','research','limit','fortify','give','devmode','expand','floor','ceil','round','abs','min','max','sqrt','pow','range','len']);

function highlightScript(src) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let out = '', i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') { out += '\n'; i++; continue; }
    if (ch === '#') {
      let j = i;
      while (j < src.length && src[j] !== '\n') j++;
      out += `<span class="sh-cmt">${esc(src.slice(i, j))}</span>`;
      i = j; continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch && src[j] !== '\n') {
        if (src[j] === '\\') j++;
        j++;
      }
      if (j < src.length && src[j] === ch) j++;
      out += `<span class="sh-str">${esc(src.slice(i, j))}</span>`;
      i = j; continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out += `<span class="sh-num">${esc(src.slice(i, j))}</span>`;
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (SH_KEYWORDS.has(word))       out += `<span class="sh-kw">${esc(word)}</span>`;
      else if (SH_BUILTINS.has(word))  out += `<span class="sh-fn">${esc(word)}</span>`;
      else if (/^[A-Z][A-Z0-9_]*$/.test(word)) out += `<span class="sh-var">${esc(word)}</span>`;
      else                             out += esc(word);
      i = j; continue;
    }
    out += esc(ch); i++;
  }
  return out;
}

function syncScriptHighlight(ta, hl) {
  if (!ta || !hl) return;
  hl.innerHTML = highlightScript(ta.value) + '\n';
  hl.scrollTop  = ta.scrollTop;
  hl.scrollLeft = ta.scrollLeft;
}

function initScriptHighlighters() {
  const pairs = [
    ['script-manual-editor', 'script-manual-hl'],
    ['script-auto-editor',   'script-auto-hl'],
  ];
  for (const [taId, hlId] of pairs) {
    const ta = document.getElementById(taId);
    const hl = document.getElementById(hlId);
    if (!ta || !hl) continue;
    syncScriptHighlight(ta, hl);
    ta.addEventListener('input',  () => syncScriptHighlight(ta, hl));
    ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; });
  }
}

function toggleScriptVerbose() {
  _scriptVerboseUI = !_scriptVerboseUI;
  const btn = document.getElementById('script-verbose-btn');
  if (btn) {
    btn.textContent = `Verbose: ${_scriptVerboseUI ? 'ON' : 'OFF'}`;
    btn.style.opacity = _scriptVerboseUI ? '' : '0.5';
  }
  renderScript();
}

function renderScript() {
  const el = document.getElementById('script-output');
  if (!el) return;
  const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 5;
  if (!scriptOutput.length) {
    el.innerHTML = '<div class="script-empty">Run a script to see output</div>';
    return;
  }
  const lines = scriptOutput.slice(-200).filter(line =>
    _scriptVerboseUI || line.type !== 'info' || !line.text.startsWith('Queued ')
  );
  el.innerHTML = lines.length
    ? lines.map(line => {
        const cls = line.type === 'error' ? 'script-line-error'
                  : line.type === 'warn'  ? 'script-line-warn'
                  : 'script-line-info';
        return `<div class="script-line ${cls}">${escapeHtml(line.text)}</div>`;
      }).join('')
    : '<div class="script-empty">Run a script to see output</div>';
  if (atBottom) el.scrollTop = el.scrollHeight;
}

document.addEventListener('DOMContentLoaded', initScriptHighlighters);
