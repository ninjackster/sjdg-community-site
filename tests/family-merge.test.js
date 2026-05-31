import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyApproved } from '../scripts/lib/family-merge.js';

const base = () => ({
  individuals: [
    { id: 'I1', names: { given: 'Root', surnames: ['A'] }, sex: 'M' },
    { id: 'I2', names: { given: 'Dad', surnames: ['A'] }, sex: 'M' },
    { id: 'I3', names: { given: 'Mom', surnames: ['B'] }, sex: 'F' },
  ],
  families: [{ id: 'F1', husband: 'I2', wife: 'I3', children: ['I1'] }],
});

test('child of a parent is added to that parent\'s family', () => {
  const t = applyApproved(base(), [{ id: 'X1', relativeOf: 'I2', relationship: 'child', names: { given: 'Kid', surnames: ['A'] } }]);
  assert.ok(t.individuals.find(i => i.id === 'X1'));
  assert.ok(t.families.find(f => f.id === 'F1').children.includes('X1'));
});

test('sibling of the root joins the root\'s family of origin', () => {
  const t = applyApproved(base(), [{ id: 'X2', relativeOf: 'I1', relationship: 'sibling', names: { given: 'Sib', surnames: ['A'] } }]);
  assert.ok(t.families.find(f => f.id === 'F1').children.includes('X2'));
});

test('spouse of a single parent fills the empty slot', () => {
  const tree = base(); tree.families = [{ id: 'F1', husband: 'I2', wife: null, children: ['I1'] }];
  const t = applyApproved(tree, [{ id: 'X3', relativeOf: 'I2', relationship: 'spouse', names: { given: 'Wife', surnames: ['C'] }, sex: 'F' }]);
  assert.equal(t.families.find(f => f.id === 'F1').wife, 'X3');
});

test('parent of someone whose origin family has an empty slot fills it', () => {
  const tree = base(); tree.families = [{ id: 'F1', husband: 'I2', wife: null, children: ['I1'] }];
  const t = applyApproved(tree, [{ id: 'X4', relativeOf: 'I1', relationship: 'parent', names: { given: 'Mother', surnames: ['B'] }, sex: 'F' }]);
  assert.equal(t.families.find(f => f.id === 'F1').wife, 'X4');
});

test('child of a childless person creates a new family with them as parent', () => {
  const t = applyApproved(base(), [{ id: 'X5', relativeOf: 'I1', relationship: 'child', names: { given: 'GrandKid', surnames: ['A'] } }]);
  const f = t.families.find(f => (f.children || []).includes('X5'));
  assert.ok(f && (f.husband === 'I1' || f.wife === 'I1'));
});

test('ignores invalid or duplicate submissions', () => {
  const t = applyApproved(base(), [
    { id: 'I1', relativeOf: 'I2', relationship: 'child', names: { given: 'Dup' } }, // duplicate id
    { id: 'X6', relativeOf: 'NOPE', relationship: 'child', names: { given: 'Orphan' } }, // unknown target
    { relativeOf: 'I2', relationship: 'child' }, // no id
  ]);
  assert.equal(t.individuals.length, 3); // none added
});

test('does not mutate the input tree', () => {
  const tree = base();
  applyApproved(tree, [{ id: 'X7', relativeOf: 'I2', relationship: 'child', names: { given: 'Kid' } }]);
  assert.equal(tree.individuals.length, 3);
  assert.equal(tree.families[0].children.length, 1);
});
