// Hourglass tidy-tree layout for the private family tree. Dependency-free ES module,
// imported by both the browser (type="module") and the Node tests — single source of truth.
// Lays out ancestors (gen>0) UP and all collateral/descendant subtrees DOWN with
// non-overlapping, non-crossing geometry. Maternal side strictly left, paternal strictly
// right of the focal; within a couple, wife left / husband right.

export function buildModel(tree, focalId) {
  const byId = new Map(tree.individuals.map(i => [i.id, i]));
  const famById = new Map(tree.families.map(f => [f.id, f]));
  const childToFamily = new Map();   // child -> the family it is a child of
  const parentToFamily = new Map();  // parent -> the (first) family it parents
  const childParents = new Map();    // child -> [parents]
  const kidsOf = new Map();          // parent -> [children]
  const coupleOf = new Map();        // spouse <-> spouse
  for (const f of tree.families) {
    const ps = [f.husband, f.wife].filter(Boolean);
    for (const c of (f.children || [])) {
      if (!childToFamily.has(c)) childToFamily.set(c, f.id);
      childParents.set(c, (childParents.get(c) || []).concat(ps));
    }
    for (const p of ps) {
      if (!parentToFamily.has(p)) parentToFamily.set(p, f.id);
      (kidsOf.get(p) || kidsOf.set(p, []).get(p)).push(...(f.children || []));
    }
    if (ps.length === 2) { coupleOf.set(ps[0], ps[1]); coupleOf.set(ps[1], ps[0]); }
  }
  // Direct line: focal + ancestors (upward closure).
  const direct = new Set();
  (function up(id){ if (direct.has(id)) return; direct.add(id); for (const p of (childParents.get(id)||[])) up(p); })(focalId);
  // Generations: focal=0, ancestors positive (BFS up), descendants negative (BFS down).
  const gen = new Map([[focalId, 0]]);
  (function climb(id){ for (const p of (childParents.get(id)||[])) if (!gen.has(p)) { gen.set(p, gen.get(id)+1); climb(p); } })(focalId);
  // Side: flood maternal/paternal through spouse+sibling links, excluding the focal nuclear family.
  const focalFamId = childToFamily.get(focalId);
  const father = focalFamId != null ? famById.get(focalFamId).husband : null;
  const mother = focalFamId != null ? famById.get(focalFamId).wife : null;
  const adj = new Map();
  const link = (a,b) => { if(!a||!b) return; (adj.get(a)||adj.set(a,new Set()).get(a)).add(b); (adj.get(b)||adj.set(b,new Set()).get(b)).add(a); };
  for (const f of tree.families) {
    if (focalFamId != null && f.id === focalFamId) continue;
    const ps = [f.husband, f.wife].filter(Boolean), ks = f.children || [];
    if (ps.length === 2) link(ps[0], ps[1]);
    for (const k of ks) for (const p of ps) link(p, k);
    for (let i=0;i<ks.length;i++) for (let j=i+1;j<ks.length;j++) link(ks[i], ks[j]);
  }
  const side = new Map([[focalId,'C']]);
  const flood = (start, tag) => { if(!start) return; const st=[start]; while(st.length){ const n=st.pop(); if(side.has(n)) continue; side.set(n,tag); for (const m of (adj.get(n)||[])) if (m!==focalId && !side.has(m)) st.push(m); } };
  flood(father, 'P'); flood(mother, 'M');
  return {
    byId, famById, childToFamily, parentToFamily, childParents, kidsOf, coupleOf,
    direct, gen, focalFamId, father, mother,
    sideOf: (id) => side.get(id) || 'M',
  };
}
