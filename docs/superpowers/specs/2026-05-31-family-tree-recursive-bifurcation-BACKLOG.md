# BACKLOG — Family tree: recursive bifurcation + directional expand/contract

**Status:** Largely implemented 2026-06-02 on branch `feature/family-tree-bifurcation`
(spec `docs/superpowers/specs/2026-06-01-family-tree-bifurcation-design.md`,
plan `docs/superpowers/plans/2026-06-01-family-tree-bifurcation.md`).
**Owner:** Jaime Murillo
**Area:** `family-tree.js` layout engine (the private tree at `/es/familia`).

### What shipped (2026-06-02)
- New pure module `scripts/lib/ancestor-layout.js` (`layoutAncestors`) does
  recursive-bifurcation layout of the **entire ancestor region** (gen ≥ 1): every
  direct ancestor sits centred under its parents; collateral aunts/uncles &
  great-aunts/uncles fan outward with their married-in spouse; each couple's wife
  block is laid strictly left of the husband block, so **no lineage lines cross**.
  Maternal (Mena/Ruiz) fills the left, paternal (Murillo/Patiño) the right.
- The client inlines the same function (sync-guarded by a test) and uses it for all
  gen ≥ 1 + the focal anchor; descendants (gen ≤ 0) keep the existing child-centering.
- **Compact default view** (a slice of scope B): great-aunts/uncles (gen ≥ 2
  collaterals) and cousins collapse behind `+N` toggles; the direct line + your own
  aunts/uncles + your siblings show by default. Expanding a direct ancestor reveals
  its siblings; expanding a relative reveals their children. Verified in-browser.

### Still backlogged (scope B remainder)
- Dedicated directional **▲ expand-up / ◀▶ expand-sideways** affordances distinct
  from the unified `+N` toggle, and any further compaction of the focal-couple gap
  (parents are pushed apart by the inner grandparents nesting between them — inherent
  to a non-overlapping pedigree, acceptable but could be tuned).

## Problem (observed in production)

1. **Lineages cross at the grandparent level.** Grandpa **José Murillo Villalobos** sits to the right of grandma **Teresa Patiño Gutiérrez** (correct), but José's ancestors (`? Murillo` / `? Villalobos`) and his brother Francisco are placed on the **left**, while Teresa's ancestors (`? Patiño` / `? Gutiérrez`) and siblings are mixed across — so the two couples' connector lines **overlap/cross** where the families meet.
2. **The two grandparent families intermix** instead of separating cleanly. Jaime wants: **grandma's (Patiño) family expands up-and-to-the-LEFT; grandpa's (Murillo) family expands up-and-to-the-RIGHT**, meeting only at the José+Teresa marriage.
3. **Focal point should be Jaime + his parents**, not the grandparents — the parents/me band should read as the anchor.

Root cause: the current layout uses "direct line hugs center + family-gap" ordering with a bottom-up centering pass. It keeps the focal couple adjacent and centers children under parents, but it does **not** allocate each ancestor's two parental lineages as contiguous, non-overlapping subtrees — so collaterals (e.g. Francisco) and the great-grandparent couples drift to the wrong side and lines cross.

## Desired design (best-in-class)

Implement the **union-node recursive layout** the research recommended (GoJS genogram + Reingold–Tilford):

