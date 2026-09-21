import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
function zipEntries(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0);
  const entries = [];
  let offset = buffer.readUInt32LE(end + 16);
  for (let index = 0; index < buffer.readUInt16LE(end + 10); index++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const length = buffer.readUInt16LE(offset + 28);
    const local = buffer.readUInt32LE(offset + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const compressed = buffer.subarray(start, start + buffer.readUInt32LE(offset + 20));
    entries.push({ name: buffer.toString('utf8', offset + 46, offset + 46 + length),
      mode: buffer.readUInt32LE(offset + 38) >>> 16,
      data: buffer.readUInt16LE(offset + 10) === 8 ? inflateRawSync(compressed) : compressed });
    offset += 46 + length + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return entries;
}

test('release ZIP uses tagged code, excludes campaigns and keeps launchers portable', async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'kakapin-release-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: fixture, stdio: 'pipe' });
  const put = async (name, contents) => {
    await mkdir(path.dirname(path.join(fixture, name)), { recursive: true });
    await writeFile(path.join(fixture, name), contents);
  };
  for (const name of ['scripts/package-release.mjs', '.gitattributes', '.gitignore']) {
    await mkdir(path.dirname(path.join(fixture, name)), { recursive: true });
    await copyFile(path.join(root, name), path.join(fixture, name));
  }
  for (const [name, body] of Object.entries({ 'server.mjs': 'tagged source', 'package-lock.json': '{}',
    'scripts/launch.mjs': '// launcher', 'public/index.html': '<html></html>',
    '启动 KakaPin.command': '#!/bin/sh\necho KakaPin\n', '启动 KakaPin.bat': '@echo off\necho KakaPin\n',
    'marketing/copy.md': 'private campaign', 'videos/script.md': 'private promo',
    '.runtime/project.json': 'private album', 'kakapin.config.json': 'private config' })) await put(name, body);
  git(['init']);
  git(['config', 'user.name', 'Release test']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'core.autocrlf', 'false']);
  git(['add', '-f', '.']);
  git(['update-index', '--chmod=+x', '启动 KakaPin.command']);
  git(['commit', '-m', 'fixture']);
  git(['tag', 'v1.0.0-beta.1']);
  await put('server.mjs', 'uncommitted change must not ship');
  const script = path.join(fixture, 'scripts/package-release.mjs');
  execFileSync(process.execPath, [script, 'v1.0.0-beta.1']);
  const output = path.join(fixture, 'release-artifacts/v1.0.0-beta.1');
  const filename = 'KakaPin-v1.0.0-beta.1-macOS-Windows.zip';
  const zip = await readFile(path.join(output, filename));
  const entries = zipEntries(zip);
  assert.ok(entries.every(entry => !/(marketing|videos|\.runtime|kakapin\.config\.json)/.test(entry.name)));
  assert.equal(entries.find(entry => entry.name.endsWith('/server.mjs')).data.toString(), 'tagged source');
  assert.ok(entries.find(entry => entry.name.endsWith('.command')).mode & 0o111);
  assert.equal(entries.find(entry => entry.name.endsWith('.bat')).data.toString(), '@echo off\r\necho KakaPin\r\n');
  const hash = createHash('sha256').update(zip).digest('hex');
  assert.equal(await readFile(path.join(output, 'SHA256SUMS.txt'), 'utf8'), `${hash}  ${filename}\n`);
  assert.throws(() => execFileSync(process.execPath, [script, 'v1.0.0-beta.1'], { stdio: 'pipe' }));
  const sourceArchive = git(['archive', '--format=zip', 'v1.0.0-beta.1']);
  assert.ok(zipEntries(sourceArchive).every(entry => !/^(marketing|videos|\.runtime|kakapin\.config\.json)(\/|$)/.test(entry.name)));
  await put('docs/private.key', 'do not ship');
  git(['add', '-f', 'docs/private.key']);
  git(['commit', '-m', 'unsafe fixture']);
  git(['tag', 'v1.0.0-beta.2']);
  assert.throws(() => execFileSync(process.execPath, [script, 'v1.0.0-beta.2'], { stdio: 'pipe' }));
});
