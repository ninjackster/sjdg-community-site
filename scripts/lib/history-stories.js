// Pure validator for history "Story" atoms. Mirrors the family-tree validateTree discipline.
const KINDS = new Set(['place', 'person', 'object', 'event']);
const bilingual = (v) => v && typeof v === 'object' && typeof v.en === 'string' && typeof v.es === 'string';

export function validateStories(data) {
  const errors = [];
  const stories = (data && Array.isArray(data.stories)) ? data.stories : null;
  if (!stories) return { valid: false, errors: ['stories must be an array'] };
  const seen = new Set();
  for (const s of stories) {
    const id = s && s.id;
    if (!id || typeof id !== 'string') { errors.push('story missing string id'); continue; }
    if (seen.has(id)) errors.push(`duplicate id: ${id}`);
    seen.add(id);
    if (!KINDS.has(s.kind)) errors.push(`${id}: invalid kind "${s.kind}"`);
    if (!bilingual(s.title)) errors.push(`${id}: title must have en+es`);
    if (!bilingual(s.body)) errors.push(`${id}: body must have en+es`);
    if (s.place) {
      if (typeof s.place.lat !== 'number' || typeof s.place.lng !== 'number') errors.push(`${id}: place coords must be numbers`);
    }
  }
  return { valid: errors.length === 0, errors };
}
