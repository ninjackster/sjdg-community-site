const bilingual = (v) => v && typeof v === 'object' && typeof v.en === 'string' && typeof v.es === 'string';

export function validateVoces(data) {
  const errors = [];
  const items = (data && Array.isArray(data.items)) ? data.items : null;
  if (!items) return { valid: false, errors: ['voces.items must be an array'] };
  const seen = new Set();
  for (const v of items) {
    if (!v.id || typeof v.id !== 'string') { errors.push('voz missing id'); continue; }
    if (seen.has(v.id)) errors.push(`duplicate voz id: ${v.id}`);
    seen.add(v.id);
    if (v.kind !== 'file' && v.kind !== 'embed') errors.push(`${v.id}: kind must be file|embed`);
    if (typeof v.audioSrc !== 'string' || !v.audioSrc) errors.push(`${v.id}: audioSrc required`);
    if (!bilingual(v.transcript)) errors.push(`${v.id}: transcript must have en+es`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateFotos(data) {
  const errors = [];
  const pairs = (data && Array.isArray(data.pairs)) ? data.pairs : null;
  if (!pairs) return { valid: false, errors: ['fotos.pairs must be an array'] };
  const seen = new Set();
  for (const p of pairs) {
    if (!p.id || typeof p.id !== 'string') { errors.push('pair missing id'); continue; }
    if (seen.has(p.id)) errors.push(`duplicate pair id: ${p.id}`);
    seen.add(p.id);
    for (const side of ['then', 'now']) {
      if (!p[side] || typeof p[side].src !== 'string' || !p[side].src) errors.push(`${p.id}: ${side}.src required`);
      if (!p[side] || !bilingual(p[side].caption)) errors.push(`${p.id}: ${side}.caption must have en+es`);
    }
  }
  return { valid: errors.length === 0, errors };
}
