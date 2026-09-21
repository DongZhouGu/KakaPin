import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildPlan } from '../lib/layout-engine.mjs';
import { STYLES, normalizeBackgroundColor, sceneBackground, backgroundTextColor, backdropSvg, frameGeometry, styleRects, getStyle } from '../lib/style-catalog.mjs';
import { normalizeSettings, hydrateProject, updateSettings, editorDocument, restoreDocument } from '../lib/project-state.mjs';
import { projectSummary } from '../lib/project-summary.mjs';

test('custom background accepts only canonical hex colors and defaults old projects to template colors', () => {
  assert.equal(normalizeBackgroundColor(' #aBc '),'#aabbcc');
  assert.equal(normalizeBackgroundColor('FFAA01'),'#ffaa01');
  assert.equal(normalizeSettings({}).backgroundColor,null);
  for (const bad of [null,{},42,'','red','transparent','#1234','#11223344','url(https://example.com)','"/><script/>']) {
    assert.equal(normalizeBackgroundColor(bad),null);
    assert.equal(normalizeSettings({backgroundColor:bad}).backgroundColor,null);
  }
  assert.equal(sceneBackground({style:'polaroid'}),getStyle('polaroid').background);
  assert.equal(sceneBackground({style:'polaroid',backgroundColor:'#000'}),'#000000');
});

test('background changes persist, undo and reset without changing frames, timing, captions or transitions', () => {
  const photos=[{id:'a',type:'image',width:900,height:1400,caption:'hello'},{id:'v',type:'video',width:900,height:1400,duration:8.4,caption:''}];
  const settings=normalizeSettings({style:'polaroid',includeCover:false});
  const p=hydrateProject({id:'test',photos,settings,plan:buildPlan(photos,settings)});
  p.plan.scenes[0].duration=9; p.plan.scenes[0].durationOverride=true;
  p.plan.scenes[0].transition='wipeleft'; p.plan.scenes[0].transitionOverride=true;
  const before=structuredClone(editorDocument(p));
  const rect=styleRects(p.settings,p.plan.scenes[0].layout)[0];
  const frame=frameGeometry(p.settings,rect);
  updateSettings(p,{backgroundColor:'#000'});
  restoreDocument(p,structuredClone(editorDocument(p)));
  assert.equal(p.settings.backgroundColor,'#000000');
  assert.deepEqual(editorDocument(p).scenes,before.scenes);
  assert.deepEqual(editorDocument(p).photos,before.photos);
  assert.deepEqual(frameGeometry(p.settings,rect),frame);
  assert.equal(getStyle(p.settings.style).frame,'#fffdf6');
  assert.equal(projectSummary(p).previewSettings.backgroundColor,'#000000');
  updateSettings(p,{style:'sage'}); assert.equal(p.settings.backgroundColor,'#000000');
  updateSettings(p,{backgroundColor:null}); assert.equal(sceneBackground(p.settings),getStyle('sage').background);
  restoreDocument(p,before); assert.deepEqual(editorDocument(p),before);
});

test('custom backdrops render exact solid colors while default template artwork remains unchanged', async () => {
  for (const style of STYLES) {
    assert.equal(backdropSvg(style.id),backdropSvg(style.id,null));
    for (const color of ['#000000','#234a65']) {
      const source=backdropSvg(style.id,color);
      assert.doesNotMatch(source, /filter|gradient|script|image|text/i);
      const pixel=await sharp(Buffer.from(source)).extract({left:100,top:100,width:1,height:1}).removeAlpha().raw().toBuffer();
      assert.deepEqual([...pixel],[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)));
    }
  }
});

test('cover and quote text remain readable over custom dark and light backgrounds', () => {
  assert.equal(backgroundTextColor({style:'polaroid',backgroundColor:'#000000'}),'#f5f5f5');
  assert.equal(backgroundTextColor({style:'polaroid',backgroundColor:'#ffffff'}),'#222222');
  assert.equal(backgroundTextColor({style:'polaroid'}),getStyle('polaroid').text);
});
