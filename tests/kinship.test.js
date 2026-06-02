import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relationshipLabel } from '../kinship.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ind = (id, sex) => ({ id, names: { given: id, surnames: [] }, sex });
const L = (tree, pid, lang = 'es') => relationshipLabel(tree, 'F', pid, lang);

// Multi-generation synthetic tree rooted at focal F.
//  F1: D(M)+M(F) -> F, SIB ; HALF via D+M2
//  F2: DD(M)+DM(F) -> D, UNC      (UNC = paternal uncle)
//  F3: MD(M)+MM(F) -> M
//  F4: GG1(M)+GG2(F) -> DD        (great-grandparents on dad's dad side)
//  Fu: UNC + UW(F) -> CUZ         (CUZ = first cousin); UW married-in
//  Fc: CUZ + null -> CUZK         (CUZ's child = first cousin once removed)
//  Fh: HALF(F) + null -> NIECE    (HALF's child)
const synth = () => ({
  individuals: [
    ind('F','M'), ind('SIB','F'), ind('D','M'), ind('M','F'),
    ind('DD','M'), ind('DM','F'), ind('MD','M'), ind('MM','F'),
    ind('GG1','M'), ind('GG2','F'),
    ind('UNC','M'), ind('UW','F'), ind('CUZ','M'), ind('CUZK','M'),
    ind('M2','F'), ind('HALF','F'), ind('NIECE','F'),
  ],
  families: [
    { id:'F1', husband:'D', wife:'M', children:['F','SIB'] },
    { id:'F2', husband:'DD', wife:'DM', children:['D','UNC'] },
    { id:'F3', husband:'MD', wife:'MM', children:['M'] },
    { id:'F4', husband:'GG1', wife:'GG2', children:['DD'] },
    { id:'Fu', husband:'UNC', wife:'UW', children:['CUZ'] },
    { id:'Fc', husband:'CUZ', wife:null, children:['CUZK'] },
    { id:'F16', husband:'D', wife:'M2', children:['HALF'] },
    { id:'Fh', husband:null, wife:'HALF', children:['NIECE'] },
  ],
});

test('self', () => { assert.equal(L(synth(),'F'), 'Tú'); assert.equal(L(synth(),'F','en'), 'You'); });

test('ancestors (gender + depth)', () => {
  const t = synth();
  assert.equal(L(t,'D'), 'Padre');
  assert.equal(L(t,'M'), 'Madre');
  assert.equal(L(t,'DD'), 'Abuelo');
  assert.equal(L(t,'DM'), 'Abuela');
  assert.equal(L(t,'GG1'), 'Bisabuelo');
  assert.equal(L(t,'DD','en'), 'Grandfather');
});

test('siblings: full vs half', () => {
  const t = synth();
  assert.equal(L(t,'SIB'), 'Hermana');
  assert.equal(L(t,'HALF'), 'Media hermana');
  assert.equal(L(t,'HALF','en'), 'Half-sister');
});

test('aunt/uncle', () => {
  const t = synth();
  assert.equal(L(t,'UNC'), 'Tío');
});

test('first cousin and once removed', () => {
  const t = synth();
  assert.equal(L(t,'CUZ'), 'Primo hermano');
  assert.equal(L(t,'CUZK'), 'Primo hermano una vez removido');
  assert.equal(L(t,'CUZ','en'), 'First cousin');
  assert.equal(L(t,'CUZK','en'), 'First cousin once removed');
});

test('niece/nephew (child of half-sibling)', () => {
  const t = synth();
  assert.equal(L(t,'NIECE'), 'Sobrina');
});

test('married-in described via partner (not focal-related child)', () => {
  // UW married UNC (blood uncle); their child CUZ is blood -> describe UW via the child.
  const t = synth();
  assert.equal(L(t,'UW'), 'Madre de tu primo hermano CUZ');
});

test('fallback for fully unrelated', () => {
  // X shares no ancestor with F and is neither a parent nor partner of anyone related.
  const t = { individuals: [ind('F','M'), ind('X','M')], families: [] };
  assert.equal(relationshipLabel(t,'F','X','es'), 'Familiar político');
  assert.equal(relationshipLabel(t,'F','X','en'), 'Relative by marriage');
});

// ---- real tree ----
const realTree = () => JSON.parse(readFileSync(fileURLToPath(new URL('../content/family/tree.json', import.meta.url)), 'utf8'));
const RL = (id, lang='es') => relationshipLabel(realTree(), 'I1', id, lang);

test('real tree: key relationships', () => {
  assert.equal(RL('I1'), 'Tú');
  assert.equal(RL('I2'), 'Padre');
  assert.equal(RL('I3'), 'Madre');
  assert.equal(RL('I4'), 'Abuelo');
  assert.equal(RL('I5'), 'Abuela');
  assert.equal(RL('I52'), 'Bisabuelo');     // Sebastián Patiño
  assert.equal(RL('I71'), 'Media hermana');  // Alexis
  assert.equal(RL('I13'), 'Tío');            // Jaime (uncle)
  assert.equal(RL('I133'), 'Tío abuelo');    // Chuy
  assert.equal(RL('I72'), 'Sobrina');        // Yamileth (Alexis's child)
});

test('real tree: Chuy descendants are removed cousins', () => {
  // I145 Efraín = child of Chuy (grandpa's brother) => first cousin once removed of Jaime's...
  // Efraín is gen 1; LCA = great-grandparents F8 (a=3 from Jaime, b=2 from Efraín) => primo hermano una vez removido
  assert.equal(RL('I145'), 'Primo hermano una vez removido');
});

test('real tree: Irma (I70) described via her child Alexis, not as a wife', () => {
  assert.equal(RL('I70'), 'Madre de tu media hermana Alexis');
});

test('between any two people (non-focal perspective)', () => {
  const t = realTree();
  // Mariana (I147) relative to her father Efraín (I145) => daughter.
  assert.equal(relationshipLabel(t, 'I145', 'I147', 'es'), 'Hija');
  // José (I4, grandpa) relative to Héctor (I2, his son) => father.
  assert.equal(relationshipLabel(t, 'I2', 'I4', 'es'), 'Padre');
  // Symmetry of direction: Héctor relative to José => son.
  assert.equal(relationshipLabel(t, 'I4', 'I2', 'es'), 'Hijo');
});
