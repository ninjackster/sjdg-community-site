import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

test('base.html schema no longer asserts 1,980 m or "Founded in 1793"', async () => {
  const base = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  assert.doesNotMatch(base, /1,980\s*m/i);
  assert.doesNotMatch(base, /Founded in 1793/i);
});

import { loadContent } from '../scripts/lib/content.js';

test('history content is corrected, bylined, and sourced', async () => {
  const c = await loadContent(join(ROOT, 'content/pages/history.json'));
  const json = JSON.stringify(c);
  // facts corrected
  assert.doesNotMatch(json, /Founded in 1793|Fundado en 1793|1,980/);
  assert.match(json, /1,907|1,900/);
  // byline present (both langs)
  assert.match(c.byline.en, /Compilado por Jaime Murillo/);
  assert.match(c.byline.es, /Compilado por Jaime Murillo/);
  // all 9 narrative sections present
  for (const k of ['place','origins','administrative','faith','cristero','economy','people','culture','book1897']) {
    assert.ok(c.sections[k] && c.sections[k].h2 && c.sections[k].body, `missing section ${k}`);
  }
  // sources block present with at least 4 items rendered as HTML list
  assert.match(c.sources.body.en, /<li/);
  assert.ok((c.sources.body.en.match(/<li/g) || []).length >= 4);
  // pdf button label present
  assert.ok(c.pdf.label.en && c.pdf.label.es);
});

import { buildPage } from '../scripts/lib/build-page.js';
import { renderTimeline, renderHistorias, renderVoces, renderFotos } from '../scripts/lib/history-render.js';
import { validateStories } from '../scripts/lib/history-stories.js';
import { validateVoces, validateFotos } from '../scripts/lib/history-media.js';
import { renderLocatorMap, renderDiasporaMap } from '../scripts/lib/render-maps.js';
import { feature } from 'topojson-client';

async function buildHistory(lang) {
  const layout = await readFile(join(ROOT, 'templates/layouts/base.html'), 'utf8');
  const tpl = await readFile(join(ROOT, 'templates/pages/history.html'), 'utf8');
  const content = await loadContent(join(ROOT, 'content/pages/history.json'));
  const shared = {
    nav: await loadContent(join(ROOT, 'content/shared/nav.json')),
    footer: await loadContent(join(ROOT, 'content/shared/footer.json')),
    common: await loadContent(join(ROOT, 'content/shared/common.json')),
  };
  const pageSlugs = await loadContent(join(ROOT, 'content/shared/page-slugs.json'));
  // Mirror the history augmentation in scripts/build.js (no template loops).
  const stories = await loadContent(join(ROOT, 'content/history/stories.json'));
  const v = validateStories(stories);
  if (!v.valid) throw new Error('invalid stories.json: ' + v.errors.join('; '));
  content.timeline.body = { en: renderTimeline(content.timeline, 'en'), es: renderTimeline(content.timeline, 'es') };
  content.historias = { body: { en: renderHistorias(stories, 'en'), es: renderHistorias(stories, 'es') } };
  const voces = await loadContent(join(ROOT, 'content/history/voces.json'));
  const fotos = await loadContent(join(ROOT, 'content/history/fotos.json'));
  const vv = validateVoces(voces);
  if (!vv.valid) throw new Error('invalid voces.json: ' + vv.errors.join('; '));
  const vf = validateFotos(fotos);
  if (!vf.valid) throw new Error('invalid fotos.json: ' + vf.errors.join('; '));
  content.voces = { body: { en: renderVoces(voces, 'en'), es: renderVoces(voces, 'es') } };
  content.fotos = { body: { en: renderFotos(fotos, 'en'), es: renderFotos(fotos, 'es') } };
  // Mirror the map injection in scripts/build.js.
  const countriesTopo = JSON.parse(await readFile(join(ROOT, 'data/geo/countries-50m.json'), 'utf8'));
  const usTopo = JSON.parse(await readFile(join(ROOT, 'data/geo/us-states-10m.json'), 'utf8'));
  const mexico = feature(countriesTopo, countriesTopo.objects.countries).features.find((f) => String(f.id) === '484');
  const usStates = feature(usTopo, usTopo.objects.states);
  const locator = await loadContent(join(ROOT, 'content/maps/locator.json'));
  const diaspora = await loadContent(join(ROOT, 'content/maps/diaspora.json'));
  content.mapa = { body: { en: renderLocatorMap({ mexico, content: locator }, 'en'), es: renderLocatorMap({ mexico, content: locator }, 'es') } };
  content.diaspora_map = { body: { en: renderDiasporaMap({ usStates, content: diaspora }, 'en'), es: renderDiasporaMap({ usStates, content: diaspora }, 'es') } };
  return buildPage({ lang, layout, pageTemplate: tpl, content, shared, siteUrl: 'https://sanjosedegracia.net', pageSlugs });
}

