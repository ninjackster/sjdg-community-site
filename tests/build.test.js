import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

before(() => {
  // Run the build once for all tests below.
  execSync('node scripts/build.js', { stdio: 'inherit' });
});

test('build creates dist/en/index.html', () => {
  assert.ok(existsSync('dist/en/index.html'), 'dist/en/index.html should exist');
});

test('build creates dist/es/index.html', () => {
  assert.ok(existsSync('dist/es/index.html'), 'dist/es/index.html should exist');
});

test('English homepage contains English hero copy', () => {
  const html = readFileSync('dist/en/index.html', 'utf8');
  assert.match(html, /Jalisco, México · Est\. 1793/);
  assert.match(html, /<html lang="en">/);
});

test('Spanish homepage contains Spanish lang attribute and Spanish hero copy', () => {
  const html = readFileSync('dist/es/index.html', 'utf8');
  assert.match(html, /<html lang="es-MX">/);
  // The exact ES eyebrow string from home.json:
  assert.match(html, /Jalisco, México · Fund\. 1793/);
});

test('Both pages include hreflang tags pointing at each other', () => {
  for (const path of ['dist/en/index.html', 'dist/es/index.html']) {
    const html = readFileSync(path, 'utf8');
    assert.match(html, /hreflang="en" href="https:\/\/sanjosedegracia\.net\/en\/"/);
    assert.match(html, /hreflang="es" href="https:\/\/sanjosedegracia\.net\/es\/"/);
    assert.match(html, /hreflang="x-default" href="https:\/\/sanjosedegracia\.net\/en\/"/);
  }
});

test('Built pages contain no leftover {{tokens}}', () => {
  for (const path of ['dist/en/index.html', 'dist/es/index.html']) {
    const html = readFileSync(path, 'utf8');
    assert.doesNotMatch(html, /\{\{[\w.\s]+\}\}/, `unresolved token in ${path}`);
  }
});

test('Canonical URL is language-specific', () => {
  const en = readFileSync('dist/en/index.html', 'utf8');
  const es = readFileSync('dist/es/index.html', 'utf8');
  assert.match(en, /<link rel="canonical" href="https:\/\/sanjosedegracia\.net\/en\/" \/>/);
  assert.match(es, /<link rel="canonical" href="https:\/\/sanjosedegracia\.net\/es\/" \/>/);
});
