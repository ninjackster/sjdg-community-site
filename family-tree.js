// family-tree.js — served statically, runs on /en/family and /es/familia
import { layoutHourglass } from '/hourglass-layout.js';
import { relationshipLabel } from '/kinship.js';
import { searchPeople } from '/family-search.js';
(function () {
  const login = document.getElementById('ft-login');
  const canvas = document.getElementById('ft-canvas');
  const pwInput = document.getElementById('ft-password');
  const enterBtn = document.getElementById('ft-enter');
  const errEl = document.getElementById('ft-error');
  if (!login || !canvas) return;
  const lang = (canvas.getAttribute('data-lang') || 'en').slice(0, 2); // 'es-MX' -> 'es'
  let FOCAL_ID = null;
  let TREE = null;

  async function tryLoad() {
    const res = await fetch('/api/family-tree', { credentials: 'same-origin' });
    if (res.status === 200) {
      const tree = await res.json();
      login.style.display = 'none';
      canvas.style.display = 'block';
      draw(tree);
      return true;
    }
    return false;
  }

  async function submit() {
    errEl.textContent = '';
    const res = await fetch('/api/family-auth', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwInput.value }),
    });
    if (res.ok) { await tryLoad(); }
    else { errEl.textContent = errEl.getAttribute('data-wrong'); }
  }

  enterBtn.addEventListener('click', submit);
  pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });

  function nameOf(ind) { return (ind.names.given + ' ' + ind.names.surnames.join(' ')).trim(); }


  // Generation depth from the root (0). Ancestors walk upward (positive),
  // descendants below (negative); a family's children sit one below a placed
  // parent (or a placed sibling's level), a married-in spouse takes their level.
  function buildGenerations(tree) {
    const childToParents = new Map();
    for (const fam of tree.families) {
      const parents = [fam.husband, fam.wife].filter(Boolean);
      for (const c of (fam.children || [])) childToParents.set(c, (childToParents.get(c) || []).concat(parents));
    }
    const gens = new Map();
    (function walk(id, d) {
      if (!gens.has(id) || d > gens.get(id)) gens.set(id, d);
      for (const p of (childToParents.get(id) || [])) walk(p, d + 1);
    })(tree.individuals[0].id, 0);
    let changed = true;
    while (changed) {
      changed = false;
      for (const fam of tree.families) {
        const kids = fam.children || [];
        const parents = [fam.husband, fam.wife].filter(Boolean);
        const placedParent = parents.find(p => gens.has(p));
        let cg = null;
        if (placedParent != null) {
          const pg = gens.get(placedParent);
          for (const p of parents) if (!gens.has(p)) { gens.set(p, pg); changed = true; }
          cg = pg - 1;
        } else { const pc = kids.find(c => gens.has(c)); if (pc != null) cg = gens.get(pc); }
        if (cg == null) continue;
        for (const c of kids) if (!gens.has(c)) { gens.set(c, cg); changed = true; }
      }
    }
    return gens;
  }

  function draw(tree) {
    const rootId = tree.individuals[0].id;
    FOCAL_ID = rootId;
    TREE = tree;
    const byId = new Map(tree.individuals.map(i => [i.id, i]));

    // ---- Relationship maps (computed once) ----
    const childParents = new Map(), kidsOf = new Map(), childToFamily = new Map(), coupleOf = new Map(), parentFamilyOf = new Map();
    for (const fam of tree.families) {
      const ps = [fam.husband, fam.wife].filter(Boolean);
      for (const c of (fam.children || [])) {
        childParents.set(c, (childParents.get(c) || []).concat(ps));
        if (!childToFamily.has(c)) childToFamily.set(c, fam.id);
        for (const p of ps) { if (!kidsOf.has(p)) kidsOf.set(p, []); kidsOf.get(p).push(c); }
      }
      for (const p of ps) if (!parentFamilyOf.has(p)) parentFamilyOf.set(p, fam.id);
      if (ps.length === 2) { if (!coupleOf.has(ps[0])) coupleOf.set(ps[0], ps[1]); if (!coupleOf.has(ps[1])) coupleOf.set(ps[1], ps[0]); }
    }
    const famById = new Map(tree.families.map(f => [f.id, f]));
    const direct = new Set();
    (function up(id) { if (direct.has(id)) return; direct.add(id); for (const p of (childParents.get(id) || [])) up(p); })(rootId);
    // Blood relatives = the focal, their ancestors, and every descendant of those ancestors
    // (siblings, aunts/uncles, cousins…). Anyone NOT in this set joined the tree by marriage.
    const blood = new Set(direct);
    let bch = true;
    while (bch) {
      bch = false;
      for (const fam of tree.families) {
        if (![fam.husband, fam.wife].filter(Boolean).some(p => blood.has(p))) continue;
        for (const c of (fam.children || [])) if (!blood.has(c)) { blood.add(c); bch = true; }
      }
    }
    const gens = buildGenerations(tree);

    // ---- Sides: paternal (left) / maternal (right). Flood a kin graph that
    // excludes your nuclear family so the two sides don't connect through you.
    const rootFam = tree.families.find(f => (f.children || []).includes(rootId));
    const father = rootFam ? rootFam.husband : null, mother = rootFam ? rootFam.wife : null;
    const adj = new Map();
    const link = (a, b) => { if (!a || !b) return; (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); };
    for (const fam of tree.families) {
      if (rootFam && fam.id === rootFam.id) continue;
      const ps = [fam.husband, fam.wife].filter(Boolean), ks = fam.children || [];
      if (ps.length === 2) link(ps[0], ps[1]);
      for (const k of ks) for (const p of ps) link(p, k);
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) link(ks[i], ks[j]);
    }
    const side = new Map([[rootId, 'C']]);
    const flood = (start, tag) => { if (!start) return; const st = [start]; while (st.length) { const n = st.pop(); if (side.has(n)) continue; side.set(n, tag); for (const m of (adj.get(n) || [])) if (m !== rootId && !side.has(m)) st.push(m); } };
    flood(father, 'P'); flood(mother, 'M');
    const sideOf = (id) => side.get(id) || 'M';
    const clusterKey = (id) => parentFamilyOf.get(id) || childToFamily.get(id) || 'x';
    const originKey = (id) => {
      if (childToFamily.has(id)) return childToFamily.get(id);
      const sp = coupleOf.get(id);
      if (sp && childToFamily.has(sp)) return childToFamily.get(sp) + '~';
      return 'zzz';
    };
    // Order one side: couples adjacent (wife left, husband right); direct line
    // hugs the center channel, collaterals fan outward.
    const bySide = (ids, s) => {
      const inSide = ids.filter(id => sideOf(id) === s).sort((a, b) => { const fa = originKey(a), fb = originKey(b); return fa < fb ? -1 : fa > fb ? 1 : 0; });
      const placed = new Set(), out = [];
      for (const id of inSide) {
        if (placed.has(id)) continue;
        const sp = coupleOf.get(id);
        if (sp && sideOf(sp) === s && inSide.indexOf(sp) !== -1 && !placed.has(sp)) {
          let a = id, b = sp; // wife (female) on the left
          if (byId.get(b).sex === 'F' && byId.get(a).sex !== 'F') { a = sp; b = id; }
          out.push(a, b); placed.add(a); placed.add(b);
        } else { out.push(id); placed.add(id); }
      }
      const nd = out.filter(id => !direct.has(id)), dr = out.filter(id => direct.has(id));
      return s === 'P' ? nd.concat(dr) : dr.concat(nd);
    };

    // ---- Collapse/expand. Default view = the direct line + your own aunts/uncles
    // (gen 1) + your siblings. Collapsed behind +N toggles: great-aunts/uncles
    // (gen >= 2 collaterals, revealed by expanding their direct sibling) and the
    // descendants of any collateral (cousins, revealed by expanding their parent).
    const isDir = (id) => direct.has(id);
    const nonDirParent = (id) => (childParents.get(id) || []).find(p => !isDir(p));
    const directSibling = (id) => {
      const fid = childToFamily.get(id);
      if (fid == null) return null;
      return (famById.get(fid).children || []).find(c => isDir(c)) || null;
    };
    // Your siblings and half-siblings (children of either of your parents) always show.
    const focalSibs = new Set();
    for (const p of [father, mother].filter(Boolean)) {
      for (const f of tree.families) if (f.husband === p || f.wife === p) {
        for (const c of (f.children || [])) if (c !== rootId) focalSibs.add(c);
      }
    }
    // The node whose expansion reveals `id` (null => shown by default).
    const anchorOf = (id) => {
      if (focalSibs.has(id)) return null;               // your (half-)siblings are always visible
      // A married-in spouse of a COLLATERAL (non-direct) blood relative is collapsed by default
      // and revealed by expanding that blood partner — keeps the default view clean. Spouses of
      // direct-line ancestors stay visible (the bifurcation needs both halves of each couple).
      if (!blood.has(id)) { const sp = coupleOf.get(id); if (sp != null && !isDir(sp)) return sp; }
      const p = nonDirParent(id);
      if (p != null) return p;                          // descendant of a collateral (cousin…)
      if (!isDir(id) && (gens.get(id) || 0) >= 2) {      // great-aunt/uncle & beyond
        const d = directSibling(id);
        if (d != null) return d;                        // gated by its direct (ancestor) sibling
        const sp = coupleOf.get(id);
        if (sp != null) return anchorOf(sp);            // married-in spouse: follow partner
      }
      return null;
    };
    const expanded = new Set();
    const gatedBy = new Map();                          // anchorId -> [ids it reveals]
    const anchors = new Set();
    for (const ind of tree.individuals) {
      const a = anchorOf(ind.id);
      if (a == null) continue;
      anchors.add(a);
      (gatedBy.get(a) || gatedBy.set(a, []).get(a)).push(ind.id);
    }
    // One-click subtree expand: opening an anchor cascades through its descendant +
    // married-in-spouse direction (children, their children, spouses), so a relative's
    // whole direct subtree appears in a single click. Sibling reveals stay single-level
    // (a direct ancestor's collateral siblings are NOT auto-cascaded — only opened nodes).
    const inSubtreeDir = (gatedId, anchor) =>
      (childParents.get(gatedId) || []).indexOf(anchor) !== -1   // gatedId is anchor's child
      || coupleOf.get(gatedId) === anchor;                       // gatedId is anchor's spouse
    const deepExpand = (anchor) => {
      const st = [anchor];
      while (st.length) {
        const a = st.pop();
        if (expanded.has(a)) continue;
        expanded.add(a);
        for (const g of (gatedBy.get(a) || [])) if (inSubtreeDir(g, a) && anchors.has(g)) st.push(g);
      }
    };
    const deepCollapse = (anchor) => {
      const st = [anchor];
      while (st.length) {
        const a = st.pop();
        if (!expanded.has(a)) continue;
        expanded.delete(a);
        for (const g of (gatedBy.get(a) || [])) if (inSubtreeDir(g, a) && anchors.has(g)) st.push(g);
      }
    };
    const computeHidden = () => {
      const hidden = new Set();
      const visMemo = new Map();
      const vis = (id) => {
        if (visMemo.has(id)) return visMemo.get(id);
        const a = anchorOf(id);
        const v = a == null ? true : (expanded.has(a) && vis(a));
        visMemo.set(id, v);
        return v;
      };
      for (const ind of tree.individuals) if (!vis(ind.id)) hidden.add(ind.id);
      return hidden;
    };

    const NODE_W = 210, ROW_H = 132, GAP = 30, FAM_GAP = 78, SIDE_GAP = 150, PAD = 70;
    const spacing = (a, b) => NODE_W + (sideOf(a) !== sideOf(b) ? SIDE_GAP : clusterKey(a) !== clusterKey(b) ? FAM_GAP : GAP);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;';
    canvas.innerHTML = '';
    canvas.appendChild(wrap);
    const cw = canvas.clientWidth || 1000, ch = canvas.clientHeight || 700;
    const vp = makeViewport(canvas, wrap);
    const meta = { rootCx: 0, rootCy: 0, w: 0, h: 0 };
    let firstRender = true, mode = 'tree';

    function render() {
      const hidden = computeHidden();
      // Single source of truth: the engine places every visible node (ancestors up,
      // collaterals/descendants down) with non-overlapping, non-crossing geometry.
      const placed = layoutHourglass(tree, rootId, { nodeW: NODE_W, gap: GAP, rowH: ROW_H, isHidden: (id) => hidden.has(id) });
      // Sync generations to the engine output so rows/order/arrows agree with x/y.
      for (const [id, p] of placed) gens.set(id, p.gen);
      const rows = {};
      for (const [id, g] of gens) if (!hidden.has(id) && placed.has(id)) (rows[g] = rows[g] || []).push(id);
      const visGens = Object.keys(rows).map(Number);
      const gMin = Math.min.apply(null, visGens), gMax = Math.max.apply(null, visGens);
      const order = {};
      // Row order is spatial left-to-right: maternal (left) · centre · paternal (right).
      for (const g of visGens) order[g] = [].concat(bySide(rows[g], 'M'), bySide(rows[g], 'C'), bySide(rows[g], 'P'));
      const xpos = new Map();
      for (const [id, p] of placed) if (!hidden.has(id)) xpos.set(id, p.x);

      let minX = Infinity, maxX = -Infinity;
      xpos.forEach(v => { if (v < minX) minX = v; if (v > maxX) maxX = v; });
      if (!isFinite(minX)) { minX = maxX = 0; }
      meta.w = (maxX - minX) + NODE_W + PAD * 2;
      meta.h = (gMax - gMin) * ROW_H + 110 + PAD * 2;
      wrap.style.width = meta.w + 'px';
      wrap.style.height = meta.h + 'px';
      wrap.innerHTML = '';

      const elById = new Map();
      for (const [id, g] of gens) {
        if (hidden.has(id) || !xpos.has(id)) continue;
        const el = nodeEl(byId.get(id)); elById.set(id, el);
        el.style.position = 'absolute';
        el.style.left = (xpos.get(id) - minX + PAD) + 'px';
        el.style.top = ((gMax - g) * ROW_H + PAD) + 'px';
        el.style.transform = 'translateX(-50%)';
        wrap.appendChild(el);
      }
      const rootEl = elById.get(rootId);
      if (rootEl) { rootEl.style.border = '2px solid var(--gold,#D4A843)'; rootEl.style.boxShadow = '0 0 0 4px rgba(212,168,67,.22)'; }

      // Directional expand/collapse toggle on each visible anchor that gates hidden relatives.
      // The arrow points where the hidden kin will appear: ▾ children (down), ▲ ancestors (up),
      // ◂/▸ siblings & spouses (outward — left on the maternal half, right on the paternal half).
      const PILL = 'min-width:22px;height:20px;padding:0 5px;border:1px solid var(--earth,#8B5E3C);background:#fffdf8;color:var(--earth,#8B5E3C);border-radius:11px;font-size:.7rem;font-weight:600;line-height:1;cursor:pointer;z-index:3;box-shadow:0 1px 2px rgba(28,19,9,.2);';
      for (const anchor of anchors) {
        if (!elById.has(anchor)) continue;
        const gated = gatedBy.get(anchor) || [];
        const isExp = expanded.has(anchor);
        const n = isExp ? gated.filter(id => !hidden.has(id)).length : gated.length;
        if (!n) continue;
        const ag = gens.get(anchor);
        const dir = gated.some(id => (gens.get(id) != null ? gens.get(id) : ag) > ag) ? 'up'
          : gated.some(id => (gens.get(id) != null ? gens.get(id) : ag) < ag) ? 'down'
          : (sideOf(anchor) === 'M' ? 'left' : 'right');
        const arrow = { up: '▲', down: '▾', left: '◂', right: '▸' }[dir];
        const pos = {
          up: 'left:50%;top:-12px;transform:translateX(-50%);',
          down: 'left:50%;bottom:-12px;transform:translateX(-50%);',
          left: 'left:-13px;top:50%;transform:translateY(-50%);',
          right: 'right:-13px;top:50%;transform:translateY(-50%);',
        }[dir];
        const t = document.createElement('button');
        t.type = 'button';
        t.textContent = isExp ? '−' : (arrow + n);
        t.title = isExp ? (lang === 'es' ? 'Ocultar' : 'Hide') : (lang === 'es' ? 'Mostrar ' + n : 'Show ' + n);
        t.setAttribute('aria-label', t.title);
        t.style.cssText = 'position:absolute;' + pos + PILL;
        t.addEventListener('pointerdown', e => e.stopPropagation());
        t.addEventListener('click', e => { e.stopPropagation(); if (expanded.has(anchor)) deepCollapse(anchor); else deepExpand(anchor); render(); });
        elById.get(anchor).appendChild(t);
      }

      drawConnectors(wrap, tree, elById);
      meta.elById = elById; meta.order = order; // for keyboard navigation

      const wr = wrap.getBoundingClientRect();
      const rr = (rootEl || wrap).getBoundingClientRect();
      meta.rootCx = (rr.left - wr.left) + rr.width / 2;
      meta.rootCy = (rr.top - wr.top) + rr.height / 2;
      if (firstRender) { firstRender = false; vp.set(cw / 2 - meta.rootCx, ch * 0.72 - meta.rootCy, 1); }
    }

    // Fan chart: ancestors-only radial view (focal at center, generations as rings).
    function renderFan() {
      wrap.innerHTML = '';
      const NS = 'http://www.w3.org/2000/svg';
      const segs = [];
      (function rec(id, depth, a0, a1) {
        if (!id || depth > 6) return;
        segs.push({ id: id, depth: depth, a0: a0, a1: a1 });
        const fam = famById.get(childToFamily.get(id));
        const mid = (a0 + a1) / 2;
        rec(fam ? fam.husband : null, depth + 1, a0, mid);
        rec(fam ? fam.wife : null, depth + 1, mid, a1);
      })(rootId, 0, -Math.PI, Math.PI);
      const R0 = 54, ringW = 66, maxD = segs.reduce((m, s) => Math.max(m, s.depth), 0);
      const R = R0 + maxD * ringW, cx = R + 40, cy = R + 40, size = (R + 40) * 2;
      wrap.style.width = size + 'px'; wrap.style.height = size + 'px';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', size); svg.setAttribute('height', size);
      svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;';
      const polar = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const arc = (rIn, rOut, a0, a1) => { const A = polar(rOut, a0), B = polar(rOut, a1), C = polar(rIn, a1), D = polar(rIn, a0), lg = (a1 - a0) > Math.PI ? 1 : 0; return 'M ' + A[0] + ' ' + A[1] + ' A ' + rOut + ' ' + rOut + ' 0 ' + lg + ' 1 ' + B[0] + ' ' + B[1] + ' L ' + C[0] + ' ' + C[1] + ' A ' + rIn + ' ' + rIn + ' 0 ' + lg + ' 0 ' + D[0] + ' ' + D[1] + ' Z'; };
      for (const s of segs) {
        const ind = byId.get(s.id); if (!ind) continue;
        const sd = sideOf(s.id);
        if (s.depth === 0) {
          const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', R0); c.setAttribute('fill', '#6b4f2e'); c.setAttribute('stroke', 'var(--gold,#D4A843)'); c.setAttribute('stroke-width', '3'); c.style.cursor = 'pointer'; c.addEventListener('click', () => openCard(ind)); svg.appendChild(c);
          const tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', cx); tx.setAttribute('y', cy); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('dominant-baseline', 'middle'); tx.setAttribute('fill', '#f4e9d8'); tx.setAttribute('font-size', '13'); tx.setAttribute('font-weight', '600'); tx.style.pointerEvents = 'none'; tx.textContent = ind.names.given; svg.appendChild(tx); continue;
        }
        const rIn = R0 + (s.depth - 1) * ringW, rOut = R0 + s.depth * ringW;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', arc(rIn, rOut, s.a0, s.a1));
        path.setAttribute('fill', sd === 'P' ? '#ecdfce' : '#e2d4bf');
        path.setAttribute('stroke', '#fffdf8'); path.setAttribute('stroke-width', '2');
        if (ind.placeholder) path.setAttribute('fill-opacity', '0.45');
        path.style.cursor = 'pointer';
        path.addEventListener('click', () => openCard(ind));
        const ttl = document.createElementNS(NS, 'title'); ttl.textContent = nameOf(ind); path.appendChild(ttl);
        svg.appendChild(path);
        const midA = (s.a0 + s.a1) / 2, rMid = (rIn + rOut) / 2, L = polar(rMid, midA);
        let deg = midA * 180 / Math.PI; if (deg > 90 || deg < -90) deg += 180;
        const tx = document.createElementNS(NS, 'text');
        tx.setAttribute('x', L[0]); tx.setAttribute('y', L[1]); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('dominant-baseline', 'middle');
        tx.setAttribute('transform', 'rotate(' + deg + ' ' + L[0] + ' ' + L[1] + ')');
        tx.setAttribute('fill', '#3a2a17'); tx.setAttribute('font-size', s.depth <= 2 ? '11' : '9'); tx.style.pointerEvents = 'none';
        const lim = s.depth <= 2 ? 13 : 8;
        tx.textContent = ind.placeholder ? '?' : (ind.names.given.length > lim ? ind.names.given.slice(0, lim - 1) + '…' : ind.names.given);
        svg.appendChild(tx);
      }
      wrap.appendChild(svg);
      const s = Math.max(0.2, Math.min(1.1, (cw - 60) / size, (ch - 60) / size));
      vp.set(cw / 2 - cx * s, ch / 2 - cy * s, s);
    }

    render();

    const focusRoot = (s) => vp.set(cw / 2 - meta.rootCx * s, ch * 0.72 - meta.rootCy * s, s);
    const fitAll = () => { const s = Math.max(0.2, Math.min(1, (cw - 60) / meta.w, (ch - 60) / meta.h)); vp.set(cw / 2 - (meta.w / 2) * s, ch / 2 - (meta.h / 2) * s, s); };

    const controls = document.createElement('div');
    controls.style.cssText = 'position:absolute;right:16px;bottom:16px;display:flex;flex-direction:column;gap:6px;z-index:5;';
    const mkBtn = (label, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
      b.style.cssText = 'width:40px;height:40px;border:1px solid var(--mist,#EDE8DF);background:#fffdf8;border-radius:9px;font-size:1.15rem;line-height:1;cursor:pointer;color:var(--earth,#8B5E3C);box-shadow:0 1px 5px rgba(28,19,9,.14);display:flex;align-items:center;justify-content:center;';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      return b;
    };
    controls.appendChild(mkBtn('+', lang === 'es' ? 'Acercar' : 'Zoom in', () => vp.zoomBy(1.2)));
    controls.appendChild(mkBtn('−', lang === 'es' ? 'Alejar' : 'Zoom out', () => vp.zoomBy(1 / 1.2)));
    controls.appendChild(mkBtn('⌖', lang === 'es' ? 'Centrarme' : 'Center on me', () => focusRoot(1)));
    controls.appendChild(mkBtn('⛶', lang === 'es' ? 'Ver todo' : 'Fit all', fitAll));
    controls.appendChild(mkBtn('⊕', lang === 'es' ? 'Expandir todo' : 'Expand all', () => { anchors.forEach(a => expanded.add(a)); render(); }));
    controls.appendChild(mkBtn('⊖', lang === 'es' ? 'Colapsar todo' : 'Collapse all', () => { expanded.clear(); render(); }));
    controls.appendChild(mkBtn('❋', lang === 'es' ? 'Abanico / árbol' : 'Fan / tree view', () => { mode = mode === 'tree' ? 'fan' : 'tree'; if (mode === 'fan') renderFan(); else { firstRender = true; render(); } }));
    canvas.appendChild(controls);

    // Keyboard navigation between relatives: arrows move up (parent) / down
    // (child) / sideways (same generation); Enter opens the detail card.
    canvas.setAttribute('tabindex', '0');
    let navId = rootId;
    const focusNode = (id) => {
      const el = meta.elById && meta.elById.get(id); if (!el) return;
      navId = id; el.focus({ preventScroll: true });
      const cx = parseFloat(el.style.left) || 0, cy = (parseFloat(el.style.top) || 0) + 31, s = vp.cur().scale;
      vp.set(cw / 2 - cx * s, ch / 2 - cy * s, s);
    };
    canvas.addEventListener('keydown', (e) => {
      if (document.getElementById('ft-modal')) return;
      if (e.key === 'Enter') { if (byId.get(navId)) { openCard(byId.get(navId)); e.preventDefault(); } return; }
      if (!/^Arrow/.test(e.key)) return;
      e.preventDefault();
      const vis = (id) => meta.elById && meta.elById.has(id);
      let t = null;
      if (e.key === 'ArrowUp') t = (childParents.get(navId) || []).filter(vis)[0];
      else if (e.key === 'ArrowDown') t = (kidsOf.get(navId) || []).filter(vis)[0];
      else { const row = (meta.order[gens.get(navId)] || []).filter(vis); const i = row.indexOf(navId); if (i >= 0) t = row[i + (e.key === 'ArrowLeft' ? -1 : 1)]; }
      if (t) focusNode(t);
    });

    // Search / jump-to-person: reveal a (possibly collapsed) relative and pan to them.
    // The layout is egocentric (rooted on the focal), so we don't re-root — we expand the
    // anchor chain that gates the person, re-render, then centre + briefly highlight them.
    const revealAndFocus = (id) => {
      if (mode !== 'tree') { mode = 'tree'; firstRender = false; }
      let cur = id, guard = 0;
      while (guard++ < 60) { const a = anchorOf(cur); if (a == null) break; expanded.add(a); cur = a; }
      render();
      const el = meta.elById && meta.elById.get(id);
      if (!el) return;
      focusNode(id);
      const prev = el.style.boxShadow;
      el.style.transition = 'box-shadow .2s'; el.style.boxShadow = '0 0 0 4px var(--gold,#D4A843)';
      setTimeout(() => { el.style.boxShadow = prev; }, 1600);
    };
    const search = document.createElement('div');
    search.style.cssText = 'position:absolute;left:16px;top:16px;z-index:6;width:min(260px,60vw);';
    search.innerHTML =
      '<input id="ft-search" type="search" autocomplete="off" placeholder="' + (lang === 'es' ? 'Buscar familiar…' : 'Search relative…') + '" aria-label="' + (lang === 'es' ? 'Buscar familiar' : 'Search relative') + '" style="width:100%;padding:.5rem .7rem;border:1px solid var(--mist,#EDE8DF);border-radius:8px;font:inherit;font-size:.85rem;background:#fffdf8;box-shadow:0 1px 3px rgba(28,19,9,.12);box-sizing:border-box;" />' +
      '<div id="ft-search-res" role="listbox" style="margin-top:4px;background:#fffdf8;border-radius:8px;box-shadow:0 4px 14px rgba(28,19,9,.18);overflow:hidden;display:none;max-height:50vh;overflow-y:auto;"></div>';
    canvas.appendChild(search);
    const sInput = search.querySelector('#ft-search');
    const sRes = search.querySelector('#ft-search-res');
    const hideRes = () => { sRes.style.display = 'none'; sRes.innerHTML = ''; };
    const showRes = (matches) => {
      if (!matches.length) return hideRes();
      sRes.innerHTML = matches.map(m => '<button type="button" role="option" data-id="' + m.id + '" style="display:block;width:100%;text-align:left;padding:.45rem .7rem;border:none;border-bottom:1px solid var(--mist,#EDE8DF);background:none;cursor:pointer;font:inherit;font-size:.85rem;color:var(--ink,#1c1309);">' + nameOf(byId.get(m.id)) + '</button>').join('');
      sRes.style.display = 'block';
    };
    sInput.addEventListener('input', () => showRes(searchPeople(tree, sInput.value)));
    sRes.addEventListener('mousedown', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; e.preventDefault(); revealAndFocus(b.getAttribute('data-id')); hideRes(); sInput.value = ''; });
    sInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideRes(); sInput.value = ''; sInput.blur(); } });
    canvas.addEventListener('pointerdown', (e) => { if (!search.contains(e.target)) hideRes(); });

    const legend = document.createElement('div');
    legend.innerHTML = (lang === 'es' ? '∗ adoptado · ◂▾▸ expandir · ? por confirmar' : '∗ adopted · ◂▾▸ expand · ? unconfirmed');
    legend.style.cssText = 'position:absolute;left:16px;bottom:16px;font-size:.74rem;color:rgba(28,19,9,.55);background:rgba(255,253,248,.85);padding:4px 9px;border-radius:6px;z-index:5;';
    canvas.appendChild(legend);
  }

  function drawConnectors(wrap, tree, elById) {
    const NS = 'http://www.w3.org/2000/svg';
    // Use unscaled layout offsets (offsetLeft/Top/Width/Height), NOT getBoundingClientRect:
    // the latter returns screen coords scaled by the current zoom, which would shrink the
    // connectors toward the origin on any re-render at zoom != 1. Nodes use translateX(-50%),
    // so the visual centre x equals offsetLeft.
    const pos = (el) => { const w = el.offsetWidth, h = el.offsetHeight, cx = el.offsetLeft, top = el.offsetTop; return { cx, cy: top + h / 2, left: cx - w / 2, right: cx + w / 2, top, bottom: top + h }; };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', wrap.scrollWidth); svg.setAttribute('height', wrap.scrollHeight);
    svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;pointer-events:none;z-index:0;';
    const line = (d, dashed) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('stroke', '#8B5E3C'); p.setAttribute('stroke-width', '1.5'); p.setAttribute('fill', 'none'); p.setAttribute('stroke-opacity', dashed ? '0.55' : '0.45'); if (dashed) p.setAttribute('stroke-dasharray', '3 4'); svg.appendChild(p); };
    for (const fam of tree.families) {
      const parentEls = [fam.husband, fam.wife].filter(Boolean).map(id => elById.get(id)).filter(Boolean);
      const kidEls = (fam.children || []).map(id => elById.get(id)).filter(Boolean);
      if (parentEls.length === 2) {
        const A = pos(parentEls[0]), B = pos(parentEls[1]);
        const L = A.cx <= B.cx ? A : B, R = A.cx <= B.cx ? B : A, y = (A.cy + B.cy) / 2;
        line('M ' + L.right + ' ' + y + ' H ' + R.left, true);
      }
      if (parentEls.length && kidEls.length) {
        const pp = parentEls.map(pos);
        const px = pp.reduce((s, p) => s + p.cx, 0) / pp.length;
        const py = Math.max.apply(null, pp.map(p => p.bottom));
        const kk = kidEls.map(pos);
        const kidTop = Math.min.apply(null, kk.map(k => k.top));
        const midY = py + Math.max(12, (kidTop - py) / 2);
        let d = 'M ' + px + ' ' + py + ' V ' + midY;
        for (const k of kk) d += ' M ' + px + ' ' + midY + ' H ' + k.cx + ' V ' + k.top;
        line(d, false);
      }
    }
    wrap.insertBefore(svg, wrap.firstChild);
  }

  function nodeEl(ind) {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.id = ind.id;
    el.style.cssText = 'position:relative;z-index:1;box-sizing:border-box;width:210px;flex:none;display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--mist,#EDE8DF);border-radius:10px;padding:10px 14px;cursor:pointer;font:inherit;text-align:left;box-shadow:0 1px 3px rgba(28,19,9,.07);';
    if (ind.placeholder) { el.style.borderStyle = 'dashed'; el.style.opacity = '0.72'; el.style.background = '#faf6ef'; }
    const initials = ind.placeholder ? '?' : (ind.names.given[0] || '') + (ind.names.surnames[0]?.[0] || '');
    const star = ind.adopted ? ' <span title="' + (lang === 'es' ? 'adoptado' : 'adopted') + '" style="color:var(--clay,#C4785A);font-weight:700;">∗</span>' : '';
    const avatar = ind.photo
      ? '<img src="' + ind.photo + '" alt="" aria-hidden="true" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex:none;background:var(--mist,#EDE8DF);" />'
      : '<span aria-hidden="true" style="width:40px;height:40px;border-radius:50%;background:var(--earth,#8B5E3C);color:var(--cream,#F5EFE6);display:flex;align-items:center;justify-content:center;font-weight:600;flex:none;">' + initials + '</span>';
    el.innerHTML = avatar +
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;"><strong style="font-size:.88rem;font-weight:500;">' + nameOf(ind) + star + '</strong></span>';
    el.setAttribute('aria-label', nameOf(ind) + (ind.id === FOCAL_ID ? (lang === 'es' ? ' (tú)' : ' (you)') : '') + (ind.adopted ? (lang === 'es' ? ', adoptado' : ', adopted') : '') + (ind.placeholder ? (lang === 'es' ? ', por confirmar' : ', unconfirmed') : ''));
    el.addEventListener('click', () => openCard(ind));
    return el;
  }

  function closeCard() { const o = document.getElementById('ft-modal'); if (o) o.remove(); }

  function openCard(ind) {
    closeCard();
    const o = document.createElement('div');
    o.id = 'ft-modal';
    o.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(28,19,9,.45);z-index:60;padding:1rem;';
    o.addEventListener('click', (e) => { if (e.target === o) closeCard(); });
    const oo = ind.surnameOrigin;
    const rel = (TREE && ind.id) ? relationshipLabel(TREE, FOCAL_ID, ind.id, lang) : '';
    const recs = (ind.recordLinks || []).map(r => '<li><a href="' + r.url + '" target="_blank" rel="noopener">' + r.label + '</a></li>').join('');
    o.innerHTML =
      '<div role="dialog" aria-modal="true" aria-label="' + nameOf(ind) + '" style="position:relative;background:#fffdf8;width:min(440px,92vw);max-height:80vh;overflow:auto;border-radius:14px;box-shadow:0 14px 44px rgba(28,19,9,.30);padding:26px 24px 22px;">' +
        '<button id="ft-close" aria-label="Close" style="position:absolute;top:10px;right:12px;border:none;background:none;font-size:1.6rem;line-height:1;cursor:pointer;color:rgba(28,19,9,.5);">×</button>' +
        '<h2 style="font-family:\'Playfair Display\',serif;font-weight:400;font-size:1.4rem;margin:0 1.6rem .25rem 0;">' + nameOf(ind) + '</h2>' +
        (rel ? '<p style="margin:0 0 .6rem;color:var(--clay,#C4785A);font-size:.84rem;font-weight:500;">' + rel + '</p>' : '') +
        (ind.adopted ? '<p style="display:inline-block;font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;background:rgba(196,120,90,.15);color:var(--clay,#C4785A);padding:2px 9px;border-radius:99px;margin:0 0 .6rem;">' + (lang === 'es' ? 'Adoptado' : 'Adopted') + '</p>' : '') +
        '<p style="margin:.2rem 0;"><strong>' + (lang === 'es' ? 'Nació' : 'Born') + ':</strong> ' + ((ind.birth && (ind.birth.date || ind.birth.place)) || '—') + '</p>' +
        ((ind.death && ind.death.date) ? '<p style="margin:.2rem 0;"><strong>' + (lang === 'es' ? 'Falleció' : 'Died') + ':</strong> ' + ind.death.date + '</p>' : '') +
        (oo ? '<p style="background:#f7eecf;border-left:3px solid #c4785a;padding:8px 10px;border-radius:0 6px 6px 0;margin:.8rem 0;"><strong>' + (lang === 'es' ? 'Origen del apellido' : 'Surname origin') + ':</strong> ' + oo.text + ' <em>(' + oo.confidence + ')</em></p>' : '') +
        (recs ? '<h3 style="font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6;margin:.9rem 0 .3rem;">' + (lang === 'es' ? 'Registros' : 'Records') + '</h3><ul style="margin:0;padding-left:1.1rem;">' + recs + '</ul>' : '') +
        ((ind.notes && ind.notes[lang]) ? '<p style="margin:.8rem 0 0;color:rgba(28,19,9,.8);">' + ind.notes[lang] + '</p>' : '') +
        '<button id="ft-suggest" style="margin-top:1rem;width:100%;padding:.6rem;border:1px dashed var(--clay,#C4785A);background:#fff;color:var(--clay,#C4785A);border-radius:8px;cursor:pointer;font:inherit;font-size:.85rem;">' + (lang === 'es' ? '＋ Sugerir un familiar' : '＋ Suggest a relative') + '</button>' +
        '<button id="ft-edit" style="margin-top:.5rem;width:100%;padding:.6rem;border:1px dashed var(--earth,#8B5E3C);background:#fff;color:var(--earth,#8B5E3C);border-radius:8px;cursor:pointer;font:inherit;font-size:.85rem;">' + (lang === 'es' ? '✎ Sugerir una corrección' : '✎ Suggest a correction') + '</button>' +
      '</div>';
    document.body.appendChild(o);
    o.querySelector('#ft-close').addEventListener('click', closeCard);
    o.querySelector('#ft-suggest').addEventListener('click', () => openSuggest(ind));
    o.querySelector('#ft-edit').addEventListener('click', () => openEdit(ind));
  }

  function openEdit(ind) {
    closeCard();
    const es = lang === 'es';
    const o = document.createElement('div');
    o.id = 'ft-modal';
    o.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(28,19,9,.45);z-index:60;padding:1rem;';
    o.addEventListener('click', (e) => { if (e.target === o) closeCard(); });
    const inp = 'width:100%;padding:.5rem;margin:.25rem 0 .6rem;border:1px solid var(--mist,#EDE8DF);border-radius:6px;font:inherit;box-sizing:border-box;';
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const given = ind.names.given || '';
    const sur = (ind.names.surnames || []).join(' ');
    const birth = (ind.birth && ind.birth.date) || '';
    const death = (ind.death && ind.death.date) || '';
    const note = (ind.notes && ind.notes[lang]) || '';
    o.innerHTML =
      '<div role="dialog" aria-modal="true" style="position:relative;background:#fffdf8;width:min(420px,93vw);max-height:88vh;overflow:auto;border-radius:14px;box-shadow:0 14px 44px rgba(28,19,9,.30);padding:24px;">' +
        '<button id="ft-close" aria-label="Close" style="position:absolute;top:10px;right:12px;border:none;background:none;font-size:1.6rem;cursor:pointer;color:rgba(28,19,9,.5);">×</button>' +
        '<h2 style="font-family:\'Playfair Display\',serif;font-weight:400;font-size:1.25rem;margin:0 1.6rem .2rem 0;">' + (es ? 'Sugerir una corrección' : 'Suggest a correction') + '</h2>' +
        '<p style="font-size:.85rem;color:rgba(28,19,9,.6);margin:0 0 1rem;">' + nameOf(ind) + '</p>' +
        '<label style="font-size:.8rem;">' + (es ? 'Nombre(s)' : 'First name(s)') + '</label><input id="ed-given" value="' + esc(given) + '" style="' + inp + '" />' +
        '<label style="font-size:.8rem;">' + (es ? 'Apellidos' : 'Surnames') + '</label><input id="ed-sur" value="' + esc(sur) + '" placeholder="' + (es ? 'separados por espacio' : 'space-separated') + '" style="' + inp + '" />' +
        '<div style="display:flex;gap:.6rem;"><div style="flex:1;"><label style="font-size:.8rem;">' + (es ? 'Nació' : 'Born') + '</label><input id="ed-birth" value="' + esc(birth) + '" style="' + inp + '" /></div><div style="flex:1;"><label style="font-size:.8rem;">' + (es ? 'Falleció' : 'Died') + '</label><input id="ed-death" value="' + esc(death) + '" style="' + inp + '" /></div></div>' +
        '<label style="font-size:.8rem;">' + (es ? 'Nota' : 'Note') + '</label><textarea id="ed-note" rows="2" style="' + inp + 'resize:vertical;">' + esc(note) + '</textarea>' +
        '<div id="ed-msg" style="font-size:.8rem;min-height:1.1em;margin:.2rem 0;"></div>' +
        '<button id="ed-send" style="width:100%;padding:.6rem;border:none;border-radius:8px;background:var(--earth,#8B5E3C);color:#fff;cursor:pointer;font:inherit;">' + (es ? 'Enviar para revisión' : 'Submit for review') + '</button>' +
      '</div>';
    document.body.appendChild(o);
    o.querySelector('#ft-close').addEventListener('click', closeCard);
    const msg = o.querySelector('#ed-msg');
    o.querySelector('#ed-send').addEventListener('click', async () => {
      const g = o.querySelector('#ed-given').value.trim();
      if (!g) { msg.style.color = '#b00'; msg.textContent = es ? 'Falta el nombre.' : 'Name required.'; return; }
      msg.style.color = 'rgba(28,19,9,.6)'; msg.textContent = es ? 'Enviando…' : 'Sending…';
      try {
        const res = await fetch('/api/family-suggest', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'edit', targetId: ind.id, given: g, surnames: o.querySelector('#ed-sur').value, birth: o.querySelector('#ed-birth').value, death: o.querySelector('#ed-death').value, note: o.querySelector('#ed-note').value }),
        });
        if (res.ok) { msg.style.color = 'var(--sage,#7A8C6A)'; msg.textContent = es ? '¡Gracias! Enviado para revisión.' : 'Thanks! Sent for review.'; o.querySelector('#ed-send').disabled = true; }
        else { msg.style.color = '#b00'; msg.textContent = es ? 'Error al enviar.' : 'Submit failed.'; }
      } catch (_) { msg.style.color = '#b00'; msg.textContent = es ? 'Error de red.' : 'Network error.'; }
    });
  }

  function resizePhoto(file) {
    return new Promise((resolve) => {
      if (!file) { resolve(null); return; }
      const r = new FileReader();
      r.onload = () => { const img = new Image(); img.onload = () => { const S = 160, c = document.createElement('canvas'); c.width = S; c.height = S; const ctx = c.getContext('2d'); const m = Math.min(img.width, img.height); ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S); resolve(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = () => resolve(null); img.src = r.result; };
      r.onerror = () => resolve(null); r.readAsDataURL(file);
    });
  }

  function openSuggest(ind) {
    closeCard();
    const es = lang === 'es';
    const o = document.createElement('div');
    o.id = 'ft-modal';
    o.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(28,19,9,.45);z-index:60;padding:1rem;';
    o.addEventListener('click', (e) => { if (e.target === o) closeCard(); });
    const rels = es ? [['child', 'Hijo/a'], ['parent', 'Padre/Madre'], ['spouse', 'Cónyuge'], ['sibling', 'Hermano/a']] : [['child', 'Child'], ['parent', 'Parent'], ['spouse', 'Spouse'], ['sibling', 'Sibling']];
    const inp = 'width:100%;padding:.5rem;margin:.25rem 0 .6rem;border:1px solid var(--mist,#EDE8DF);border-radius:6px;font:inherit;box-sizing:border-box;';
    o.innerHTML =
      '<div role="dialog" aria-modal="true" style="position:relative;background:#fffdf8;width:min(420px,93vw);max-height:88vh;overflow:auto;border-radius:14px;box-shadow:0 14px 44px rgba(28,19,9,.30);padding:24px;">' +
        '<button id="ft-close" aria-label="Close" style="position:absolute;top:10px;right:12px;border:none;background:none;font-size:1.6rem;cursor:pointer;color:rgba(28,19,9,.5);">×</button>' +
        '<h2 style="font-family:\'Playfair Display\',serif;font-weight:400;font-size:1.25rem;margin:0 1.6rem .2rem 0;">' + (es ? 'Sugerir un familiar' : 'Suggest a relative') + '</h2>' +
        '<p style="font-size:.85rem;color:rgba(28,19,9,.6);margin:0 0 1rem;">' + (es ? 'de ' : 'of ') + nameOf(ind) + '</p>' +
        '<label style="font-size:.8rem;">' + (es ? 'Relación' : 'Relationship') + '</label>' +
        '<select id="sg-rel" style="' + inp + '">' + rels.map(r => '<option value="' + r[0] + '">' + r[1] + '</option>').join('') + '</select>' +
        '<label style="font-size:.8rem;">' + (es ? 'Nombre(s)' : 'First name(s)') + '</label><input id="sg-given" style="' + inp + '" />' +
        '<label style="font-size:.8rem;">' + (es ? 'Apellidos' : 'Surnames') + '</label><input id="sg-sur" placeholder="' + (es ? 'separados por espacio' : 'space-separated') + '" style="' + inp + '" />' +
        '<div style="display:flex;gap:.6rem;"><div style="flex:1;"><label style="font-size:.8rem;">' + (es ? 'Nació' : 'Born') + '</label><input id="sg-birth" style="' + inp + '" /></div><div style="flex:1;"><label style="font-size:.8rem;">' + (es ? 'Falleció' : 'Died') + '</label><input id="sg-death" style="' + inp + '" /></div></div>' +
        '<label style="font-size:.8rem;">' + (es ? 'Nota' : 'Note') + '</label><textarea id="sg-note" rows="2" style="' + inp + 'resize:vertical;"></textarea>' +
        '<label style="font-size:.8rem;">' + (es ? 'Foto (opcional)' : 'Photo (optional)') + '</label><input id="sg-photo" type="file" accept="image/*" style="' + inp + '" />' +
        '<div id="sg-msg" style="font-size:.8rem;min-height:1.1em;margin:.2rem 0;"></div>' +
        '<button id="sg-send" style="width:100%;padding:.6rem;border:none;border-radius:8px;background:var(--clay,#C4785A);color:#fff;cursor:pointer;font:inherit;">' + (es ? 'Enviar para revisión' : 'Submit for review') + '</button>' +
      '</div>';
    document.body.appendChild(o);
    o.querySelector('#ft-close').addEventListener('click', closeCard);
    const msg = o.querySelector('#sg-msg');
    o.querySelector('#sg-send').addEventListener('click', async () => {
      const given = o.querySelector('#sg-given').value.trim();
      if (!given) { msg.style.color = '#b00'; msg.textContent = es ? 'Falta el nombre.' : 'Name required.'; return; }
      msg.style.color = 'rgba(28,19,9,.6)'; msg.textContent = es ? 'Enviando…' : 'Sending…';
      const photo = await resizePhoto(o.querySelector('#sg-photo').files[0]);
      try {
        const res = await fetch('/api/family-suggest', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ relativeOf: ind.id, relationship: o.querySelector('#sg-rel').value, given: given, surnames: o.querySelector('#sg-sur').value, birth: o.querySelector('#sg-birth').value, death: o.querySelector('#sg-death').value, note: o.querySelector('#sg-note').value, photo: photo }),
        });
        if (res.ok) { msg.style.color = 'var(--sage,#7A8C6A)'; msg.textContent = es ? '¡Gracias! Enviado para revisión.' : 'Thanks! Sent for review.'; o.querySelector('#sg-send').disabled = true; }
        else { msg.style.color = '#b00'; msg.textContent = es ? 'Error al enviar.' : 'Submit failed.'; }
      } catch (_) { msg.style.color = '#b00'; msg.textContent = es ? 'Error de red.' : 'Network error.'; }
    });
  }

  function makeViewport(container, wrap) {
    let scale = 1, x = 0, y = 0, dragging = false, sx = 0, sy = 0;
    const clamp = (s) => Math.min(2.6, Math.max(0.2, s));
    const apply = () => { wrap.style.transformOrigin = '0 0'; wrap.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'; };
    const zoomAround = (ns, ax, ay) => { ns = clamp(ns); const k = ns / scale; x = ax - (ax - x) * k; y = ay - (ay - y) * k; scale = ns; apply(); };
    container.addEventListener('wheel', (e) => { e.preventDefault(); const r = container.getBoundingClientRect(); zoomAround(scale - e.deltaY * 0.0016 * scale, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    container.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX - x; sy = e.clientY - y; });
    window.addEventListener('pointermove', (e) => { if (!dragging) return; x = e.clientX - sx; y = e.clientY - sy; apply(); });
    window.addEventListener('pointerup', () => { dragging = false; });
    return { set(nx, ny, ns) { x = nx; y = ny; scale = clamp(ns); apply(); }, zoomBy(f) { const r = container.getBoundingClientRect(); zoomAround(scale * f, r.width / 2, r.height / 2); }, cur() { return { x: x, y: y, scale: scale }; } };
  }

  tryLoad();
})();