test('history page renders long-form with print affordances and no unresolved tokens', async () => {
  const html = await buildHistory('es');
  assert.doesNotMatch(html, /\{\{.*?\}\}/);                 // no unresolved tokens
  assert.match(html, /Compilado por Jaime Murillo/);        // byline
  assert.match(html, /@media print/);                       // print stylesheet
  assert.match(html, /window\.print\(\)/);                  // download-pdf trigger
  for (const id of ['raices','place','origins','administrative','faith','cristero','economy','people','culture','book1897','cronista','notables','sources']) {
    assert.match(html, new RegExp(`id="sec-${id}"`), `missing #sec-${id}`);
  }
  assert.match(html, /Descargar PDF/);                      // es pdf label
});

test('built history page renders Mapa (locator) + Diáspora (map + narrative)', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.doesNotMatch(html, /\{\{.*?\}\}/, `unresolved token in ${lang}`);
    assert.match(html, /id="sec-mapa"/);
    assert.match(html, /id="sec-diaspora"/);
    // both maps emit inline SVG, no leaked NaN coordinates
    assert.ok((html.match(/<svg/g) || []).length >= 2, 'two map svgs');
    assert.doesNotMatch(html, /NaN/);
    // locator: town label + OSM link
    assert.match(html, /San José de Gracia/);
    assert.match(html, /href="https:\/\/www\.openstreetmap\.org/);
    // diaspora: destinations + narrative + Santo Toribio
    assert.match(html, /California ~58%/);
    assert.match(html, lang === 'es' ? /Santo Toribio Romo/ : /Santo Toribio Romo/);
    assert.match(html, lang === 'es' ? /era de los braceros/ : /Bracero era/);
  }
});

test('built history page renders Raíces deep-history + extended timeline anchors', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.doesNotMatch(html, /\{\{.*?\}\}/, `unresolved token in ${lang}`);
    assert.match(html, /id="sec-raices"/);
    // deep-history peoples + conquest arc present
    assert.match(html, lang === 'es' ? /tecuexes/i : /Tecuexes/);
    assert.match(html, lang === 'es' ? /Guerra del Mixtón/ : /Mixtón War/);
    assert.match(html, /Teuchitlán/);
    // timeline extended backward: a BCE/CE anchor + Tecuexes contact entry
    assert.match(html, lang === 'es' ? /a\.C\.–500 d\.C\./ : /BCE–500 CE/);
    assert.match(html, lang === 'es' ? /Al contacto/ : /At contact/);
  }
});

test('built history page renders timeline, historias, Battle, and ≥6 sources', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.doesNotMatch(html, /\{\{.*?\}\}/, `unresolved token in ${lang}`);
    assert.match(html, /class="cr-timeline"/);
    assert.match(html, /ol class="cr-tl"/);
    assert.ok((html.match(/<li/g) || []).length >= 15, 'timeline + sources list items present');
    assert.match(html, /id="sec-historias"/);
    assert.ok((html.match(/class="cr-story"/g) || []).length >= 4, 'four seed stories');
    assert.match(html, lang === 'es' ? /Batalla de Tepatitlán/ : /Battle of Tepatitlán/);
  }
});

test('built history page renders Voces, Fotos, and Colabora with empty states and WhatsApp CTA', async () => {
  for (const lang of ['en', 'es']) {
    const html = await buildHistory(lang);
    assert.doesNotMatch(html, /\{\{.*?\}\}/, `unresolved token in ${lang}`);
    // three new sections present
    assert.match(html, /id="sec-voces"/);
    assert.match(html, /id="sec-fotos"/);
    assert.match(html, /id="sec-colabora"/);
    // empty-state placeholders rendered (no seed media yet)
    assert.ok((html.match(/class="cr-empty"/g) || []).length >= 2, 'voces + fotos empty states');
    // Colabora WhatsApp contribution link
    assert.match(html, /href="https:\/\/wa\.me\/523316963003"/);
    // bilingual headings
    assert.match(html, lang === 'es' ? /Voces/ : /Voices/);
    assert.match(html, lang === 'es' ? /Comparte una memoria/ : /Share a memory/);
  }
});
