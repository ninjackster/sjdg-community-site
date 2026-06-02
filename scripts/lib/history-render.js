// Pure HTML renderers for the history page. The site's template engine does flat
// {{token}} replacement only (no loops), so lists are pre-rendered to HTML strings
// here and injected as {en,es} content fields by the build (see scripts/build.js).

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderTimeline(timeline, lang) {
  const heading = (timeline.heading && timeline.heading[lang]) || '';
  const items = (timeline.entries || []).map(e =>
    '<li><span class="cr-tl-year">' + esc(e.year) + '</span>' +
    '<span class="cr-tl-label">' + esc(e.label && e.label[lang]) + '</span></li>'
  ).join('');
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
