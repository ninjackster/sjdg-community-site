// Sitemap generator.
//
// The sitemap is generated at build time from the SAME inputs that produce the
// pages (page-slugs.json for static routes, the resolved businesses snapshot for
// per-business pages). This guarantees the sitemap can never list a URL the build
// didn't emit — the previous static sitemap.xml drifted and listed businesses that
// had been removed from Google Places, producing 404s in Search Console.

// Per-page sitemap hints. Pages NOT listed here are excluded from the sitemap
// (e.g. the private `family`/`familia` page, which is also Disallow-ed in robots.txt).
const PAGE_META = {
  'home':          { priority: '1.0', changefreq: 'weekly' },
  'businesses':    { priority: '0.9', changefreq: 'daily' },
  'things-to-do':  { priority: '0.8', changefreq: 'monthly' },
  'getting-here':  { priority: '0.8', changefreq: 'monthly' },
  'where-to-eat':  { priority: '0.8', changefreq: 'monthly' },
  'where-to-stay': { priority: '0.8', changefreq: 'monthly' },
  'tour':          { priority: '0.8', changefreq: 'monthly' },
  'faq':           { priority: '0.7', changefreq: 'monthly' },
  'history':       { priority: '0.7', changefreq: 'monthly' },
  'festivals':     { priority: '0.7', changefreq: 'monthly' },
  'advertise':     { priority: '0.6', changefreq: 'monthly' },
};

const BUSINESS_META = { priority: '0.6', changefreq: 'weekly' };

function url(siteUrl, lang, slug) {
  // home slug is "" → /en/ , /es/ (trailing slash); others have no trailing slash.
  return slug ? `${siteUrl}/${lang}/${slug}` : `${siteUrl}/${lang}/`;
}

function urlBlock({ loc, lastmod, changefreq, priority, alternates }) {
  const lines = [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
  ];
  for (const alt of alternates) {
    lines.push(`    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />`);
  }
  lines.push('  </url>');
  return lines.join('\n');
}

/**
 * Build the sitemap XML.
 * @param {object} opts
 * @param {object} opts.pageSlugs  parsed content/shared/page-slugs.json
 * @param {object|null} opts.snapshot resolved businesses snapshot ({ businesses: [{slug}] }) or null
 * @param {string} opts.siteUrl  e.g. https://sanjosedegracia.net (no trailing slash)
 * @param {string} opts.lastmod  YYYY-MM-DD
 * @returns {string} sitemap.xml contents
 */
export function generateSitemap({ pageSlugs, snapshot, siteUrl, lastmod }) {
  const blocks = [];

  // Static pages — one <url> per language pair, with full hreflang alternates.
  for (const pageName of Object.keys(pageSlugs)) {
    const meta = PAGE_META[pageName];
    if (!meta) continue; // excluded (private/admin) page
    const enSlug = pageSlugs[pageName].en;
    const esSlug = pageSlugs[pageName].es;
    const enUrl = url(siteUrl, 'en', enSlug);
    const esUrl = url(siteUrl, 'es', esSlug);
    const alternates = [
      { hreflang: 'en', href: enUrl },
      { hreflang: 'es', href: esUrl },
      { hreflang: 'x-default', href: enUrl },
    ];
    blocks.push(urlBlock({ loc: enUrl, lastmod, ...meta, alternates }));
    blocks.push(urlBlock({ loc: esUrl, lastmod, ...meta, alternates }));
  }

  // Per-business pages — only slugs present in the resolved snapshot.
  const businesses = snapshot?.businesses ?? [];
  for (const b of businesses) {
    const enUrl = `${siteUrl}/en/businesses/${b.slug}`;
    const esUrl = `${siteUrl}/es/negocios/${b.slug}`;
    const alternates = [
      { hreflang: 'en', href: enUrl },
      { hreflang: 'es', href: esUrl },
      { hreflang: 'x-default', href: enUrl },
    ];
    blocks.push(urlBlock({ loc: enUrl, lastmod, ...BUSINESS_META, alternates }));
    blocks.push(urlBlock({ loc: esUrl, lastmod, ...BUSINESS_META, alternates }));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

${blocks.join('\n')}
</urlset>
`;
}
