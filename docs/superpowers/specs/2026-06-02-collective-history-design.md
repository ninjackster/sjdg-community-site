# Collective History of San José de Gracia — Design

**Date:** 2026-06-02 · **Owner:** Jaime Murillo
**Area:** the public history experience on sanjosedegracia.net (today: `templates/pages/history.html` + `content/pages/history.json` = "La Crónica"). Bilingual EN/ES static site on Vercel; vanilla-JS, JSON content; tiny Upstash Redis suggestion/review queue; a separate private family tree.
**Research:** `docs/superpowers/research/2026-06-02-sjdg-history-dossier.md` (cited verification + new material).

## Vision

San José de Gracia's history is **transnational, oral, and photo-driven** — much of its archive lives in shoeboxes in California and Texas, and the second generation reads more English than Spanish. The site is therefore not just a town article but **a place to gather a dispersed community's memory before the elders who hold it pass on.** Bilingual by default; contribution reachable from afar; **oral histories + photos as the heart**, narrative over a searchable archive.

Grounded in best-in-class models: **Curatescape/Cleveland Historical** (the "Story" atom + tours), the **Histories of the National Mall** (multiple "doors" into one body of content), **Densho** (indexed oral histories + provenance), **StoryCorps** (oral history at scale + DIY recording), **HistoryPin/JuxtaposeJS** (then & now), **BBC 100 Objects** (object spotlights), and the **Wikipedia town-article** reference spine.

## Architecture

- **Atomic unit — the Story** (`kind`: place | person | object | event): bilingual title + body, optional date/place/media/audio, sources, themes, people, contributor. Everything else groups Stories.
- **Four doors into the same content:** place (map), time (timeline), theme, person.
- **Narrative on top of an archive:** curated essays for newcomers; searchable raw material underneath.
- **Contribution engine = the existing suggestion/review queue**, extended with `type` (story/photo/correction/voice) + optional `contributor_name`, credited on approval. Power users may also open PRs; townsfolk/diaspora use the form.
- **Bilingual data model from day one** — every content field is `{ en, es }`. (Reversing this later is the expensive mistake.)
- **Minimal-computing discipline:** precompute at build; ship flat files; runtime JS minimal; export open formats; plan backups + custodianship (single-maintainer succession risk).

## Information architecture (full program)

