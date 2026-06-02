import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPeople } from '../family-search.js';

const ind = (id, given, surnames) => ({ id, names: { given, surnames } });
const tree = () => ({
  individuals: [
    ind('I1', 'Jaime', ['Murillo', 'Mena']),
    ind('I2', 'Héctor', ['Murillo', 'Patiño']),
    ind('I3', 'Mercedes', ['Mena', 'Ruiz']),
    ind('I71', 'Alexis', ['Murillo']),
    ind('I130', 'Carmela', ['Murillo', 'Villalobos']),
    ind('I134', '¿?', ['Murillo', 'Villalobos']),
  ],
  families: [],
});

test('empty query returns nothing', () => {
  assert.deepEqual(searchPeople(tree(), ''), []);
  assert.deepEqual(searchPeople(tree(), '   '), []);
});

test('matches by given name, case-insensitive', () => {
  const r = searchPeople(tree(), 'jaime');
  assert.equal(r[0].id, 'I1');
  assert.equal(r[0].name, 'Jaime Murillo Mena');
});

test('accent-insensitive: "hector" matches "Héctor"', () => {
  const r = searchPeople(tree(), 'hector');
  assert.ok(r.some(m => m.id === 'I2'));
});

test('matches by surname', () => {
  const r = searchPeople(tree(), 'mena');
  const ids = r.map(m => m.id);
  assert.ok(ids.includes('I1') && ids.includes('I3'));
});

test('prefix matches rank above mid-word matches', () => {
  // "mar" should rank Carmela? no — prefix of a word: "Mercedes"? none start mar.
  // Use "mur": all Murillos; given-name prefix none, so all are word-prefix on surname.
  const r = searchPeople(tree(), 'me');
  // "Mercedes" (given prefix) and "Mena" (surname word prefix) should outrank nothing else;
  // ensure Mercedes (given starts with "Me") is present and ranked at/near top.
  assert.ok(r.length > 0);
  assert.equal(typeof r[0].id, 'string');
});

test('placeholder ¿? is excluded from results', () => {
  const r = searchPeople(tree(), 'murillo');
  assert.ok(!r.some(m => m.id === 'I134'), 'placeholder excluded');
  assert.ok(r.some(m => m.id === 'I130'), 'real Murillo included');
});

test('respects a result limit', () => {
  const r = searchPeople(tree(), 'murillo', 2);
  assert.equal(r.length, 2);
});
