# Best-in-Class Maps for a Static, Bilingual Local-History Site (2026)

**Site:** sanjosedegracia.net — static HTML built by a custom Node script (`scripts/build.js`), deployed on Vercel. Bilingual EN/ES "La Crónica" history page.
**Author of research:** technical research pass, 2026-06-02.
**Governing values:** minimal-computing discipline (precompute at build, ship flat files, minimal runtime JS); privacy (no leaking user IP/data to third parties); open formats; single-maintainer 10-year longevity (no expiring API keys, no paid tiers).

The two map needs are fundamentally different and should be treated as such:

1. **Locator map** — situate the town in Los Altos de Jalisco, with a handful of fixed historical/walking-tour points (plaza, parroquia, El Bramido). *This is a reference illustration, not a wayfinding tool.*
2. **Diaspora map** — show US migration destinations from Los Altos (California ~58%, then Colorado, Arizona, Texas) as a flow / choropleth from Jalisco to the US. *This is a data visualization.*

---

## TL;DR Recommendation

| Map | Recommendation |
|---|---|
| **Locator** | **Build-time static inline SVG** (d3-geo + topojson, Natural Earth data), points baked in, plus an optional "Open in OpenStreetMap" text link. **Zero runtime JS, zero third-party calls.** |
| **Diaspora** | **Build-time static inline SVG** (same toolchain: d3-geo, US + MX state TopoJSON), flow lines / graduated symbols baked in. **Zero runtime JS, zero third-party calls.** |

Both maps are *displays of fixed information on a history page* — neither needs pan/zoom, live tiles, or geolocation. A static SVG generated at build time is therefore the best-in-class minimal-computing answer and is the **only** option that keeps the Phase 1–2 "zero runtime JS dependencies" record intact. If interactivity is ever demanded later, the documented upgrade path is **Leaflet + self-hosted Protomaps PMTiles** (raster), lazy-loaded — never OSM default tiles, never a keyed SaaS basemap.

---

## Comparison Table

| Approach | Bundle / runtime cost | Privacy | Longevity (10 yr, no keys) | Interactivity | Build complexity | License |
|---|---|---|---|---|---|---|
| **Static inline SVG** (d3-geo + topojson at build) | **0 KB runtime JS.** Inline `<svg>` ~5–40 KB markup, gzips well. d3-geo (~15 KB) + topojson run **only in Node at build**, never shipped. | **Best.** No client requests beyond your own origin. No IP leak. | **Best.** Output is plain SVG in HTML; works forever with no dependency on any live service or key. | None (static image). Can add CSS `:hover` tooltips with no JS. | Low–moderate: add a build step that reads public-domain GeoJSON/TopoJSON, projects with d3-geo, writes an `<svg>` partial. | Code: d3-geo/topojson **ISC/BSD**. Data: Natural Earth **public domain**. |
| **Prerendered raster image** (PNG/WebP exported once) | 0 KB JS; one image request to own origin. | Best (self-hosted asset). | Best. | None; no hover/labels without extra markup. Not crisp on zoom, not the -able for dark mode / EN-ES label swap. | Lowest, but inferior to SVG for text, theming, retina, and bilingual label swapping. | Image is yours. |
| **Leaflet + self-hosted Protomaps PMTiles (raster)** | Leaflet **~42 KB gz** + `pmtiles` lib + your `.pmtiles` file (region-clipped, MBs). | Good **if** the `.pmtiles` is served from your own origin/Vercel. No third-party key, no SaaS. | Good: PMTiles is a single static file, no server, no key, no metered SaaS. Leaflet is BSD and extremely stable. | Full slippy pan/zoom/markers. | Moderate–high: generate a clipped PMTiles extract, host it, wire up Leaflet + pmtiles plugin, lazy-load. | Leaflet **BSD-2**; Protomaps tools **BSD**; OSM data **ODbL** (attribution required). |
| **MapLibre GL JS + PMTiles (vector)** | MapLibre **~210–290 KB gz** + WebGL + style JSON + glyphs/sprites + `.pmtiles`. | Good if self-hosted. | Good (BSD, PMTiles single file). | Best: vector zoom, rotation, runtime styling, smooth labels. | High: vector style authoring, glyph/sprite hosting, WebGL. | MapLibre **BSD-3**; data **ODbL**. |
| **Leaflet/MapLibre + OSM default tiles** (`tile.openstreetmap.org`) | Leaflet/MapLibre weight + **many third-party tile requests**. | **Bad.** Every visitor's IP + Referer goes to OSMF servers. | **Bad / disallowed.** OSMF Tile Usage Policy forbids heavy/production use, prohibits generic User-Agent / referer-stripping, no SLA, can block without notice. | Full slippy. | Low to wire, but a policy violation for a public production site. | Tiles ODbL; **usage policy prohibits this deployment.** |
| **Leaflet/MapLibre + Carto / Stadia / MapTiler tiles** | Library weight + third-party tile requests. | **Bad** (IP to vendor) and **requires an API key**. | **Bad** for this site: API keys can be rotated/revoked, free tiers change, billing risk — violates the no-expiring-key, no-paid-tier constraint. | Full slippy. | Low. | Mixed; vendor ToS. |

