# Family Tree — Recursive Bifurcation Ancestor Layout

**Status:** Approved (Jaime, 2026-06-01)
**Branch:** `feature/family-tree-bifurcation`
**Area:** `family-tree.js` (private tree client) + new `scripts/lib/ancestor-layout.js`
**Supersedes the layout half of:** `docs/superpowers/specs/2026-05-31-family-tree-recursive-bifurcation-BACKLOG.md`

## Goal

Eliminate crossing connector lines in the **ancestor region** of the family tree by allocating each
couple's two parental lineages as contiguous, non-overlapping horizontal intervals — the wife's whole
ancestral block strictly to the left, the husband's whole ancestral block strictly to the right —
recursively, all the way up. Parents + Jaime read as the focal anchor.

This is scope **(A)** of the backlog only. The directional up/sideways expand-collapse system —
scope **(B)** — is explicitly deferred to a follow-up and is NOT built here.

## Background / why the current layout crosses

`family-tree.js` lays out every generation in one row-based pass: `buildGenerations()` assigns each
individual an integer generation (focal = 0, ancestors positive, descendants negative), then `render()`
does a bottom-up x-centering pass plus a top-down child-centering pass (`shiftSub`). It keeps the focal
couple adjacent and centers children under parents, but it does **not** allocate each ancestor's two
parental lineages as contiguous, non-overlapping subtrees. Collaterals (e.g. grandpa José's brother
Francisco) and the great-grandparent couples drift to the wrong side, so the Patiño and Murillo
lineage lines overlap where the José + Teresa couple meets.

## Research basis (2026-06-01)

Two parallel research sweeps (web/GitHub algorithm survey + Reddit r/Genealogy & r/reactjs UX survey)
converged:

- **Reingold–Tilford / Buchheim tidy-tree** (the linear-time RT variant that `d3.tree()` implements)
  on the ancestor binary tree is the canonical, provably crossing-free method. A pedigree is a true
  tree (each ancestor has exactly one descendant-child you came from), so RT never crosses sibling
  subtrees and the two parental lineages land in separate half-planes automatically.
- Serious hourglass tools (FamilySearch, Topola, the most-referenced D3 pedigree repos) lay out
  **ancestors and descendants as two separate passes pinned at the focal node** — never one unified
  graph engine. Forcing both into one engine means dropping to heavier Sugiyama/dagre and losing RT's
  tidy symmetry.
- Couples are modeled as **union nodes** (one synthetic vertex per marriage).
- UX: the #1 real-user pain is multi-marriage handling + crossing lines (exactly this bug); the
  consensus fix is union nodes. Auto-layout reshuffle is disliked, so the view must stay stable on
  expand (viewport is already preserved). Expand/collapse, click-to-recenter, zoom/pan, photos on
  nodes are the most-valued interactions — all already shipped; the only gap is the ancestor crossing.

We hand-roll the RT recursion (~150 lines) rather than add d3, to keep `family-tree.js`'s zero-dependency
vanilla setup (the file is served statically, unbundled).

## Decisions (confirmed with user)

1. **Scope:** Ancestors-only rewrite. The descendant half (your generation, siblings, cousins,
   collapse/expand, fan view) is left on the existing layout logic.
2. **Features:** Bifurcation fix only this session (scope A). Directional expand/collapse (scope B)
   is a separate follow-up.
3. **Orientation:** Wife-left / husband-right at **every** union, including the top (your parents).
   Result: Mom's maternal family (Mena / Ruiz) fills the LEFT; Dad's paternal family
   (Murillo / Patiño) fills the RIGHT. **This flips the current page's left/right.**
4. **Algorithm:** Hand-rolled Reingold–Tilford / Buchheim-style recursive interval allocation on
   union nodes. No new dependency.

## Architecture

### New module: `scripts/lib/ancestor-layout.js`

A **pure** function, unit-testable with no DOM:

```
layoutAncestors(tree, focalId, opts) -> Map<id, { x, gen }>
```

- `tree` — the GEDCOM-aligned `{ individuals, families }`.
- `focalId` — the focal person (root, `I1`).
- `opts` — `{ nodeW, gap, coupleGap, isHidden(id) }`. `isHidden` lets the client tell the layout which
  collateral individuals are currently collapsed so hidden subtrees contribute zero width.
