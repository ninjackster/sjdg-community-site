# Family Tree Hourglass Tidy-Tree Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the family-tree layout with a single dependency-free ES module `/family-layout.js` that places BOTH ancestors (up) and all descendant/collateral subtrees (down) with non-overlapping, non-crossing geometry, retiring the client-side outward-push heuristic and the inlined-mirror + marker-sync.

**Architecture:** Extend the proven recursive-bifurcation layout (today's `scripts/lib/ancestor-layout.js`) so that `buildSlot` recursively *places* each person's entire descendant subtree (not just reserves its width), and the module returns positions for EVERY visible node. The client (`family-tree.js`) drops its spine+descendant placement code and simply consumes the returned `Map<id,{x,y,gen}>`. The module ships as a root-level ES module imported by both the browser (`<script type="module">`) and the Node tests — one source of truth, no mirror.

**Tech Stack:** Vanilla ES modules (no deps, no bundler). Node built-in test runner (`node --test`). Static-site generator with root-`.js` passthrough to `dist/`.

**DEVIATION FROM SPEC (flagged for reviewer):** The spec names "threaded Buchheim/Walker O(n)" as the engine. This plan implements the equivalent **recursive variable-width subtree packing** instead: bottom-up width summation + center-parent-over-children, which yields the *same* tidy aesthetics (R1–R4: same-depth alignment, parent centered, subtree isomorphism, child order preserved) for this tree's shape, while reusing the battle-tested bifurcation code. Buchheim's threads/contours are purely an O(n) vs O(n²) optimization that is irrelevant at n≈150 and would add regression risk for no visible benefit. All other spec requirements (union nodes, both halves in one module, retire mirror, dependency-free, preserved features, edge cases, test ports) are met exactly.

**Backup:** tag `backup/pre-tidy-tree-rewrite-2026-06-02` @ `c2ccc55` (on origin). Restore: `git checkout backup/pre-tidy-tree-rewrite-2026-06-02 -- family-tree.js scripts/lib/ancestor-layout.js templates/pages/family.html`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `family-layout.js` (repo root) | The whole layout engine: `buildModel`, recursive variable-width slot/subtree packing for ancestors+collaterals+descendants, `layoutHourglass` public API. ES module. | **Create** |
| `tests/family-layout.test.js` | Unit + invariant tests importing `/family-layout.js`. | **Create** (ports `tests/ancestor-layout.test.js` + adds descendant-packing tests) |
| `family-tree.js` (repo root) | Client IIFE → becomes `type="module"`; imports `layoutHourglass`; deletes inlined `layoutAncestors` + the spine/descendant placement block; consumes the returned Map. | **Modify** |
| `templates/pages/family.html` | Script tag → `type="module"`. | **Modify** (line 26) |
| `scripts/lib/ancestor-layout.js` | Old pure module. | **Delete** (Task 8) |
| `tests/ancestor-layout.test.js` | Old tests. | **Delete** (Task 8, after port) |
| `tests/ancestor-layout-client-sync.test.js` | Marker-sync test (mirror retired). | **Delete** (Task 8) |

**Coordinate contract:** `layoutHourglass(tree, focalId, opts) → Map<id,{x,y,gen}>`. `gen` keeps the existing sign (0 focal, +1 parents, +2 grandparents…; negative below focal). `x` is the horizontal centre of the node. `y = -gen * rowH`. Hidden ids are omitted. `opts = { nodeW=210, rowH=132, gap=30, famGap=78, sideGap=150, isHidden=()=>false }`.

---

## Task 1: Scaffold `/family-layout.js` with `buildModel` (union + maps)

**Files:**
- Create: `family-layout.js`
- Test: `tests/family-layout.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/family-layout.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../family-layout.js';

const ind = (id, sex) => ({ id, names: { given: id, surnames: [] }, sex });
const synthetic = () => ({
  individuals: ['F','M','D','MM','MD','DM','DD'].map(id => ind(id, /M$|^M$/.test(id) ? 'F' : 'M')),
  families: [
    { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
    { id: 'f2', husband: 'DD', wife: 'DM', children: ['D'] },
    { id: 'f3', husband: 'MD', wife: 'MM', children: ['M'] },
  ],
});

test('buildModel: focal gen 0, parents gen 1, grandparents gen 2; sides M/P', () => {
  const m = buildModel(synthetic(), 'F');
  assert.equal(m.gen.get('F'), 0);
  assert.equal(m.gen.get('M'), 1);
  assert.equal(m.gen.get('D'), 1);
  assert.equal(m.gen.get('MM'), 2);
  assert.equal(m.sideOf('M'), 'M');
  assert.equal(m.sideOf('D'), 'P');
  assert.equal(m.sideOf('F'), 'C');
});

test('buildModel: coupleOf and childParents are bidirectional/complete', () => {
  const m = buildModel(synthetic(), 'F');
  assert.equal(m.coupleOf.get('M'), 'D');
  assert.equal(m.coupleOf.get('D'), 'M');
  assert.deepEqual([...(m.childParents.get('F') || [])].sort(), ['D','M']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-layout.test.js`
Expected: FAIL with `Cannot find module '.../family-layout.js'` (or `buildModel is not a function`).

- [ ] **Step 3: Write minimal implementation**

Create `family-layout.js`:

```js
// Hourglass tidy-tree layout for the private family tree. Dependency-free ES module,
// imported by both the browser (type="module") and the Node tests — single source of truth.
// Lays out ancestors (gen>0) UP and all collateral/descendant subtrees DOWN with
// non-overlapping, non-crossing geometry. Maternal side strictly left, paternal strictly
// right of the focal; within a couple, wife left / husband right.

export function buildModel(tree, focalId) {
  const byId = new Map(tree.individuals.map(i => [i.id, i]));
  const famById = new Map(tree.families.map(f => [f.id, f]));
  const childToFamily = new Map();   // child -> the family it is a child of
  const parentToFamily = new Map();  // parent -> the (first) family it parents
  const childParents = new Map();    // child -> [parents]
  const kidsOf = new Map();          // parent -> [children]
  const coupleOf = new Map();        // spouse <-> spouse
  for (const f of tree.families) {
    const ps = [f.husband, f.wife].filter(Boolean);
    for (const c of (f.children || [])) {
      if (!childToFamily.has(c)) childToFamily.set(c, f.id);
      childParents.set(c, (childParents.get(c) || []).concat(ps));
    }
    for (const p of ps) {
      if (!parentToFamily.has(p)) parentToFamily.set(p, f.id);
      (kidsOf.get(p) || kidsOf.set(p, []).get(p)).push(...(f.children || []));
    }
    if (ps.length === 2) { coupleOf.set(ps[0], ps[1]); coupleOf.set(ps[1], ps[0]); }
  }
  // Direct line: focal + ancestors (upward closure).
  const direct = new Set();
  (function up(id){ if (direct.has(id)) return; direct.add(id); for (const p of (childParents.get(id)||[])) up(p); })(focalId);
  // Generations: focal=0, ancestors positive (BFS up), descendants negative (BFS down).
  const gen = new Map([[focalId, 0]]);
  (function climb(id){ for (const p of (childParents.get(id)||[])) if (!gen.has(p)) { gen.set(p, gen.get(id)+1); climb(p); } })(focalId);
  // Side: flood maternal/paternal through spouse+sibling links, excluding the focal nuclear family.
  const focalFamId = childToFamily.get(focalId);
  const father = focalFamId != null ? famById.get(focalFamId).husband : null;
  const mother = focalFamId != null ? famById.get(focalFamId).wife : null;
  const adj = new Map();
  const link = (a,b) => { if(!a||!b) return; (adj.get(a)||adj.set(a,new Set()).get(a)).add(b); (adj.get(b)||adj.set(b,new Set()).get(b)).add(a); };
  for (const f of tree.families) {
    if (focalFamId != null && f.id === focalFamId) continue;
    const ps = [f.husband, f.wife].filter(Boolean), ks = f.children || [];
    if (ps.length === 2) link(ps[0], ps[1]);
    for (const k of ks) for (const p of ps) link(p, k);
    for (let i=0;i<ks.length;i++) for (let j=i+1;j<ks.length;j++) link(ks[i], ks[j]);
  }
  const side = new Map([[focalId,'C']]);
  const flood = (start, tag) => { if(!start) return; const st=[start]; while(st.length){ const n=st.pop(); if(side.has(n)) continue; side.set(n,tag); for (const m of (adj.get(n)||[])) if (m!==focalId && !side.has(m)) st.push(m); } };
  flood(father, 'P'); flood(mother, 'M');
  return {
    byId, famById, childToFamily, parentToFamily, childParents, kidsOf, coupleOf,
    direct, gen, focalFamId, father, mother,
    sideOf: (id) => side.get(id) || 'M',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-layout.test.js`
Expected: PASS (4 assertions across 2 tests).

- [ ] **Step 5: Commit**

```bash
git add family-layout.js tests/family-layout.test.js
git commit -m "feat(family-layout): buildModel — union maps, gens, sides"
```

---

## Task 2: Recursive variable-width slot/subtree packing (`layoutSubtree`)

This is the engine core: given a person, lay out the person (and spouse, wife-left) plus their ENTIRE descendant subtree below, returning left-anchored cells and total width. Parents are centred over the span of their children; sibling subtrees are packed side by side with `gap`. This replaces both `descWidth` (width-only) and the client outward-push.

**Files:**
- Modify: `family-layout.js`
- Test: `tests/family-layout.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/family-layout.test.js`:

```js
import { layoutSubtree } from '../family-layout.js';

// A grandparent G with two children C1, C2; C1 has two kids K1,K2.
const descTree = () => ({
  individuals: ['G','C1','C2','K1','K2'].map(id => ind(id, 'M')),
  families: [
    { id: 'g', husband: 'G', wife: null, children: ['C1','C2'] },
    { id: 'c1', husband: 'C1', wife: null, children: ['K1','K2'] },
  ],
});

test('layoutSubtree: parent centred over its children span, no overlap', () => {
  const m = buildModel(descTree(), 'G');
  const { cells, w } = layoutSubtree('G', 0, m, { nodeW: 100, gap: 20, vis: () => true });
  const pos = new Map(cells.map(c => [c.id, c]));
  // K1,K2 are gen -2 leaves under C1; C1 centred over them; G centred over C1,C2 span.
  const c1mid = (pos.get('K1').x + pos.get('K2').x) / 2;
  assert.ok(Math.abs(pos.get('C1').x - c1mid) < 1e-6, 'C1 centred over its kids');
  // total width spans 3 leaf columns (K1,K2,C2) => 3*100 + 2*20
  assert.equal(w, 3 * 100 + 2 * 20);
  // no two cells in the same gen overlap
  const byGen = {}; for (const c of cells) (byGen[c.gen] = byGen[c.gen] || []).push(c.x);
  for (const g of Object.keys(byGen)) { const xs = byGen[g].sort((a,b)=>a-b); for (let i=1;i<xs.length;i++) assert.ok(xs[i]-xs[i-1] >= 100 - 1e-6); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-layout.test.js`
Expected: FAIL with `layoutSubtree is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `family-layout.js`:

```js
// Lay out `rootId` (+ spouse, wife-left) at gen `gen`, with the entire descendant subtree
// placed BELOW (gen-1, gen-2, …). Returns { cells:[{id,x,gen}], w } with x left-anchored in [0,w].
// `opts` = { nodeW, gap, coupleGap=gap, vis }. Pure; no DOM.
export function layoutSubtree(rootId, gen, model, opts) {
  const nodeW = opts.nodeW, gap = opts.gap, coupleGap = opts.coupleGap != null ? opts.coupleGap : gap;
  const vis = opts.vis;
  const { parentToFamily, famById, byId } = model;

  const spouseOf = (id) => {
    const pf = parentToFamily.get(id); if (pf == null) return null;
    const f = famById.get(pf);
    const o = f.husband === id ? f.wife : (f.wife === id ? f.husband : null);
    return vis(o) ? o : null;
  };
  const slotMembers = (id) => {
    const sp = spouseOf(id); if (!sp) return [id];
    return (byId.get(id) || {}).sex === 'F' ? [id, sp] : [sp, id];
  };
  const childrenOf = (id) => {
    const pf = parentToFamily.get(id); if (pf == null) return [];
    return (famById.get(pf).children || []).filter(vis);
  };

  function build(id, g) {
    const members = slotMembers(id);
    const coupleW = members.length * nodeW + (members.length - 1) * coupleGap;
    const kids = childrenOf(id);
    if (!kids.length) {
      const cells = []; let x = nodeW / 2;
      for (const mId of members) { cells.push({ id: mId, x, gen: g }); x += nodeW + coupleGap; }
      return { cells, w: coupleW, coupleMid: coupleW / 2 };
    }
    // Lay out each child subtree left-to-right, packed by gap.
    const childBlocks = []; let cursor = 0;
    for (const k of kids) {
      const b = build(k, g - 1);
      childBlocks.push({ b, offset: cursor });
      cursor += b.w + gap;
    }
    const kidsW = cursor - gap;
    const w = Math.max(coupleW, kidsW);
    const kidsShift = (w - kidsW) / 2;     // centre the kid band within the wider of {couple,kids}
    const cells = [];
    let childMidSum = 0, childCount = 0;
    for (const { b, offset } of childBlocks) {
      for (const c of b.cells) cells.push({ id: c.id, x: c.x + offset + kidsShift, gen: c.gen });
      childMidSum += b.coupleMid + offset + kidsShift; childCount++;
    }
    const childrenCentre = childMidSum / childCount;
    // Place the couple centred over the children's centre.
    const coupleShift = childrenCentre - coupleW / 2;
    let x = coupleShift + nodeW / 2;
    for (const mId of members) { cells.push({ id: mId, x, gen: g }); x += nodeW + coupleGap; }
    return { cells, w, coupleMid: childrenCentre };
  }

  const { cells, w } = build(rootId, gen);
  // normalise x into [0,w]
  let lo = Infinity; for (const c of cells) lo = Math.min(lo, c.x - nodeW / 2);
  for (const c of cells) c.x -= lo;
  return { cells, w };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-layout.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add family-layout.js tests/family-layout.test.js
git commit -m "feat(family-layout): recursive variable-width subtree packing"
```

---

## Task 3: Ancestor bifurcation with descendant-bearing collaterals (`layoutAncestorSide`)

Port the proven `block()` recursion, but every collateral sibling slot now uses `layoutSubtree` (Task 2) so collaterals carry their full descendant subtrees, fanning outward. Returns cells for one side.

**Files:**
- Modify: `family-layout.js`
- Test: `tests/family-layout.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/family-layout.test.js`:

```js
import { layoutAncestorSide } from '../family-layout.js';

// Mom M with sister MS (an aunt) who has a child AC (focal's cousin).
const collatDesc = () => ({
  individuals: ['F','M','D','MM','MD','MS','AC'].map(id => ind(id, /^(M|MM|MS)$/.test(id) ? 'F' : 'M')),
  families: [
    { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
    { id: 'f3', husband: 'MD', wife: 'MM', children: ['M','MS'] },
    { id: 'fa', husband: null, wife: 'MS', children: ['AC'] },
  ],
});

test('layoutAncestorSide: maternal aunt fans left of mom and carries her child below', () => {
  const m = buildModel(collatDesc(), 'F');
  const { cells } = layoutAncestorSide('M', m, { nodeW: 100, gap: 20, vis: () => true });
  const pos = new Map(cells.map(c => [c.id, c]));
  assert.equal(pos.get('M').gen, 1);
  assert.equal(pos.get('MS').gen, 1);
  assert.equal(pos.get('AC').gen, 0);            // aunt's child one gen below the aunt
  assert.ok(pos.get('MS').x < pos.get('M').x, 'aunt left of mom (fans outward on maternal side)');
  assert.ok(Math.abs(pos.get('AC').x - pos.get('MS').x) < 1e-6, 'cousin centred under lone aunt');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-layout.test.js`
Expected: FAIL with `layoutAncestorSide is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `family-layout.js`. This is the proven `block()` from `ancestor-layout.js`, adapted: (a) it reads maps from `model`; (b) collateral slots use `layoutSubtree` so they carry descendants; (c) it returns the bifurcation `{cells, lo, hi}` exactly as before. The spine person itself is placed at local x=0 at its gen, and its OWN descendants are NOT placed here (the spine's descendants below the focal are handled by the focal side; ancestors have no descendants other than via collaterals).

```js
// Lay out one direct-ancestor `spineId` at local x=0 (gen from model), plus its collateral
// siblings (each carrying their descendant subtree via layoutSubtree) fanning in `dir`
// (-1 maternal/left, +1 paternal/right), plus its parents recursing upward (wife-left).
// Returns { cells:[{id,x,gen}], lo, hi } where lo/hi are signed outer edges of the spine row.
export function layoutAncestorSide(spineId, model, opts) {
  const nodeW = opts.nodeW, gap = opts.gap;
  const { childToFamily, famById } = model;
  const vis = opts.vis;
  const dirOf = (id) => model.sideOf(id) === 'M' ? -1 : 1;

  function block(spineId, dir) {
    const g = model.gen.get(spineId);
    const fam = childToFamily.has(spineId) ? famById.get(childToFamily.get(spineId)) : null;
    const cells = [{ id: spineId, x: 0, gen: g }];
    let edge = dir * (nodeW / 2);

    const collats = fam ? (fam.children || []).filter(c => c !== spineId && vis(c)) : [];
    for (const c of collats) {
      const s = layoutSubtree(c, g, model, opts);   // carries c's descendants below
      const start = dir < 0 ? (edge - gap - s.w) : (edge + gap);
      for (const cell of s.cells) cells.push({ id: cell.id, x: start + cell.x, gen: cell.gen });
      edge = dir < 0 ? start : start + s.w;
    }

    const wifeId = fam && vis(fam.wife) ? fam.wife : null;
    const husbandId = fam && vis(fam.husband) ? fam.husband : null;
    if (wifeId || husbandId) {
      const innerId = dir < 0 ? (husbandId || wifeId) : (wifeId || husbandId);
      const outerId = innerId === husbandId ? wifeId : husbandId;
      const innerB = block(innerId, dir);
      for (const c of innerB.cells) cells.push(c);
      let curLo = innerB.lo, curHi = innerB.hi;
      if (outerId) {
        const outerB = block(outerId, dir);
        const shift = dir < 0 ? (curLo - gap - outerB.hi) : (curHi + gap - outerB.lo);
        for (const c of outerB.cells) cells.push({ id: c.id, x: c.x + shift, gen: c.gen });
        curLo = Math.min(curLo, outerB.lo + shift);
        curHi = Math.max(curHi, outerB.hi + shift);
      }
    }
    let lo = Infinity, hi = -Infinity;
    for (const c of cells) { lo = Math.min(lo, c.x - nodeW / 2); hi = Math.max(hi, c.x + nodeW / 2); }
    return { cells, lo, hi };
  }
  return block(spineId, dirOf(spineId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-layout.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add family-layout.js tests/family-layout.test.js
git commit -m "feat(family-layout): ancestor bifurcation carrying collateral descendants"
```

---

## Task 4: Public API `layoutHourglass` + focal framing + second family

Compose: focal at x=0; maternal side (mom block, shifted to `-half`) + paternal side (dad block, `+half`); focal's own siblings/descendants and half-siblings placed under the focal union; second-family spouse injected outward. Returns `Map<id,{x,y,gen}>`.

**Files:**
- Modify: `family-layout.js`
- Test: `tests/family-layout.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/family-layout.test.js`:

```js
import { layoutHourglass } from '../family-layout.js';

const NODE = 100, GAP = 20, OPTS = { nodeW: NODE, gap: GAP, rowH: 130 };
const maxX = (pos, ids) => Math.max(...ids.map(i => pos.get(i).x));
const minX = (pos, ids) => Math.min(...ids.map(i => pos.get(i).x));

test('hourglass: maternal < focal < paternal; focal at midpoint of parents; y from gen', () => {
  const pos = layoutHourglass(synthetic(), 'F', OPTS);
  const fx = pos.get('F').x;
  assert.ok(maxX(pos, ['M','MM','MD']) < fx);
  assert.ok(fx < minX(pos, ['D','DM','DD']));
  assert.ok(Math.abs(fx - (pos.get('M').x + pos.get('D').x) / 2) < 1e-6);
  assert.equal(pos.get('F').y, 0);
  assert.equal(pos.get('M').y, -130);
  assert.equal(pos.get('MM').y, -260);
});

test('hourglass: focal sibling sits beside focal at gen 0', () => {
  const t = synthetic(); t.families[0].children = ['F','SIB']; t.individuals.push(ind('SIB','F'));
  const pos = layoutHourglass(t, 'F', OPTS);
  assert.equal(pos.get('SIB').gen, 0);
  assert.ok(Math.abs(pos.get('SIB').x - pos.get('F').x) >= NODE - 1e-6, 'sibling does not overlap focal');
});

test('hourglass: hidden node omitted, others still placed', () => {
  const pos = layoutHourglass(synthetic(), 'F', { ...OPTS, isHidden: (id) => id === 'DM' });
  assert.ok(!pos.has('DM'));
  assert.ok(pos.has('DD'));
});

test('hourglass: focal-parent second family — spouse outward, half-sib placed at gen 0', () => {
  const tree = {
    individuals: ['F','M','D','M2','HS'].map(id => ind(id, /^(M|M2|HS)$/.test(id) ? 'F' : 'M')),
    families: [
      { id: 'f1', husband: 'D', wife: 'M', children: ['F'] },
      { id: 'f2', husband: 'D', wife: 'M2', children: ['HS'] },
    ],
  };
  const pos = layoutHourglass(tree, 'F', OPTS);
  assert.ok(pos.get('M2').x > pos.get('D').x, 'second spouse outward of dad (paternal side)');
  assert.equal(pos.get('HS').gen, 0);
  assert.ok(pos.get('HS').x > pos.get('F').x, 'half-sibling on the paternal side of focal');
});

test('hourglass: missing focal family returns focal only', () => {
  const pos = layoutHourglass({ individuals: [ind('F','M')], families: [] }, 'F', OPTS);
  assert.equal(pos.size, 1);
  assert.deepEqual(pos.get('F'), { x: 0, y: 0, gen: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/family-layout.test.js`
Expected: FAIL with `layoutHourglass is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `family-layout.js`:

```js
export function layoutHourglass(tree, focalId, opts = {}) {
  const nodeW = opts.nodeW != null ? opts.nodeW : 210;
  const gap = opts.gap != null ? opts.gap : 30;
  const rowH = opts.rowH != null ? opts.rowH : 132;
  const isHidden = opts.isHidden || (() => false);
  const vis = (id) => !!id && !isHidden(id);
  const lopts = { nodeW, gap, coupleGap: gap, vis };

  const model = buildModel(tree, focalId);
  const out = new Map();
  const finish = () => { for (const [, v] of out) v.y = -v.gen * rowH; return out; };

  if (model.focalFamId == null) { out.set(focalId, { x: 0, y: 0, gen: 0 }); return finish(); }
  const focalFam = model.famById.get(model.focalFamId);
  const momId = vis(focalFam.wife) ? focalFam.wife : null;
  const dadId = vis(focalFam.husband) ? focalFam.husband : null;

  // Reserve width for the focal's own slot band (focal + siblings + their descendant subtrees).
  const focalSibs = (focalFam.children || []).filter(vis);
  let reserve = 0; for (const c of focalSibs) reserve += layoutSubtree(c, 0, model, lopts).w + gap;
  reserve = Math.max(nodeW, reserve - gap);
  const half = reserve / 2 + gap / 2;

  // Second-family spouse injection (mirrors the proven behavior): place an extra spouse of a
  // focal parent just outward, shift that parent's gen-1 siblings out, and remember half-sibs.
  const injectExtra = (cells, parentId, dir) => {
    for (const f of tree.families) {
      if (f.id === model.focalFamId || (f.husband !== parentId && f.wife !== parentId)) continue;
      const sp = f.husband === parentId ? f.wife : f.husband;
      if (!vis(sp)) continue;
      const INS = nodeW + gap;
      for (const c of cells) if (c.gen === 1 && c.id !== parentId && Math.sign(c.x) === dir) c.x += dir * INS;
      cells.push({ id: sp, x: dir * (nodeW + gap), gen: 1 });
    }
  };

  const both = momId && dadId;
  const momOff = both ? -half : 0, dadOff = both ? half : 0;
  if (momId) { const b = layoutAncestorSide(momId, model, lopts); injectExtra(b.cells, momId, -1); for (const c of b.cells) out.set(c.id, { x: c.x + momOff, gen: c.gen }); }
  if (dadId) { const b = layoutAncestorSide(dadId, model, lopts); injectExtra(b.cells, dadId, 1); for (const c of b.cells) out.set(c.id, { x: c.x + dadOff, gen: c.gen }); }

  // Place the focal slot band (focal + siblings + descendants) centred at x=0.
  let cursor = -reserve / 2;
  for (const c of focalSibs) {
    const s = layoutSubtree(c, 0, model, lopts);
    // shift this child's subtree so its couple-centre lands at the cursor band
    for (const cell of s.cells) out.set(cell.id, { x: cursor + cell.x, gen: cell.gen });
    cursor += s.w + gap;
  }
  // Pin focal exactly between mom and dad (overrides its band slot for the centre invariant).
  const fx = both ? (out.get(momId).x + out.get(dadId).x) / 2 : 0;
  out.set(focalId, { x: fx, gen: 0 });
  return finish();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/family-layout.test.js`
Expected: PASS. If the "sibling beside focal" test reveals the focal-band overlapping the pinned focal, adjust by centring the band on `fx` (replace `cursor = -reserve/2` start with the band centred so focal's own cell aligns to `fx`); keep iterating until all Task-4 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add family-layout.js tests/family-layout.test.js
git commit -m "feat(family-layout): layoutHourglass public API — framing, siblings, second family"
```

---

## Task 5: Port the full invariant suite from `ancestor-layout.test.js`

Bring every surviving invariant onto `layoutHourglass` so we keep coverage parity, plus the real-tree smoke tests.

**Files:**
- Modify: `tests/family-layout.test.js`

- [ ] **Step 1: Add the ported tests**

Append to `tests/family-layout.test.js` (these mirror the originals but call `layoutHourglass` and read `content/family/tree.json`):

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const realTree = () => JSON.parse(readFileSync(fileURLToPath(new URL('../content/family/tree.json', import.meta.url)), 'utf8'));
const R = { nodeW: 210, gap: 30, rowH: 132 };

test('real tree: gens for focal/parents/grandparents', () => {
  const pos = layoutHourglass(realTree(), 'I1', R);
  assert.equal(pos.get('I1').gen, 0);
  assert.equal(pos.get('I2').gen, 1);
  assert.equal(pos.get('I3').gen, 1);
  assert.equal(pos.get('I4').gen, 2);
  assert.equal(pos.get('I7').gen, 2);
});

test('real tree: maternal left, paternal right', () => {
  const pos = layoutHourglass(realTree(), 'I1', R);
  const fx = pos.get('I1').x;
  assert.ok(pos.get('I3').x < fx && pos.get('I2').x > fx);
  assert.ok(pos.get('I6').x < fx && pos.get('I7').x < fx);
  assert.ok(pos.get('I4').x > fx && pos.get('I5').x > fx);
});

test('real tree: wife left of husband within grandparent unions', () => {
  const pos = layoutHourglass(realTree(), 'I1', R);
  assert.ok(pos.get('I5').x < pos.get('I4').x);
  assert.ok(pos.get('I7').x < pos.get('I6').x);
});

test('real tree: mom rightmost maternal, dad leftmost paternal (centre seam)', () => {
  const pos = layoutHourglass(realTree(), 'I1', R);
  const fx = pos.get('I1').x;
  let matMax = -Infinity, patMin = Infinity;
  for (const [, p] of pos) { if (p.x < fx) matMax = Math.max(matMax, p.x); else if (p.x > fx) patMin = Math.min(patMin, p.x); }
  assert.equal(pos.get('I3').x, matMax);
  assert.equal(pos.get('I2').x, patMin);
});

test('real tree: no two nodes in a generation overlap', () => {
  const pos = layoutHourglass(realTree(), 'I1', R);
  const byGen = {};
  for (const [, v] of pos) (byGen[v.gen] = byGen[v.gen] || []).push(v.x);
  for (const g of Object.keys(byGen)) { const xs = byGen[g].sort((a,b)=>a-b); for (let i=1;i<xs.length;i++) assert.ok(xs[i]-xs[i-1] >= 210 - 1e-6, `gen ${g} overlap`); }
});

test('real tree: Chuy 3-gen branch all present and non-overlapping', () => {
  // Chuy I133 -> I145 Efraín, I146 Gelly; Efraín -> I147 Mariana, I148 Sebastián; Mariana -> I151,I152
  const ids = ['I133','I145','I146','I147','I148','I149','I150','I151','I152'];
  const pos = layoutHourglass(realTree(), 'I1', R);
  for (const id of ids) assert.ok(pos.has(id), `${id} present`);
});
```

- [ ] **Step 2: Run and confirm**

Run: `node --test tests/family-layout.test.js`
Expected: PASS. If "no overlap" fails on the real tree, the cause is two collateral subtrees on the same side whose bands touch — fix in `layoutAncestorSide` by ensuring `edge` advances by the full subtree width (it does); if a descendant gen row overlaps, ensure `layoutSubtree` packs by `gap` (it does). Iterate until green. Do NOT relax the assertion.

- [ ] **Step 3: Commit**

```bash
git add tests/family-layout.test.js
git commit -m "test(family-layout): port invariant suite + real-tree + Chuy branch"
```

---

## Task 6: Client integration — import the module, delete the inlined engine + outward-push

**Files:**
- Modify: `family-tree.js:46-153` (delete inlined `layoutAncestors`), `family-tree.js:359-444` (replace placement), top of file (add import)
- Modify: `templates/pages/family.html:26`

- [ ] **Step 1: Switch the script tag to a module**

In `templates/pages/family.html`, change line 26 from:
```html
<script src="/family-tree.js" defer></script>
```
to:
```html
<script type="module" src="/family-tree.js"></script>
```

- [ ] **Step 2: Add the import and delete the inlined engine**

At the very top of `family-tree.js` (before the IIFE or as the first line inside a module), add:
```js
import { layoutHourglass } from '/family-layout.js';
```
Then DELETE the entire inlined `function layoutAncestors(tree, focalId, nodeW, gap, isHidden) { … }` block (currently lines ~46–153).

- [ ] **Step 3: Replace the spine + descendant placement with one call**

In `render()`, replace the whole block from `const xpos = new Map();` through the end of the outward-push loop (currently lines ~373–444, ending just before `let minX = Infinity`) with:

```js
      // Single source of truth: the module places every visible node (ancestors up,
      // descendants/collaterals down) with non-overlapping, non-crossing geometry.
      const xpos = new Map();
      const placed = layoutHourglass(tree, rootId, { nodeW: NODE_W, gap: GAP, rowH: ROW_H, isHidden: (id) => hidden.has(id) });
      for (const [id, p] of placed) if (!hidden.has(id)) xpos.set(id, p.x);
```

The downstream code (`minX/maxX`, node DOM placement using `xpos` + `gens` for the row, `drawConnectors`) is unchanged — it still reads `xpos` per id and `gens.get(id)` for the row. (The module's `gen` matches the client's `gens` map, so vertical placement is unaffected.) The `order`, `bySide`, `spacing`, `avgKids`, `shiftSub` helpers used only by the deleted block may be removed if now unreferenced; leave `bySide`/`order` if still used by keyboard nav (`meta.order`).

- [ ] **Step 4: Verify keyboard nav still has its row order**

`meta.order[g]` is consumed by Arrow Left/Right nav (around line 605). Keep the `order` construction (lines ~365–369) — it does not depend on the deleted placement code. Confirm by grep:
```bash
grep -n "meta.order\|order\[" family-tree.js
```
Expected: `order` is still built and read; no reference to deleted helpers remains. If `bySide` is only used by `order`, keep both.

- [ ] **Step 5: Build and run the full suite**

Run: `node scripts/build.js && node --test --test-concurrency=1 2>&1 | tail -6`
Expected: build OK; tests show failures ONLY in the now-stale `tests/ancestor-layout*.js` (handled in Task 7). `tests/family-layout.test.js` and all non-layout suites PASS. Confirm `dist/family-layout.js` exists:
```bash
ls -1 dist/family-layout.js dist/family-tree.js
```

- [ ] **Step 6: Commit**

```bash
git add family-tree.js templates/pages/family.html
git commit -m "feat(family-tree): consume /family-layout.js module; drop inlined engine + outward-push"
```

---

## Task 7: Delete the retired module, mirror, and old tests

**Files:**
- Delete: `scripts/lib/ancestor-layout.js`, `tests/ancestor-layout.test.js`, `tests/ancestor-layout-client-sync.test.js`

- [ ] **Step 1: Confirm nothing else imports the old module**

Run:
```bash
grep -rn "ancestor-layout" --include=*.js . | grep -v node_modules | grep -v dist
```
Expected: matches ONLY in the three files about to be deleted. If any other file imports `ancestor-layout.js`, stop and re-point it to `family-layout.js` first.

- [ ] **Step 2: Delete the files**

```bash
git rm scripts/lib/ancestor-layout.js tests/ancestor-layout.test.js tests/ancestor-layout-client-sync.test.js
```

- [ ] **Step 3: Run the full suite green**

Run: `node --test --test-concurrency=1 2>&1 | tail -6`
Expected: all tests pass, 0 fail (count = previous 113 − the deleted layout/sync tests + the new `family-layout.test.js` tests). Record the new total.

- [ ] **Step 4: Build once more**

Run: `node scripts/build.js >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(family-layout): retire ancestor-layout module, inlined mirror, sync test"
```

---

## Task 8: Browser verification on Vercel preview + review gate

**Files:** none (verification only)

- [ ] **Step 1: Push the branch and get the preview**

```bash
git push -u origin feature/tidy-tree-rewrite
```
Then read the preview URL via the Vercel deployment list (branch alias `sjdg-webpage-git-feature-tidy-tree-rewrite-…`). Wait for state READY.

- [ ] **Step 2: Verify in-browser (Chrome MCP, login `changeme`)**

Navigate to `/es/familia` on the preview and confirm via DOM probes:
- focal `I1` centred; `I3` (mom) immediately left of seam, `I2` (dad) immediately right.
- Maternal ids all left of focal x, paternal all right (spot-check `I4`,`I5`,`I6`,`I7`).
- Expand grandpa `I4`, then deep-expand Chuy `I133`: all of `I145..I152` appear; **0 overlapping node pairs** (reuse the overlap probe from the prior session: pairwise rect intersection > 6px ⇒ fail).
- Collapse Chuy: subtree removed; re-expand: returns.
- Connectors aligned at a non-1 zoom level (zoom, then re-render, check a parent→child line endpoints land on node centres).
- Fan view toggle still renders.

- [ ] **Step 3: Record evidence and PAUSE**

Summarise the probe results to Jaime (node counts, overlap=0, seam correct). Per the standing rule, do NOT merge to `main`. Present the preview and ask for explicit approval to merge to prod.

- [ ] **Step 4 (after approval): finish the branch**

Use superpowers:finishing-a-development-branch → merge `--no-ff` to `main`, push, delete the branch. Then confirm the prod deployment is READY and aliased to `sanjosedegracia.net`. Update the backlog doc (mark the tidy-tree item shipped) and the Notion Memory Bank.

---

## Self-Review

**Spec coverage:** dependency-free root ES module (Task 1,6) ✓; retire mirror+sync (Task 7) ✓; union nodes + variable width (Task 2) ✓; ancestors up + collateral descendants down in one module (Task 3,4) ✓; `layoutHourglass(tree,focalId,opts)→Map<id,{x,y,gen}>` (Task 4) ✓; maternal-left/paternal-right + wife-left/husband-right + centre seam (Task 4,5) ✓; preserved features via unchanged client downstream + import (Task 6) ✓; edge cases — single parent (Task 2 leaf), second family/half-sib (Task 4), placeholders (vis treats them as normal; real-tree test), hidden nodes (Task 4 test), no-overlap (Task 2,5) ✓; test ports + new tidy invariants (Task 5) ✓; delete sync test (Task 7) ✓; browser verify + review gate (Task 8) ✓. **Deviation** (recursive packing vs threaded Buchheim) flagged at top.

**Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output. The only "iterate until green" notes (Task 4 Step 4, Task 5 Step 2) are debugging guidance with a concrete fix direction, not deferred work.

**Type consistency:** `buildModel` returns the same object shape consumed by `layoutSubtree`/`layoutAncestorSide`/`layoutHourglass` (`parentToFamily`, `famById`, `byId`, `childToFamily`, `gen`, `sideOf`, `focalFamId`). `layoutSubtree`/`layoutAncestorSide` take `(…, model, opts)` with `opts={nodeW,gap,coupleGap,vis}`; `layoutHourglass` builds `lopts` with exactly those keys. Public return is `{x,y,gen}` everywhere the client reads (`xpos` uses `.x`, vertical uses the client's own `gens`). Consistent.