Sizes cross-checked: Leaflet ~42 KB gzipped; MapLibre GL JS ~210 KB gz (Map + NavigationControl only) up to ~290 KB gz full; d3-geo ~15 KB (build-only). Sources below.

---

## Why the slippy-map basemap options fail this site's constraints

- **OSM default tiles are not an option.** The OSMF [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) explicitly states the tile servers are donation-funded with limited capacity, offer **no SLA**, forbid **heavy/production use**, and **block clients** that use generic User-Agents or strip the `Referer` header. A public town website embedding `tile.openstreetmap.org` is exactly the prohibited case, and it also routes every visitor's IP to a third party — a privacy regression.
- **Carto / Stadia / MapTiler all require an API key.** Stadia's own docs confirm "to function, it requires an API key." That directly violates the hard constraint of *no keys that expire* and *no paid tiers* (free tiers are also metered, e.g. Stadia's 2,500 credits/month, and can change terms). Keys also become an unmaintained liability for a single maintainer over 10 years.
- **MapLibre GL JS is overkill here.** At ~210–290 KB gzipped plus WebGL, a glyph/sprite pipeline, and a vector style to author, it is the heaviest possible answer for two static history illustrations. It earns its weight only when you need vector zoom on a data-dense, interactive map — which this site does not.
- **Self-hosted Protomaps PMTiles is the *only acceptable* slippy-map path**, because the basemap becomes a **single static `.pmtiles` file** you host on your own origin (Vercel, S3, even GitHub Pages), with **no API key, no SaaS, no metering, no third-party IP leak**. Protomaps explicitly markets "the open source map in a file… no dependence on a third party or API keys." But for *this* use case it is still more machinery (clipped extract generation, hosting a multi-MB file, Leaflet + pmtiles wiring) than two fixed illustrations justify.

---

## How best-in-class digital-history / minimal-computing projects actually do it

- **CollectionBuilder** (University of Idaho; the reference "minimal computing" static-site DH framework, Jekyll-based) ships a **built-in map feature that uses Leaflet** plus a GeoJSON file of items' lat/long. It is the canonical example of "static site + Leaflet + GeoJSON" in DH. Notably, CollectionBuilder still pulls a basemap (historically OSM/Carto-style raster), which is the part a privacy-strict project must replace with self-hosted tiles. This validates **Leaflet as the DH default** when interactivity is genuinely needed.
- **Curatescape** and most Leaflet-based DH/walking-tour sites use Leaflet with a hosted basemap — good for wayfinding apps, but they accept the third-party-tile tradeoff that this site explicitly rejects.
- **Minimal Computing (GO::DH) / Jentery Sayers / the "static-site DH" school** prize *longevity and reducing dependencies* over interactivity. The discipline-true move for a non-interactive illustration is to **precompute the graphic at build time and ship flat output**, not to load a mapping engine at runtime. For a history page (read, not navigate), a baked SVG is more in the spirit of minimal computing than even a self-hosted Leaflet map.
- **Practitioner signal (Reddit):** Across r/gis and r/selfhosted, the consistent 2025–2026 pattern for "no-API-key, self-hostable" maps is **MapLibre/Leaflet + Protomaps PMTiles served as a static file** (e.g. the Home Assistant "Helios" card advertises a "3D MapLibre map… **No API key to configure**"; the `lidar2map` and Dawarich self-hosting threads center on local PMTiles/MBTiles). This confirms PMTiles as the community-endorsed escape hatch from keyed tile SaaS — i.e., the right *fallback* if this site ever needs a real slippy map.

