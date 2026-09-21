import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const [html, css, composition, catalog, app, manifest] = await Promise.all([
  'public/index.html', 'public/styles.css', 'public/composition.css',
  'lib/style-catalog.mjs', 'public/app.js', 'package.json',
].map(read));
const token = name => css.match(new RegExp('--' + name + ':([^;]+);'))?.[1];
function luminance(hex) {
  const values = hex.slice(1).match(/../g).map(c => parseInt(c,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  return values[0]*.2126 + values[1]*.7152 + values[2]*.0722;
}
function contrast(a,b) {
  const values = [luminance(a),luminance(b)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
}

test('public branding uses KakaPin without migrating existing data identifiers', () => {
  assert.match(html, /<title>KakaPin · 本地相册成片<\/title>/);
  assert.match(html, /name="application-name" content="KakaPin"/);
  assert.match(html, /aria-label="KakaPin · 返回项目首页"/);
  assert.match(html, /href="\/favicon.svg"/);
  assert.doesNotMatch(html, /誓影/);
  assert.equal(JSON.parse(manifest).name, 'wedding-album-studio');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test('KakaPin shares the established KakaPick brand palette', () => {
  const shared = {'brand-orange':'#ff7a1a','brand-orange-hover':'#ff8f3d','brand-orange-pressed':'#e86100',canvas:'#0b0c0e',surface:'#181a1e','surface-raised':'#24272d','text-primary':'#f7f7f5','text-secondary':'#a6a8ad',success:'#35c76f',warning:'#ffb547',danger:'#ff5c57'};
  for (const [name,value] of Object.entries(shared)) assert.equal(token(name),value,name);
  assert.match(css, /color-scheme:dark/);
  assert.doesNotMatch(css, /#6d5de6|#f0edff|color-scheme:light/i);
});

test('brand actions and copy retain readable contrast on dark surfaces', () => {
  for (const background of ['canvas','surface','surface-raised']) {
    for (const foreground of ['text-primary','text-secondary','text-tertiary','brand-orange']) {
      assert.ok(contrast(token(background),token(foreground)) >= 4.5, foreground + ' on ' + background);
    }
  }
  for (const background of ['brand-orange','brand-orange-hover','brand-orange-pressed']) {
    assert.ok(contrast(token(background),token('canvas')) >= 4.5);
  }
});

test('saved and failed states use status colors rather than brand orange', () => {
  assert.match(app, /saveStatus'\).dataset.state = saveError \? 'error'/);
  assert.match(css, /data-state=saved[^}]+background:var\(--success\)/);
  assert.match(css, /data-state=error[^}]+background:var\(--danger\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('brand assets render at small sizes and do not enter the video composition', async () => {
  for (const file of ['public/assets/brand/kakapin-mark.svg','public/favicon.svg']) {
    const source = await read(file);
    assert.match(source, /#FF7A1A/);
    assert.doesNotMatch(source, /<text|<animate|<script|<image/);
    for (const width of [16,32,64]) {
      const {info} = await sharp(Buffer.from(source)).resize(width,width).png().toBuffer({resolveWithObject:true});
      assert.equal(info.width,width); assert.equal(info.height,width);
    }
  }
  assert.doesNotMatch(composition + catalog, /kakapin|brand-orange|var\(--accent\)/i);
});
