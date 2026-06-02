import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel } from '../hourglass-layout.js';
import { layoutSubtree } from '../hourglass-layout.js';
import { layoutAncestorSide } from '../hourglass-layout.js';

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

import { layoutHourglass } from '../hourglass-layout.js';

const NODE = 100, GAP = 20, OPTS = { nodeW: NODE, gap: GAP, rowH: 130 };
const maxXof = (pos, ids) => Math.max(...ids.map(i => pos.get(i).x));
const minXof = (pos, ids) => Math.min(...ids.map(i => pos.get(i).x));

test('hourglass: maternal < focal < paternal; focal at midpoint of parents; y from gen', () => {
  const pos = layoutHourglass(synthetic(), 'F', OPTS);
  const fx = pos.get('F').x;
  assert.ok(maxXof(pos, ['M','MM','MD']) < fx);
  assert.ok(fx < minXof(pos, ['D','DM','DD']));
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

test('real tree: Chuy 3-gen branch all present', () => {
  const ids = ['I133','I145','I146','I147','I148','I149','I150','I151','I152'];
  const pos = layoutHourglass(realTree(), 'I1', R);
  for (const id of ids) assert.ok(pos.has(id), `${id} present`);
});
