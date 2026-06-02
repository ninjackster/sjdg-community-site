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

// Lay out `rootId` (+ spouse, wife-left) at gen `gen`, with the entire descendant subtree
// placed BELOW (gen-1, gen-2, …). Returns { cells:[{id,x,gen}], w } with x left-anchored in [0,w].
// `opts` = { nodeW, gap, coupleGap=gap, vis }. Pure; no DOM.
export function layoutSubtree(rootId, gen, model, opts) {
  const nodeW = opts.nodeW, gap = opts.gap, coupleGap = opts.coupleGap != null ? opts.coupleGap : gap;
  const vis = opts.vis;
  const { parentToFamily, famById, byId } = model;

  const spouseOf = (id) => {
    const pf = parentToFamily.get(id); if (pf == null) return null;
    const f = famById.get(pf);
    const o = f.husband === id ? f.wife : (f.wife === id ? f.husband : null);
    return vis(o) ? o : null;
  };
  const slotMembers = (id) => {
    const sp = spouseOf(id); if (!sp) return [id];
    return (byId.get(id) || {}).sex === 'F' ? [id, sp] : [sp, id];
  };
  const childrenOf = (id) => {
    const pf = parentToFamily.get(id); if (pf == null) return [];
    return (famById.get(pf).children || []).filter(vis);
  };

  function build(id, g) {
    const members = slotMembers(id);
    const coupleW = members.length * nodeW + (members.length - 1) * coupleGap;
    const kids = childrenOf(id);
    if (!kids.length) {
      const cells = []; let x = nodeW / 2;
      for (const mId of members) { cells.push({ id: mId, x, gen: g }); x += nodeW + coupleGap; }
      return { cells, w: coupleW, coupleMid: coupleW / 2 };
    }
    // Lay out each child subtree left-to-right, packed by gap.
    const childBlocks = []; let cursor = 0;
    for (const k of kids) {
      const b = build(k, g - 1);
      childBlocks.push({ b, offset: cursor });
      cursor += b.w + gap;
    }
    const kidsW = cursor - gap;
    const w = Math.max(coupleW, kidsW);
    const kidsShift = (w - kidsW) / 2;     // centre the kid band within the wider of {couple,kids}
    const cells = [];
    let childMidSum = 0, childCount = 0;
    for (const { b, offset } of childBlocks) {
      for (const c of b.cells) cells.push({ id: c.id, x: c.x + offset + kidsShift, gen: c.gen });
      childMidSum += b.coupleMid + offset + kidsShift; childCount++;
    }
    const childrenCentre = childMidSum / childCount;
    // Place the couple centred over the children's centre.
    const coupleShift = childrenCentre - coupleW / 2;
    let x = coupleShift + nodeW / 2;
    for (const mId of members) { cells.push({ id: mId, x, gen: g }); x += nodeW + coupleGap; }
    return { cells, w, coupleMid: childrenCentre };
  }

  const { cells, w } = build(rootId, gen);
  // normalise x into [0,w]
  let lo = Infinity; for (const c of cells) lo = Math.min(lo, c.x - nodeW / 2);
  for (const c of cells) c.x -= lo;
  return { cells, w };
}
