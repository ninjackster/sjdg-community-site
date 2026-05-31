import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTree } from '../scripts/lib/family-tree.js';

const ok = {
  individuals: [
    { id: 'I1', names: { given: 'Jaime', surnames: ['Murillo', 'Mena'] }, sex: 'M',
      birth: { date: null, place: null }, death: { date: null, place: null },
      photo: null, surnameOrigin: null, recordLinks: [], notes: { en: '', es: '' } },
    { id: 'I2', names: { given: 'José', surnames: ['Murillo', 'Villalobos'] }, sex: 'M',
      birth: { date: null, place: 'San José de Gracia, Jalisco' }, death: { date: null, place: null },
      photo: null, surnameOrigin: { text: 'Murillo — toponímico', confidence: 'high' },
      recordLinks: [{ label: 'Tepatitlán', url: 'https://example.org' }], notes: { en: '', es: '' } },
  ],
  families: [{ id: 'F1', husband: 'I2', wife: null, children: ['I1'] }],
};

test('accepts a well-formed tree', () => {
  assert.deepEqual(validateTree(ok), { valid: true, errors: [] });
});

test('rejects duplicate individual ids', () => {
  const bad = structuredClone(ok);
  bad.individuals[1].id = 'I1';
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /duplicate individual id: I1/i);
});

test('rejects a family referencing an unknown individual', () => {
  const bad = structuredClone(ok);
  bad.families[0].children = ['I999'];
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /family F1 references unknown individual: I999/i);
});

test('rejects an individual missing a given name', () => {
  const bad = structuredClone(ok);
  delete bad.individuals[0].names.given;
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /individual I1 missing names\.given/i);
});

test('rejects an invalid surnameOrigin confidence', () => {
  const bad = structuredClone(ok);
  bad.individuals[1].surnameOrigin.confidence = 'maybe';
  const res = validateTree(bad);
  assert.equal(res.valid, false);
  assert.match(res.errors.join('\n'), /individual I2 surnameOrigin\.confidence must be one of/i);
});
