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

// Lay out one direct-ancestor `spineId` at local x=0 (gen from model), plus its collateral
// siblings (each carrying their descendant subtree via layoutSubtree) fanning in `dir`
// (-1 maternal/left, +1 paternal/right), plus its parents recursing upward (wife-left).
// Returns { cells:[{id,x,gen}], lo, hi } where lo/hi are signed outer edges of the spine row.
export function layoutAncestorSide(spineId, model, opts) {
  const nodeW = opts.nodeW, gap = opts.gap;
  const { childToFamily, famById } = model;
  const vis = opts.vis;
  const dirOf = (id) => model.sideOf(id) === 'M' ? -1 : 1;

  // edgeHint: the minimum |x| the first collateral of this block must start beyond,
  // passed down from a child block so ancestors' collateral subtrees never overlap
  // with a descendant spine-level's collateral subtrees in the same generation.
  function block(spineId, dir, edgeHint = dir * (nodeW / 2)) {
    const g = model.gen.get(spineId);
    const fam = childToFamily.has(spineId) ? famById.get(childToFamily.get(spineId)) : null;
    const cells = [{ id: spineId, x: 0, gen: g }];
    // Start edge from edgeHint so this block's collaterals clear any lower-gen collaterals.
    let edge = dir < 0 ? Math.min(dir * (nodeW / 2), edgeHint) : Math.max(dir * (nodeW / 2), edgeHint);

    const collats = fam ? (fam.children || []).filter(c => c !== spineId && vis(c)) : [];
    for (const c of collats) {
      const s = layoutSubtree(c, g, model, opts);   // carries c's descendants below
      const start = dir < 0 ? (edge - gap - s.w) : (edge + gap);
      for (const cell of s.cells) cells.push({ id: cell.id, x: start + cell.x, gen: cell.gen });
      edge = dir < 0 ? start : start + s.w;
    }

    const wifeId = fam && vis(fam.wife) ? fam.wife : null;
    const husbandId = fam && vis(fam.husband) ? fam.husband : null;
    if (wifeId || husbandId) {
      const innerId = dir < 0 ? (husbandId || wifeId) : (wifeId || husbandId);
      const outerId = innerId === husbandId ? wifeId : husbandId;
      // Pass current edge down so inner block's collaterals don't overlap ours.
      const innerB = block(innerId, dir, edge);
      for (const c of innerB.cells) cells.push(c);
      let curLo = innerB.lo, curHi = innerB.hi;
      if (outerId) {
        const outerB = block(outerId, dir, edge);
        const shift = dir < 0 ? (curLo - gap - outerB.hi) : (curHi + gap - outerB.lo);
        for (const c of outerB.cells) cells.push({ id: c.id, x: c.x + shift, gen: c.gen });
        curLo = Math.min(curLo, outerB.lo + shift);
        curHi = Math.max(curHi, outerB.hi + shift);
      }
    }
    let lo = Infinity, hi = -Infinity;
    for (const c of cells) { lo = Math.min(lo, c.x - nodeW / 2); hi = Math.max(hi, c.x + nodeW / 2); }
    return { cells, lo, hi };
  }
  return block(spineId, dirOf(spineId));
}

