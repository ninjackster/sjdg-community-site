import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPage } from '../scripts/lib/build-page.js';

const LAYOUT = `<!DOCTYPE html>
<html lang="{{lang}}">
<head>
<title>{{meta.title}}</title>
<link rel="canonical" href="{{canonical}}" />
{{hreflang}}
</head>
<body>{{content}}</body>
</html>`;

const PAGE = `<h1>{{hero.headline}}</h1><p>{{hero.sub}}</p>`;

const CONTENT = {
  meta: {
    slug:  { en: '',          es: '' },
    title: { en: 'EN Title',  es: 'ES Título' },
  },
  hero: {
    headline: { en: 'Hello',  es: 'Hola' },
    sub:      { en: 'Sub EN', es: 'Sub ES' },
  },
};

const SHARED = {};
const SITE_URL = 'https://example.com';

test('builds an English page with EN content', () => {
  const html = buildPage({
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /<p>Sub EN<\/p>/);
  assert.match(html, /<title>EN Title<\/title>/);
});

test('builds a Spanish page with ES content', () => {
  const html = buildPage({
    lang: 'es',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<html lang="es-MX">/);
  assert.match(html, /<h1>Hola<\/h1>/);
  assert.match(html, /<p>Sub ES<\/p>/);
});

test('emits canonical URL pointing at the current-language URL', () => {
  const html = buildPage({
    lang: 'es',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/es\/" \/>/);
});

test('emits hreflang tags for every language plus x-default', () => {
  const html = buildPage({
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/example\.com\/en\/" \/>/);
  assert.match(html, /<link rel="alternate" hreflang="es" href="https:\/\/example\.com\/es\/" \/>/);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/example\.com\/en\/" \/>/);
});

test('hreflang reflects translated slugs', () => {
  const content = {
    meta: {
      slug:  { en: 'businesses', es: 'negocios' },
      title: { en: 'B', es: 'N' },
    },
    hero: { headline: { en: 'X', es: 'Y' }, sub: { en: 'a', es: 'b' } },
  };
  const html = buildPage({
    lang: 'en',
    layout: LAYOUT,
    pageTemplate: PAGE,
    content,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /hreflang="en" href="https:\/\/example\.com\/en\/businesses" \/>/);
  assert.match(html, /hreflang="es" href="https:\/\/example\.com\/es\/negocios" \/>/);
});

test('throws if any token is left unresolved (catches missing translations)', () => {
  const broken = {
    meta: { slug: { en: '', es: '' }, title: { en: 'T', es: 'T' } },
    hero: { headline: { en: 'X', es: 'Y' } },  // sub is missing
  };
  assert.throws(
    () => buildPage({
      lang: 'en',
      layout: LAYOUT,
      pageTemplate: PAGE,
      content: broken,
      shared: SHARED,
      siteUrl: SITE_URL,
    }),
    /unresolved token/i
  );
});

const PAGE_SLUGS = {
  home:       { en: '',            es: '' },
  businesses: { en: 'businesses',  es: 'negocios' },
  faq:        { en: 'faq',         es: 'preguntas' },
};

test('exposes nav_urls for the current language', () => {
  const html = buildPage({
    lang: 'en',
    layout: '<a href="{{nav_urls.businesses}}">B</a><a href="{{nav_urls.faq}}">F</a>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
    pageSlugs: PAGE_SLUGS,
  });
  assert.match(html, /<a href="\/en\/businesses">B<\/a>/);
  assert.match(html, /<a href="\/en\/faq">F<\/a>/);
});

test('nav_urls swaps to Spanish slugs when lang is es', () => {
  const html = buildPage({
    lang: 'es',
    layout: '<a href="{{nav_urls.businesses}}">B</a><a href="{{nav_urls.faq}}">F</a>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
    pageSlugs: PAGE_SLUGS,
  });
  assert.match(html, /<a href="\/es\/negocios">B<\/a>/);
  assert.match(html, /<a href="\/es\/preguntas">F<\/a>/);
});

test('nav_urls.home points at the language root', () => {
  const html = buildPage({
    lang: 'es',
    layout: '<a href="{{nav_urls.home}}">H</a>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
    pageSlugs: PAGE_SLUGS,
  });
  assert.match(html, /<a href="\/es\/">H<\/a>/);
});

test('buildPage works without pageSlugs (backwards compat — nav_urls is empty object)', () => {
  const html = buildPage({
    lang: 'en',
    layout: '<p>{{meta.title}}</p>',
    pageTemplate: '',
    content: CONTENT,
    shared: SHARED,
    siteUrl: SITE_URL,
  });
  assert.match(html, /<p>EN Title<\/p>/);
});
