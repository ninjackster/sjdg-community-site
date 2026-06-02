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
