# Family Tree — Full Hourglass Tidy-Tree Rewrite (Design)

**Date:** 2026-06-02
**Owner:** Jaime Murillo
**Area:** the private interactive family tree at `/es/familia` & `/en/family` (repo `ninjackster/sjdg-community-site`, Vercel `sjdg-webpage`).
**Backup:** tag `backup/pre-tidy-tree-rewrite-2026-06-02` @ `c2ccc55` (pushed to origin). Restore the engine with:
`git checkout backup/pre-tidy-tree-rewrite-2026-06-02 -- family-tree.js scripts/lib/ancestor-layout.js templates/pages/family.html`

## Goal

Replace the family-tree layout engine with a single, hand-rolled, dependency-free **union-node tidy-tree** that lays out both the ancestor pedigree (upward) and all collateral/descendant subtrees (downward) with provably non-overlapping, non-crossing geometry — retiring today's "outward-push" descendant heuristic and the inlined-mirror + marker-sync maintenance burden. The visible framing, all interactions, and all other features are preserved exactly; only node *positioning* changes.

## Non-goals

- No change to the collapse/expand model, deep-expand, directional arrows, fan view, zoom/pan, detail card, suggest-a-relative, keyboard nav, accessibility, or bilingual strings.
- No data-model change to `content/family/tree.json`.
- No new runtime dependency (no d3-flextree, no bundler).
- Not the deep-ancestor `▲` expand-up feature (separately backlogged for Q4 2026).

## Framing (must be preserved)

