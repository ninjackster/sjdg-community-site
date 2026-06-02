// Family-tree statistics + surname color palette. Pure & dependency-free; imported by
// family-tree.js (browser) and the Node tests.

// Curated earth-tone palette for surname/branch tinting.
const PALETTE = ['#8B5E3C', '#C4785A', '#7A8C6A', '#6B7E8C', '#A88B4C', '#9A6A7E', '#5E7A6B', '#B07A4C'];

const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export function surnameColor(surname) {
  return PALETTE[hash(String(surname || '')) % PALETTE.length];
}

const year = (d) => { const m = /(\d{4})/.exec(String(d || '')); return m ? parseInt(m[1], 10) : null; };

export function computeStats(tree) {
  const inds = tree.individuals || [];
  const fams = tree.families || [];
  let placeholders = 0, withPhotos = 0, deceased = 0;
  const surnameCounts = new Map();
  const spans = [];
  for (const i of inds) {
    if (i.placeholder) placeholders++;
    if (i.photo) withPhotos++;
    if (i.death && i.death.date) deceased++;
    for (const sn of ((i.names && i.names.surnames) || [])) {
      if (!sn) continue;
      surnameCounts.set(sn, (surnameCounts.get(sn) || 0) + 1);
    }
    const b = year(i.birth && i.birth.date), d = year(i.death && i.death.date);
    if (b != null && d != null && d >= b) spans.push(d - b);
  }
  const topSurnames = [...surnameCounts.entries()]
    .map(([surname, count]) => ({ surname, count }))
    .sort((a, b) => b.count - a.count || a.surname.localeCompare(b.surname))
    .slice(0, 6);
  let largestFamily = { count: 0, id: null };
  for (const f of fams) {
    const c = (f.children || []).length;
    if (c > largestFamily.count) largestFamily = { count: c, id: f.id };
  }
  const avgLifespan = spans.length ? Math.round(spans.reduce((s, v) => s + v, 0) / spans.length) : null;
  return {
    total: inds.length,
    families: fams.length,
    placeholders,
    withPhotos,
    deceased,
    living: inds.length - deceased,
    topSurnames,
    largestFamily,
    avgLifespan,
  };
}
