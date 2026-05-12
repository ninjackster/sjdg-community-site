import { render } from './render.js';
import { resolveLang } from './content.js';

const LANGS = ['en', 'es'];
const HTML_LANG = { en: 'en', es: 'es-MX' };
const DEFAULT_LANG = 'en';

function urlFor(siteUrl, lang, slug) {
  return slug ? `${siteUrl}/${lang}/${slug}` : `${siteUrl}/${lang}/`;
}

function buildHreflang(siteUrl, slugs) {
  const tags = LANGS.map(
    l => `<link rel="alternate" hreflang="${l}" href="${urlFor(siteUrl, l, slugs[l])}" />`
  );
  tags.push(
    `<link rel="alternate" hreflang="x-default" href="${urlFor(siteUrl, DEFAULT_LANG, slugs[DEFAULT_LANG])}" />`
  );
  return tags.join('\n');
}

export function buildPage({ lang, layout, pageTemplate, content, shared, siteUrl }) {
  const localized = resolveLang(content, lang);
  const localizedShared = resolveLang(shared, lang);

  const slugs = {};
  for (const l of LANGS) slugs[l] = content.meta.slug[l] ?? '';

  const ctx = {
    ...localized,
    shared: localizedShared,
    lang: HTML_LANG[lang],
    canonical: urlFor(siteUrl, lang, slugs[lang]),
    hreflang: buildHreflang(siteUrl, slugs),
  };

  // Render the page body first, then inject it into the layout.
  const body = render(pageTemplate, ctx);
  return render(layout, { ...ctx, content: body });
}
