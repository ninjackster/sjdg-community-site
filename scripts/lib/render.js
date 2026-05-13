// Allow letters/digits/underscores plus hyphens and dots so tokens like
// {{nav_urls.things-to-do}} resolve correctly. Without hyphens, those tokens
// would silently pass through as literal text in the output.
const TOKEN_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;

function resolve(ctx, key) {
  return key.split('.').reduce((acc, part) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[part];
  }, ctx);
}

export function render(template, ctx) {
  // Single pass — does not re-scan output, so values containing braces are safe.
  return template.replace(TOKEN_RE, (_, key) => {
    const value = resolve(ctx, key);
    if (value === undefined) {
      throw new Error(`unresolved token: ${key}`);
    }
    return String(value);
  });
}
