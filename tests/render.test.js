import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../scripts/lib/render.js';

test('substitutes a simple token', () => {
  assert.equal(render('Hello {{name}}', { name: 'World' }), 'Hello World');
});

test('substitutes multiple tokens', () => {
  assert.equal(
    render('{{greeting}}, {{name}}!', { greeting: 'Hola', name: 'Jaime' }),
    'Hola, Jaime!'
  );
});

test('substitutes nested keys via dot notation', () => {
  assert.equal(
    render('{{user.name}}', { user: { name: 'Ana' } }),
    'Ana'
  );
});

test('preserves whitespace inside braces', () => {
  assert.equal(render('{{ name }}', { name: 'Luis' }), 'Luis');
});

test('throws when a token is unresolved', () => {
  assert.throws(
    () => render('Hi {{missing}}', {}),
    /unresolved token: missing/i
  );
});

test('returns input unchanged when there are no tokens', () => {
  assert.equal(render('plain string', { x: 1 }), 'plain string');
});

test('does not double-render — output containing braces is left alone', () => {
  assert.equal(
    render('{{html}}', { html: '{{not-a-token}}' }),
    '{{not-a-token}}'
  );
});

test('substitutes tokens with hyphens in keys (e.g. nav_urls.things-to-do)', () => {
  assert.equal(
    render('{{nav_urls.things-to-do}}', { nav_urls: { 'things-to-do': '/en/things-to-do' } }),
    '/en/things-to-do'
  );
});

test('throws on unresolved hyphenated token (catches typos)', () => {
  assert.throws(
    () => render('{{nav_urls.bad-key}}', { nav_urls: {} }),
    /unresolved token: nav_urls\.bad-key/i
  );
});
