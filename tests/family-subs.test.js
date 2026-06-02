import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEditSubmission } from '../scripts/lib/family-subs.js';

const base = { targetId: 'I1', given: 'Jaime', surnames: 'Murillo Mena', birth: '1990', death: '', note: 'fix spelling' };

test('valid edit submission has the expected shape', () => {
  const { sub, error } = buildEditSubmission(base, 'Xabc', 123);
  assert.equal(error, undefined);
  assert.equal(sub.id, 'Xabc');
  assert.equal(sub.kind, 'edit');
  assert.equal(sub.status, 'pending');
  assert.equal(sub.targetId, 'I1');
  assert.equal(sub.names.given, 'Jaime');
  assert.deepEqual(sub.names.surnames, ['Murillo', 'Mena']);
  assert.equal(sub.birth.date, '1990');
  assert.equal(sub.birth.place, null);
  assert.equal(sub.death.date, null);
  assert.equal(sub.notes.en, 'fix spelling');
  assert.equal(sub.notes.es, 'fix spelling');
  assert.equal(sub.ts, 123);
});

test('missing targetId is rejected', () => {
  const { sub, error } = buildEditSubmission({ ...base, targetId: '' }, 'X', 1);
  assert.equal(sub, undefined);
  assert.match(error, /targetId/);
});

test('missing given name is rejected', () => {
  const { error } = buildEditSubmission({ ...base, given: '   ' }, 'X', 1);
  assert.match(error, /name/i);
});

test('surnames as array is clamped to 3 and trimmed', () => {
  const { sub } = buildEditSubmission({ ...base, surnames: [' A ', 'B', 'C', 'D'] }, 'X', 1);
  assert.deepEqual(sub.names.surnames, ['A', 'B', 'C']);
});

test('surnames string splits on whitespace', () => {
  const { sub } = buildEditSubmission({ ...base, surnames: '  Patiño   Gutiérrez ' }, 'X', 1);
  assert.deepEqual(sub.names.surnames, ['Patiño', 'Gutiérrez']);
});

test('given is clamped to 60 chars and note to 600', () => {
  const { sub } = buildEditSubmission({ ...base, given: 'x'.repeat(80), note: 'y'.repeat(900) }, 'X', 1);
  assert.equal(sub.names.given.length, 60);
  assert.equal(sub.notes.en.length, 600);
});

test('blank birth/death become null', () => {
  const { sub } = buildEditSubmission({ ...base, birth: '   ', death: undefined }, 'X', 1);
  assert.equal(sub.birth.date, null);
  assert.equal(sub.death.date, null);
});
