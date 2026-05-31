# BACKLOG — Family tree: recursive bifurcation + directional expand/contract

**Status:** Backlogged (not started). Requested by Jaime 2026-05-31.
**Owner:** Jaime Murillo
**Area:** `family-tree.js` layout engine (the private tree at `/es/familia`).

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
