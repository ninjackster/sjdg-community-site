# Collective History — Phase 4: Navegación + Colabora (design)

**Date:** 2026-06-03 · **Owner:** Jaime Murillo
**Area:** the public history page (`templates/pages/history.html` + `content/pages/history.json`, helpers in `scripts/lib/`). Bilingual EN/ES static build; zero runtime-JS dependencies held through Phases 1–3.

## Vision / why
La Crónica is now a long single page (≈17 narrative sections + timeline + Historias/Voces/Fotos/Colabora/Sources). Phase 4 closes the roadmap with **findability** (navigation) and **contribution polish** (turning readers into contributors), without breaking the minimal-computing discipline.

## Best-in-class decision: navigation, not a search engine
For a **single long-form document**, a JS search engine (Fuse.js/Lunr/Pagefind) is the wrong tool — those are best-in-class for *multi-page* sites and would add the first runtime dependency + an index artifact for marginal gain over the browser's native find. Best-in-class here = a **Table-of-Contents jump-index + native Ctrl+F**, optionally enhanced with a tiny dependency-free live filter. Benefits: real navigation, zero runtime dependency, offline-forever longevity, graceful degradation (anchors work with JS off). Documented upgrade path if the Story atoms ever split into separate pages: **Pagefind** (keyless, static, no third-party).

## Components

### 1. Índice / Contents (navigation)
- A compact bilingual **jump-index** placed near the top (after the hero/byline, before the timeline) linking to every major section + the featured stories, via existing `id="sec-*"` anchors.
- A small **dependency-free live-filter** input above the index: typing narrows the visible entries (accent-insensitive, case-insensitive substring); the entries are plain `<a href="#sec-…">`, so click/Enter jumps and everything works with JS disabled.
- Built by a **pure, tested helper** `renderIndex(entries, lang)` in `scripts/lib/history-render.js`, fed by an explicit ordered list of `{ id, label:{en,es} }` (authored in content, mirroring the section order) — NOT auto-scraped, to keep it deterministic and curated.
- Tiny inline `<script>` (like the then/now slider) wires the filter; `aria` label; clay styling.

### 2. "Graba a tu abuelo" guide (contribution polish)
- Expand the existing `colabora` block into a clear, warm **step-by-step**: (1) sit with an elder and a box of old photos; (2) open the phone's voice recorder; (3) let them talk five minutes; (4) send the audio/photos by WhatsApp; (5) we add it, with credit. Plus a short "what to send" line (audio, photos, documents, names, dates — in either language).
- Keep the existing WhatsApp CTA (`wa.me/523316963003`). Bilingual, no new dependency. Rendered via the existing `colabora` content fields (extend the body; optionally add a `steps` array rendered by a small helper, or just structured HTML in the body — implementer's choice, keep it testable).

### 3. Créditos / Contributors (contributor wall)
- A new **`creditos` section** near the end (after Sources, or just before the cross-nav), seeded with the real lineage so it is meaningful from day one and ready to grow:
  - **Cronista:** Don Taurino Arámbula Vázquez · **Informante:** Don Porfirio Hernández Valle
  - **Semblanza & enlace:** Juan Ramón Ramírez Andrade — Museo Nacional Humanista, Atotonilco el Alto
  - **Instituciones citadas:** IIEG Jalisco, INEGI, Archivo Histórico Municipal de Tepatitlán, Diócesis de San Juan de los Lagos, Arquidiócesis de Guadalajara, Secretaría de Cultura de Jalisco
  - **Compilación:** Jaime Murillo Mena
  - A closing line inviting readers to join the list by contributing.
- Data-driven: a small `content/history/creditos.json` (`{ heading, intro, groups:[{ role:{en,es}, names:[…] }], invite:{en,es} }`) rendered by a pure, tested `renderCreditos(data, lang)` helper. Append future contributors by editing JSON.

## Architecture (unchanged pattern)
- Pure render helpers → `{en,es}` HTML strings injected by `build.js` in the `if (pageName === 'history')` block; new content in JSON; new template sections; CSS in the page `<style>`; print rules. The live filter is a tiny inline script. **No new runtime dependency.**

## Testing
- Unit: `renderIndex` (entries → anchors, bilingual, escaping, no `{{`); `renderCreditos` (groups/names render, bilingual). 
- Page: `tests/history-page.test.js` — índice present with `href="#sec-…"` jump links + filter input; expanded guide steps; `#sec-creditos` seeded with the lineage names; no unresolved tokens; both langs.
- `node scripts/build.js` + `node --test --test-concurrency=1` green (baseline 176).

## Rollout
Branch `feature/history-phase4` → Vercel preview → open the tab → pause for Jaime's explicit **merge** → prod → cleanup → Memory Bank update. Bilingual, cited where relevant, honest. Additive only; slug unchanged.

## Risks / mitigations
- **Index drift** (sections added later but not in the index): index is curated content, so it is updated alongside section changes; a page test asserts the core section ids are present.
- **Over-engineering search**: explicitly avoided — no engine, no index artifact; just anchors + a tiny filter.
- **Contributor-wall emptiness**: mitigated by seeding the real lineage; framed as a living credit list, not a submission feed.
