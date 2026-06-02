// Pure builders/validators for family-tree submissions stored in the `fam_subs` review queue.
// Kept dependency-free so they can be unit-tested without Redis/HTTP.

function parseSurnames(s) {
  const arr = Array.isArray(s) ? s : (typeof s === 'string' ? s.trim().split(/\s+/) : []);
  return arr.map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 3);
}

function dateField(v) {
  return (typeof v === 'string' && v.trim()) ? { date: v.trim().slice(0, 40), place: null } : { date: null, place: null };
}

// Build a "suggest a correction" (edit) submission for an EXISTING person.
// Returns { sub } on success or { error } with a message. `id` and `ts` are supplied by the caller.
export function buildEditSubmission(body, id, ts) {
  const b = body || {};
  if (!b.targetId || typeof b.targetId !== 'string') return { error: 'targetId required' };
  const given = typeof b.given === 'string' ? b.given.trim().slice(0, 60) : '';
  if (!given) return { error: 'name required' };
  const note = typeof b.note === 'string' ? b.note.slice(0, 600) : '';
  const photo = (typeof b.photo === 'string' && b.photo.startsWith('data:image/') && b.photo.length < 220000) ? b.photo : null;
  const sub = {
    id,
    kind: 'edit',
    status: 'pending',
    targetId: b.targetId,
    names: { given, surnames: parseSurnames(b.surnames) },
    birth: dateField(b.birth),
    death: dateField(b.death),
    photo,
    notes: { en: note, es: note },
    ts,
  };
  return { sub };
}
