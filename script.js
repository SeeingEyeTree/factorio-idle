'use strict';

// ── Tokenizer ─────────────────────────────────────────────────

function tokenize(src) {
  const KEYWORDS = {
    if:'IF', elif:'ELIF', else:'ELSE', while:'WHILE', for:'FOR',
    in:'IN', and:'AND', or:'OR', not:'NOT',
    pass:'PASS', break:'BREAK', continue:'CONTINUE',
    True:'TRUE', False:'FALSE', None:'NONE',
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

    if (t.type === 'NAME') {
      this.advance();
      if (this.peek().type === 'OP' && this.peek().value === '(') {
        this.advance();
        const args = [];
        while (!(this.peek().type === 'OP' && this.peek().value === ')')) {
          args.push(this.parseExpr());
          if (this.peek().type === 'OP' && this.peek().value === ',') this.advance();
        }
        this.eat('OP', ')');
        return { type: 'call', func: t.value, args };
      }
      return { type: 'name', id: t.value };
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

class ScriptEvaluator {
  constructor(context) {
    this.ctx   = context;
    this.vars  = {};
    this.steps = 0;
  }

  step() {
    if (++this.steps > 100000) throw new Error('Script exceeded step limit — possible infinite loop');
  }

  lookup(name) {
    if (name in this.vars) return this.vars[name];
    if (name in this.ctx)  return this.ctx[name];
    return 0;
  }

  assign(name, value) {
    this.vars[name] = value;
    if (name.startsWith('MEM_') && state?.scriptMemory != null)
      state.scriptMemory[name] = value;
  }

  execProgram(ast) { return this.execBlock(ast.body); }

  execBlock(stmts) {
    for (const stmt of stmts) {
      const r = this.execStmt(stmt);
      if (r === _BREAK || r === _CONTINUE) return r;
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
          if (stmt.orelse[0]?.type === 'if') return this.execStmt(stmt.orelse[0]);
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
  const bldgs    = state.buildings       ?? [];
  const p        = state.perimeter       ?? {};
  const research = state.research        ?? {};
  const pq       = placeQueue            ?? [];

  const countType  = t => bldgs.filter(b => b.type === t).length;
  const countMiner = (t, r) => bldgs.filter(b => b.type === t && b.resource === r).length;

  const ctx = {};

  // ── Inventory + delta (all ITEMS)
  for (const key of Object.keys(ITEMS ?? {})) {
    const v = _camelToScream(key);
    ctx[v]          = Math.floor(inv[key] ?? 0);
    ctx['DELTA_' + v] = delta[key] ?? 0;
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

  // ── Queue variables
  const cq = state.craftQueue ?? [];
  const ca = state.craftActive;
  ctx.Q_len    = pq.length;
  ctx.Q_miners = pq.filter(b => b.type === 'miner' || b.type === 'electricMiner').length;

  // ── Persistent script memory (MEM_*)
  for (const [k, v] of Object.entries(state.scriptMemory ?? {})) {
    ctx[k] = v;
  }

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
    const text = args.map(a => a === null || a === undefined ? 'None' : String(a)).join(' ');
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
  // Recipe aliases (for place/limit with furnaces/assemblers)
  ctx.iron_plate = 'iron_plate'; ctx.copper_plate = 'copper_plate';
  ctx.stone_brick = 'stone_brick'; ctx.steel = 'steel';
  ctx.iron_gear = 'iron_gear'; ctx.gear = 'iron_gear';
  ctx.copper_cable = 'copper_cable'; ctx.cable = 'copper_cable';
  ctx.pipe = 'pipe'; ctx.iron_stick = 'iron_stick';
  ctx.circuit = 'circuit'; ctx.green_circuit = 'circuit';
  ctx.electronic_circuit = 'circuit';
  ctx.advanced_circuit = 'advanced_circuit'; ctx.red_circuit = 'advanced_circuit';
  ctx.processing_unit = 'processing_unit'; ctx.blue_circuit = 'processing_unit';
  ctx.inserter = 'inserter'; ctx.transport_belt = 'transport_belt'; ctx.belt = 'transport_belt';
  ctx.engine_unit = 'engine_unit'; ctx.engine = 'engine_unit';
  ctx.electric_engine = 'electric_engine'; ctx.electric_engine_unit = 'electric_engine';
  ctx.flying_robot_frame = 'flying_robot_frame';
  ctx.construction_robot = 'construction_robot';
  ctx.plastic_bar = 'plastic_bar'; ctx.plastic = 'plastic_bar';
  ctx.sulfur = 'sulfur'; ctx.sulfuric_acid = 'sulfuric_acid';
  ctx.battery = 'battery'; ctx.lubricant = 'lubricant';
  ctx.solid_fuel = 'solid_fuel'; ctx.rocket_fuel = 'rocket_fuel';
  ctx.explosives = 'explosives';
  ctx.low_density_structure = 'low_density_structure';
  ctx.rocket_control_unit = 'rocket_control_unit';
  ctx.rocket_part = 'rocket_part';
  ctx.science_pack_1 = 'science_pack_1'; ctx.red_science = 'science_pack_1';
  ctx.science_pack_2 = 'science_pack_2'; ctx.green_science = 'science_pack_2';
  ctx.science_pack_3 = 'science_pack_3'; ctx.blue_science = 'science_pack_3';
  ctx.military_science = 'military_science';
  ctx.production_science = 'production_science';
  ctx.utility_science = 'utility_science';
  ctx.space_science = 'space_science';
  ctx.uranium_processing = 'uranium_processing';
  ctx.kovarex = 'kovarex'; ctx.uranium_fuel_cell = 'uranium_fuel_cell';
  ctx.concrete = 'concrete';
  ctx.basic_oil = 'basic_oil'; ctx.advanced_oil = 'advanced_oil';
  ctx.heavy_oil_cracking = 'heavy_oil_cracking'; ctx.light_oil_cracking = 'light_oil_cracking';

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
    const raw   = String(item ?? '');
    const key   = GIVE_MAP[raw] ?? raw;
    const count = typeof n === 'number' ? Math.max(1, Math.floor(n)) : 1;
    if (!key) { scriptOutput.push({ type: 'warn', text: 'give: item name required' }); return; }
    state.inventory[key] = (state.inventory[key] ?? 0) + count;
    if (count > 0) state.seen[key] = true;
    scriptOutput.push({ type: 'info', text: `Gave ${count.toLocaleString()}× ${key}` });
  };

  // ── place(type, arg, n=1)
  ctx.place = function(type, arg, n) {
    scriptPlaceBuilding(String(type ?? ''), arg != null ? String(arg) : null, n);
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
    const TYPE_MAP = {
      miner: 'miner', burner_miner: 'miner', burner: 'miner',
      e_drill: 'electricMiner', electric_drill: 'electricMiner', electric_miner: 'electricMiner', e_miner: 'electricMiner',
      furnace: 'furnace', stone_furnace: 'furnace',
      steel_furnace: 'steelFurnace', electric_furnace: 'electricFurnace',
      assembly: 'assembly', assembler: 'assembly', am1: 'assembly', assembly1: 'assembly',
      assembly2: 'assembly2', assembler2: 'assembly2', am2: 'assembly2',
      assembly3: 'assembly3', assembler3: 'assembly3', am3: 'assembly3',
      lab: 'lab', boiler: 'boiler', steam_engine: 'steamEngine', solar_panel: 'solarPanel',
      accumulator: 'accumulator', acc: 'accumulator',
      offshore_pump: 'offshoreP', offshore: 'offshoreP', pump: 'offshoreP',
      radar: 'radar', pumpjack: 'pumpjack', oil_pump: 'pumpjack',
      oil_refinery: 'oilRefinery', refinery: 'oilRefinery',
      chemical_plant: 'chemicalPlant', chem_plant: 'chemicalPlant',
      centrifuge: 'centrifuge', rocket_silo: 'rocketSilo', silo: 'rocketSilo',
      nuclear_reactor: 'nuclearReactor', nuclear: 'nuclearReactor', reactor: 'nuclearReactor',
    };
    const RECIPE_MAP = {
      iron_plate: 'ironPlate', copper_plate: 'copperPlate', stone_brick: 'stoneBrick', steel: 'steel',
      iron_gear: 'ironGear', gear: 'ironGear', copper_cable: 'copperCable', cable: 'copperCable',
      pipe: 'pipe', iron_stick: 'ironStick',
      circuit: 'electronicCircuit', green_circuit: 'electronicCircuit', electronic_circuit: 'electronicCircuit',
      advanced_circuit: 'advancedCircuit', red_circuit: 'advancedCircuit',
      processing_unit: 'processingUnit', blue_circuit: 'processingUnit',
      inserter: 'inserter', transport_belt: 'transportBelt', belt: 'transportBelt',
      engine_unit: 'engineUnit', engine: 'engineUnit',
      electric_engine: 'electricEngineUnit', electric_engine_unit: 'electricEngineUnit',
      flying_robot_frame: 'flyingRobotFrame',
      red_science: 'redScience', green_science: 'greenScience', blue_science: 'blueScience',
      black_science: 'blackScience', purple_science: 'purpleScience', yellow_science: 'yellowScience',
      plastic: 'plasticBar', plastic_bar: 'plasticBar',
      sulfur: 'sulfur', sulfuric_acid: 'sulfuricAcid', battery: 'battery', lubricant: 'lubricant',
      solid_fuel: 'solidFuelLight', rocket_fuel: 'rocketFuel',
      low_density_structure: 'lowDensityStructure', lds: 'lowDensityStructure',
      basic_oil: 'basicOilProcessing', advanced_oil: 'advancedOilProcessing',
      uranium_processing: 'uraniumProcessing', kovarex: 'kovarexEnrichment',
      uranium_fuel_cell: 'uraniumFuelCell', concrete: 'concrete',
    };
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

function scriptPlaceBuilding(type, arg, n) {
  const TYPE_MAP = {
    miner: 'miner', burner_miner: 'miner', burner: 'miner',
    e_drill: 'electricMiner', electric_drill: 'electricMiner', electric_miner: 'electricMiner', e_miner: 'electricMiner',
    furnace: 'furnace', stone_furnace: 'furnace',
    steel_furnace: 'steelFurnace',
    electric_furnace: 'electricFurnace',
    assembly: 'assembly', assembler: 'assembly', am1: 'assembly', assembly1: 'assembly',
    assembly2: 'assembly2', assembler2: 'assembly2', am2: 'assembly2',
    assembly3: 'assembly3', assembler3: 'assembly3', am3: 'assembly3',
    lab: 'lab',
    boiler: 'boiler',
    steam_engine: 'steamEngine', steamengine: 'steamEngine',
    solar_panel: 'solarPanel', solar: 'solarPanel',
    accumulator: 'accumulator', acc: 'accumulator',
    offshore_pump: 'offshoreP', offshore: 'offshoreP', pump: 'offshoreP',
    radar: 'radar',
    pumpjack: 'pumpjack', oil_pump: 'pumpjack',
    oil_refinery: 'oilRefinery', refinery: 'oilRefinery',
    chemical_plant: 'chemicalPlant', chem_plant: 'chemicalPlant',
    centrifuge: 'centrifuge',
    rocket_silo: 'rocketSilo', silo: 'rocketSilo',
    nuclear_reactor: 'nuclearReactor', nuclear: 'nuclearReactor', reactor: 'nuclearReactor',
  };

  const RESOURCE_MAP = {
    iron: 'ironOre', iron_ore: 'ironOre',
    copper: 'copperOre', copper_ore: 'copperOre',
    coal: 'coal',
    stone: 'stone',
    oil: 'crudeOil', crude_oil: 'crudeOil',
    uranium: 'uraniumOre', uranium_ore: 'uraniumOre',
  };

  const RECIPE_MAP = {
    iron_plate: 'ironPlate', copper_plate: 'copperPlate', stone_brick: 'stoneBrick',
    steel: 'steel',
    iron_gear: 'ironGear', gear: 'ironGear',
    copper_cable: 'copperCable', cable: 'copperCable',
    pipe: 'pipe', iron_stick: 'ironStick',
    circuit: 'electronicCircuit', green_circuit: 'electronicCircuit', electronic_circuit: 'electronicCircuit',
    advanced_circuit: 'advancedCircuit', red_circuit: 'advancedCircuit',
    processing_unit: 'processingUnit', blue_circuit: 'processingUnit',
    inserter: 'inserter',
    transport_belt: 'transportBelt', belt: 'transportBelt',
    engine_unit: 'engineUnit', engine: 'engineUnit',
    electric_engine: 'electricEngineUnit', electric_engine_unit: 'electricEngineUnit',
    flying_robot_frame: 'flyingRobotFrame',
    red_science: 'redScience', green_science: 'greenScience', blue_science: 'blueScience',
    black_science: 'blackScience', purple_science: 'purpleScience', yellow_science: 'yellowScience',
    plastic: 'plasticBar', plastic_bar: 'plasticBar',
    sulfur: 'sulfur', sulfuric_acid: 'sulfuricAcid',
    battery: 'battery', lubricant: 'lubricant', explosives: 'explosives',
    solid_fuel: 'solidFuelLight', rocket_fuel: 'rocketFuel',
    low_density_structure: 'lowDensityStructure', lds: 'lowDensityStructure',
    basic_oil: 'basicOilProcessing', advanced_oil: 'advancedOilProcessing',
    heavy_oil_cracking: 'heavyOilCracking', light_oil_cracking: 'lightOilCracking',
    uranium_processing: 'uraniumProcessing', kovarex: 'kovarexEnrichment',
    uranium_fuel_cell: 'uraniumFuelCell', nuclear_fuel: 'nuclearFuel',
    concrete: 'concrete',
    firearm_magazine: 'firearmMagazine', ammo: 'firearmMagazine',
    piercing_rounds: 'piercingRoundsMag', piercing: 'piercingRoundsMag',
    rocket_part: 'rocketPart',
  };

  const DISPLAY = {
    miner: 'Burner Miner', electricMiner: 'Electric Mining Drill',
    furnace: 'Stone Furnace', steelFurnace: 'Steel Furnace', electricFurnace: 'Electric Furnace',
    assembly: 'Assembly Machine Mk1', assembly2: 'Assembly Machine Mk2', assembly3: 'Assembly Machine Mk3',
    lab: 'Lab', boiler: 'Boiler', steamEngine: 'Steam Engine',
    solarPanel: 'Solar Panel', accumulator: 'Accumulator', offshoreP: 'Offshore Pump',
    radar: 'Radar', pumpjack: 'Pumpjack', oilRefinery: 'Oil Refinery',
    chemicalPlant: 'Chemical Plant', centrifuge: 'Centrifuge',
    rocketSilo: 'Rocket Silo', nuclearReactor: 'Nuclear Reactor',
  };

  const realType = TYPE_MAP[type] ?? type;
  const costs    = BUILDING_COSTS[realType];

  if (!costs) {
    scriptOutput.push({ type: 'warn', text: `place: unknown building type "${type}"` });
    return;
  }
  if (!isUnlocked('building', realType)) {
    scriptOutput.push({ type: 'warn', text: `place: ${DISPLAY[realType] ?? realType} is locked (research required)` });
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
  const MINER_TYPES = ['furnace','steelFurnace','electricFurnace','assembly','assembly2','assembly3',
                       'oilRefinery','chemicalPlant','centrifuge','rocketSilo'];
  let placed = 0;

  for (let i = 0; i < count; i++) {
    if (!canAfford(costs)) {
      if (i === 0) scriptOutput.push({ type: 'warn', text: `place: can't afford ${DISPLAY[realType] ?? realType}` });
      break;
    }
    let target;
    if (realType === 'miner' || realType === 'electricMiner') {
      const resource = (arg ? (RESOURCE_MAP[arg] ?? arg) : null) ?? pr[realType] ?? 'ironOre';
      const maxNodes = maxDrillsForResource(resource);
      if (drillCountForResource(resource) >= maxNodes) {
        if (i === 0) scriptOutput.push({ type: 'warn', text: `place: max drills reached for ${resource}` });
        break;
      }
      spend(costs);
      target = { type: realType, resource, acc: 0 };
    } else if (realType === 'pumpjack') {
      spend(costs);
      target = { type: realType, resource: 'crudeOil', acc: 0 };
    } else if (MINER_TYPES.includes(realType)) {
      const recipe = (arg ? (RECIPE_MAP[arg] ?? arg) : null) ?? pr[realType] ?? '';
      spend(costs);
      target = { type: realType, recipe, active: false, progress: 0 };
    } else {
      spend(costs);
      target = { type: realType };
    }
    target.displayName = DISPLAY[realType] ?? realType;
    placeQueue.push(target);
    placed++;
  }

  if (placed > 0) {
    scriptOutput.push({ type: 'info', text: `Queued ${placed}× ${DISPLAY[realType] ?? realType}` });
    if (!placing) processNextPlacement();
  }
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

  const key = ALIAS[item] ?? item;
  if (!PLAYER_RECIPES?.[key]) {
    scriptOutput.push({ type: 'warn', text: `craft: unknown recipe "${item}"` });
    return;
  }

  for (let i = 0; i < n; i++) state.craftQueue.push({ key });
  scriptOutput.push({ type: 'info', text: `Queued ${n}× ${PLAYER_RECIPES[key].name}` });
}

// ── Runner helpers ────────────────────────────────────────────

function _executeScript(src) {
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
        _buildings: state.buildings,
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
  const manual = document.getElementById('script-manual-editor');
  const auto   = document.getElementById('script-auto-editor');
  const mBtn   = document.getElementById('script-tab-manual');
  const aBtn   = document.getElementById('script-tab-auto');

  if (tab === 'auto') {
    manual?.classList.add('hidden');
    auto?.classList.remove('hidden');
    mBtn?.classList.remove('script-tab-active');
    aBtn?.classList.add('script-tab-active');
  } else {
    auto?.classList.add('hidden');
    manual?.classList.remove('hidden');
    aBtn?.classList.remove('script-tab-active');
    mBtn?.classList.add('script-tab-active');
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

function renderScript() {
  const el = document.getElementById('script-output');
  if (!el) return;
  if (!scriptOutput.length) {
    el.innerHTML = '<div class="script-empty">Run a script to see output</div>';
    return;
  }
  const lines = scriptOutput.slice(-200);
  el.innerHTML = lines.map(line => {
    const cls = line.type === 'error' ? 'script-line-error'
              : line.type === 'warn'  ? 'script-line-warn'
              : 'script-line-info';
    return `<div class="script-line ${cls}">${escapeHtml(line.text)}</div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}
