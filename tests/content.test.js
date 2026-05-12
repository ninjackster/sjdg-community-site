import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent, resolveLang } from '../scripts/lib/content.js';

test('loadContent reads JSON from a path', async () => {
  const data = await loadContent('tests/fixtures/sample.json');
  assert.equal(data.title.en, 'Hello');
  assert.equal(data.title.es, 'Hola');
});

test('resolveLang flattens {en,es} fields to a single language', () => {
  const data = {
    title: { en: 'Hello', es: 'Hola' },
    constant: 'shared',
  };
  assert.deepEqual(resolveLang(data, 'en'), { title: 'Hello', constant: 'shared' });
  assert.deepEqual(resolveLang(data, 'es'), { title: 'Hola',  constant: 'shared' });
});

test('resolveLang recurses into nested objects', () => {
  const data = {
    nav: {
      home:  { en: 'Home',     es: 'Inicio' },
      about: { en: 'About',    es: 'Acerca' },
    },
  };
  assert.deepEqual(resolveLang(data, 'es'), {
    nav: { home: 'Inicio', about: 'Acerca' },
  });
});

test('resolveLang preserves arrays and recurses into their items', () => {
  const data = {
    items: [
      { label: { en: 'A', es: 'Uno' } },
      { label: { en: 'B', es: 'Dos' } },
    ],
  };
  assert.deepEqual(resolveLang(data, 'es'), {
    items: [{ label: 'Uno' }, { label: 'Dos' }],
  });
});

test('resolveLang throws when the requested language is missing', () => {
  const data = { title: { en: 'Only English' } };
  assert.throws(() => resolveLang(data, 'es'), /missing translation for lang "es"/);
});
