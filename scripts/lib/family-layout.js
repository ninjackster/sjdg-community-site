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
  return gens;
}