1. **Inicio** — pitch + featured Story + call to contribute
2. **El Pueblo** — the reference spine (today's La Crónica, now fully cited)
3. **Línea del Tiempo** — decade timeline
4. **Mapa y recorridos** — Leaflet map + walking tours of the cabecera
5. **Voces** — oral-history clips + transcripts *(the heart)*
6. **Objetos y fotos** — "then & now" pairs + a curated "100 objetos"
7. **La Diáspora** — the US-migration story + map
8. **Colabora / Créditos** — "how to record your abuelo on a phone" + contributor wall

## Tooling (all permissive / dependency-light)

Adopt as needed: **Scrollama** (MIT, scrollytelling), **Leaflet** (BSD, maps), **JuxtaposeJS** (then/now slider), **TimelineJS** (MPL — lazy iframe only). Borrow *schemas* from Curatescape/CollectionBuilder; do not vendor GPL/AGPL code (Omeka, Mukurtu, Curatescape, Tropy). Keep each as a vendored static asset with its license notice; lazy-load heavy widgets.

## Phased roadmap (each phase: its own plan → build → review/merge gate)

- **Phase 1 — Foundation (this spec):** cite & strengthen El Pueblo; ship the timeline; establish the bilingual Story model + render pipeline with seed stories.
- **Phase 2 — Voces + Fotos:** oral-history player w/ transcripts; "then & now" pairs; extend the queue with `type: voice/photo`.
- **Phase 3 — Mapa + La Diáspora:** Leaflet map/tours; the migration narrative + map (uses dossier §C).
- **Phase 4 — Search + contribution polish:** client-side search (Fuse/Lunr over a prebuilt index); the "record your abuelo" guide; contributor wall.

---

# Phase 1 — Foundation (detailed)

Three deliverables, each independently shippable; all bilingual, print-friendly, no new runtime dependency.

### 1a. Verify & cite "El Pueblo" (La Crónica)
Apply the research dossier to `content/pages/history.json`:
- Add a structured **`sources`** list (array of `{ label, url }`) rendered in the existing `.cr-sources` section — the authoritative citations (IIEG Análisis 3309, CityPopulation/INEGI 140930291, es.wikipedia, UB/geocrit Cantón de La Barca, Tepatitlán Boletín No. 14, heyjalisco).
- **Soften/footnote** the four flagged claims: the 1857 vecinos date, the parish dates/first priest (single-source), the archive-only Hernández testaments & 1833 capellanía, and the §260 verbatim quote (mark "transcribed; exact wording pending a page scan").
- **Add the Battle of Tepatitlán (18–19 Apr 1929)** to the Cristero section as a concrete, well-documented municipal anchor (José Reyes Vega; ~28 Cristero dead incl. Vega; landmark victory).
- Keep all edits bilingual (en+es) and within the existing one-object-per-key JSON shape.

### 1b. Timeline (Línea del Tiempo)
- Add `timeline: { heading:{en,es}, entries:[ { year, en, es, era? } … ] }` to `history.json`, authored chronologically and seeded from dossier §D (1530, 1707, 1824, 1883, 1822 chapel, 1889 temple, 1910 parish, 1917 comisaría, 1926–29 Cristero + 1929 Battle of Tepatitlán, 1939 delegación, census 2000/2010/2020, 2021 cultural center). Each entry's `year` may be a string ("1926–29").
- Render a `.cr-timeline` section in `history.html` (placed after the hero, before the narrative): a vertical line with year dots + bilingual labels; `page-break-inside: avoid` for print; ordered-list semantics for a11y; clay accents matching the page.
- A small **pure, tested helper** `renderTimeline(entries, lang)` (or a build-time formatter) so the section has coverage; assert ordering + bilingual fields + escaping.

### 1c. Story data model + render pipeline (foundation for Phases 2–4)
- **Schema** (documented here; lives in `content/history/stories.json` as `{ stories: [...] }`):
  `{ id, kind: 'place'|'person'|'object'|'event', title:{en,es}, body:{en,es}, year?, place?:{name,lat,lng}, media?:[{src,alt:{en,es},credit}], sources?:[{label,url}], themes?:[string], people?:[string], contributor?:string }`.
- **Seed** with 3–4 real Stories drawn from the dossier (e.g. *El Bramido y los Hernández* [place/event], *La parroquia de San José* [place], *La Batalla de Tepatitlán, 1929* [event], *Santo Toribio, patrono de los migrantes* [person]).
- A **pure, tested module** `scripts/lib/history-stories.js` → `validateStories(data)` (ids unique; required bilingual fields present; `kind` in the allowed set; `place` coords numeric if present) — mirrors `validateTree`'s discipline.
- Render a minimal **"Historias" featured strip** on the history page: cards (kind chip + bilingual title + short body), proving the atom + pipeline. Full Story pages / media / audio / map come in later phases.

## Testing
- Extend `tests/history-page.test.js`: timeline section renders entries; sources list renders; Battle-of-Tepatitlán present; Historias strip renders seed stories; bilingual output for both langs.
- New `tests/history-stories.test.js`: `validateStories` (valid set; duplicate id; missing bilingual field; bad `kind`; non-numeric coords) — mirrors the family-tree validator tests.
- `tests/timeline` coverage via the `renderTimeline` helper (ordering, bilingual, escaping).
- Keep the full suite green; build OK.

## Rollout
Branch `feature/history-phase1`, TDD where there's pure logic (validator, timeline helper), browser-verify on a Vercel preview (timeline reads well, sources cite correctly, Historias strip renders, EN+ES), then pause for review before prod (standing rule). Additive — no change to the family tree or other pages. Update the Memory Bank on ship.

## Risks / mitigations
- **Over-building the Story pipeline before it's consumed** → Phase 1 ships only a minimal featured strip; full rendering arrives with Phase 2's real content.
- **Sourcing trust** → every strengthened claim carries a citation or an explicit confidence caveat (dossier drives this).
- **Scope creep** (it's a grand vision) → strict phase gates; each phase is independently valuable and shippable.
- **Single-maintainer succession / format longevity** → open formats + backups; revisit a custodianship note in a later phase.
