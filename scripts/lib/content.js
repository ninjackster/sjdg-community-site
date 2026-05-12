import { readFile } from 'node:fs/promises';

const LANGS = ['en', 'es'];

function isTranslationLeaf(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(k => LANGS.includes(k));
}

export function resolveLang(node, lang) {
  if (isTranslationLeaf(node)) {
    if (!(lang in node)) {
      throw new Error(`missing translation for lang "${lang}" in ${JSON.stringify(node)}`);
    }
    return node[lang];
  }
  if (Array.isArray(node)) {
    return node.map(item => resolveLang(item, lang));
  }
  if (node !== null && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = resolveLang(value, lang);
    }
    return out;
  }
  return node;
}

export async function loadContent(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}
