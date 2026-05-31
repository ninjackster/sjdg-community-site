# SEO Overhaul — sanjosedegracia.net

**Date:** 2026-05-12
**Status:** Approved design, ready for implementation planning
**Owner:** Jaime Murillo

## Goal

Grow organic search traffic to the SJDG community website. Current organic search is ~6% of all traffic (38 sessions / 6 months). Target: 5–10× organic search within 6–9 months.

## Audience priority (locked)

D = mix, ranked: **C > A > B**

- **C — Local commerce / business directory** (highest priority): people searching specific businesses or "restaurantes en San José de Gracia"
- **A — Tourists / visitors**: "qué hacer en San José de Gracia," "pueblos cerca de Guadalajara"
- **B — Diaspora / paisanos**: news, fiestas, family-related searches

## Key data points (from GA4 + Search Console review)

- **Organic Search: 6% of sessions** (38 / 597 in last 6mo) — search is broken/underdeveloped
- **Mexico is #1 country (47%)**, US #2 (35%) — confirms Spanish-language search is the largest untapped market
- **Only 3 pages get traffic**: `/`, `/businesses`, `/advertise` — `/faq` and `/tour` aren't being found
- `/businesses` has best engagement (36s avg time) — directory intent is real and underserved
- `/advertise` gets ~5 visits/month — monetization is gated by lack of overall inbound traffic, not by the offer

## Root-cause analysis — why search isn't working

