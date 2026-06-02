// Accent-insensitive name search over the family tree. Pure & dependency-free; imported by
// family-tree.js (browser) and the Node tests. Returns ranked [{id, name}] matches.

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchPeople(tree, query, limit = 8) {
  const q = norm(query).trim();
  if (!q) return [];
  const out = [];
  for (const ind of (tree.individuals || [])) {
    const given = (ind.names && ind.names.given) || '';
    if (given === '¿?' || ind.placeholder) continue;            // skip unnamed placeholders
    const surnames = (ind.names && ind.names.surnames) || [];
    const name = (given + ' ' + surnames.join(' ')).trim();
    const words = norm(name).split(/\s+/);
    const nname = norm(name);
    if (!nname.includes(q)) continue;
    // rank: 0 = a word starts with the query, 1 = appears mid-word
    const rank = words.some(w => w.startsWith(q)) ? 0 : 1;
    out.push({ id: ind.id, name, rank });
  }
  out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return out.slice(0, limit).map(({ id, name }) => ({ id, name }));
}
