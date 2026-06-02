# Relationship-to-Focal Labels on the Popout (Design)

**Date:** 2026-06-02
**Owner:** Jaime Murillo
**Area:** the private family tree popout card (`openCard` in `family-tree.js`) + a new pure module.

## Goal

Show, on each individual's detail popout, that person's kinship relationship to the focal person (Jaime) — e.g. "Abuelo", "Tío abuelo", "Primo hermano", "Sobrina", "Madre de tu media hermana Alexis". Gender-aware, bilingual (EN/ES), full kinship precision, with a graceful fallback. Self shows "Tú" / "You".

## Module

New dependency-free ES module **`/kinship.js`** (root-level, passed through to `dist/`, imported by `family-tree.js` via the existing `type="module"` script and by the Node tests — one source of truth, same pattern as `hourglass-layout.js`). Public API:

```
relationshipLabel(tree, focalId, personId, lang) -> string
```
- Returns the kinship label in `lang` ('en' | 'es'). Returns "" only if `personId === focalId` is NOT special-cased here — the caller decides; the function itself returns "Tú"/"You" for the focal.
- Pure; never throws; unknown/unreachable → graceful fallback string.

Internally builds light maps from `tree`: `childParents` (child → [parents]), `coupleOf` (spouse ↔ spouse), and `byId` (for `sex`). No dependency on the layout engine.

## Algorithm — lowest common ancestor (LCA)

1. `ancestorsWithDist(id)` → `Map<ancestorId, distance>` via BFS up `childParents`; self = 0.
2. Compute for focal (F) and person (P). Intersect; choose the common ancestor minimizing `distF + distP` (ties → minimize `max`). Let `a = distF[LCA]`, `b = distP[LCA]`.
3. Classify:
   - **No common ancestor** → married-in (see below).
   - `a==0 && b==0` → self → "Tú" / "You".
   - `a==0` (F is ancestor of P) → **descendant**: b=1 hijo/a, 2 nieto/a, 3 bisnieto/a, 4 tataranieto/a, else "descendiente".
   - `b==0` (P is ancestor of F) → **ancestor**: a=1 padre/madre, 2 abuelo/a, 3 bisabuelo/a, 4 tatarabuelo/a, else "ancestro".
   - `a==1 && b==1` → **sibling**: share both parents → hermano/a; share one → medio hermano/a.
   - `b==1 && a>=2` → **aunt/uncle**: a=2 tío/a, a=3 tío/a abuelo/a, a=4 tío/a bisabuelo/a, else "tío/a (ancestro)".
   - `a==1 && b>=2` → **niece/nephew**: b=2 sobrino/a, b=3 sobrino/a nieto/a, b=4 sobrino/a bisnieto/a, else "sobrino/a (lejano)".
   - `a>=2 && b>=2` → **cousin**: degree `d = min(a,b) - 1`, removed `r = |a-b|`.
     - d: 1 primo/a hermano/a, 2 primo/a segundo/a, 3 primo/a tercero/a, else "primo/a (grado d)".
     - r>0: append ES " una vez removido/a" (r=1) / " {r} veces removido/a"; EN "first cousin once/twice/… removed" using ordinal(d)+removed(r).

Gender via `sex` ('F' → feminine endings, abuela/tía/prima/sobrina/hija/madre; default masculine). `null`/unknown sex → masculine default (matches existing UI conventions).

## Married-in (no common ancestor with focal)

Marriage-agnostic, accurate (per Jaime: a shared child does not imply marriage):
1. **Co-parent of a blood relative:** if P is a parent in any family that has a child blood-related to F, pick the closest-related such child C; label = "{Madre|Padre} de {C's relationship phrase incl. name}" — e.g. ES "Madre de tu media hermana Alexis", EN "Mother of your half-sister Alexis". (Covers Irma I70 → via Alexis I71.)
2. **Partner of a blood relative:** else if `coupleOf(P)` is blood → ES "Pareja de {partner relationship incl. name}" / EN "Partner of {…}". Neutral term — never asserts marriage.
3. **Fallback:** ES "Familiar político" / EN "Relative by marriage".

The "relationship phrase incl. name" helper renders e.g. "tu media hermana Alexis" / "your half-sister Alexis" (lowercase term + given name) for embedding in the married-in strings.

## Display (in `openCard`)

A single subtitle line directly under the `<h2>` name: small, clay-colored, e.g.:
```
<p class="ft-rel">Tío abuelo</p>
```
- Focal: "Tú" / "You".
- Capitalized first letter. No layout disruption; sits between the name and the Born line.
- Built by calling `relationshipLabel(tree, FOCAL_ID, ind.id, lang)`; `tree` is already in scope in `draw()` (pass it into `openCard`, or close over it).

## Edge cases

- Focal itself → "Tú"/"You".
- Placeholder (`¿?`) people: still labeled by position (e.g. an unnamed great-aunt → "Tía abuela"); name embedding uses given (may be "¿?").
- Person with multiple paths to focal (none in current data) → LCA with min sum picks the closest; documented limitation, no crash.
- Married-in with neither blood child nor blood partner → generic fallback.
- Missing `sex` → masculine default.

## Testing

`tests/kinship.test.js` importing `/kinship.js`:
- **Synthetic unit tests** for each branch + gender: ancestor (padre/abuela/bisabuelo), descendant (hija/nieto), sibling (hermano vs medio hermano), aunt/uncle (tía, tío abuelo), niece/nephew (sobrino, sobrina nieta), cousins (primo hermano; first cousin once removed; primo segundo), married-in co-parent (Madre de…), married-in partner (Pareja de…), fallback, self.
- **Real-tree assertions** (`content/family/tree.json`, focal I1): I2 padre, I3 madre, I4 abuelo, I5 abuela, I52 bisabuelo, I71 "media hermana", I13 tío, I133 "tío abuelo", I145 (Efraín, Chuy's son) primo hermano once-removed, I147 (Mariana) further removed, I72 (Yamileth, Alexis's child) sobrina, I70 (Irma) → "Madre de tu media hermana Alexis".
- Bilingual: spot-check EN + ES for a few.

## Rollout

Branch `feature/relationship-labels`, TDD, preview verification (open several cards, confirm labels read correctly EN + ES), then pause for review before prod (standing rule). Low risk: additive (new module + one card line); no change to layout or data.