This is an **egocentric** layout, not a vanilla top-down tidy tree:
- Focal (Jaime, `tree.individuals[0]`) + his parents read as the centered anchor.
- The direct line is the central spine; **maternal side strictly left, paternal strictly right** of the focal column.
- Mom is the rightmost maternal node and Dad the leftmost paternal node (spine hugs the center seam).
- Within any couple, **wife left / husband right**.
- Collateral kin (aunts/uncles, great-aunts/uncles, cousins, multi-generation branches like Chuy's) fan **outward** from the spine, on their own lineage's side.

## Architecture & Packaging

**New module:** `/family-layout.js` at the repo root — a dependency-free **ES module** exporting the layout engine. Root-level `.js` files are already copied verbatim to `dist/` by `scripts/lib/passthrough.js`, so the browser can load it at `/family-layout.js`.

**Client loading:** `templates/pages/family.html` changes the script tag from
`<script src="/family-tree.js" defer></script>` to
`<script type="module" src="/family-tree.js"></script>` (module scripts defer by default).
`family-tree.js` then does `import { layoutHourglass } from '/family-layout.js';`.

**Single source of truth:** Node tests `import` the same `/family-layout.js`. This **deletes** `scripts/lib/ancestor-layout.js`, the inlined `layoutAncestors` copy inside `family-tree.js`, and `tests/ancestor-layout-client-sync.test.js` (the marker-sync test is no longer needed).

**Unchanged build/test wiring:** `scripts/lib/family-tree.js` (`validateTree`) stays. `scripts/build.js` and the passthrough are unchanged except that `family-layout.js` rides along as a root `.js` file.

### Public API (the only contract `family-tree.js` depends on)

```
layoutHourglass(tree, focalId, opts) -> Map<id, { x, y, gen }>
```
- `tree` — `{ individuals, families }` as loaded today.
- `focalId` — the root individual id.
- `opts` — `{ nodeW=210, rowH=132, gap=30, famGap=78, sideGap=150, isHidden=(id)=>false }`.
- Returns a Map from individual id to `{ x, y, gen }` for every **visible** individual (hidden ids omitted). `gen` keeps today's sign convention (0 = focal, positive = ancestors). `y` is derived (`-gen * rowH`) but returned so the client doesn't recompute. The client maps the Map to absolute DOM positions exactly as it does now (translateX(-50%), top from row).

**Map ownership (resolved):** the engine builds whatever relationship maps it needs **internally** from `tree` (in `buildModel`); it does NOT receive or return them. The client continues to build its **own** maps for interaction logic (collapse/anchor model, arrows, connectors, keyboard nav). The two never share map objects — the only contract between them is the returned `Map<id,{x,y,gen}>`. This keeps the API narrow at the cost of each side deriving maps from `tree` once; acceptable (both are O(n) over a ~150-node tree). The client keeps ownership of DOM creation (`nodeEl`), connector drawing (`drawConnectors`), and everything in §"Preserved".

## Components (inside `family-layout.js`, each independently testable)

1. **`buildModel(tree, focalId)`** → engine-internal relationship maps + `unions`. Collapses every couple into a **union node**: `{ id, partners:[a,b?], childIds:[], kind:'couple'|'single' }`. Also computes `direct` (focal ancestors), `sideOf` (M/P/C), `gen`, `coupleOf`, `childParents`, `kidsOf`. These are private to the engine (the client derives its own copies for interaction logic — see Map ownership above).
2. **`tidy(rootLayoutNode)`** → the generic Buchheim/Walker linear-time Reingold–Tilford pass with **van der Ploeg variable node widths**. Operates on an abstract `LayoutNode { width, children, x, mod, thread, ancestor, shift, change, prelim }`. Pure; no domain knowledge. This is the ~150-line core and gets its own focused tests.
3. **`measureDescendantSubtree(unionOrPersonId, side)`** → runs `tidy` on a collateral/descendant subtree growing downward, returns `{ cells: Map<id,{dx,dy}>, width }` (local coordinates). Width feeds the ancestor pass.
4. **`layoutAncestorPedigree(...)`** → builds the upward pedigree as `LayoutNode`s where each ancestor union's **effective width** includes the widths of the collateral subtrees that must sit beside it on its side; runs `tidy`; forces maternal child first (left), paternal second (right). Then slots each measured collateral subtree into its reserved outward band.
5. **`stitch(...)`** → pins focal at x=0, composes ancestor coordinates (up) with descendant/collateral coordinates (down) into the final `Map<id,{x,y,gen}>`. Applies the wife-left/husband-right ordering inside each union and the second-family injection (see Edge cases).

## Data flow

`tree` → `buildModel` → (`measureDescendantSubtree` per collateral branch) → `layoutAncestorPedigree` (variable-width tidy) → `stitch` → `Map<id,{x,y,gen}>` → client `render()` positions DOM nodes → `drawConnectors`. `isHidden` is consulted in `buildModel`/measure so collapsed nodes never enter the packing.

## Preserved (verbatim behavior, code may move into `family-layout.js`'s `buildModel`)

Password gate; data loading; the collapse/anchor model (`direct`, `blood`, `focalSibs`, `anchorOf`, `gatedBy`, `expanded`, `computeHidden`); `deepExpand`/`deepCollapse` one-click subtree; directional `▲▾◂▸` arrows with counts; fan/radial view; zoom/pan viewport; controls (zoom/center/fit/expand-all/collapse-all/fan toggle); detail card (`openCard`); suggest-a-relative (`openSuggest` + `/api/family-suggest`); keyboard navigation + `meta.order`; ARIA labels; EN/ES strings; placeholder (dashed/dimmed) and adopted (`∗`) styling; focal highlight.

## Edge cases

- **Single known parent** → single-partner union, half-width box; tidy variable-width handles it; child centers under the lone parent.
- **Second family / half-sibling** (Héctor F16; Alexis + dimmed Irma I70) → the focal parent's extra union slots on the **outer** side; half-sibling sits beside focal at gen 0; the dimmed placeholder partner renders but does not distort packing.
- **Placeholders** (`¿?`, `placeholder:true`) → laid out as normal leaves, rendered dimmed.
- **Hidden/collapsed nodes** → omitted from `buildModel`/measurement so packing reflects only visible nodes; layout recomputes on every expand/collapse (as today).
- **No-overlap invariant** → every generation row has ≥ `nodeW + gap` between adjacent nodes (tidy guarantees it; asserted in tests).
- **Missing focal family** → returns `{focal:{x:0,y:0,gen:0}}` without throwing.
- **Consanguinity loops** (a person reachable as both ancestor and descendant) → not present in this data; if introduced, the node is placed by its ancestor path and a note is logged (no planar guarantee — documented limitation).

## Testing

- **Keep all existing non-layout tests green** (currently 113 total across 18 files).
- **Replace** `tests/ancestor-layout.test.js` → `tests/family-layout.test.js` importing `/family-layout.js`; port every existing invariant (gen assignment, maternal<focal<paternal, per-union wife-left/husband-right, parent-centering, single-parent, placeholder, hidden-node omission, collaterals fan outward & no-overlap, center seam, second-spouse injection, real-tree smoke on `content/family/tree.json`).
- **Add tidy-tree invariants:** parent centered over the span of its children; sibling subtrees never overlap (contour test); deterministic child order ⇒ no maternal/paternal crossing; variable-width packing keeps ≥ separation with mixed couple/single widths.
- **Delete** `tests/ancestor-layout-client-sync.test.js` (mirror retired).
- **Browser verification** on a Vercel preview (login `changeme`): focal centered; mom/dad hug the seam; Chuy's 3-gen branch packs without overlap; expand/collapse + deep-expand still correct; connectors aligned at zoom; fan view still works.

## Rollout

Big-bang on a feature branch (`feature/tidy-tree-rewrite`), executed with **subagent-driven-development** (fresh subagent per task; spec-compliance then code-quality review between tasks). The page is private; verify thoroughly on the Vercel preview, then pause for Jaime's review before merging to `main`/prod (standing rule). The pre-rewrite engine is restorable from the backup tag at any time.

## Risks

- Highest-risk file in the project (`family-tree.js`); broad blast radius across ~18 features.
- Payoff is correctness + maintainability (no outward-push hack, no mirror), i.e. polish over a working layout — so verification is weighted toward "no regressions" over "new capability."
- Mitigations: backup tag; one-source-of-truth module with strong unit tests; preview verification; explicit review gate before prod.
