export function slugify(input) {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function businessSlug(name, placeId) {
  const base = slugify(name) || 'place';
  const idTail = (placeId || '').slice(-6).toLowerCase();
  return idTail ? `${base}-${idTail}` : base;
}
