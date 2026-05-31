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
  // Esc closes the detail popout.
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });

  function nameOf(ind) { return ind.names.given + ' ' + ind.names.surnames.join(' '); }

  // Generation depth from the root (0). Ancestors are walked upward; then any
  // child of a family is seated either one generation below a placed parent,
  // or — if no parent is in the tree — at the generation of a placed sibling
  // (so grandparents' siblings render too). Also records each person's
  // family-of-origin for grouping siblings together in a row.
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
        if (placedParent != null) cg = gens.get(placedParent) - 1;
        else { const pc = kids.find(c => gens.has(c)); if (pc != null) cg = gens.get(pc); }
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
    const maxGen = Math.max(...gens.values());
    const rows = Array.from({ length: maxGen + 1 }, () => []);
    for (const [id, g] of gens) rows[g].push(id);
    // Keep siblings adjacent by grouping each row by family-of-origin.
    rows.forEach(row => row.sort((a, b) => {
      const fa = childToFamily.get(a) || 'zzz', fb = childToFamily.get(b) || 'zzz';
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    }));

    // Layered tidy layout: one horizontal line per generation (never wraps),
    // generous fixed spacing; the canvas pans/zooms. inline-flex so the wrap
    // sizes to its content and can be larger than the viewport.
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-flex;flex-direction:column-reverse;gap:64px;padding:48px;align-items:center;';
    const elById = new Map();
    rows.forEach(row => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:26px;justify-content:center;flex-wrap:nowrap;';
      row.forEach(id => { const el = nodeEl(byId.get(id)); elById.set(id, el); r.appendChild(el); });
      wrap.appendChild(r);
    });
    canvas.innerHTML = '';
    canvas.appendChild(wrap);

    // Focal point: emphasize the root (you) so it stands out anywhere in its row.
    const rootEl = elById.get(rootId);
    if (rootEl) {
      rootEl.style.border = '2px solid var(--gold,#D4A843)';
      rootEl.style.boxShadow = '0 0 0 4px rgba(212,168,67,.22)';
    }

    drawConnectors(wrap, tree, elById);

    // Initial view: fit the whole tree to the canvas and center horizontally on
    // the root, seated near the bottom so ancestors rise above it.
    const cw = canvas.clientWidth || 900, ch = canvas.clientHeight || 600;
    const sw = wrap.scrollWidth, sh = wrap.scrollHeight;
    const scale = Math.max(0.3, Math.min(1, (cw - 48) / sw, (ch - 48) / sh));
    const wr = wrap.getBoundingClientRect();
    const rr = (rootEl || wrap).getBoundingClientRect();
    const rootCx = (rr.left - wr.left) + rr.width / 2;
    const rootCy = (rr.top - wr.top) + rr.height / 2;
    const x0 = cw / 2 - rootCx * scale;
    const y0 = ch * 0.82 - rootCy * scale;
    enableZoomPan(canvas, wrap, { x: x0, y: y0, scale });
  }

  // Elbow connectors from each couple down to their children. Drawn in an SVG
  // layer inside `wrap` (so it pans/zooms with the nodes) using positions
  // measured at the initial identity transform. Families with no parent in the
  // tree (e.g. a grandparent's sibling group) draw no lines.
  function drawConnectors(wrap, tree, elById) {
    const NS = 'http://www.w3.org/2000/svg';
    const wr = wrap.getBoundingClientRect();
    const pos = (el) => {
      const r = el.getBoundingClientRect();
      return { cx: r.left - wr.left + r.width / 2, top: r.top - wr.top, bottom: r.top - wr.top + r.height };
    };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', wrap.scrollWidth);
    svg.setAttribute('height', wrap.scrollHeight);
    svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;pointer-events:none;z-index:0;';
    for (const fam of tree.families) {
      const parents = [fam.husband, fam.wife].filter(Boolean).map(id => elById.get(id)).filter(Boolean);
      const kids = (fam.children || []).map(id => elById.get(id)).filter(Boolean);
      if (!parents.length || !kids.length) continue;
      const pp = parents.map(pos);
      const px = pp.reduce((s, p) => s + p.cx, 0) / pp.length;
      const py = Math.max.apply(null, pp.map(p => p.bottom)); // parents sit above
      const kk = kids.map(pos);
      const kidTop = Math.min.apply(null, kk.map(k => k.top));
      const midY = py + Math.max(12, (kidTop - py) / 2);
      let d = 'M ' + px + ' ' + py + ' V ' + midY;
      for (const k of kk) d += ' M ' + px + ' ' + midY + ' H ' + k.cx + ' V ' + k.top;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#8B5E3C');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-opacity', '0.45');
      svg.appendChild(path);
    }
    wrap.insertBefore(svg, wrap.firstChild);
  }

  function nodeEl(ind) {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.id = ind.id;
    el.style.cssText = 'position:relative;z-index:1;flex:none;white-space:nowrap;display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--mist,#EDE8DF);border-radius:10px;padding:10px 14px;cursor:pointer;font:inherit;text-align:left;box-shadow:0 1px 3px rgba(28,19,9,.07);';
    const initials = (ind.names.given[0] || '') + (ind.names.surnames[0]?.[0] || '');
    el.innerHTML = '<span style="width:40px;height:40px;border-radius:50%;background:var(--earth,#8B5E3C);color:var(--cream,#F5EFE6);display:flex;align-items:center;justify-content:center;font-weight:600;flex:none;">' + initials + '</span>' +
      '<span><strong style="font-size:.9rem;">' + nameOf(ind) + '</strong></span>';
    el.addEventListener('click', () => openCard(ind));
    return el;
  }

  function closeCard() {
    const o = document.getElementById('ft-modal');
    if (o) o.remove();
  }

  // Centered popout card (small/medium). Closes via the ✕, clicking the
  // backdrop, or Esc.
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
        '<h2 style="font-family:\'Playfair Display\',serif;font-weight:400;font-size:1.4rem;margin:0 1.6rem .6rem 0;">' + nameOf(ind) + '</h2>' +
        '<p style="margin:.2rem 0;"><strong>' + (lang === 'es' ? 'Nació' : 'Born') + ':</strong> ' + ((ind.birth && (ind.birth.date || ind.birth.place)) || '—') + '</p>' +
        ((ind.death && ind.death.date) ? '<p style="margin:.2rem 0;"><strong>' + (lang === 'es' ? 'Falleció' : 'Died') + ':</strong> ' + ind.death.date + '</p>' : '') +
        (oo ? '<p style="background:#f7eecf;border-left:3px solid #c4785a;padding:8px 10px;border-radius:0 6px 6px 0;margin:.8rem 0;"><strong>' + (lang === 'es' ? 'Origen del apellido' : 'Surname origin') + ':</strong> ' + oo.text + ' <em>(' + oo.confidence + ')</em></p>' : '') +
        (recs ? '<h3 style="font-size:.78rem;text-transform:uppercase;letter-spacing:.05em;opacity:.6;margin:.9rem 0 .3rem;">' + (lang === 'es' ? 'Registros' : 'Records') + '</h3><ul style="margin:0;padding-left:1.1rem;">' + recs + '</ul>' : '') +
        ((ind.notes && ind.notes[lang]) ? '<p style="margin:.8rem 0 0;color:rgba(28,19,9,.8);">' + ind.notes[lang] + '</p>' : '') +
      '</div>';
    document.body.appendChild(o);
    o.querySelector('#ft-close').addEventListener('click', closeCard);
  }

  function enableZoomPan(container, target, init) {
    let scale = (init && init.scale) || 1, x = (init && init.x) || 0, y = (init && init.y) || 0, dragging = false, sx = 0, sy = 0;
    const apply = () => { target.style.transformOrigin = '0 0'; target.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'; };
    apply();
    container.addEventListener('wheel', (e) => { e.preventDefault(); scale = Math.min(2.5, Math.max(0.3, scale - e.deltaY * 0.0015)); apply(); }, { passive: false });
    container.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX - x; sy = e.clientY - y; });
    window.addEventListener('pointermove', (e) => { if (!dragging) return; x = e.clientX - sx; y = e.clientY - sy; apply(); });
    window.addEventListener('pointerup', () => { dragging = false; });
  }

  tryLoad();
})();