- **Treat each couple as one layout unit** (a "union"). Lay out unions, not individuals.
- **Recursive split at every couple:** each parent owns its *own* ancestral subtree; the wife's subtree is allocated entirely to the left, the husband's entirely to the right (Jaime's preference: grandma/wife left, grandpa/husband right). Recurse upward — so each lineage is a self-contained block that cannot interleave or cross.
- **R-T centering:** a couple is centered over the midpoint of its children's x-span; subtree widths are summed bottom-up so blocks never overlap.
- **Focal framing:** Jaime + parents centered as the anchor; ancestors fan upward, descendants downward (hourglass).

Refs (from the 2026-05-30 research): GoJS genogram (`LayeredDigraphVertex` = couple), Reingold–Tilford tidy tree, d3-hierarchy. Consider `d3-hierarchy` for coordinates if hand-rolling the recursion balloons.

## Dynamic expand / contract (the requested feature)

Mirror the existing downward **+N** collapse/expand, but **directionally**, for ancestors beyond the grandparents:

- Past the grandparents, an ancestor's parents/grandparents collapse by default with an **"expand up"** affordance (▲ +N) on the ancestor node.
- An ancestor's siblings / their descendants collapse with an **"expand sideways"** affordance (◀ / ▶ +N) that opens that collateral branch outward (left for maternal-of-that-line, right for paternal-of-that-line).
- Re-render preserves zoom (already supported). Same pattern FamilySearch uses (per-line expand arrows).

## Acceptance criteria

- No connector crossings between the Patiño and Murillo lineages (or any couple's two lines).
- Grandma's family strictly left of the José+Teresa union; grandpa's strictly right.
- Each ancestor beyond the grandparents has up/sideways expand toggles; default view stays compact and centered on Jaime+parents.
- Existing features preserved: collapse/expand of descendants, fan view, popout, suggest-a-relative, accessibility labels, bilingual.

## Estimate / notes

Substantial — it's a layout-engine rewrite (union model + recursive subtree packing + directional toggles). Best done as its own focused session with browser verification. Lower-risk increment first: fix the ancestor crossing via recursive bifurcation; add directional expand/contract second.

## Backlog — collapse collateral spouses by default (requested 2026-06-02)

For a cleaner default view, **collapse/hide the married-in spouses of everyone EXCEPT the
direct roll-up** (you, parents, grandparents, great-grandparents …). I.e. a collateral's
married-in partner (Chepa's Pedro Vásquez, Olga's Baudelio, the ¿? placeholders, Abel de la
Torre, Tonguelo, Antonio Herrera, etc.) would be hidden by default, showing only the blood
relative, with an affordance to reveal the spouse on demand. Direct-line ancestors keep both
partners (the bifurcation depends on each ancestor couple). Implementation sketch: in the
client `anchorOf`/collapse model, gate a married-in spouse of a NON-direct person behind its
blood-relative partner (or a dedicated toggle); keep `injectExtraSpouses` / focal-parent
spouses as-is. Verify the suggest-a-relative + couple connectors still read correctly.

## ✅ SHIPPED 2026-06-02 — one-click "open whole subtree" (requested 2026-06-02)

Done on branch `feature/subtree-expand` (merged to main `7b11245`). The expand toggle now calls
`deepExpand`/`deepCollapse`, which cascade through the descendant + married-in-spouse direction
(`inSubtreeDir` = gated id is the anchor's child or spouse) over the existing anchor model, so a
relative's whole direct subtree opens/closes in one click. Sibling reveals stay single-level (a
direct ancestor's collateral siblings are NOT auto-cascaded). Verified in-browser on preview:
clicking Chuy revealed all 8 descendants across 3 generations, 0 overlaps; re-click removed the
whole subtree; expanding grandpa José still revealed only his 6 siblings (no cascade). Original ask:

When expanding a relative (e.g. Santos), open their ENTIRE direct subtree at once — spouse +
children (+ grandchildren …) — instead of the current step-by-step (reveal spouse, then click
again to reveal kids). Implementation sketch: on an expand click, deep-expand — add the clicked
anchor AND every anchor whose `anchorOf` chain passes through it to the `expanded` set (BFS over
`anchors` where `anchorOf(sub) === a`); collapse removes the whole subtree likewise. Decide
whether this should follow only the descendant/spouse direction (probably yes) or also cascade
into collateral-sibling branches (e.g. clicking a grandparent opening every great-uncle's family
— likely too much; gate the cascade to descendants+spouse, keep sibling reveals single-level).
