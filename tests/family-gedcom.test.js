import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGedcom } from '../family-gedcom.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ind = (id, given, surnames, extra = {}) => ({ id, names: { given, surnames }, ...extra });
const tree = () => ({
  individuals: [
    ind('I1', 'Jaime', ['Murillo', 'Mena'], { sex: 'M' }),
    ind('I2', 'Héctor', ['Murillo', 'Patiño'], { sex: 'M' }),
    ind('I3', 'Mercedes', ['Mena', 'Ruiz'], { sex: 'F' }),
    ind('I4', 'José', ['Murillo', 'Villalobos'], { sex: 'M', birth: { date: '1930' }, death: { date: '2010' }, notes: { en: 'Patriarch', es: 'Patriarca' } }),
  ],
  families: [
    { id: 'F1', husband: 'I2', wife: 'I3', children: ['I1'] },
    { id: 'F2', husband: 'I4', wife: null, children: ['I2'] },
  ],
});

const g = () => toGedcom(tree());

test('valid GEDCOM envelope: HEAD … TRLR, version + charset', () => {
  const out = g();
  assert.ok(out.startsWith('0 HEAD\n'));
  assert.ok(out.trimEnd().endsWith('0 TRLR'));
  assert.match(out, /1 GEDC\n2 VERS 5\.5\.1/);
  assert.match(out, /1 CHAR UTF-8/);
});

test('individual record: xref, NAME with /surnames/, SEX', () => {
  const out = g();
  assert.match(out, /0 @I1@ INDI/);
  assert.match(out, /1 NAME Jaime \/Murillo Mena\//);
  assert.match(out, /1 SEX M/);
});

test('birth/death dates emitted under BIRT/DEAT', () => {
  const out = g();
  assert.match(out, /0 @I4@ INDI[\s\S]*?1 BIRT\n2 DATE 1930[\s\S]*?1 DEAT\n2 DATE 2010/);
});

test('family record with HUSB/WIFE/CHIL; single-parent omits WIFE', () => {
  const out = g();
  assert.match(out, /0 @F1@ FAM\n1 HUSB @I2@\n1 WIFE @I3@\n1 CHIL @I1@/);
  assert.match(out, /0 @F2@ FAM\n1 HUSB @I4@\n1 CHIL @I2@/);
  assert.ok(!/0 @F2@ FAM\n1 HUSB @I4@\n1 WIFE/.test(out), 'no WIFE line for single-parent family');
});

test('FAMC (child link) and FAMS (spouse link)', () => {
  const out = g();
  assert.match(out, /0 @I1@ INDI[\s\S]*?1 FAMC @F1@/);   // Jaime is a child of F1
  assert.match(out, /0 @I2@ INDI[\s\S]*?1 FAMS @F1@/);   // Héctor is a spouse in F1
  assert.match(out, /0 @I2@ INDI[\s\S]*?1 FAMC @F2@/);   // …and a child of F2
});

test('notes emitted as NOTE', () => {
  const out = g();
  assert.match(out, /0 @I4@ INDI[\s\S]*?1 NOTE Patriarch/);
});

test('every line is well-formed (level digit + space) and <= 255 chars', () => {
  const out = g();
  for (const line of out.split('\n')) {
    if (line === '') continue;
    assert.match(line, /^[0-9] /, 'line starts with a level: ' + line);
    assert.ok(line.length <= 255, 'line within 255 chars');
  }
});

test('long story is chunked with CONC so no line exceeds 255', () => {
  const t = { individuals: [ind('I1', 'X', ['Y'], { sex: 'M', story: { en: 'z'.repeat(600), es: '' } })], families: [] };
  const out = toGedcom(t);
  assert.match(out, /1 NOTE z+/);
  assert.match(out, /2 CONC z+/);
  for (const line of out.split('\n')) assert.ok(line.length <= 255);
});

const realTree = () => JSON.parse(readFileSync(fileURLToPath(new URL('../content/family/tree.json', import.meta.url)), 'utf8'));
test('real tree: one INDI per individual, one FAM per family, parseable lines', () => {
  const t = realTree();
  const out = toGedcom(t);
  const indi = (out.match(/^0 @\w+@ INDI$/gm) || []).length;
  const fam = (out.match(/^0 @\w+@ FAM$/gm) || []).length;
  assert.equal(indi, t.individuals.length);
  assert.equal(fam, t.families.length);
  for (const line of out.split('\n')) { if (line) assert.match(line, /^[0-9] /); }
});
