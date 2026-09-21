import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');

test('repository documentation links and local images resolve inside the source tree', async () => {
  const documents = [];
  for (const directory of ['', 'docs', 'bin', 'fonts', '.github']) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) documents.push(path.join(directory, entry.name));
    }
  }
  for (const file of documents) {
    const source = (await read(file)).replace(/```[\s\S]*?```/g, '');
    const links = [
      ...[...source.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]),
      ...[...source.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]),
    ];
    for (const link of links) {
      if (/^(?:[a-z]+:|#)/i.test(link)) continue;
      const target = path.resolve(root, path.dirname(file), decodeURIComponent(link.split('#')[0]));
      assert.ok(target.startsWith(root), `${file}: link leaves the repository`);
      await assert.doesNotReject(access(target), `${file}: missing local link ${link}`);
    }
  }
});

test('package metadata and lockfile keep the same runtime contract', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.deepEqual(manifest.dependencies, lock.packages[''].dependencies);
  assert.deepEqual(manifest.engines, lock.packages[''].engines);
  assert.equal(manifest.repository.url, 'https://github.com/DongZhouGu/KakaPin.git');
  assert.equal(manifest.private, true, 'The source app must not be accidentally published to npm');
  for (const dependency of Object.keys(lock.packages['node_modules/sharp'].optionalDependencies)) {
    assert.ok(lock.packages['node_modules/' + dependency], `Missing Sharp platform package: ${dependency}`);
  }
});

test('Chinese and English overviews state the important product boundaries', async () => {
  const chinese = await read('README.md');
  const english = await read('README.en.md');
  for (const text of [chinese, english]) {
    assert.match(text, /1920×1080/);
    assert.match(text, /4K/);
    assert.match(text, /SECURITY\.md/);
    assert.match(text, /docs\/assets\/kakapin-start\.png/);
  }
  assert.match(chinese, /视频原声目前不参与导出/);
  assert.match(english, /Source video audio is not included/);
});