1. **Bilingual content is invisible to Google.** Translations live client-side in JS dictionaries (`T = {en, es}`). One URL per page; language is swapped in the DOM via `applyLang()`. Initial language picked by IP geolocation (`ipapi.co`). Googlebot crawls from US IPs and never runs the geolocation fetch — it sees only English HTML. **Spanish content is uncrawlable, unindexable, and therefore unrankable.** Given Mexico is the #1 country, this is the #1 problem.
2. **Business directory is fully client-side.** `/businesses` calls Google Places API in the browser. Googlebot sees an essentially empty page. There are no per-business URLs, so no individual business can rank for any query.
3. **Sitemap is incomplete.** Lists `/`, `/businesses`, `/advertise`. Missing `/faq`, `/tour`, and the entire Spanish version (which doesn't exist as separate URLs anyway).
4. **No `hreflang` signals** — even when bilingual URLs exist, Google needs to be told they're language alternates of each other.
5. **Mixed lang signals.** `<html lang="en">` is hardcoded while OG locale declares `es_MX` as primary.
6. **Duplicate content via `.org`.** `sanjosedegracia.org` is aliased (not redirected) to the same Vercel project, serving identical bytes. Google sees two sites; domain authority is split.
7. **Search Console misconfigured.** Property is `https://www.sanjosedegracia.net/` (URL-prefix, www only). Doesn't aggregate www/non-www data and doesn't cover `.org` at all.
8. **Topical content is buried in one giant homepage.** History video, events list, "getting here" content all live as sections of `/` instead of standalone, indexable, query-targeted pages.
9. **No `LocalBusiness` structured data** for any business listing. Only the homepage has a `TouristDestination` schema.

## Architectural decision — content authoring

**Selected: Custom Node build script (Option A)** generating static HTML to `dist/en/*` and `dist/es/*`, served by Vercel.

**Why:** Single source of truth (author once, both languages update). Honors the project's "vanilla HTML, no frameworks" principle. The existing `T = {en, es}` dictionaries can be migrated directly into JSON content files. Output is static HTML — Vercel serves files; no runtime cost; no framework lock-in.

**Rejected:**
- **Eleventy / Astro** — adds framework and convention overhead; "no frameworks" project rule.
- **Query param `?lang=es`** — weaker SEO signal than path-based; ranks worse.
- **Subdomain `es.sanjosedegracia.net`** — dilutes domain authority, more DNS config.

## Architectural decision — business directory

**Selected: Build-time snapshot with per-business static pages (Option Y)**

**Why:** The user's "hands off" requirement and the SEO need for per-business URLs both hold. A nightly Vercel cron job calls Google Places API server-side, writes a snapshot JSON, and the next build generates a static page per business. Self-updating after initial setup. Each business gets a real URL (`/es/negocios/[slug]`, `/en/businesses/[slug]`) with full `LocalBusiness` schema and is individually rankable.

**Rejected:**
- **Z (Featured-only static pages)** — leaves audience C's long-tail mostly unserved; small cost savings not worth it given user is fine with ~$0.50/mo Places API spend.
- **X (keep current dynamic-only)** — gives up the entire long-tail of business-name searches.

The existing live grid on `/businesses` and `/es/negocios` can be retained for freshness UX (open-now filter, real-time data), with the static per-business pages serving SEO and direct linking.

## Target URL structure

```
/                         → 302 redirect to /en/ or /es/ based on Accept-Language
/en/                      English homepage
/es/                      Spanish homepage
/en/businesses            Directory landing
/es/negocios              Directory landing (Spanish)
/en/businesses/[slug]     Per-business static page
/es/negocios/[slug]       Per-business static page (Spanish)
/en/things-to-do          Tourist intent landing
/es/que-hacer             Tourist intent landing
/en/getting-here          How to get there
/es/como-llegar           How to get there
/en/where-to-eat
/es/donde-comer
/en/where-to-stay
/es/donde-hospedarse
/en/history
/es/historia
/en/festivals
/es/fiestas
/en/walking-tour          (formerly /tour)
/es/recorrido
/en/faq                   (formerly /faq)
/es/preguntas
/en/advertise             (formerly /advertise)
/es/anuncios
/sitemap.xml              Sitemap index pointing to /sitemap-en.xml and /sitemap-es.xml
/sitemap-en.xml
/sitemap-es.xml
/robots.txt
```

Spanish slugs are intentionally translated — `/es/negocios` ranks materially better for "negocios" than `/es/businesses` would.

## Build system architecture

```
content/                       Source of truth — author here
  shared/
    nav.json                   { en: {...}, es: {...} }
    footer.json
    common.json                Site name, contact, etc.
  pages/
    home.json                  All translatable strings for homepage
    businesses.json
    faq.json
    tour.json
    advertise.json
    things-to-do.json
    getting-here.json
    where-to-eat.json
    where-to-stay.json
    history.json
    festivals.json
  businesses-snapshot.json     Generated by cron — Place data for static pages

templates/
  layouts/
    base.html                  <head>, nav, footer with {{placeholders}}
  pages/
    home.html
    businesses.html
    business-detail.html       Used to generate per-business pages
    faq.html
    ...

scripts/
  build.js                     Main build — content + templates → dist/en/* and dist/es/*
  fetch-businesses.js          Cron-invoked: Places API → businesses-snapshot.json
  generate-sitemap.js          Reads built dist/, outputs sitemap-en.xml + sitemap-es.xml

dist/                          Build output — gitignored, deployed to Vercel
  en/
    index.html
    businesses.html
    businesses/[slug].html
    ...
  es/
    index.html
    negocios.html
    negocios/[slug].html
    ...
  sitemap.xml
  sitemap-en.xml
  sitemap-es.xml
  robots.txt

package.json                   Scripts: build, dev, fetch-businesses
vercel.json                    Build command, rewrites, .org redirect, cron config
```

**Build flow:**
1. `npm run build` invokes `scripts/build.js`
2. For each page in `content/pages/`, render the template twice (once per language)
3. Write to `dist/en/*` and `dist/es/*`
4. Inject `hreflang` tags pointing to the alternate language URL
5. Generate sitemaps
6. Vercel deploys `dist/`

**Cron flow (Vercel Cron, daily):**
1. `scripts/fetch-businesses.js` calls Google Places API server-side for each tab category (restaurants, bars, stores, etc.)
2. Merges with Featured/Blocked lists
3. Writes `content/businesses-snapshot.json`
4. Triggers a Vercel deploy

## Per-page bilingual handling

Each page's content file looks like:

```json
{
  "meta": {
    "title":       { "en": "Local Businesses — San José de Gracia", "es": "Negocios Locales — San José de Gracia" },
    "description": { "en": "...", "es": "..." },
    "slug":        { "en": "businesses",       "es": "negocios" }
  },
  "sections": {
    "hero_headline": { "en": "...", "es": "..." }
  }
}
```

The build resolves the right slug per language to construct URLs and `hreflang` links.

## Hreflang strategy

Every page emits in `<head>`:
```html
<link rel="alternate" hreflang="en" href="https://sanjosedegracia.net/en/businesses" />
<link rel="alternate" hreflang="es" href="https://sanjosedegracia.net/es/negocios" />
<link rel="alternate" hreflang="x-default" href="https://sanjosedegracia.net/en/businesses" />
```

`x-default` points to English (default for non-MX traffic). The root `/` redirect also respects this.

## Root path behavior

- `/` returns a 302 redirect (not 301 — language preference can change)
- Redirect logic lives in `vercel.json` rewrites or a tiny serverless function
- Honors `Accept-Language` header: `es*` → `/es/`, anything else → `/en/`
- A user-controlled language switcher (existing UI) toggles via direct navigation between `/en/...` ↔ `/es/...`, replacing the current `localStorage`-based JS toggle

## PR sequence

| # | PR | Scope | Ships independently? |
|---|----|-------|----------------------|
| 1 | Build system foundation | `package.json`, `scripts/build.js`, content/template scaffold, migrate **homepage only** as proof; deploy `/en/` and `/es/` alongside legacy URLs | Yes — legacy URLs untouched |
| 2 | Migrate remaining pages | businesses, faq, tour, advertise; Spanish slugs; legacy URL 301 redirects to new bilingual URLs | Yes |
| 3 | SEO infrastructure | hreflang on all pages, sitemap index + per-language sitemaps, `<html lang>` correctness, `robots.txt` updates | Yes |
| 4 | Per-business static pages | `scripts/fetch-businesses.js`, Vercel cron config, `templates/pages/business-detail.html`, generation of `/{lang}/businesses/[slug]` with `LocalBusiness` schema | Yes |
| 5 | Tourist intent pages | New content files + templates for things-to-do, getting-here, where-to-eat, where-to-stay (EN + ES) | Yes |
| 6 | Search Console + measurement | Add Domain property for `sanjosedegracia.net`, configure `.org` 301 redirect in Vercel, submit sitemaps, GA4 outbound-click events on business cards | Yes |
| 7 | History / Festivals standalone pages | Extract from homepage into `/{lang}/history` and `/{lang}/festivals` with `Event` schema for festivals | Yes |
| 8 | Performance pass | Responsive `<picture>` srcset, lazy loading, Core Web Vitals audit + fixes, font-display strategy | Yes |
| 9 | Internal linking + breadcrumbs | Cross-links between business detail pages and topic pages, `BreadcrumbList` schema, related-content blocks | Yes |

**Sequencing logic:**
- 1–3 are infrastructure — they unlock everything else but don't move traffic alone
- 4 is the highest-leverage content PR (audience C — top priority); deferred until bilingual URLs exist so we don't build it twice
- 5 covers audience A
- 6 closes the measurement loop *after* there's something rankable to measure
- 7–9 are amplification

## Out of scope (deferred to backlog)

- Hardcoded admin password rotation in `api/blocked-places.js` (security; user-deferred to end of project)
- Multi-language UX beyond EN/ES
- Migration to Eleventy/Astro
- Newsletter / email capture
- Booking integrations beyond current Airbnb links
- Paid SEM

## Success metrics (track after PR 6)

- Organic search sessions (target: 5× within 6 months → ~190 sessions/month)
- Spanish-language impressions in Search Console (currently ~0 indexable; target: meaningful presence within 90 days of PRs 1–3 shipping)
- Number of indexed pages (currently ~5 useful URLs; target: 30+ after per-business + topic pages)
- Click-through rate on `/businesses` listings (proxy for business-page conversion)

## Risks and mitigations

- **Google Places ToS on caching.** Places API "New" allows caching `id`, `displayName`, `formattedAddress`, `location`, `types` for up to 30 days; phone/hours need shorter TTL. Cron runs daily — well within bounds.
- **Build-time API failures.** If `fetch-businesses.js` fails, fall back to the previous snapshot JSON and log a warning. Never deploy with empty business data.
- **URL changes break existing inbound links.** PR 2 adds 301 redirects from old URLs (`/businesses`, `/faq`, etc.) to new bilingual URLs. Preserves any existing link equity.
- **Language detection on `/` redirect.** Some users will land on the wrong language. Existing language switcher (preserved) handles correction; cookie remembers preference for next visit.
