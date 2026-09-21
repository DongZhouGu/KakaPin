import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// Exact allowlist: never publish the repository root or runtime media.
const files = [
  ['site/index.html', 'index.html'],
  ['site/en/index.html', 'en/index.html'],
  ['site/styles.css', 'styles.css'],
  ['public/assets/brand/kakapin-mark.svg', 'assets/kakapin-mark.svg'],
  ['public/favicon.svg', 'assets/favicon.svg'],
  ...['workspace', 'templates', 'projects', 'media', 'export'].map(name =>
    [`docs/assets/kakapin-${name}.png`, `assets/kakapin-${name}.png`]),
];
// Refuse to reuse an old output directory, so stale files cannot be deployed.
const destination = path.join(root, '.site-dist');
await mkdir(destination);
for (const [source, target] of files) {
  const output = path.join(destination, target);
  await mkdir(path.dirname(output), { recursive: true });
  await copyFile(path.join(root, source), output);
}
console.log(`Built ${files.length} allowlisted static files in .site-dist/`);
