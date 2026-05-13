import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

before(() => {
  execSync('node scripts/build.js', { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
});

const LEGACY_FILES = [
  'admin-businesses.html',
  'robots.txt',
  'sitemap.xml',
  'favicon-32.png',
  'favicon-48.png',
  'favicon-192.png',
  'apple-touch-icon.png',
  'jmm-logo.png',
  'pueblo-1.webp',
  'pueblo-2.webp',
  'pueblo-3.webp',
  'church-hero.jpg',
  'temple.png',
];

test('passthrough copies all legacy HTML and assets to dist/', () => {
  for (const file of LEGACY_FILES) {
    assert.ok(existsSync(`dist/${file}`), `dist/${file} should exist`);
    assert.ok(statSync(`dist/${file}`).size > 0, `dist/${file} should be non-empty`);
  }
});

test('passthrough copies api/ directory', () => {
  assert.ok(existsSync('dist/api/blocked-places.js'), 'dist/api/blocked-places.js should exist');
});
