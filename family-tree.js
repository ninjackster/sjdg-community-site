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

  function draw(tree) {
    const childToParents = new Map();
    for (const fam of tree.families) {
      const parents = [fam.husband, fam.wife].filter(Boolean);
      for (const c of (fam.children || [])) childToParents.set(c, (childToParents.get(c) || []).concat(parents));
    }
    const byId = new Map(tree.individuals.map(i => [i.id, i]));
    const gens = new Map();
    (function walk(id, d) {
      if (!gens.has(id) || d > gens.get(id)) gens.set(id, d);
      for (const p of (childToParents.get(id) || [])) walk(p, d + 1);
    })(tree.individuals[0].id, 0);

    const maxGen = Math.max(...gens.values());
    const rows = Array.from({ length: maxGen + 1 }, () => []);
    for (const [id, g] of gens) rows[g].push(byId.get(id));

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column-reverse;gap:28px;padding:28px;align-items:center;';
    rows.forEach(row => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:18px;justify-content:center;flex-wrap:wrap;';
      row.forEach(ind => r.appendChild(nodeEl(ind)));
      wrap.appendChild(r);
    });
    canvas.innerHTML = '';
    canvas.appendChild(wrap);
    enableZoomPan(canvas, wrap);
  }

  function nodeEl(ind) {
    const el = document.createElement('button');
    el.type = 'button';
    el.style.cssText = 'display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #d9c9b0;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit;text-align:left;';
    const initials = (ind.names.given[0] || '') + (ind.names.surnames[0]?.[0] || '');
    el.innerHTML = '<span style="width:40px;height:40px;border-radius:50%;background:#6b4f2e;color:#f4e9d8;display:flex;align-items:center;justify-content:center;font-weight:600;">' + initials + '</span>' +
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
      '<p><strong>' + (lang === 'es' ? 'Nació' : 'Born') + ':</strong> ' + ((ind.birth && ind.birth.place) || '—') + '</p>' +
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
