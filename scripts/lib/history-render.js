// Pure HTML renderers for the history page. The site's template engine does flat
// {{token}} replacement only (no loops), so lists are pre-rendered to HTML strings
// here and injected as {en,es} content fields by the build (see scripts/build.js).

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderTimeline(timeline, lang) {
  const heading = (timeline.heading && timeline.heading[lang]) || '';
  const items = (timeline.entries || []).map(e => {
    const year = e.year && typeof e.year === 'object' ? e.year[lang] : e.year;
    return '<li><span class="cr-tl-year">' + esc(year) + '</span>' +
      '<span class="cr-tl-label">' + esc(e.label && e.label[lang]) + '</span></li>';
  }).join('');
  return '<h2>' + esc(heading) + '</h2><ol class="cr-tl">' + items + '</ol>';
}

const KIND_LABEL = {
  place: { en: 'Place', es: 'Lugar' }, person: { en: 'Person', es: 'Persona' },
  object: { en: 'Object', es: 'Objeto' }, event: { en: 'Event', es: 'Suceso' },
};

export function renderHistorias(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const cards = (data.stories || []).map(s => {
    const kind = (KIND_LABEL[s.kind] && KIND_LABEL[s.kind][lang]) || esc(s.kind);
    return '<article class="cr-story" data-kind="' + esc(s.kind) + '">' +
      '<span class="cr-story-kind">' + esc(kind) + '</span>' +
      '<h3>' + esc(s.title && s.title[lang]) + '</h3>' +
      '<p>' + esc(s.body && s.body[lang]) + '</p>' +
      '</article>';
  }).join('');
  return '<h2>' + esc(heading) + '</h2><div class="cr-stories">' + cards + '</div>';
}

export function renderVoces(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const intro = (data.intro && data.intro[lang]) || '';
  const items = data.items || [];
  let inner;
  if (!items.length) {
    inner = '<p class="cr-empty">' + esc((data.empty && data.empty[lang]) || '') + '</p>';
  } else {
    inner = items.map(v => {
      const speaker = esc((v.speaker && v.speaker[lang]) || '');
      const player = v.kind === 'embed'
        ? '<iframe class="cr-voz-embed" src="' + esc(v.audioSrc) + '" loading="lazy" allow="encrypted-media" title="' + speaker + '"></iframe>'
        : '<audio class="cr-voz-audio" controls preload="none" src="' + esc(v.audioSrc) + '"></audio>';
      const transcript = esc((v.transcript && v.transcript[lang]) || '');
      return '<figure class="cr-voz">' +
        (speaker ? '<figcaption class="cr-voz-by">' + speaker + '</figcaption>' : '') +
        player +
        (transcript ? '<details class="cr-voz-tr"><summary>' + (lang === 'es' ? 'Transcripción' : 'Transcript') + '</summary><p>' + transcript + '</p></details>' : '') +
        '</figure>';
    }).join('');
  }
  return '<h2>' + esc(heading) + '</h2>' + (intro ? '<p>' + esc(intro) + '</p>' : '') + '<div class="cr-voces-list">' + inner + '</div>';
}

export function renderFotos(data, lang) {
  const heading = (data.heading && data.heading[lang]) || '';
  const intro = (data.intro && data.intro[lang]) || '';
  const pairs = data.pairs || [];
  let inner;
  if (!pairs.length) {
    inner = '<p class="cr-empty">' + esc((data.empty && data.empty[lang]) || '') + '</p>';
  } else {
    inner = pairs.map(p => {
      const thenCap = esc((p.then.caption && p.then.caption[lang]) || '');
      const nowCap = esc((p.now.caption && p.now.caption[lang]) || '');
      const year = esc(p.then.year || '');
      return '<figure class="cr-juxta-fig">' +
        '<div class="cr-juxta" role="group" aria-label="' + thenCap + '">' +
          '<img class="cr-juxta-now" src="' + esc(p.now.src) + '" alt="' + nowCap + '" />' +
          '<div class="cr-juxta-then"><img src="' + esc(p.then.src) + '" alt="' + thenCap + '" /></div>' +
          '<input class="cr-juxta-range" type="range" min="0" max="100" value="50" aria-label="' + (lang === 'es' ? 'Comparar antes y ahora' : 'Compare then and now') + '" />' +
        '</div>' +
        '<figcaption>' + (year ? '<strong>' + year + '</strong> · ' : '') + thenCap + (nowCap ? ' → ' + nowCap : '') + '</figcaption>' +
        '</figure>';
    }).join('');
  }
  return '<h2>' + esc(heading) + '</h2>' + (intro ? '<p>' + esc(intro) + '</p>' : '') + '<div class="cr-fotos-list">' + inner + '</div>';
}
