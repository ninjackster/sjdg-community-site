// Kinship relationship of any individual to the focal person — gender-aware, bilingual (en/es),
// full precision (cousins + "removed", great-aunts, etc.). Pure & dependency-free; imported by
// family-tree.js (browser, type=module) and the Node tests. Never throws; falls back gracefully.

export function relationshipLabel(tree, focalId, personId, lang = 'es') {
  const en = lang === 'en';
  const byId = new Map(tree.individuals.map(i => [i.id, i]));
  const childParents = new Map();      // child -> [parents]
  const coupleOf = new Map();          // spouse <-> spouse
  const parentFamilies = new Map();    // parent -> [families they parent]
  for (const f of tree.families) {
    const ps = [f.husband, f.wife].filter(Boolean);
    for (const c of (f.children || [])) childParents.set(c, (childParents.get(c) || []).concat(ps));
    for (const p of ps) (parentFamilies.get(p) || parentFamilies.set(p, []).get(p)).push(f);
    if (ps.length === 2) { if (!coupleOf.has(ps[0])) coupleOf.set(ps[0], ps[1]); if (!coupleOf.has(ps[1])) coupleOf.set(ps[1], ps[0]); }
  }
  const fem = (id) => ((byId.get(id) || {}).sex) === 'F';
  const givenOf = (id) => (((byId.get(id) || {}).names) || {}).given || '';
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  if (personId === focalId) return en ? 'You' : 'Tú';

  // ancestors of `id` with distance (self = 0), keeping the minimum distance on multiple paths.
  const anc = (id) => {
    const m = new Map(); const st = [[id, 0]];
    while (st.length) { const [n, d] = st.pop(); if (m.has(n) && m.get(n) <= d) continue; m.set(n, d); for (const p of (childParents.get(n) || [])) st.push([p, d + 1]); }
    return m;
  };

  // Lowercase blood-relationship phrase of pid relative to fid, or null if no common ancestor.
  const blood = (fid, pid) => {
    if (pid === fid) return en ? 'yourself' : 'tú mismo';
    const af = anc(fid), ap = anc(pid);
    let lca = null, best = Infinity, bestMax = Infinity;
    for (const [c, df] of af) if (ap.has(c)) { const dp = ap.get(c), sum = df + dp, mx = Math.max(df, dp); if (sum < best || (sum === best && mx < bestMax)) { best = sum; bestMax = mx; lca = c; } }
    if (lca == null) return null;
    const a = af.get(lca), b = ap.get(lca), f2 = fem(pid);

    if (a === 0) { // descendant of focal
      const arr = en ? (f2 ? ['daughter', 'granddaughter', 'great-granddaughter', 'great-great-granddaughter'] : ['son', 'grandson', 'great-grandson', 'great-great-grandson'])
                     : (f2 ? ['hija', 'nieta', 'bisnieta', 'tataranieta'] : ['hijo', 'nieto', 'bisnieto', 'tataranieto']);
      return arr[b - 1] || (en ? 'descendant' : 'descendiente');
    }
    if (b === 0) { // ancestor of focal
      const arr = en ? (f2 ? ['mother', 'grandmother', 'great-grandmother', 'great-great-grandmother'] : ['father', 'grandfather', 'great-grandfather', 'great-great-grandfather'])
                     : (f2 ? ['madre', 'abuela', 'bisabuela', 'tatarabuela'] : ['padre', 'abuelo', 'bisabuelo', 'tatarabuelo']);
      return arr[a - 1] || (en ? 'ancestor' : 'ancestro');
    }
    if (a === 1 && b === 1) { // sibling
      const fp = new Set(childParents.get(fid) || []);
      const shared = (childParents.get(pid) || []).filter(x => fp.has(x)).length;
      if (shared >= 2) return en ? (f2 ? 'sister' : 'brother') : (f2 ? 'hermana' : 'hermano');
      return en ? (f2 ? 'half-sister' : 'half-brother') : (f2 ? 'media hermana' : 'medio hermano');
    }
    if (b === 1 && a >= 2) { // aunt / uncle line
      const arr = en ? (f2 ? ['aunt', 'great-aunt', 'great-great-aunt'] : ['uncle', 'great-uncle', 'great-great-uncle'])
                     : (f2 ? ['tía', 'tía abuela', 'tía bisabuela'] : ['tío', 'tío abuelo', 'tío bisabuelo']);
      return arr[a - 2] || (en ? 'distant aunt/uncle' : (f2 ? 'tía lejana' : 'tío lejano'));
    }
    if (a === 1 && b >= 2) { // niece / nephew line
      const arr = en ? (f2 ? ['niece', 'grand-niece', 'great-grand-niece'] : ['nephew', 'grand-nephew', 'great-grand-nephew'])
                     : (f2 ? ['sobrina', 'sobrina nieta', 'sobrina bisnieta'] : ['sobrino', 'sobrino nieto', 'sobrino bisnieto']);
      return arr[b - 2] || (en ? 'distant niece/nephew' : (f2 ? 'sobrina lejana' : 'sobrino lejano'));
    }
    // cousins
    const d = Math.min(a, b) - 1, r = Math.abs(a - b);
    if (en) {
      const ord = ['first', 'second', 'third', 'fourth', 'fifth'];
      const rem = r === 0 ? '' : (r === 1 ? ' once removed' : r === 2 ? ' twice removed' : ' ' + r + ' times removed');
      return (ord[d - 1] || (d + 'th')) + ' cousin' + rem;
    }
    const ord = f2 ? ['hermana', 'segunda', 'tercera', 'cuarta', 'quinta'] : ['hermano', 'segundo', 'tercero', 'cuarto', 'quinto'];
    const remES = r === 0 ? '' : (r === 1 ? ' una vez removid' + (f2 ? 'a' : 'o') : ' ' + r + ' veces removid' + (f2 ? 'a' : 'o'));
    return (f2 ? 'prima ' : 'primo ') + (ord[d - 1] || ('en grado ' + d)) + remES;
  };

  const direct = blood(focalId, personId);
  if (direct) return cap(direct);

  // Married-in (no common ancestor). Describe via a blood CHILD first (marriage-agnostic), then a
  // blood PARTNER. Per Jaime: a shared child does not imply marriage.
  let bestChild = null, bestSum = Infinity;
  for (const f of (parentFamilies.get(personId) || [])) {
    for (const c of (f.children || [])) {
      if (c === focalId) continue;
      const rel = blood(focalId, c);
      if (!rel) continue;
      const af = anc(focalId), ac = anc(c);
      let s = Infinity; for (const [x, df] of af) if (ac.has(x)) s = Math.min(s, df + ac.get(x));
      if (s < bestSum) { bestSum = s; bestChild = { id: c, rel }; }
    }
  }
  const poss = en ? 'your' : 'tu';
  if (bestChild) {
    const term = en ? (fem(personId) ? 'Mother' : 'Father') : (fem(personId) ? 'Madre' : 'Padre');
    return term + (en ? ' of ' : ' de ') + poss + ' ' + bestChild.rel + ' ' + givenOf(bestChild.id);
  }
  const sp = coupleOf.get(personId);
  if (sp) { const rel = blood(focalId, sp); if (rel) return (en ? 'Partner of ' : 'Pareja de ') + poss + ' ' + rel + ' ' + givenOf(sp); }
  return en ? 'Relative by marriage' : 'Familiar político';
}
