// Pure recursive-bifurcation layout for the ANCESTOR region (gen >= 1) + the focal (gen 0).
// The direct spine hugs the centre: the focal's mother is the rightmost node of the maternal
// (left) half and the father the leftmost of the paternal (right) half, with focal between them.
// Ancestors + collateral aunts/uncles fan OUTWARD from the spine; each couple keeps wife-left/
// husband-right; the wife's whole block stays left of the husband's, so lineages never cross.
// Returns Map<id,{x,gen}>. Descendants below the focal (gen <= 0) are positioned by the caller.
// Mom = rightmost of the maternal (left) half; Dad = leftmost of the paternal (right) half.
export function layoutAncestors(tree, focalId, opts = {}) {
  const nodeW = opts.nodeW != null ? opts.nodeW : 210;
  const gap = opts.gap != null ? opts.gap : 30;
  const coupleGap = opts.coupleGap != null ? opts.coupleGap : gap;
  const sideGap = opts.sideGap != null ? opts.sideGap : gap;
  const isHidden = opts.isHidden || (() => false);

  const byId = new Map(tree.individuals.map(i => [i.id, i]));
  const famById = new Map(tree.families.map(f => [f.id, f]));
  const childToFamily = new Map();
  const parentToFamily = new Map();
  for (const f of tree.families) {
    for (const c of (f.children || [])) if (!childToFamily.has(c)) childToFamily.set(c, f.id);
    for (const p of [f.husband, f.wife]) if (p && !parentToFamily.has(p)) parentToFamily.set(p, f.id);
  }
  const vis = (id) => !!id && !isHidden(id);
  const out = new Map();
  const focalFamId = childToFamily.get(focalId);
  if (focalFamId == null) { out.set(focalId, { x: 0, gen: 0 }); return out; }

  function spouseOf(childId) {
    const pf = parentToFamily.get(childId); if (pf == null) return null;
    const f = famById.get(pf);
    const other = f.husband === childId ? f.wife : (f.wife === childId ? f.husband : null);
    return vis(other) ? other : null;
  }
  function descWidth(childId) {
    const pf = parentToFamily.get(childId); if (pf == null) return nodeW;
    const kids = (famById.get(pf).children || []).filter(vis);
    if (!kids.length) return nodeW;
    let w = 0; for (const k of kids) w += slotWidth(k) + gap;
    return Math.max(nodeW, w - gap);
  }
  function slotMembers(childId) {
    const sp = spouseOf(childId); if (!sp) return [childId];
    const fem = (byId.get(childId) || {}).sex === 'F';
    return fem ? [childId, sp] : [sp, childId];
  }
  function slotWidth(childId) {
    const m = slotMembers(childId);
    return Math.max(m.length * nodeW + (m.length - 1) * coupleGap, descWidth(childId));
  }
  function buildSlot(childId, gen) {                  // left-anchored cells, x in [0,w]
    const m = slotMembers(childId);
    const intrinsic = m.length * nodeW + (m.length - 1) * coupleGap;
    const w = Math.max(intrinsic, descWidth(childId));
    const cells = []; let x = (w - intrinsic) / 2 + nodeW / 2;
    for (const id of m) { cells.push({ id, x, gen }); x += nodeW + coupleGap; }
    return { cells, w };
  }

  // Lay out spineId at x=0 plus ancestors + collateral siblings, all fanning in `dir`
  // (-1 = left/maternal, +1 = right/paternal). Returns {cells, lo, hi} (edges).
  function block(spineId, gen, dir) {
    const fam = childToFamily.has(spineId) ? famById.get(childToFamily.get(spineId)) : null;
    const cells = [{ id: spineId, x: 0, gen }];
    let edge = dir * (nodeW / 2);                     // signed outer edge of this gen's row

    // collateral siblings fan outward
    const collats = fam ? (fam.children || []).filter(c => c !== spineId && vis(c)) : [];
    for (const c of collats) {
      const s = buildSlot(c, gen);
      const start = dir < 0 ? (edge - gap - s.w) : (edge + gap);
      for (const cell of s.cells) cells.push({ id: cell.id, x: start + cell.x, gen: cell.gen });
      edge = dir < 0 ? start : start + s.w;
    }

    // parents: inner parent sits directly above the spine (x≈0); the other parent + each
    // parent's own ancestors fan further outward. Keep wife-left / husband-right absolutely.
    const wifeId = fam && vis(fam.wife) ? fam.wife : null;
    const husbandId = fam && vis(fam.husband) ? fam.husband : null;
    if (wifeId || husbandId) {
      // inner parent = the one closer to centre. maternal(dir<0): inner=husband (right of couple);
      // paternal(dir>0): inner=wife (left of couple).
      const innerId = dir < 0 ? (husbandId || wifeId) : (wifeId || husbandId);
      const outerId = innerId === husbandId ? wifeId : husbandId;
      const innerB = block(innerId, gen + 1, dir);    // inner parent at its local 0
      // place innerB with inner parent above spine (offset 0)
      for (const c of innerB.cells) cells.push(c);
      let curLo = innerB.lo, curHi = innerB.hi;
      if (outerId) {
        const outerB = block(outerId, gen + 1, dir);
        // place outer block beyond the inner block on the dir side
        let shift;
        if (dir < 0) { shift = curLo - gap - outerB.hi; }   // outer to the left
        else { shift = curHi + gap - outerB.lo; }            // outer to the right
        for (const c of outerB.cells) cells.push({ id: c.id, x: c.x + shift, gen: c.gen });
        curLo = Math.min(curLo, outerB.lo + shift);
        curHi = Math.max(curHi, outerB.hi + shift);
      }
    }

    let lo = Infinity, hi = -Infinity;
    for (const c of cells) { lo = Math.min(lo, c.x - nodeW / 2); hi = Math.max(hi, c.x + nodeW / 2); }
    return { cells, lo, hi };
  }

  const focalFam = famById.get(focalFamId);
  const momId = vis(focalFam.wife) ? focalFam.wife : null;
  const dadId = vis(focalFam.husband) ? focalFam.husband : null;
  let focalReserve = 0;
  for (const c of (focalFam.children || []).filter(vis)) focalReserve += slotWidth(c) + gap;
  focalReserve = Math.max(nodeW, focalReserve - gap);
  const half = focalReserve / 2 + gap / 2;

  // A focal parent may have a SECOND family (e.g. a half-sibling's other parent). Slot that
  // extra spouse in just outward of the parent (dir side), shifting the parent's gen-1 siblings
  // out to make room. The half-sibling (gen 0) is then placed by the caller under that union.
  const injectExtraSpouses = (cells, parentId, dir) => {
    for (const f of tree.families) {
      if (f.id === focalFamId || (f.husband !== parentId && f.wife !== parentId)) continue;
      const sp = f.husband === parentId ? f.wife : f.husband;
      if (!vis(sp)) continue;
      const INS = nodeW + gap;
      for (const c of cells) if (c.gen === 1 && c.id !== parentId && Math.sign(c.x) === dir) c.x += dir * INS;
      cells.push({ id: sp, x: dir * (nodeW + gap), gen: 1 });
    }
  };

  const both = momId && dadId;                        // with one parent only, centre it over the focal
  const momOff = both ? -half : 0, dadOff = both ? half : 0;
  const all = [];
  if (momId) { const mB = block(momId, 1, -1); injectExtraSpouses(mB.cells, momId, -1); for (const c of mB.cells) all.push({ id: c.id, x: c.x + momOff, gen: c.gen }); }
  if (dadId) { const pB = block(dadId, 1, 1); injectExtraSpouses(pB.cells, dadId, 1); for (const c of pB.cells) all.push({ id: c.id, x: c.x + dadOff, gen: c.gen }); }
  for (const c of all) out.set(c.id, { x: c.x, gen: c.gen });
  out.set(focalId, { x: 0, gen: 0 });
  return out;
}
