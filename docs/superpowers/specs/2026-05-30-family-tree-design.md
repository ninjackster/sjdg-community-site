# Family Tree — sanjosedegracia.net (private, family-only)

**Date:** 2026-05-30
**Status:** Approved design, ready for implementation planning
**Owner:** Jaime Murillo

## Goal

A private, bilingual (EN/ES) interactive family tree on the SJDG site, seeded with Jaime's researched direct line and built to grow over time. Authored in Notion, baked into the repo as GEDCOM-aligned data, rendered as a custom vertical pedigree. Family-only access for now via a shared password.

## Locked decisions (from brainstorming)

- **Architecture B** — draft the tree in Notion (human-readable workshop), export to a GEDCOM-aligned JSON file in the repo, render a custom interactive tree at build time. Notion is the authoring workshop, **not** a live runtime dependency.
- **Scope: extensible + GEDCOM-import-ready** — seed with the direct line now; data model supports siblings, spouses, children, more generations, and a future FamilySearch GEDCOM import.
- **Layout: vertical pedigree** (you at the bottom, ancestors upward). Radial "poster view" is designed-for but **deferred** to a later toggle.
- **Detail interaction: side drawer** on desktop, full-screen sheet on mobile.
- **Privacy: shared family password** — serverless auth function + signed cookie; page `noindex` and excluded from sitemap/robots. Protected data endpoint so nothing is scrapable without the password.
- **Bilingual EN/ES** throughout, matching the rest of the site.

## Architecture

```
Notion family-tree DB  →  content/family/tree.json  →  build.js render step  →  /familia + /family (private, noindex)
(authoring workshop)      (GEDCOM-aligned, in repo)     (vanilla-JS interactive)   (gated by api/family-auth + cookie)
```

- The site stays a static build deployed on Vercel. No live Notion API call at build or runtime.
- New render path mirrors existing `scripts/lib/render.js` + `templates/pages/*.html` + `content/pages/*.json` conventions.

## Data model (GEDCOM-compatible)

File: `content/family/tree.json`. Mirrors the GEDCOM INDI/FAM split so a future FamilySearch export maps cleanly.

```jsonc
{
  "individuals": [
    {
      "id": "I1",
      "names": { "given": "José", "surnames": ["Murillo", "Villalobos"] },
      "sex": "M",
      "birth": { "date": null, "place": "San José de Gracia, Jalisco" },
      "death": { "date": null, "place": null },
      "photo": null,
      "surnameOrigin": { "text": "Murillo — toponímico, del latín murellus…", "confidence": "high" },
      "recordLinks": [
        { "label": "Tepatitlán · San Francisco de Asís (1666–1957)", "url": "https://www.familysearch.org/…" }
      ],
      "notes": { "en": "", "es": "" }
    }
  ],
  "families": [
    { "id": "F1", "husband": "I1", "wife": "I2", "children": ["I3"] }
  ]
}
```

- Bilingual free-text fields (`notes`) are `{en, es}` objects.
- `surnameOrigin` seed text comes from the completed surname research (Murillo, Mena, Ruiz, Patiño, Villalobos, Gutiérrez, Sánchez, Hernández).
- Seed individuals: Jaime Murillo Mena; parents Héctor Murillo Patiño + Mercedes Mena Ruiz; paternal grandparents José Murillo Villalobos + Teresa Patiño Gutiérrez; maternal grandparents Benjamín Mena Sánchez + María del Refugio Ruiz Hernández.

## Rendering & interaction

- **Vertical pedigree**, computed client-side from `tree.json`. Vanilla JS (no heavy framework) to keep the static site lean; "claude design" tooling used for visual polish during implementation.
- **Person node:** avatar (photo or initials), name, surname tag, life years.
- **Detail (side drawer / mobile sheet):** vitals (birth/death/place, spouse), *Origen del apellido* with confidence tag, record deep-links, bilingual notes.
- **Zoom/pan** on the tree canvas.
- **`viewMode` flag** in layout code reserved so the radial poster view can be added later without a rebuild.

## Privacy (shared family password)

- Page carries `<meta name="robots" content="noindex,nofollow">`, is excluded from `sitemap.xml`, and disallowed in `robots.txt`.
- Login form posts to **`api/family-auth.js`** (Vercel serverless): validates against `FAMILY_TREE_PASSWORD` env var, sets an HttpOnly signed cookie on success.
- Tree **data** is served by **`api/family-tree.js`** only when the cookie is valid — without the password the page is just a login shell with no family data to scrape.
- One password, shared with family. (Per-person accounts explicitly out of scope.)

## Placement

- Private URLs: `/familia` (ES) and `/family` (EN). Not in public nav. Conceptually adjacent to the existing History page. Slugs are easily changed.

## Testing (repo `node --test` convention)

- `tree.json` schema validation (required fields, valid id references in `families`).
- Render snapshot of the family page.
- Auth function: correct password → cookie issued; wrong/absent → denied; data endpoint refuses without valid cookie.
- noindex + sitemap-exclusion + robots-disallow assertions.

## Deliverables, in order

1. Notion family-tree database, seeded with the direct line + surname-origin research.
2. `content/family/tree.json` model + seed data in the repo.
3. Build/render step + interactive front-end (vertical pedigree, side drawer, zoom/pan).
4. Auth function + login shell + noindex/robots/sitemap wiring.
5. Tests.

## Out of scope / Future PRs

- **Radial "poster view"** toggle (data/layout already reserves `viewMode`).
- **FamilySearch GEDCOM import** — bulk-load a larger tree once Jaime does the signed-in FamilySearch research (Tepatitlán San Francisco de Asís parish 1666–1957; civil registration 1866–1997).
- **23andMe integration** — Jaime has prior 23andMe results; a future PR could surface ancestry composition and/or DNA relative matches to enrich or auto-suggest tree branches. (Requires deciding on export ingestion vs. API, and a privacy review since this is sensitive genetic data.)
- **Per-person accounts** / granular access control.

## Constraints & notes

- Michoacán-vs-Jalisco disambiguation preserved in all surname/record content (this family is from San José de Gracia, **Jalisco**, a delegación of Tepatitlán de Morelos).
- Standing rule: pause for explicit review of diffs / preview deploy before merging to main.
