import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../lib/layout-engine.mjs';
import { normalizeSettings, hydrateProject, editorDocument, restoreDocument, updateSettings } from '../lib/project-state.mjs';
import { buildTimeline, transitionOverlap, entryAt } from '../lib/timeline.mjs';

function fixture() {
  const photos = [
    { id: 'a', type: 'image', width: 1800, height: 1000, caption: '第一张' },
    { id: 'b', type: 'image', width: 1800, height: 1000, caption: '第二张' },
    { id: 'v', type: 'video', width: 1800, height: 1000, duration: 7.4, caption: '' },
  ];
  const settings = normalizeSettings({ includeCover: false, secondsPerScene: 4.2 });
  return hydrateProject({ id: 'test', photos, settings, plan: buildPlan(photos, settings) });
}

test('changing global settings preserves scene IDs, layouts, custom durations, and full video', () => {
  const p = fixture(), ids = p.plan.scenes.map(s => s.id);
  p.plan.scenes[0].layout = 'solo-portrait';
  p.plan.scenes[0].duration = 8; p.plan.scenes[0].durationOverride = true;
  updateSettings(p, { secondsPerScene: 5, style: 'french' });
  assert.deepEqual(p.plan.scenes.map(s => s.id), ids);
  assert.equal(p.plan.scenes[0].layout, 'solo-portrait');
  assert.deepEqual(p.plan.scenes.map(s => s.duration), [8, 5, 7.4]);
});

test('legacy custom duration is preserved even without override metadata', () => {
  const p = fixture(); delete p.plan.scenes[0].durationOverride; p.plan.scenes[0].duration = 7;
  updateSettings(p, { secondsPerScene: 6 });
  assert.equal(p.plan.scenes[0].duration, 7); assert.equal(p.plan.scenes[0].durationOverride, true);
});

test('transition mixes preserve manually assigned transitions', () => {
  const p = fixture(); p.plan.scenes[0].transition = 'wipeleft'; p.plan.scenes[0].transitionOverride = true;
  updateSettings(p, { transitionMix: { fadeblack: 0, fade: 100 } });
  assert.deepEqual(p.plan.scenes.map(s => s.transition), ['wipeleft', 'fade', 'fade']);
});

test('opening and saving a legacy project retains its existing page overrides', () => {
  const p = fixture();
  delete p.plan.scenes[0].durationOverride; p.plan.scenes[0].duration = 9;
  delete p.plan.scenes[0].transitionOverride; p.plan.scenes[0].transition = 'wipeleft';
  hydrateProject(p);
  restoreDocument(p, structuredClone(editorDocument(p)));
  updateSettings(p, { secondsPerScene: 6, transitionMix: { fadeblack: 0, fade: 100 } });
  assert.equal(p.plan.scenes[0].duration, 9);
  assert.equal(p.plan.scenes[0].transition, 'wipeleft');
});

test('caption clearing propagates through persisted media references and undo restores them', () => {
  const p = hydrateProject(JSON.parse(JSON.stringify(fixture()))), before = structuredClone(editorDocument(p));
  p.photos.forEach(photo => { photo.caption = ''; });
  assert.equal(p.plan.scenes[0].photos[0].caption, '');
  const saved = structuredClone(editorDocument(p)); restoreDocument(p, saved);
  assert.equal(p.plan.scenes[0].photos[0], p.photos[0]);
  restoreDocument(p, before); assert.equal(p.plan.scenes[0].photos[0].caption, '第一张');
});

test('restoring state preserves assets, media order, and actual video length', () => {
  const p = fixture(), document = structuredClone(editorDocument(p));
  p.photos[0].file = 'assets/source.jpg';
  document.scenes.reverse(); document.photos.reverse();
  document.scenes[0].duration = 4;
  restoreDocument(p, document);
  assert.equal(p.plan.scenes[0].duration, 7.4);
  assert.equal(p.photos.at(-1).file, 'assets/source.jpg');
});

test('invalid documents cannot drop or duplicate assets or hide them in quote scenes', () => {
  for (const mutate of [d => d.photos.pop(), d => { d.scenes[1].photos = ['a']; }, d => { d.scenes[0].kind = 'quote'; }, d => { d.scenes[0].photos.push('b'); }]) {
    const p = fixture(), d = structuredClone(editorDocument(p)); mutate(d);
    assert.throws(() => restoreDocument(p,d), { status: 400 });
  }
});

test('timeline has no implicit cover and includes every video frame interval', () => {
  const p = fixture(), timeline = buildTimeline(p);
  assert.equal(timeline.length, 3); assert.equal(timeline[0].start, 0);
  assert.ok(Math.abs(timeline.at(-1).end - 14.84) < 0.0001);
  assert.equal(timeline[2].duration, 7.4);
  assert.equal(entryAt(timeline,timeline[2].start), 2);
  p.settings.includeCover = true; assert.equal(buildTimeline(p).length, 4);
});

test('short video transition overlaps stay within both clips', () => {
  assert.equal(transitionOverlap(4, .2, .48), .1);
  assert.equal(transitionOverlap(.2, 4, .48), .1);
});

test('unsupported options and custom dimensions are normalized', () => {
  const s = normalizeSettings({ outputFormat:'unknown', outputWidth:1921, secondsPerScene:80, style:'unknown' });
  assert.equal(s.outputFormat,'landscape'); assert.equal(s.outputWidth,1920); assert.equal(s.secondsPerScene,30); assert.equal(s.style,'film');
});