So: best-in-class DH uses **Leaflet + GeoJSON** for interactive maps and **self-hosted Protomaps PMTiles** for keyless basemaps — but the *most* minimal-computing-aligned choice for fixed history illustrations is the **build-time static SVG**, which several data-journalism/"datawrapper-style" static exports also favor.

---

## The recommended approach in detail: build-time static SVG

For a history page, both maps are fixed graphics. Generate them in the Node build (the project already has `scripts/build.js` and a `scripts/lib/` convention) and inline the resulting `<svg>` into the page. **Nothing ships to the browser except SVG markup and CSS.**

### Exact libraries (build-time only, never shipped to client)
- **`d3-geo`** — projections (`geoMercator` / `geoConicConformal` for Jalisco; `geoAlbersUsa` for the diaspora map) and `geoPath` to emit SVG `d` strings. License: **ISC** (BSD-equivalent, permissive). ~15 KB, but it runs only in Node.
- **`topojson-client`** — decode compact TopoJSON to GeoJSON features at build. License: **ISC**.
- Optional **`topojson-server` / `topojson-simplify` / `mapshaper`** — to pre-simplify/clip boundaries so the SVG stays tiny. Mapshaper (MPL-2) is the easiest CLI for clipping Jalisco/Los Altos extents.

### Exact public-domain / open data sources (all license-clean)
- **Natural Earth** (`naturalearthdata.com`) — **public domain**, the terms state "All versions of Natural Earth raster + vector map data… are in the public domain" and "No permission is needed… Crediting the authors is unnecessary." Use 1:10m admin-1 (states/provinces) for Jalisco and US states.
- **`topojson/world-atlas`** (GitHub) — pre-built TopoJSON from Natural Earth at 1:110m / 1:50m / 1:10m. Redistribution license **ISC**; underlying data public domain. Convenient drop-in for country/state outlines.
- For Mexican municipal/state precision, **INEGI Marco Geoestadístico** boundaries are openly licensed (INEGI open terms) and can be simplified with mapshaper; Natural Earth admin-1 is sufficient if municipality-level detail isn't required.
- Town/POI coordinates (plaza, parroquia, El Bramido) are just a few hand-entered lat/long pairs in a small JSON content file — no dataset needed.

### Build wiring (fits the existing pipeline)
1. Add `d3-geo` + `topojson-client` as **devDependencies** (build-only; they never enter `dist/`).
2. New module, e.g. `scripts/lib/render-maps.js`: read TopoJSON + a small `content/maps/*.json` of points/flows, project with d3-geo, return SVG strings (one for locator, one for diaspora), with bilingual labels driven by the existing EN/ES content mechanism.
3. Inline the SVG into the history page template; style with the site's CSS variables/fonts. Use `<title>`/`<desc>` and `aria-label` for accessibility, and CSS `:hover`/`:focus` for label reveal — still **no JS**.
4. Bilingual handling is free: render two SVGs (or swap `<text>` via the same per-language build that already produces EN/ES pages).

