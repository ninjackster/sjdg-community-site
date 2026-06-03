# Collective History — Phase 3: Raíces + Mapa + La Diáspora

> **For agentic workers:** executed via superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Extend La Crónica back to the deepest documentable regional past (Raíces), and add two build-time static-SVG maps — a Los Altos locator and a US-diaspora map — plus the migration narrative. Zero runtime JS dependencies preserved (d3-geo/topojson are build-only devDependencies).

**Architecture:** Maps are precomputed at build to inline `<svg>` via a new pure module `scripts/lib/render-maps.js` (d3-geo + topojson-client), fed by vendored public-domain TopoJSON (`data/geo/`) + small bilingual content JSON (`content/maps/`). SVG injected as `{en,es}` content into the history page exactly like the existing timeline/voces/fotos sections (template engine has no loops). Deep history is content-only: extend the existing `timeline` and add a `raices` narrative section + new sources.

**Research inputs:**
- `docs/superpowers/research/2026-06-02-sjdg-deep-regional-history.md` (deep history, cited, confidence-tagged)
- `docs/superpowers/research/2026-06-02-map-approach-best-in-class.md` (static-SVG recommendation)
- `docs/superpowers/research/2026-06-02-sjdg-history-dossier.md` §C (US-migration arc)

---

## Task 1 — Raíces (deep history): timeline extension + narrative section + sources

**Files:** Modify `content/pages/history.json`; Modify `templates/pages/history.html`; Test `tests/history-page.test.js`.

1a. **Extend the timeline backward.** Prepend deep-history entries (chronological; renderTimeline preserves array order) to `timeline.entries`. Use BCE/CE year strings. High-confidence anchors get plain labels; Med/Low get explicit hedging ("approx.", "regional context"). New entries (each `{year, label:{en,es}}`):
- `c. 350 BCE–500 CE` — Teuchitlán tradition (guachimontones) flourishes W of Guadalajara; the Altos are its sparsely-settled eastern margin. *(regional horizon)*
- `At contact` — Tecuexes (sedentary Uto-Aztecan farmers) hold the Tepatitlán region, on the frontier with the nomadic Guachichiles. *(High)*
- `1530` — already present (Almíndez Chirinos); keep.
- `1540–1542` — Mixtón War shatters Altos indigenous society. *(High)*
- `c. 1550–1590` — Chichimeca War; the Altos a strategic frontier corridor; 1591 Tlaxcalan resettlement. *(High)*
- `16th–17th c.` — Spanish/criollo ranchero families resettle the Altos; most Altos towns founded. *(Med–High)*
Keep the existing 1822→2021 entries after these.

1b. **Add a `raices` narrative section** to `history.json` (`{h2:{en,es}, body:{en,es}}`), placed in the template **after the hero/byline, before `sec-place`** (deepest story first). Bilingual, cited inline, honest framing per the dossier: archaeology = frontier/interface (not a culture core, between Teuchitlán W and Chupícuaro/Bajío SE); Tecuexes at contact + Guachichile frontier; conquest arc (Guzmán 1529–30 → Nueva Galicia 1531 → Mixtón 1540–42 → Chichimeca War → Tlaxcalan 1591 → criollo-ranchero repopulation → bridge to El Bramido). Flag the Otomí folk claim as municipal tradition (Low), not asserted. Deep prehistory = regional backdrop only.

1c. **Template:** add `<section class="cr-raices" id="sec-raices"><h2>{{raices.h2}}</h2>{{raices.body}}</section>` before `#sec-place`.

1d. **Sources:** append deep-history citations to `sources.body` (rendered list): Schmal "Indigenous Jalisco" (indigenousmexico.org); Tecuexe / Mixtón War / Chichimeca War (Wikipedia, citing Baus de Czitrom); Teuchitlán culture / INAH Guachimontones; "Las cuatro fundaciones de Guadalajara". Keep `[primary]/[secondary]` tags style.

1e. **Test:** extend `tests/history-page.test.js` — assert `#sec-raices` renders in both langs; timeline now contains a BCE entry and "Tecuexes"/"Mixtón"; sources list count grows. No unresolved tokens.

---

## Task 2 — Map render module + data + content (pure, tested)

**Files:** Create `scripts/lib/render-maps.js`; Create `content/maps/locator.json`, `content/maps/diaspora.json`; Create `data/geo/` (vendored TopoJSON); Create `tests/render-maps.test.js`; Modify `package.json` (devDependencies); Modify `.gitignore` if needed (do NOT ignore `data/geo`).

2a. **devDependencies (build-only, never shipped):** `d3-geo`, `topojson-client`, `world-atlas`, `us-atlas`. Run `npm install -D`. Confirm they do not enter `dist/`.

2b. **Vendor data** under `data/geo/` (public domain — Natural Earth / US Census via the atlas packages): copy `world-atlas/countries-50m.json` → `data/geo/countries-50m.json` and `us-atlas/states-10m.json` → `data/geo/us-states-10m.json` (commit them so the build is offline/reproducible; add a `data/geo/README.md` noting source + public-domain license).

2c. **`content/maps/locator.json`** — bilingual heading/intro + POIs (lat/lng + `{en,es}` label + `kind` "town"|"city"|"historic"):
- town: San José de Gracia (~20.73, -102.58) — verify/refine.
- city: Tepatitlán de Morelos (~20.817, -102.764), Guadalajara (~20.677, -103.347).
- historic (ties to Raíces): Teuchitlán/Guachimontones (~20.69, -103.84), Nochistlán (~21.36, -102.85), Zacatecas (~22.77, -102.58).
Plus an `osm` field: `{en,es}` "Open in OpenStreetMap" + a URL to OSM centered on SJdG.

