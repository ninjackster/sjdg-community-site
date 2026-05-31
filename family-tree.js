// family-tree.js — served statically, runs on /en/family and /es/familia
(function () {
  const login = document.getElementById('ft-login');
  const canvas = document.getElementById('ft-canvas');
  const pwInput = document.getElementById('ft-password');
  const enterBtn = document.getElementById('ft-enter');
  const errEl = document.getElementById('ft-error');
  if (!login || !canvas) return;
  const lang = canvas.getAttribute('data-lang') || 'en';

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

  // Generation depth from the root (0). Ancestors walk upward; then a family's
  // children sit one below a placed parent (or at a placed sibling's level when
  // no parent is in the tree), and a married-in spouse takes their partner's level.
  function buildGenerations(tree) {
    const childToParents = new Map();
    const childToFamily = new Map();
    for (const fam of tree.families) {
      const parents = [fam.husband, fam.wife].filter(Boolean);
      for (const c of (fam.children || [])) {
        childToParents.set(c, (childToParents.get(c) || []).concat(parents));
        if (!childToFamily.has(c)) childToFamily.set(c, fam.id);
      }
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
    return { gens, childToFamily };
  }

  function draw(tree) {
    const rootId = tree.individuals[0].id;
    const byId = new Map(tree.individuals.map(i => [i.id, i]));
    const { gens, childToFamily } = buildGenerations(tree);
    // Direct ancestral line (you + your ancestors) — used to seat the direct
    // line nearest the center channel, pushing collateral relatives outward.
    const childParents = new Map();
    for (const fam of tree.families) { const ps = [fam.husband, fam.wife].filter(Boolean); for (const c of (fam.children || [])) childParents.set(c, (childParents.get(c) || []).concat(ps)); }
    const direct = new Set();
    (function up(id) { if (direct.has(id)) return; direct.add(id); for (const p of (childParents.get(id) || [])) up(p); })(tree.individuals[0].id);
    const maxGen = Math.max(...gens.values());
    const rows = Array.from({ length: maxGen + 1 }, () => []);
    for (const [id, g] of gens) rows[g].push(id);

    // Two trees: paternal (left) and maternal (right). Build a kin graph that
    // excludes your nuclear family (so the sides don't connect through you),
    // then flood from each parent.
    const rootFam = tree.families.find(f => (f.children || []).includes(rootId));
    const father = rootFam ? rootFam.husband : null;
    const mother = rootFam ? rootFam.wife : null;
    const adj = new Map();
    const link = (a, b) => { if (!a || !b) return; (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); };
    for (const fam of tree.families) {
      if (rootFam && fam.id === rootFam.id) continue;
      const ps = [fam.husband, fam.wife].filter(Boolean);
      const ks = fam.children || [];
      if (ps.length === 2) link(ps[0], ps[1]);
      for (const k of ks) for (const p of ps) link(p, k);
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) link(ks[i], ks[j]);
    }
    const side = new Map([[rootId, 'C']]);
    const flood = (start, tag) => { if (!start) return; const st = [start]; while (st.length) { const n = st.pop(); if (side.has(n)) continue; side.set(n, tag); for (const m of (adj.get(n) || [])) if (m !== rootId && !side.has(m)) st.push(m); } };
    flood(father, 'P'); flood(mother, 'M');
    const sideOf = (id) => side.get(id) || 'M';

    const originKey = (id) => {
      if (childToFamily.has(id)) return childToFamily.get(id);
      for (const fam of tree.families) if (fam.husband === id || fam.wife === id) {
        const other = fam.husband === id ? fam.wife : fam.husband;
        if (other && childToFamily.has(other)) return childToFamily.get(other) + '~';
      }
      return 'zzz';
    };
    // Order a side: keep same-side couples adjacent (husband first), and seat
    // your parent nearest the center channel so you sit directly under them.
    const bySide = (ids, s) => {
      const inSide = ids.filter(id => sideOf(id) === s).sort((a, b) => { const fa = originKey(a), fb = originKey(b); return fa < fb ? -1 : fa > fb ? 1 : 0; });
      const placed = new Set(), out = [];
      for (const id of inSide) {
        if (placed.has(id)) continue;
        let spouse = null;
        for (const fam of tree.families) if (fam.husband === id || fam.wife === id) {
          const o = fam.husband === id ? fam.wife : fam.husband;
          if (o && sideOf(o) === s && inSide.indexOf(o) !== -1 && !placed.has(o)) { spouse = o; break; }
        }
        if (spouse) {
          const pair = (byId.get(id).sex === 'F' && byId.get(spouse).sex !== 'F') ? [spouse, id] : [id, spouse];
          out.push(pair[0], pair[1]); placed.add(id); placed.add(spouse);
        } else { out.push(id); placed.add(id); }
      }
      // Direct line hugs the center channel; collaterals (siblings, their kin)
      // sit outward. Paternal: direct to the right; maternal: direct to the left.
      const nd = out.filter(id => !direct.has(id)), dr = out.filter(id => direct.has(id));
      return s === 'P' ? nd.concat(dr) : dr.concat(nd);
    };

    const cw = canvas.clientWidth || 1000, ch = canvas.clientHeight || 700;
    // Fixed center axis: every row is a 3-column grid [1fr | center | 1fr], so the
    // center column lines up vertically across all generations. You live in the
    // center; paternal hugs the channel from the left, maternal from the right.
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column-reverse;gap:64px;padding:48px 0;align-items:stretch;width:' + Math.max(cw, 1100) + 'px;';
    const elById = new Map();
    const cell = (justify) => { const c = document.createElement('div'); c.style.cssText = 'display:flex;gap:26px;align-items:center;min-width:0;justify-content:' + justify + ';'; return c; };
    rows.forEach(row => {
      const r = document.createElement('div');
      r.style.cssText = 'display:grid;grid-template-columns:1fr auto 1fr;column-gap:90px;align-items:center;width:100%;';
      const L = cell('flex-end'), Cc = cell('center'), R = cell('flex-start');
      const put = (cellEl) => (id) => { const el = nodeEl(byId.get(id)); elById.set(id, el); cellEl.appendChild(el); };
      bySide(row, 'P').forEach(put(L));
      bySide(row, 'C').forEach(put(Cc));
      bySide(row, 'M').forEach(put(R));
      r.appendChild(L); r.appendChild(Cc); r.appendChild(R);
      wrap.appendChild(r);
    });
    canvas.innerHTML = '';
    canvas.appendChild(wrap);

    const rootEl = elById.get(rootId);
    if (rootEl) { rootEl.style.border = '2px solid var(--gold,#D4A843)'; rootEl.style.boxShadow = '0 0 0 4px rgba(212,168,67,.22)'; }

    drawConnectors(wrap, tree, elById);

    // Content bounds (handles side clusters that overflow the axis).
    const wrRect = wrap.getBoundingClientRect();
    let minL = Infinity, maxR = -Infinity, minT = Infinity, maxB = -Infinity;
    elById.forEach(el => { const r = el.getBoundingClientRect(); minL = Math.min(minL, r.left - wrRect.left); maxR = Math.max(maxR, r.right - wrRect.left); minT = Math.min(minT, r.top - wrRect.top); maxB = Math.max(maxB, r.bottom - wrRect.top); });
    const rr = (rootEl || wrap).getBoundingClientRect();
    const rootCx = (rr.left - wrRect.left) + rr.width / 2;
    const rootCy = (rr.top - wrRect.top) + rr.height / 2;

    const vp = makeViewport(canvas, wrap);
    const focusRoot = (s) => vp.set(cw / 2 - rootCx * s, ch * 0.80 - rootCy * s, s);
    const fitAll = () => { const cWi = maxR - minL, cHi = maxB - minT, s = Math.max(0.25, Math.min(1, (cw - 60) / cWi, (ch - 60) / cHi)); vp.set(cw / 2 - ((minL + maxR) / 2) * s, ch / 2 - ((minT + maxB) / 2) * s, s); };

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
    controls.appendChild(mkBtn('⌖', lang === 'es' ? 'Centrarme' : 'Center on me', () => focusRoot(1.1)));
    controls.appendChild(mkBtn('⛶', lang === 'es' ? 'Ver todo' : 'Fit all', fitAll));
    canvas.appendChild(controls);

    // Legend for the adopted marker.
    const legend = document.createElement('div');
    legend.textContent = (lang === 'es' ? '∗ adoptado' : '∗ adopted');
    legend.style.cssText = 'position:absolute;left:16px;bottom:16px;font-size:.78rem;color:rgba(28,19,9,.55);background:rgba(255,253,248,.8);padding:3px 8px;border-radius:6px;z-index:5;';
    canvas.appendChild(legend);

    focusRoot(1.1); // start zoomed in on you
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
      if (parentEls.length === 2) { // marriage: dotted line between spouses
        const A = pos(parentEls[0]), B = pos(parentEls[1]);
        const L = A.cx <= B.cx ? A : B, R = A.cx <= B.cx ? B : A, y = (A.cy + B.cy) / 2;
        line('M ' + L.right + ' ' + y + ' H ' + R.left, true);
      }
      if (parentEls.length && kidEls.length) { // parent -> children elbow
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
    el.style.cssText = 'position:relative;z-index:1;flex:none;white-space:nowrap;display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--mist,#EDE8DF);border-radius:10px;padding:10px 14px;cursor:pointer;font:inherit;text-align:left;box-shadow:0 1px 3px rgba(28,19,9,.07);';
    if (ind.placeholder) { el.style.borderStyle = 'dashed'; el.style.opacity = '0.72'; el.style.background = '#faf6ef'; }
    const initials = ind.placeholder ? '?' : (ind.names.given[0] || '') + (ind.names.surnames[0]?.[0] || '');
    const star = ind.adopted ? ' <span title="' + (lang === 'es' ? 'adoptado' : 'adopted') + '" style="color:var(--clay,#C4785A);font-weight:700;">∗</span>' : '';
    el.innerHTML = '<span style="width:40px;height:40px;border-radius:50%;background:var(--earth,#8B5E3C);color:var(--cream,#F5EFE6);display:flex;align-items:center;justify-content:center;font-weight:600;flex:none;">' + initials + '</span>' +
      '<span><strong style="font-size:.9rem;">' + nameOf(ind) + star + '</strong></span>';
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
    const clamp = (s) => Math.min(2.6, Math.max(0.25, s));
    const apply = () => { wrap.style.transformOrigin = '0 0'; wrap.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'; };
    const zoomAround = (ns, ax, ay) => { ns = clamp(ns); const k = ns / scale; x = ax - (ax - x) * k; y = ay - (ay - y) * k; scale = ns; apply(); };
    container.addEventListener('wheel', (e) => { e.preventDefault(); const r = container.getBoundingClientRect(); zoomAround(scale - e.deltaY * 0.0016 * scale, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    container.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX - x; sy = e.clientY - y; });
    window.addEventListener('pointermove', (e) => { if (!dragging) return; x = e.clientX - sx; y = e.clientY - sy; apply(); });
    window.addEventListener('pointerup', () => { dragging = false; });
    return { set(nx, ny, ns) { x = nx; y = ny; scale = clamp(ns); apply(); }, zoomBy(f) { const r = container.getBoundingClientRect(); zoomAround(scale * f, r.width / 2, r.height / 2); } };
  }

  tryLoad();
})();
