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
      const parents = [fam.husband, fam.wife].filter(Boolean);
      const placedParent = parents.find(p => gens.has(p));
      if (placedParent == null) continue;
      const childGen = gens.get(placedParent) - 1;
      for (const child of (fam.children || [])) {
        if (!gens.has(child)) { gens.set(child, childGen); changed = true; }
      }
    }
  }
  return gens;
}
