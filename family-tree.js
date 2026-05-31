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

  function nameOf(ind) { return ind.names.given + ' ' + ind.names.surnames.join(' '); }

  // Generation depth from the root (0), plus the family each person is a child
  // of. Ancestors are walked upward; siblings/aunts/uncles are then placed one
  // generation below their (already-placed) parent so they render too.
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
        const parents = [fam.husband, fam.wife].filter(Boolean);
        const placed = parents.find(p => gens.has(p));
        if (placed == null) continue;
        const cg = gens.get(placed) - 1;
        for (const c of (fam.children || [])) if (!gens.has(c)) { gens.set(c, cg); changed = true; }
      }
    }
    return { gens, childToFamily };
  }

  function draw(tree) {
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

    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:flex;flex-direction:column-reverse;gap:40px;padding:28px;align-items:center;';
    const elById = new Map();
    rows.forEach(row => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:18px;justify-content:center;flex-wrap:wrap;';
      row.forEach(id => { const el = nodeEl(byId.get(id)); elById.set(id, el); r.appendChild(el); });
      wrap.appendChild(r);
    });
    canvas.innerHTML = '';
    canvas.appendChild(wrap);
    drawConnectors(wrap, tree, elById);
    enableZoomPan(canvas, wrap);
  }

  // Elbow connectors from each couple down to their children. Drawn in an SVG
  // layer inside `wrap` (so it pans/zooms with the nodes) using positions
  // measured at the initial identity transform.
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
    el.style.cssText = 'position:relative;z-index:1;display:flex;gap:10px;align-items:center;background:#fff;border:1px solid var(--mist,#EDE8DF);border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit;text-align:left;box-shadow:0 1px 3px rgba(28,19,9,.07);';
    const initials = (ind.names.given[0] || '') + (ind.names.surnames[0]?.[0] || '');
    el.innerHTML = '<span style="width:40px;height:40px;border-radius:50%;background:var(--earth,#8B5E3C);color:var(--cream,#F5EFE6);display:flex;align-items:center;justify-content:center;font-weight:600;flex:none;">' + initials + '</span>' +
      '<span><strong style="font-size:.9rem;">' + nameOf(ind) + '</strong></span>';
    el.addEventListener('click', () => openDrawer(ind));
    return el;
  }

  function openDrawer(ind) {
    let d = document.getElementById('ft-drawer');
    if (!d) {
      d = document.createElement('div');
      d.id = 'ft-drawer';
      d.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:min(380px,90vw);background:#fffdf8;box-shadow:-4px 0 24px rgba(0,0,0,.18);padding:24px;overflow:auto;z-index:50;';
      document.body.appendChild(d);
    }
    const o = ind.surnameOrigin;
    const recs = (ind.recordLinks || []).map(r => '<li><a href="' + r.url + '" target="_blank" rel="noopener">' + r.label + '</a></li>').join('');
    d.innerHTML =
      '<button id="ft-close" style="float:right;border:none;background:none;font-size:1.4rem;cursor:pointer;">×</button>' +
      '<h2 style="font-family:\'Playfair Display\',serif;font-weight:400;">' + nameOf(ind) + '</h2>' +
      '<p><strong>' + (lang === 'es' ? 'Nació' : 'Born') + ':</strong> ' + ((ind.birth && (ind.birth.date || ind.birth.place)) || '—') + '</p>' +
      ((ind.death && ind.death.date) ? '<p><strong>' + (lang === 'es' ? 'Falleció' : 'Died') + ':</strong> ' + ind.death.date + '</p>' : '') +
      (o ? '<p style="background:#f7eecf;border-left:3px solid #c4785a;padding:8px 10px;border-radius:0 6px 6px 0;"><strong>' + (lang === 'es' ? 'Origen del apellido' : 'Surname origin') + ':</strong> ' + o.text + ' <em>(' + o.confidence + ')</em></p>' : '') +
      (recs ? '<h3 style="font-size:.8rem;text-transform:uppercase;opacity:.6;">' + (lang === 'es' ? 'Registros' : 'Records') + '</h3><ul>' + recs + '</ul>' : '') +
      ((ind.notes && ind.notes[lang]) ? '<p>' + ind.notes[lang] + '</p>' : '');
    d.style.display = 'block';
    document.getElementById('ft-close').addEventListener('click', () => { d.style.display = 'none'; });
  }

  function enableZoomPan(container, target) {
    let scale = 1, x = 0, y = 0, dragging = false, sx = 0, sy = 0;
    const apply = () => { target.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'; };
    container.addEventListener('wheel', (e) => { e.preventDefault(); scale = Math.min(2.5, Math.max(0.4, scale - e.deltaY * 0.001)); apply(); }, { passive: false });
    container.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX - x; sy = e.clientY - y; });
    window.addEventListener('pointermove', (e) => { if (!dragging) return; x = e.clientX - sx; y = e.clientY - sy; apply(); });
    window.addEventListener('pointerup', () => { dragging = false; });
  }

  tryLoad();
})();