export function layoutHourglass(tree, focalId, opts = {}) {
  const nodeW = opts.nodeW != null ? opts.nodeW : 210;
  const gap = opts.gap != null ? opts.gap : 30;
  const rowH = opts.rowH != null ? opts.rowH : 132;
  const isHidden = opts.isHidden || (() => false);
  const vis = (id) => !!id && !isHidden(id);
  const lopts = { nodeW, gap, coupleGap: gap, vis };

  const model = buildModel(tree, focalId);
  const out = new Map();
  const finish = () => { for (const [, v] of out) v.y = v.gen === 0 ? 0 : -v.gen * rowH; return out; };

  if (model.focalFamId == null) { out.set(focalId, { x: 0, y: 0, gen: 0 }); return finish(); }
  const focalFam = model.famById.get(model.focalFamId);
  const momId = vis(focalFam.wife) ? focalFam.wife : null;
  const dadId = vis(focalFam.husband) ? focalFam.husband : null;

  // Reserve width for the focal's own slot band (focal + siblings + their descendant subtrees).
  const focalSibs = (focalFam.children || []).filter(vis);
  let reserve = 0; for (const c of focalSibs) reserve += layoutSubtree(c, 0, model, lopts).w + gap;
  reserve = Math.max(nodeW, reserve - gap);
  const half = reserve / 2 + gap / 2;

  // Collect half-siblings (children of a focal parent's other families) keyed by direction.
  const halfSibsByDir = { '-1': [], '1': [] };
  const injectExtra = (cells, parentId, dir) => {
    for (const f of tree.families) {
      if (f.id === model.focalFamId || (f.husband !== parentId && f.wife !== parentId)) continue;
      const sp = f.husband === parentId ? f.wife : f.husband;
      if (!vis(sp)) continue;
      const INS = nodeW + gap;
      for (const c of cells) if (c.gen === 1 && c.id !== parentId && Math.sign(c.x) === dir) c.x += dir * INS;
      cells.push({ id: sp, x: dir * (nodeW + gap), gen: 1 });
      // Collect half-siblings to be placed at gen 0 on this side.
      for (const hs of (f.children || [])) { if (vis(hs) && hs !== focalId) halfSibsByDir[String(dir)].push(hs); }
    }
  };

  const both = momId && dadId;
  const momOff = both ? -half : 0, dadOff = both ? half : 0;
  if (momId) { const b = layoutAncestorSide(momId, model, lopts); injectExtra(b.cells, momId, -1); for (const c of b.cells) out.set(c.id, { x: c.x + momOff, gen: c.gen }); }
  if (dadId) { const b = layoutAncestorSide(dadId, model, lopts); injectExtra(b.cells, dadId, 1); for (const c of b.cells) out.set(c.id, { x: c.x + dadOff, gen: c.gen }); }

  // Place the focal slot band (focal + siblings + descendants) centred at x=0.
  // After placing, align the band so the focal's band slot lands on fx (parents' midpoint).
  const fxParentsMidpoint = both ? (out.get(momId).x + out.get(dadId).x) / 2 : 0;

  // Compute band placements into a temporary list.
  const bandCells = [];
  let cursor = 0;
  for (const c of focalSibs) {
    const s = layoutSubtree(c, 0, model, lopts);
    for (const cell of s.cells) bandCells.push({ id: cell.id, x: cursor + cell.x, gen: cell.gen });
    cursor += s.w + gap;
  }

  // Find focal's x in the band.
  const focalBandCell = bandCells.find(c => c.id === focalId);
  const focalBandX = focalBandCell ? focalBandCell.x : 0;

  // Shift entire band so focal's band slot aligns with parents' midpoint.
  const shift = fxParentsMidpoint - focalBandX;
  for (const cell of bandCells) out.set(cell.id, { x: cell.x + shift, gen: cell.gen });

  // Pin focal exactly between mom and dad.
  out.set(focalId, { x: fxParentsMidpoint, gen: 0 });

  // Place half-siblings at gen 0 outward of the focal band on their respective side.
  // Find the current rightmost/leftmost x of the focal band to anchor half-sibs outward.
  let bandRightEdge = fxParentsMidpoint + nodeW / 2;
  let bandLeftEdge = fxParentsMidpoint - nodeW / 2;
  for (const [, v] of out) {
    if (v.gen === 0) {
      bandRightEdge = Math.max(bandRightEdge, v.x + nodeW / 2);
      bandLeftEdge = Math.min(bandLeftEdge, v.x - nodeW / 2);
    }
  }
  for (const hs of halfSibsByDir['1']) {
    const s = layoutSubtree(hs, 0, model, lopts);
    const hsX = bandRightEdge + gap + s.w / 2;
    for (const cell of s.cells) out.set(cell.id, { x: bandRightEdge + gap + cell.x, gen: cell.gen });
    bandRightEdge += gap + s.w;
  }
  for (const hs of halfSibsByDir['-1']) {
    const s = layoutSubtree(hs, 0, model, lopts);
    for (const cell of s.cells) out.set(cell.id, { x: bandLeftEdge - gap - s.w + cell.x, gen: cell.gen });
    bandLeftEdge -= gap + s.w;
  }

  return finish();
}
