const CONFIDENCE = new Set(['high', 'medium', 'low']);

export function validateTree(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { valid: false, errors: ['tree must be an object'] };
  const individuals = Array.isArray(data.individuals) ? data.individuals : null;
  const families = Array.isArray(data.families) ? data.families : null;
  if (!individuals) errors.push('individuals must be an array');
  if (!families) errors.push('families must be an array');
  if (!individuals || !families) return { valid: false, errors };

  const ids = new Set();
  for (const ind of individuals) {
    if (!ind || typeof ind.id !== 'string') { errors.push('every individual needs a string id'); continue; }
    if (ids.has(ind.id)) errors.push(`duplicate individual id: ${ind.id}`);
    ids.add(ind.id);
    if (!ind.names || typeof ind.names.given !== 'string') errors.push(`individual ${ind.id} missing names.given`);
    if (!ind.names || !Array.isArray(ind.names.surnames)) errors.push(`individual ${ind.id} missing names.surnames[]`);
    if (ind.surnameOrigin && !CONFIDENCE.has(ind.surnameOrigin.confidence)) {
      errors.push(`individual ${ind.id} surnameOrigin.confidence must be one of high|medium|low`);
    }
  }

  for (const fam of families) {
    if (!fam || typeof fam.id !== 'string') { errors.push('every family needs a string id'); continue; }
    const refs = [fam.husband, fam.wife, ...(Array.isArray(fam.children) ? fam.children : [])].filter(Boolean);
    for (const ref of refs) {
      if (!ids.has(ref)) errors.push(`family ${fam.id} references unknown individual: ${ref}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
