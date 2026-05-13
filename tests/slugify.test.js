import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, businessSlug } from '../scripts/lib/slugify.js';

test('slugify lowercases and dashes spaces', () => {
  assert.equal(slugify('La Cocina'), 'la-cocina');
});

test('slugify strips diacritics', () => {
  assert.equal(slugify('Café Azul Cobalto'), 'cafe-azul-cobalto');
  assert.equal(slugify('Paletería y Nevería San José'), 'paleteria-y-neveria-san-jose');
});

test('slugify drops non-alphanumeric (except dashes)', () => {
  assert.equal(slugify("Doña Maria's Kitchen!"), 'dona-marias-kitchen');
});

test('slugify collapses multiple dashes and trims edges', () => {
  assert.equal(slugify('  ---Foo   --  Bar---  '), 'foo-bar');
});

test('slugify on empty / whitespace returns empty string', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify('   '), '');
});

test('businessSlug appends last 6 chars of place_id for uniqueness', () => {
  assert.equal(
    businessSlug('Café Azul Cobalto', 'ChIJabc123def456'),
    'cafe-azul-cobalto-def456'
  );
});

test('businessSlug handles short place_ids', () => {
  assert.equal(businessSlug('Test', 'ABC'), 'test-abc');
});

test('businessSlug falls back to "place" when name is empty', () => {
  assert.equal(businessSlug('', 'ChIJxyz789abc'), 'place-789abc');
});