### Tradeoffs being accepted
- **No pan/zoom/interactivity.** Acceptable and arguably *better* for a history page: the reader sees the whole story at a glance, on any device, instantly, offline-friendly, with no layout shift and no spinner.
- **Boundaries are fixed at build time.** Fine — historical/diaspora geography doesn't change; rebuild if you ever want different detail.
- **Slightly more build logic** than dropping in a `<script>` tag — but it is *self-contained Node code you own*, with no external runtime dependency, which is precisely the longevity property the project values. This is the correct place to spend complexity: at build, once, under your control.

### Documented upgrade path (only if interactivity is ever truly required)
**Leaflet (BSD-2, ~42 KB gz) + self-hosted Protomaps PMTiles (raster), lazy-loaded** on user interaction (e.g. "click to load interactive map"), basemap `.pmtiles` served from your own Vercel origin. This keeps **no API key, no third-party IP leak, no paid tier**. Add **ODbL attribution** ("© OpenStreetMap contributors") in the map credit. Do **not** use OSM default tiles or any keyed SaaS basemap. MapLibre + vector PMTiles is available but unjustified weight for this site.

---

## Single clear recommendation

- **Locator map → build-time static inline SVG** (d3-geo + topojson, Natural Earth public-domain boundaries, hand-entered POIs). Add a plain `<a href>` "Open in OpenStreetMap / Google Maps" text link for anyone who actually wants to navigate — that hands wayfinding to a dedicated tool without embedding a tracker.
- **Diaspora map → build-time static inline SVG** (same toolchain; `geoAlbersUsa` US states + Jalisco origin; graduated circles or flow lines sized by share, California ~58% largest). A choropleth/flow as a static figure is exactly how data-journalism static exports present this, and it ships zero runtime JS.

**Top reasons:** (1) preserves the project's zero-runtime-JS-dependency discipline — no mapping engine, no tiles, no keys ever expire; (2) best possible privacy — every byte comes from your own origin, no visitor IP leaves to a tile vendor; (3) maximum longevity — the output is plain SVG that will render in any browser in 2036 with no live-service dependency. **Key tradeoff accepted:** the maps are non-interactive (no pan/zoom), which is appropriate for a history page and not a wayfinding app.

---

## Sources

- [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) and [OSM Wiki: Tile usage policy](https://wiki.openstreetmap.org/wiki/Tile_usage_policy)
- [Protomaps — The open source map in a file](https://protomaps.com/about); [PMTiles for Leaflet](https://docs.protomaps.com/pmtiles/leaflet); [PMTiles for MapLibre](https://docs.protomaps.com/pmtiles/maplibre); [PMTiles Concepts](https://docs.protomaps.com/pmtiles/)
- [Stadia Maps pricing / FAQ](https://stadiamaps.com/pricing/) (API key required, metered free tier)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) and bundle-size discussion ([maplibre-gl-js issue #59](https://github.com/maplibre/maplibre-gl-js/issues/59), [Bundlephobia: maplibre-gl](https://bundlephobia.com/package/maplibre-gl)); Leaflet ~42 KB gz, MapLibre ~210–290 KB gz
- [d3-geo](https://d3js.org/d3-geo) (~15 KB, projections/path generator); [Mike Bostock, "Let's Make a Map"](https://bost.ocks.org/mike/map/)
- [topojson/world-atlas](https://github.com/topojson/world-atlas) (ISC redistribution; Natural Earth 1:10m/1:50m/1:110m)
- [Natural Earth Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/) (public domain, no attribution required)
- [CollectionBuilder (Lib-Static)](https://lib-static.github.io/models/collectionbuilder/) and [CollectionBuilder docs](https://collectionbuilder.github.io/) (Leaflet + GeoJSON, minimal computing)
- [Code4Lib Journal — Static Web Methodology as a Sustainable Approach to DH](https://journal.code4lib.org/articles/18372); [NYU Libraries — Web Design & Minimal Computing](https://guides.nyu.edu/digital-humanities/tools-and-software/web-design-minimal-computing)
- Reddit practitioner signal: r/homeassistant "Helios" MapLibre card ("No API key to configure"); r/gis & r/selfhosted self-hosted PMTiles/MBTiles threads (`lidar2map`, Dawarich) — via reddit-rss MCP
