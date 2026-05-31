# History Showpiece — *La Crónica de San José de Gracia*

**Date:** 2026-05-30
**Status:** Approved design, ready for implementation planning
**Owner:** Jaime Murillo
**Branch:** `feature/history-showpiece` (off `main`)

## Goal

Transform the thin `/history` (`/historia`) page on sanjosedegracia.net into a **thoroughly extensive, show-off-worthy, bilingual (EN/ES) long-form history of San José de Gracia**, built from the verified deep-research dossier and the 1897 *Geografía Particular del Estado de Jalisco*. The same page produces a **downloadable, watermarked PDF** via a print stylesheet. Public-facing and SEO-indexable. Branded "Compilado por Jaime Murillo."

## Locked decisions (from brainstorming)

- **Two deliverables, one source of truth:** a long-form public web page **and** a print-to-PDF, both from the same `history.json` + template.
- **PDF approach A:** a print stylesheet (`@media print`) + a "Download PDF / Descargar PDF" button calling `window.print()`. **No new dependencies.** Watermark, page breaks, and running footer live in print CSS.
- **Brand/watermark:** "Compilado por Jaime Murillo" — byline on screen, diagonal watermark + running footer in print, link back to sanjosedegracia.net in the footer.
- **Replaces** the existing thin `/history` page (does not live alongside it) and **folds in the accuracy fixes** below — this supersedes the separately-spawned "fix elevation + founding date" task.
- **Bilingual EN/ES** throughout, matching the site's existing `{en,es}` content convention.
- Public + indexable (`meta.robots` stays the default `index, follow`).

## Accuracy fixes (fold in; supersedes the spawned cleanup chip)

- Elevation: replace **1,980 m** with **~1,900 m (INEGI: 1,907 m)** everywhere (page content + base-layout schema description).
- Founding: replace the asserted **"Founded in 1793"** with the verified framing **"with roots in the late 18th–early 19th century, in the Hacienda de San José de Gracia"** — the specific 1793 / Hernández-Padilla narrative was adversarially refuted (0-3). Present it honestly (e.g., "popularly dated to 1793, though the documentary record points to the late 18th–early 19th century").
- Update the `base.html` TouristDestination/Place JSON-LD description accordingly (it currently says "Founded in 1793 at 1,980 m").

## Content structure (12 sections, each bilingual, each cited)

Source material: the verified dossier (`~/Downloads/Histtoria /San-Jose-de-Gracia-Jalisco-dossier-historico.md`) and the 1897 transcription (`…/Geografia-Particular-Jalisco-1897-transcripcion.md`).

1. **Hero + intro** — title "La Crónica de San José de Gracia", byline "Compilado por Jaime Murillo", evocative opening + the Los Altos Sur / Tepatitlán framing.
2. **Tierra y lugar / Land & place** — Altos Sur (IIEG region 03), INEGI identity (140930291, delegación of Tepatitlán), ~1,907 m, dry climate, ~95 km NE of Guadalajara. `[HIGH]`
3. **Orígenes / Origins** — Hacienda de San José de Gracia, the Hernández family (testaments of Antonio Rafael & José María Hernández), "El Bramido"/"Bramadero", maize-and-mezcal economy; late-18th/early-19th c., with the 1793-myth handled honestly. `[MEDIUM]`
4. **De la Nueva Galicia a la delegación / Administrative arc** — Nueva Galicia → antiguo Cantón de La Barca (1857 vecinos in road proceedings; 1860s under La Barca with Capilla de Guadalupe) → comisaría of Tepatitlán → delegación (1939). **Anchored by the 1897 book** with scanned pages as figures (esp. p. 63, the San José de Gracia comisaría entry). `[HIGH]`
5. **Fe y parroquia / Faith & the parish** — dedicated to San José; cantera-roja church (construction 1889), parish erected 1910 (first priest Fermín Padilla), earlier capellanía. Dates flagged `[MEDIUM]`, dedication `[HIGH]`.
6. **La Cristiada / The Cristero era** — Los Altos regional context (Cristero heartland, 96.7% Catholic), honestly noting that no locality-specific events survived archive-grade verification (an open question). `[regional HIGH / local OPEN]`
7. **Tierra y trabajo / Economy** — maize, beans, agave (~9,000 ha municipal), cattle ranching; "one of the most humid zones in the Altos." `[HIGH]`
8. **La gente / The people** — population by census decade (5,128→5,441, 2000–2020), 3rd-largest locality; US migration as a major Los Altos sending region (regional context, local data an open question). `[HIGH / OPEN]`
9. **Fiestas y costumbres / Culture** — May fiestas patronales, ranchero traditions, the Delegación Municipal + Cruz Roja civic note. `[HIGH]`
10. **El libro de 1897 / The 1897 book** — feature on the *Geografía Particular* (Nájar Herrera): what it is, the comisaría passage, transcription excerpts, scanned figures.
11. **Fuentes y método / Sources & method** — cited source list (INEGI, SIGA PPDU, Tepatitlán archive, IIEG, Wikipedia) with confidence levels and a short "how this was researched / adversarially verified" note.
12. **Footer** — "Compilado por Jaime Murillo · 2026", link to sanjosedegracia.net, and a subtle link to the (private) family tree as a "Raíces" teaser.

