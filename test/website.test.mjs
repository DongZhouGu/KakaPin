import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = ['site/index.html', 'site/en/index.html', 'site/styles.css', 'scripts/build-site.mjs',
  'public/assets/brand/kakapin-mark.svg', 'public/favicon.svg',
  ...['workspace', 'templates', 'projects', 'media', 'export'].map(name => `docs/assets/kakapin-${name}.png`)];

test('Pages build publishes only allowlisted assets with working bilingual links', async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'kakapin-site-test-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const source of sources) {
    await mkdir(path.dirname(path.join(fixture, source)), { recursive: true });
    await copyFile(path.join(root, source), path.join(fixture, source));
  }
  execFileSync(process.execPath, [path.join(fixture, 'scripts/build-site.mjs')]);
  const output = path.join(fixture, '.site-dist');
  assert.deepEqual((await readdir(output)).sort(), ['assets', 'en', 'index.html', 'styles.css']);
  assert.equal((await readdir(path.join(output, 'assets'))).length, 7);
  for (const [file, language] of [['index.html', 'zh-CN'], ['en/index.html', 'en']]) {
    const html = await readFile(path.join(output, file), 'utf8');
    assert.ok(html.includes(`<html lang="${language}">`));
    assert.equal([...html.matchAll(/<h1>/g)].length, 1);
    assert.match(html, /hreflang="zh-CN"/);
    assert.match(html, /hreflang="en"/);
    assert.match(html, /1080p/);
    assert.match(html, /4K/);
    assert.doesNotMatch(html, /<script|<form|localhost|127\.0\.0\.1/);
    for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^https?:/.test(link)) continue;
      if (link.startsWith('#')) {
        assert.ok(html.includes(`id="${link.slice(1)}"`), `Missing anchor ${link}`);
        continue;
      }
      const destination = path.resolve(output, path.dirname(file), link);
      assert.ok(destination === output || destination.startsWith(output + path.sep));
      const info = await stat(destination);
      if (info.isDirectory()) await stat(path.join(destination, 'index.html'));
    }
  }
  assert.throws(() => execFileSync(process.execPath, [path.join(fixture, 'scripts/build-site.mjs')], { stdio: 'pipe' }),
    'Existing output must not allow stale files into a later deployment');
});