- Returns x-coordinate (center, in layout units; focal couple centered near x = 0) and generation for
  **every ancestor-region individual** (gen ≥ 1, plus the focal couple's members). Descendant-region
  individuals (gen ≤ 0 other than via the focal couple) are NOT positioned here.

#### The recursion

The recursion is rooted at the **focal couple** — the family whose children include `focalId` (your
parents). Define a *union* = a `family` with at least one parent. For a union U with members
`wife = U.wife`, `husband = U.husband`:

1. Resolve each member's **parent-union** = the family in which that member is a child
   (`childToFamily`). That parent-union is laid out recursively and forms a *block* that sits one
   generation up.
2. Resolve each member's **collateral children** within their own parent-union — i.e. the member's
   siblings (the ancestor's brothers/sisters) — but those are rendered as part of the parent-union's
   own children band, collapsed by default (see below), so they fold into the parent-union's block
   width, never the child union's.
3. Lay out left-to-right within U's interval:
   `[ wife's parent-union block ] [ wife ] [ husband ] [ husband's parent-union block ]`.
   - Wife's entire block occupies x strictly less than husband's entire block.
   - The wife/husband pair is separated by `coupleGap`; blocks by `gap`.
4. The union's center x = midpoint of the wife/husband pair after their blocks are placed. Each
   parent-union block is shifted so it is centered over the member it descends into, then de-overlapped
   against its sibling block on the same side (RT contour/shift step) so blocks never collide.
5. A **leaf** is an ancestor with no known parent-union (including `placeholder: true` great-grandparents).
   Its block width is just `nodeW`.

Generations: focal couple = gen 1, their parents = gen 2, etc. (`gen` increases upward). The focal
person `focalId` itself is gen 0 and is positioned by the client (centered under the focal couple), not
by this module — but the module returns the focal couple so the client can pin to it.

#### Collateral ancestors (aunts/uncles, great-aunts/uncles)

These are the *other* children of an ancestor union (e.g. José's brother Francisco; Mom's nine
siblings). They remain **collapsed by default** exactly as today (`collapsible` = families with no
direct-line parent). When collapsed, `isHidden` reports them hidden and they contribute **zero width**.
When expanded, they are placed **within their own lineage's allocated interval**, beside the
direct-line ancestor, so expanding a collateral grows that side's block but never pushes across the
center channel — no crossing is possible. Their descendants (your cousins) hang beneath them via the
client's existing child-centering pass.

### Client changes: `family-tree.js`

- `render()` calls `layoutAncestors()` to position all gen ≥ 1 individuals + the focal couple.
- Descendant-region individuals (gen ≤ 0: focal person, siblings, cousins, any deeper descendants)
  keep the **existing** placement logic (bottom-up + `shiftSub` child-centering), hung under the
  ancestor-pass-positioned parents.
- Everything is translated so the focal node sits at a fixed center x; you + parents are the anchor.
- Connector drawing, collapse toggles, fan chart, popout, suggest-a-relative, photos, keyboard nav,
  accessibility labels, bilingual strings, gold focal ring — all unchanged.
- The legacy `bySide` ordering + paternal/maternal flood is replaced for the ancestor region by the
  module's interval output. The flood may still be used to tag side (P/M) for connector/fan coloring.

## Edge cases

- **Single known parent** (e.g. a union with only a husband or only a wife): the missing member
  occupies no slot; the present member's parent-block still allocates on the correct side
  (wife-side-left / husband-side-right based on the present member's sex).
- **Placeholder ancestors** (`placeholder: true`): treated as normal leaves (width `nodeW`), already
  styled dashed by `nodeEl`.
- **Missing focal couple** (no family lists `focalId` as a child): degrade gracefully — return just
  the focal at x = 0, gen 0; client renders descendants only. (Should not happen for I1 but must not
  throw.)
- **A member who married in** (spouse of a collateral, with their own unknown parents): leaf on the
  appropriate side of their own union.
- **Pedigree collapse** (same ancestor reachable by two paths): not expected in this dataset; if it
  occurs, the first path wins (first `childToFamily` entry), matching current behavior — no crash.

## Testing

New `tests/ancestor-layout.test.js` (node:test), driven by small synthetic trees AND a smoke test
against the real `content/family/tree.json`. The invariants that *prove* no crossing:

1. **Bifurcation:** for every union, `max(x over wife's entire subtree) < min(x over husband's entire
   subtree)`.
2. **Global partition:** every maternal-side ancestor x < focal-couple center x < every paternal-side
   ancestor x.
3. **Parent centering:** each parent-union's center x ≈ centered over the child it descends into
   (within half a node width).
4. **No overlap:** within any generation, adjacent positioned nodes are ≥ `nodeW + gap` apart.
5. **Collapse invariance:** hiding a collateral family (via `isHidden`) preserves invariants 1–4 and
   reduces total width.
6. **Determinism / no-throw:** running on the real `tree.json` returns a position for every gen ≥ 1
   individual and never throws.

Final result is verified visually in-browser (Claude-in-Chrome) against a Vercel preview deploy before
any merge to main, per the standing review rule.

## Out of scope (this spec)

- Directional up/sideways expand-collapse affordances (scope B — separate follow-up).
- Any change to the descendant-region layout beyond pinning it under the new ancestor positions.
- Data edits (new relatives, names) — none required.
- Fan chart changes.

## Acceptance criteria

- No connector crossings between the maternal (Mena/Ruiz) and paternal (Murillo/Patiño) lineages, or
  between any couple's two parental lines.
- Mom's maternal family strictly left of the focal couple; Dad's paternal family strictly right.
- Parents + Jaime are visually centered as the anchor; ancestors fan upward.
- All existing features preserved: descendant layout, collapse/expand of collateral branches, fan
  view, popout, suggest-a-relative, photos, accessibility labels, bilingual UI.
- `tests/ancestor-layout.test.js` passes; full suite stays green (serial run).
- Verified in-browser on a preview deploy before merge.
