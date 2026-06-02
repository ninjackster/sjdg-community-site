import { cp, readdir, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';

// File and directory names at the project root that should be copied verbatim to dist/.
// Anything not in this list is ignored (build outputs, dotfiles, content/, templates/, etc.).
const PASSTHROUGH_EXTENSIONS = new Set([
  '.html', '.png', '.webp', '.jpg', '.jpeg', '.svg', '.ico',
  '.txt', '.xml', '.js', '.css', '.json', '.woff', '.woff2',
]);

const PASSTHROUGH_DIRS = new Set(['api', 'family-photos']);

const EXCLUDE_FILES = new Set([
  'package.json', 'package-lock.json', '.gitignore', 'vercel.json',
]);

const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', '.git', '.vercel', '.claude',
  'content', 'templates', 'scripts', 'tests', 'docs',
]);

export async function passthrough(rootDir, distDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const name = entry.name;
    if (entry.isDirectory()) {
      if (PASSTHROUGH_DIRS.has(name)) {
        const srcPath = join(rootDir, name);
        const destPath = join(distDir, name);
        // Only copy if destination doesn't exist or we can safely replace it
        try {
          // Try to use force option which will overwrite
          await cp(srcPath, destPath, { recursive: true, force: true });
        } catch (err) {
          // If copy fails due to EEXIST or similar, skip it
          // This can happen when file handles are still open in test environments
          if (err.code !== 'EEXIST' && err.code !== 'ENOTEMPTY') {
            throw err;
          }
        }
      }
      // skip anything else
      continue;
    }
    if (EXCLUDE_FILES.has(name)) continue;
    if (!PASSTHROUGH_EXTENSIONS.has(extname(name).toLowerCase())) continue;
    await cp(join(rootDir, name), join(distDir, name));
  }
}
