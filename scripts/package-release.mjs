import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(tag || '')) {
  throw new Error('Usage: node scripts/package-release.mjs v1.0.0-beta.1 (tag must already exist)');
}
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const commit = git(['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]).trim();
const entries = git(['ls-tree', '-r', '-z', commit]).split('\0').filter(Boolean).map(entry => {
  const [metadata, name] = entry.split('\t');
  const [mode, type] = metadata.split(' ');
  return { mode, type, name };
});
const roots = new Set(['.editorconfig', '.gitattributes', '.gitignore', '.nvmrc', 'package.json',
  'package-lock.json', 'server.mjs', 'kakapin.config.example.json', 'README.md', 'README.en.md',
  'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE',
  '双击启动说明.md', '启动 KakaPin.command', '启动 KakaPin.bat', 'bin/README.md', 'fonts/README.md']);
const files = entries.filter(({ name }) => roots.has(name) || /^(?:lib|public|docs|site|scripts|test|\.github)\//.test(name));
const forbidden = /(?:^|\/)(?:marketing|videos|node_modules|\.runtime|\.backups|\.env(?:\.[^/]*)?|kakapin\.config\.json)(?:\/|$)|\.(?:jpe?g|heic|arw|dng|mp4|mov|mp3|wav|ttf|otf|pem|key|zip)$/i;
for (const file of files) {
  if (file.type !== 'blob' || !['100644', '100755'].includes(file.mode) || forbidden.test(file.name)) {
    throw new Error(`Unsafe release entry: ${file.name}`);
  }
}
for (const required of ['server.mjs', 'package-lock.json', 'scripts/launch.mjs', 'public/index.html', '启动 KakaPin.command', '启动 KakaPin.bat']) {
  if (!files.some(file => file.name === required)) throw new Error(`Missing release file: ${required}`);
}
const directory = path.join(root, 'release-artifacts', tag);
await mkdir(path.dirname(directory), { recursive: true });
await mkdir(directory); // Refuse to overwrite an existing release package.
const filename = `KakaPin-${tag}-macOS-Windows.zip`;
const archive = path.join(directory, filename);
git(['archive', '--format=zip', `--prefix=KakaPin-${tag}/`, `--output=${archive}`, commit, '--', ...files.map(file => file.name)]);
const sha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(path.join(directory, 'SHA256SUMS.txt'), `${sha256}  ${filename}\n`);
console.log(JSON.stringify({ tag, commit, archive, sha256, sourceFiles: files.length }, null, 2));
