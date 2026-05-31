// family-tree.js — served statically, runs on /en/family and /es/familia
(function () {
  const login = document.getElementById('ft-login');
  const canvas = document.getElementById('ft-canvas');
  const pwInput = document.getElementById('ft-password');
  const enterBtn = document.getElementById('ft-enter');
  const errEl = document.getElementById('ft-error');
  if (!login || !canvas) return;
  const lang = canvas.getAttribute('data-lang') || 'en';
  let FOCAL_ID = null;

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
    const direct = new Set();
    (function up(id) { if (direct.has(id)) return; direct.add(id); for (const p of (childParents.get(id) || [])) up(p); })(rootId);
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

    // ---- Collapse/expand: collateral branches (families with no direct-line
    // parent) start collapsed so the dense cousin rows don't blow up the width.
    const collapsible = new Set(tree.families.filter(f => (f.children || []).length && ![f.husband, f.wife].filter(Boolean).some(p => direct.has(p))).map(f => f.id));
    const collapsed = new Set(collapsible);
    const computeHidden = () => {
      const hidden = new Set();
      let changed = true;
      while (changed) {
        changed = false;
        for (const fam of tree.families) {
          const parentHidden = [fam.husband, fam.wife].filter(Boolean).some(p => hidden.has(p));
          if (collapsed.has(fam.id) || parentHidden) for (const c of (fam.children || [])) if (!hidden.has(c)) { hidden.add(c); changed = true; }
        }
      }
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
    let firstRender = true;

    function render() {
      const hidden = computeHidden();
      const rows = {};
      for (const [id, g] of gens) if (!hidden.has(id)) (rows[g] = rows[g] || []).push(id);
      const visGens = Object.keys(rows).map(Number);
      const gMin = Math.min.apply(null, visGens), gMax = Math.max.apply(null, visGens);
      const order = {};
      for (const g of visGens) order[g] = [].concat(bySide(rows[g], 'P'), bySide(rows[g], 'C'), bySide(rows[g], 'M'));

      // x-assignment: youngest generation first; center over placed children;
      // de-overlap left-to-right; keep adjacent same-side couples as a unit.
      const xpos = new Map();
      for (let g = gMin; g <= gMax; g++) {
        const ids = order[g]; if (!ids) continue;
        const avgKids = (id) => { const k = (kidsOf.get(id) || []).filter(c => xpos.has(c)); return k.length ? k.reduce((s, c) => s + xpos.get(c), 0) / k.length : null; };
        let prev = null, prevX = 0, i = 0;
        while (i < ids.length) {
          const id = ids[i], sp = coupleOf.get(id);
          if (sp && ids[i + 1] === sp && sideOf(id) === sideOf(sp)) {
            const kx = [].concat(kidsOf.get(id) || [], kidsOf.get(sp) || []).filter(c => xpos.has(c)).map(c => xpos.get(c));
            const desired = kx.length ? kx.reduce((s, v) => s + v, 0) / kx.length : null;
            const half = (NODE_W + GAP) / 2;
            const lx = (prev === null) ? (desired != null ? desired - half : 0) : Math.max(desired != null ? desired - half : -1e9, prevX + spacing(prev, id));
            xpos.set(id, lx); xpos.set(sp, lx + NODE_W + GAP); prev = sp; prevX = lx + NODE_W + GAP; i += 2;
          } else {
            const desired = avgKids(id);
            const x = (prev === null) ? (desired != null ? desired : 0) : (desired != null ? Math.max(desired, prevX + spacing(prev, id)) : prevX + spacing(prev, id));
            xpos.set(id, x); prev = id; prevX = x; i += 1;
          }
        }
      }
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
        if (hidden.has(id)) continue;
        const el = nodeEl(byId.get(id)); elById.set(id, el);
        el.style.position = 'absolute';
        el.style.left = (xpos.get(id) - minX + PAD) + 'px';
        el.style.top = ((gMax - g) * ROW_H + PAD) + 'px';
        el.style.transform = 'translateX(-50%)';
        wrap.appendChild(el);
      }
      const rootEl = elById.get(rootId);
      if (rootEl) { rootEl.style.border = '2px solid var(--gold,#D4A843)'; rootEl.style.boxShadow = '0 0 0 4px rgba(212,168,67,.22)'; }

      // collapse/expand toggle on each collapsible family's visible anchor parent
      for (const fam of tree.families) {
        if (!collapsible.has(fam.id)) continue;
        const anchor = [fam.wife, fam.husband].filter(Boolean).find(p => elById.has(p));
        if (!anchor) continue;
        const isC = collapsed.has(fam.id), n = (fam.children || []).length;
        const t = document.createElement('button');
        t.type = 'button';
        t.textContent = isC ? ('+' + n) : '−';
        t.title = isC ? (lang === 'es' ? 'Mostrar ' + n : 'Show ' + n) : (lang === 'es' ? 'Ocultar' : 'Hide');
        t.setAttribute('aria-label', t.title);
        t.style.cssText = 'position:absolute;left:50%;bottom:-12px;transform:translateX(-50%);min-width:24px;height:20px;padding:0 5px;border:1px solid var(--earth,#8B5E3C);background:#fffdf8;color:var(--earth,#8B5E3C);border-radius:11px;font-size:.7rem;font-weight:600;line-height:1;cursor:pointer;z-index:3;box-shadow:0 1px 2px rgba(28,19,9,.2);';
        t.addEventListener('pointerdown', e => e.stopPropagation());
        t.addEventListener('click', e => { e.stopPropagation(); if (collapsed.has(fam.id)) collapsed.delete(fam.id); else collapsed.add(fam.id); render(); });
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
    controls.appendChild(mkBtn('⊕', lang === 'es' ? 'Expandir todo' : 'Expand all', () => { collapsed.clear(); render(); }));
    controls.appendChild(mkBtn('⊖', lang === 'es' ? 'Colapsar todo' : 'Collapse all', () => { collapsible.forEach(f => collapsed.add(f)); render(); }));
    canvas.appendChild(controls);

    // Keyboard navigation between relatives: arrows move up (parent) / down
    // (child) / sideways (same generation); Enter opens the detail card.
    canvas.setAttribute('tabindex', '0');
    let navId = rootId;
    const focusNode = (id) => {
      const el = meta.elById && meta.elById.get(id); if (!el) return;
      navId = id; el.focus();
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

    const legend = document.createElement('div');
    legend.innerHTML = (lang === 'es' ? '∗ adoptado · +N expandir · ? por confirmar' : '∗ adopted · +N expand · ? unconfirmed');
    legend.style.cssText = 'position:absolute;left:16px;bottom:16px;font-size:.74rem;color:rgba(28,19,9,.55);background:rgba(255,253,248,.85);padding:4px 9px;border-radius:6px;z-index:5;';
    canvas.appendChild(legend);
  }

  function drawConnectors(wrap, tree, elById) {
    const NS = 'http://www.w3.org/2000/svg';
    const wr = wrap.getBoundingClientRect();
    const pos = (el) => { const r = el.getBoundingClientRect(); return { cx: r.left - wr.left + r.width / 2, cy: r.top - wr.top + r.height / 2, left: r.left - wr.left, right: r.left - wr.left + r.width, top: r.top - wr.top, bottom: r.top - wr.top + r.height }; };
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
    const recs = (ind.recordLinks || []).map(r => '<li><a href="' + r.url + '" target="_blank" rel="noopener">' + r.label + '</a></li>').join('');
    o.innerHTML =
      '<div role="dialog" aria-modal="true" aria-label="' + nameOf(ind) + '" style="position:relative;background:#fffdf8;width:min(440px,92vw);max-height:80vh;overflow:auto;border-radius:14px;box-shadow:0 14px 44px rgba(28,19,9,.30);padding:26px 24px 22px;">' +
        '<button id="ft-close" aria-label="Close" style="position:absolute;top:10px;right:12px;border:none;background:none;font-size:1.6rem;line-height:1;cursor:pointer;color:rgba(28,19,9,.5);">×</button>' +
        '<h2 style="font-family:\'Playfair Display\',serif;font-weight:400;font-size:1.4rem;margin:0 1.6rem .5rem 0;">' + nameOf(ind) + '</h2>' +
        (ind.adopted ? '<p style="display:inline-block;font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;background:rgba(196,120,90,.15);color:var(--clay,#C4785A);padding:2px 9px;border-radius:99px;margin:0 0 .6rem;">' + (lang === 'es' ? 'Adoptado' : 'Adopted') + '</p>' : '') +
        '<p style="margin:.2rem 0;"><strong>' + (lang === 'es' ? 'Nació' : 'Born') + ':</strong> ' + ((ind.birth && (ind.birth.date || ind.birth.place)) || '—') + '</p>' +
        ((ind.death && ind.death.date) ? '<p style="margin:.2rem 0;"><strong>' + (lang === 'es' ? 'Falleció' : 'Died') + ':</strong> ' + ind.death.date + '</p>' : '') +
        (oo ? '<p style="background:#f7eecf;border-left:3px solid #c4785a;padding:8px 10px;border-radius:0 6px 6px 0;margin:.8rem 0;"><strong>' + (lang === 'es' ? 'Origen del apellido' : 'Surname origin') + ':</strong> ' + oo.text + ' <em>(' + oo.confidence + ')</em></p>' : '') +
        (recs ? '<h3 style="font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6;margin:.9rem 0 .3rem;">' + (lang === 'es' ? 'Registros' : 'Records') + '</h3><ul style="margin:0;padding-left:1.1rem;">' + recs + '</ul>' : '') +
        ((ind.notes && ind.notes[lang]) ? '<p style="margin:.8rem 0 0;color:rgba(28,19,9,.8);">' + ind.notes[lang] + '</p>' : '') +
      '</div>';
    document.body.appendChild(o);
    o.querySelector('#ft-close').addEventListener('click', closeCard);
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
