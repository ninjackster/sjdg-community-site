// Merge approved family submissions into a tree. Each approved entry adds one
// new individual linked to an existing person (relativeOf) by relationship:
// 'child' | 'parent' | 'spouse' | 'sibling'. Pure function — no I/O.
export function applyApproved(tree, approved) {
  const t = {
    individuals: tree.individuals.map(i => ({ ...i })),
    families: tree.families.map(f => ({ ...f, children: (f.children || []).slice() })),
  };
  const byId = new Map(t.individuals.map(i => [i.id, i]));
  const famOfChild = (id) => t.families.find(f => (f.children || []).includes(id));
  const famAsParent = (id) => t.families.find(f => f.husband === id || f.wife === id);
  let famSeq = t.families.length;
  const newFamId = () => 'XF' + (++famSeq);

  for (const a of (approved || [])) {
    if (!a || !a.id || byId.has(a.id) || !a.relativeOf || !byId.has(a.relativeOf)) continue;
    const ind = {
      id: a.id,
      names: { given: (a.names && a.names.given) || '?', surnames: (a.names && a.names.surnames) || [] },
      sex: a.sex || null,
      birth: a.birth || { date: null, place: null },
      death: a.death || { date: null, place: null },
      photo: a.photo || null,
      surnameOrigin: null,
      recordLinks: [],
      notes: a.notes || { en: '', es: '' },
      submitted: true,
    };
    t.individuals.push(ind); byId.set(ind.id, ind);
    const tgt = a.relativeOf;

    if (a.relationship === 'sibling') {
      const f = famOfChild(tgt);
      if (f) f.children.push(a.id);
      else t.families.push({ id: newFamId(), husband: null, wife: null, children: [tgt, a.id] });
    } else if (a.relationship === 'child') {
      let f = famAsParent(tgt);
      if (f) f.children.push(a.id);
      else {
        const tSex = byId.get(tgt).sex;
        t.families.push({ id: newFamId(), husband: tSex === 'F' ? null : tgt, wife: tSex === 'F' ? tgt : null, children: [a.id] });
      }
    } else if (a.relationship === 'spouse') {
      const f = t.families.find(f => (f.husband === tgt && !f.wife) || (f.wife === tgt && !f.husband));
      if (f) { if (f.husband === tgt) f.wife = a.id; else f.husband = a.id; }
      else { const tSex = byId.get(tgt).sex; t.families.push({ id: newFamId(), husband: tSex === 'F' ? a.id : tgt, wife: tSex === 'F' ? tgt : a.id, children: [] }); }
    } else if (a.relationship === 'parent') {
      const f = famOfChild(tgt);
      if (f && !f.husband) f.husband = a.id;
      else if (f && !f.wife) f.wife = a.id;
      else if (!f) t.families.push({ id: newFamId(), husband: a.id, wife: null, children: [tgt] });
      // if both parent slots already filled, the individual is added but unlinked (rare)
    }
  }
  return t;
}