## Architecture / File structure

- **Modify `content/pages/history.json`** — replace the thin content with the full 12-section bilingual structure (hero, sections array, sources array, byline). Correct elevation/founding facts. Keep the existing `meta` shape (slug history/historia, title, description, og locales) updated for the richer page; keep `rental` block (layout contract).
- **Rewrite `templates/pages/history.html`** — long-form layout: hero with byline, section blocks, a vertical timeline for the administrative arc, image `<figure>`s, the 1897-book feature, sources list, footer/byline. Add the "Download PDF" button (`onclick="window.print()"`, bilingual label). Add a `@media print` stylesheet block (diagonal "Compilado por Jaime Murillo" watermark, running footer with page numbers, hide nav/popup/button, sensible page breaks, show full source URLs).
- **Add image assets to the repo** — optimize a curated set of the 1897 book scans from `~/Downloads/Histtoria /` (note the trailing space in the path) into web-sized assets at repo root or a `history/` folder copied by passthrough. Curated set: cover (IMG_7500), title page (IMG_7501), p. 63 San José de Gracia entry (IMG_7505), the Notas page (IMG_7502). Plus reuse existing `pueblo-1/2/3.webp`, `church-hero.jpg`, `temple.png`. Resize to ≤~1600 px wide, compress; provide width/height + lazy-loading per the repo's existing perf pattern.
- **Update `templates/layouts/base.html`** — correct the JSON-LD description (1,980 m → ~1,907 m; founding framing). Optionally enrich the history page's own Article schema with `datePublished`/`author` (Jaime Murillo).
- **No change to `page-slugs.json`** (history/historia already registered) and **no sitemap change needed** beyond what the build already emits (page stays indexable).

## Testing (repo `node --test` convention)

- Build the history page in both langs with no unresolved `{{tokens}}` (render throws otherwise).
- Snapshot/assert key facts: page contains "1,907" (or "~1,900"), does **not** assert "1980"/"1,980"; founding text contains the "late 18th–early 19th" framing and not a bare "Founded in 1793."
- Assert the print affordance exists: a `window.print()` trigger and an `@media print` block in the built HTML.
- Assert the byline "Compilado por Jaime Murillo" is present.
- Assert each of the 12 sections renders (e.g., by stable section ids/headings).
- Assert the sources section lists the primary sources.
- Confirm `base.html` schema no longer contains "1,980" / "1793-as-fact".
- Image assets: assert referenced image files exist in the build output.

## Out of scope / Future

- Headless-Chromium pixel-perfect PDF (approach B) — explicitly not doing; print CSS is the chosen path.
- Locality-specific Cristero research, US-migration quantification, parish-date primary confirmation — these remain the dossier's open questions; the page presents them honestly as such rather than inventing content.
- The private family tree (separate `feature/family-tree` branch) — only a subtle link from the footer here.

## Constraints & notes

- Source-image folder path has a **trailing space**: `~/Downloads/Histtoria /` — quote it in any command.
- Standing rule: pause for explicit review of the diff / preview deploy before merging to `main`.
- Disambiguation: this is San José de Gracia, **Jalisco** (delegación of Tepatitlán de Morelos) — never the Michoacán municipio.
- This branch is independent of `feature/family-tree`; it branches from `main`.
