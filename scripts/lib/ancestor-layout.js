// Pure recursive-bifurcation layout for the ANCESTOR region of a family tree (gen >= 1) plus
// the focal person (gen 0). Each couple is a union; the wife's whole ancestral block is laid
// strictly left of the husband's, recursively, so lineage lines never cross. Every direct
// ancestor sits centred under its own parents; collateral siblings (aunts/uncles, great-aunts/
// uncles) fan OUTWARD with their married-in spouse, reserving room for their descendants.
// Returns Map<id,{x,gen}>. Descendants below the focal (gen <= 0) are positioned by the caller.
export function layoutAncestors(tree, focalId, opts = {}) {
  const nodeW = opts.nodeW != null ? opts.nodeW : 210;
  const gap = opts.gap != null ? opts.gap : 30;            // between band slots / sibling blocks
  const coupleGap = opts.coupleGap != null ? opts.coupleGap : gap; // spouses within a slot
  const sideGap = opts.sideGap != null ? opts.sideGap : gap;       // between maternal & paternal blocks
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

  // The married-in spouse of a band member (the other parent in the family where member is a parent).
  function spouseOf(childId) {
    const pf = parentToFamily.get(childId);
    if (pf == null) return null;
    const f = famById.get(pf);
    const other = f.husband === childId ? f.wife : (f.wife === childId ? f.husband : null);
    return vis(other) ? other : null;
  }
  // Horizontal room a member's visible descendants (gen below) need (cousins under collaterals).
  function descWidth(childId) {
    const pf = parentToFamily.get(childId);
    if (pf == null) return nodeW;
    const kids = (famById.get(pf).children || []).filter(vis);
    if (!kids.length) return nodeW;
    let w = 0;
    for (const k of kids) w += slotWidth(k) + gap;
    return Math.max(nodeW, w - gap);
  }
  function slotMembers(childId) {
    const sp = spouseOf(childId);
    if (!sp) return [childId];
    const childFem = (byId.get(childId) || {}).sex === 'F';
    return childFem ? [childId, sp] : [sp, childId]; // wife (female) left
  }
  function slotWidth(childId) {
    const m = slotMembers(childId);
    const intrinsic = m.length * nodeW + (m.length - 1) * coupleGap;
    return Math.max(intrinsic, descWidth(childId));
  }
  function buildSlot(childId, gen, isSpine) {
    // The spine child is a singleton: its co-parent is the OTHER ancestor block (handled
    // above), and the generation below it is placed by the caller. Only collateral siblings
    // carry their married-in spouse and reserve room for their own descendants (cousins).
    const m = isSpine ? [childId] : slotMembers(childId);
    const intrinsic = m.length * nodeW + (m.length - 1) * coupleGap;
    const w = isSpine ? nodeW : Math.max(intrinsic, descWidth(childId));
    const cells = [];
    let x = (w - intrinsic) / 2 + nodeW / 2;
    let connectX = null;
    for (const id of m) { cells.push({ id, x, gen }); if (id === childId) connectX = x; x += nodeW + coupleGap; }
    return { cells, w, connectX: connectX == null ? w / 2 : connectX };
  }

  // Lay out spineId at `gen`, its visible collateral siblings (+ spouses) at `gen`, and all
  // ancestors above. Coords are local (edges measured center +/- nodeW/2).
  // Returns { cells:[{id,x,gen}], lo, hi, connectX }  (connectX = spineId's x).
  function block(spineId, gen) {
    const fam = childToFamily.has(spineId) ? famById.get(childToFamily.get(spineId)) : null;
    const cells = [];

    // ----- ancestors above (wife's block left, husband's block right) -----
    let parentMid = null;
    const wifeId = fam && vis(fam.wife) ? fam.wife : null;
    const husbandId = fam && vis(fam.husband) ? fam.husband : null;
    if (wifeId || husbandId) {
      const wB = wifeId ? block(wifeId, gen + 1) : null;
      const hB = husbandId ? block(husbandId, gen + 1) : null;
      if (wB && hB) {
        const shift = (wB.hi + sideGap) - hB.lo;
        for (const c of hB.cells) c.x += shift;
        hB.connectX += shift;
        cells.push(...wB.cells, ...hB.cells);
        parentMid = (wB.connectX + hB.connectX) / 2;
      } else {
        const only = wB || hB;
        cells.push(...only.cells);
        parentMid = only.connectX;
      }
    }

    // ----- child band at `gen` -----
    // The spine person sits directly under its parents (clean vertical connector); its
    // collateral siblings fan OUTWARD, away from the centre, on the side set by the spine's
    // role in its own marriage (wife -> left, husband -> right). This keeps each lineage's
    // collaterals inside that lineage's half-plane, so nothing crosses the centre channel.
    const spineX = parentMid != null ? parentMid : 0;
    const band = [{ id: spineId, x: spineX, gen }];
    const collats = fam ? (fam.children || []).filter(c => c !== spineId && vis(c)) : [];
    const fanLeft = (byId.get(spineId) || {}).sex === 'F';
    const dir = fanLeft ? -1 : 1;
    let edge = spineX + dir * (nodeW / 2); // outer edge of placed band
    for (const c of collats) {
      const s = buildSlot(c, gen, false);
      let start; // left edge of this slot in absolute coords
      if (dir < 0) { start = edge - gap - s.w; edge = start; }
      else { start = edge + gap; edge = start + s.w; }
      for (const cell of s.cells) band.push({ id: cell.id, x: start + cell.x, gen: cell.gen });
    }
    const spineConnect = spineX;
    cells.push(...band);

    let lo = Infinity, hi = -Infinity;
    for (const c of cells) { lo = Math.min(lo, c.x - nodeW / 2); hi = Math.max(hi, c.x + nodeW / 2); }
    return { cells, lo, hi, connectX: spineConnect };
  }

  // ----- entry: focal couple -----
  const focalFam = famById.get(focalFamId);
  const momId = vis(focalFam.wife) ? focalFam.wife : null;      // maternal -> left
  const dadId = vis(focalFam.husband) ? focalFam.husband : null; // paternal -> right
  const mB = momId ? block(momId, 1) : null;
  const pB = dadId ? block(dadId, 1) : null;

  // room for the focal band (focal + siblings, gen 0) between the two parents
  let focalReserve = 0;
  for (const c of (focalFam.children || []).filter(vis)) focalReserve += slotWidth(c) + gap;
  focalReserve = Math.max(nodeW, focalReserve - gap);

  let focalX = 0;
  const all = [];
  if (mB && pB) {
    let shift = (mB.hi + sideGap) - pB.lo;
    const gapC = (pB.connectX + shift) - mB.connectX;
    if (gapC < focalReserve) shift += (focalReserve - gapC);
    for (const c of pB.cells) c.x += shift;
    pB.connectX += shift;
    all.push(...mB.cells, ...pB.cells);
    focalX = (mB.connectX + pB.connectX) / 2;
  } else if (mB || pB) {
    const only = mB || pB;
    all.push(...only.cells);
    focalX = only.connectX;
  }
  for (const c of all) out.set(c.id, { x: c.x, gen: c.gen });
  out.set(focalId, { x: focalX, gen: 0 });
  return out;
}