2d. **`content/maps/diaspora.json`** — bilingual heading/intro + `origin` (Jalisco ~20.97, -101.0 label) + `destinations` array of `{state: "California", share: 58, label:{en,es}}` for CA 58, CO 10, AZ 7, TX 6 (per dossier §C; mark "approx., Jaliscienses in US 2018"). Legend labels bilingual.

2e. **`scripts/lib/render-maps.js`** — pure, no I/O of its own (callers pass parsed TopoJSON + content):
- `renderLocatorMap({ countries, content }, lang)` → SVG string. Project with `geoMercator` fitted to a Jalisco-region bounding box (roughly lon [-104.2,-101.8], lat [20.2,23.1]); draw Mexico (id 484) land path; plot POIs as circles with `<text>` labels (distinct class per `kind`); include `<title>`/`aria-label` for a11y; viewBox e.g. `0 0 720 560`.
- `renderDiasporaMap({ usStates, content }, lang)` → SVG string. Project US states with `geoAlbersUsa` fit to a viewBox; fill the four destination states with a graduated tint by `share`; draw graduated circles sized by `share` at each state centroid (use `geoPath.centroid`); add an origin marker + faint flow lines from origin to each destination; bilingual legend (`<text>`). geoAlbersUsa drops the origin (Mexico) off-grid, so render the origin as a labeled marker pinned at the SVG's lower-left with lines to destination centroids (do NOT rely on projecting a Mexican coordinate through geoAlbersUsa — it returns null).
- Both: escape all text (reuse an `esc` helper); no `{{`/unresolved tokens; deterministic output (no Date/random).

2f. **`tests/render-maps.test.js`** — load the vendored TopoJSON + content; for both langs assert: output starts with `<svg`, contains a `<path` (geometry), contains each POI/destination label, diaspora contains 4 graduated circles + a legend, locator contains the OSM link text, no `NaN` in any coordinate, no unresolved `{{`. Snapshot-light (assert structure, not exact paths).

---

## Task 3 — Integrate maps + Mapa & Diáspora sections (build wiring, template, content, CSS, tests)

**Files:** Modify `scripts/build.js`; Modify `templates/pages/history.html`; Modify `content/pages/history.json` (Mapa + Diáspora narrative blocks); Modify `tests/history-page.test.js`.

3a. **build.js:** in the `if (pageName === 'history')` block, read `data/geo/countries-50m.json` + `data/geo/us-states-10m.json` (via existing fs reader / JSON.parse) and `content/maps/locator.json` + `diaspora.json`; `topojson.feature(...)` to GeoJSON; call `renderLocatorMap`/`renderDiasporaMap` for en+es; inject `content.mapa = { body:{en,es} }` and `content.diaspora_map = { body:{en,es} }`. Import the two renderers + `topojson-client`.

3b. **content/pages/history.json:** add `diaspora` narrative block (`{h2,body}` from dossier §C: late-19th-c. railroad origins → Revolution/Cristero displacement → Bracero 1942–64; why a heavy sending region; CA~58%/CO/AZ/TX; Santo Toribio patron of migrants; Jalisco #2 remittance state — all hedged "regional"). The map heading/intro live in `content/maps/*.json`.

3c. **Template (order):** after `#sec-culture`/`#sec-book1897`, before Voces, add:
- `<section class="cr-mapa" id="sec-mapa">{{mapa.body}}<p class="cr-map-osm">…</p></section>` (locator; OSM link comes from the SVG/content)
- `<section class="cr-diaspora" id="sec-diaspora"><h2>{{diaspora.h2}}</h2>{{diaspora.body}}{{diaspora_map.body}}</section>`
Place sensibly within the narrative flow (Mapa near the top with El Pueblo is also acceptable — final call during integration; keep Diáspora after the town story).

3d. **CSS:** add styles for `.cr-mapa`, `.cr-diaspora`, `.cr-map svg` (responsive `max-width:100%; height:auto`), POI/label/circle/flow classes, legend, `.cr-map-osm`. Add `page-break-inside: avoid` for the map figures in `@media print`.

3e. **Tests:** mirror the map injection in `tests/history-page.test.js` `buildHistory`; assert `#sec-mapa` + `#sec-diaspora` render with `<svg` in both langs, diaspora narrative present, no unresolved tokens. Run `node scripts/build.js` + `node --test --test-concurrency=1` green.

---

## Task 4 — Final review, browser verify, merge gate

- Dispatch final code review over the whole Phase 3 diff.
- `git push -u origin feature/history-phase3`; get the real preview URL via Vercel `list_deployments` (branch-alias hashes); open the tab for the user (standing pref).
- Browser-verify `/es/historia` + `/en/history`: Raíces reads well + cited; timeline shows the new BCE→16th-c. anchors in order; locator SVG renders with POIs + OSM link; diaspora SVG renders with graduated states/circles + legend; no console errors; print clean; bilingual.
- **Pause for the user's explicit "merge".** On approval: merge to main, push, verify prod, clean up worktree/branch, update Memory Bank.

## Notes / risks
- geoAlbersUsa returns null for non-US coords — origin marker is pinned manually (2e).
- Keep maps legible at mobile width; labels may need small font + selective showing.
- If `world-atlas` Mexico outline is too coarse at 1:50m, acceptable for a locator; do not chase admin-1 state boundaries (scope creep) — POIs carry the information.
- No em-dash rule applies to first-person deliverables; historical prose may use them (matches existing page voice).
