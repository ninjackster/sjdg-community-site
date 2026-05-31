// Returns Map<individualId, generationDepth> where the root is 0 and each
// ancestor generation increments by 1. Used to place rows in the pedigree.
export function computeGenerations(tree, rootId) {
  const childToParents = new Map();
  for (const fam of tree.families) {
    const parents = [fam.husband, fam.wife].filter(Boolean);
    for (const child of (fam.children || [])) {
      childToParents.set(child, (childToParents.get(child) || []).concat(parents));
    }
  }
  const gens = new Map();
  const walk = (id, depth) => {
    if (!gens.has(id) || depth > gens.get(id)) gens.set(id, depth);
    for (const parent of (childToParents.get(id) || [])) walk(parent, depth + 1);
  };
  walk(rootId, 0);

  // Place siblings: any child of a family whose parent is already placed sits
  // one generation below that parent. This lets aunts/uncles render alongside
  // the direct ancestor line. Repeat until stable (handles families in any order).
  let changed = true;
  while (changed) {
    changed = false;
    for (const fam of tree.families) {
      const kids = fam.children || [];
      const parents = [fam.husband, fam.wife].filter(Boolean);
      const placedParent = parents.find(p => gens.has(p));
      // Prefer a placed parent (children sit one below). Otherwise, if a
      // sibling is already placed, the rest of the children share its
      // generation — this seats grandparents' siblings whose own parents
      // aren't in the tree.
      let childGen = null;
      if (placedParent != null) {
        const pg = gens.get(placedParent);
        // Seat a married-in spouse at the same generation as their partner.
        for (const p of parents) if (!gens.has(p)) { gens.set(p, pg); changed = true; }
        childGen = pg - 1;
      } else {
        const placedChild = kids.find(c => gens.has(c));
        if (placedChild != null) childGen = gens.get(placedChild);
      }
      if (childGen == null) continue;
      for (const child of kids) {
        if (!gens.has(child)) { gens.set(child, childGen); changed = true; }
      }
    }
  }
  return gens;
}
