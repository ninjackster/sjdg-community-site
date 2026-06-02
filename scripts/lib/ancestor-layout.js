// Pure recursive-bifurcation layout for the ANCESTOR spine of a family tree.
// Each couple is a union; the wife's entire ancestral block is allocated strictly
// to the left of the husband's, recursively, so lineage lines never cross.
// Returns Map<id,{x,gen}> for the focal person (gen 0) and every visible direct
// ancestor (gen >= 1). Collaterals and descendants are positioned by the caller.
export function layoutAncestors(tree, focalId, opts = {}) {
  const nodeW = opts.nodeW != null ? opts.nodeW : 210;
  const gap = opts.gap != null ? opts.gap : 30;
  const isHidden = opts.isHidden || (() => false);

  const famById = new Map(tree.families.map(f => [f.id, f]));
  const childToFamily = new Map();
  for (const f of tree.families) {
    for (const c of (f.children || [])) if (!childToFamily.has(c)) childToFamily.set(c, f.id);
  }

  const out = new Map();
  if (!childToFamily.has(focalId)) { out.set(focalId, { x: 0, gen: 0 }); return out; }

  // Lay out `personId` at `gen` plus all visible ancestors above, in local coords
  // starting at x=0. Returns { width, anchorX, cells:[{id,x,gen}] }.
  function block(personId, gen) {
    const fam = famById.get(childToFamily.get(personId));
    const ups = [];                         // wife (left) then husband (right)
    if (fam) {
      if (fam.wife && !isHidden(fam.wife)) ups.push(fam.wife);
      if (fam.husband && !isHidden(fam.husband)) ups.push(fam.husband);
    }
    if (ups.length === 0) {
      return { width: nodeW, anchorX: nodeW / 2, cells: [{ id: personId, x: nodeW / 2, gen }] };
    }
    const cells = [];
    const anchors = [];
    let cursor = 0;
    for (const pid of ups) {
      const b = block(pid, gen + 1);
      for (const c of b.cells) cells.push({ id: c.id, x: c.x + cursor, gen: c.gen });
      anchors.push(cursor + b.anchorX);
      cursor += b.width + gap;
    }
    const width = cursor - gap;
    const selfX = (anchors[0] + anchors[anchors.length - 1]) / 2;
    cells.push({ id: personId, x: selfX, gen });
    return { width, anchorX: selfX, cells };
  }

  const root = block(focalId, 0);
  for (const c of root.cells) out.set(c.id, { x: c.x, gen: c.gen });
  return out;
}
