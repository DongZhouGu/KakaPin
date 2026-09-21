import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { LAYOUTS, buildPlan } from '../lib/layout-engine.mjs';
import { STYLES, STYLE_IDS, LOOKS, TEMPLATE_GROUPS, getStyle, selectedLook, styleRects, frameGeometry, backdropSvg, videoGrade, sepiaMatrix } from '../lib/style-catalog.mjs';
import { normalizeSettings, hydrateProject, updateSettings, editorDocument, restoreDocument } from '../lib/project-state.mjs';

test('catalog exposes sixteen styles and nineteen distinct selectable looks', () => {
  assert.equal(STYLES.length, 16);
  assert.equal(STYLES.filter(s => s.fresh).length, 13);
  assert.equal(LOOKS.length, 19);
  assert.equal(new Set(LOOKS.map(look => look.id)).size, 19);
  for (const look of LOOKS) {
    assert.ok(STYLE_IDS.includes(look.style));
    assert.ok(TEMPLATE_GROUPS.some(group => group.id === look.group));
    assert.equal(selectedLook(normalizeSettings(look)).id, look.id);
  }
});

test('every look has bounded, positive, even photo and video apertures for all layouts', () => {
  for (const look of LOOKS) for (const [layout, base] of Object.entries(LAYOUTS)) {
    const rects = styleRects(look, layout);
    assert.equal(rects.length, base.length, look.id + '/' + layout);
    for (const rect of rects) {
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= 1920 && rect.y + rect.h <= 1080);
      const geometry = frameGeometry(look, rect);
      assert.ok(geometry.width > 80 && geometry.height > 80);
      assert.equal(geometry.width % 2, 0);
      assert.equal(geometry.height % 2, 0);
      assert.equal(geometry.left + geometry.width + geometry.right, rect.w);
      assert.equal(geometry.top + geometry.height + geometry.bottom, rect.h);
    }
  }
});

test('templates have distinct construction, not just a different background color', () => {
  const rect = {x:0,y:0,w:650,h:840};
  assert.ok(frameGeometry({style:'polaroid'}, rect).bottom > getStyle('polaroid').border * 3);
  assert.equal(frameGeometry({style:'editorial'}, rect).left, 0);
  assert.ok(getStyle('polaroid').paperCaption && getStyle('editorial').paperCaption);
  assert.equal(getStyle('noir').saturation, 0);
  assert.match(videoGrade('noir'), /saturation=0:/);
  assert.match(videoGrade('sepia'), /colorchannelmixer=/);
  assert.ok(frameGeometry({style:'blush'}, rect).innerRadius > 0);
  assert.deepEqual(sepiaMatrix(0), [[1,0,0],[0,1,0],[0,0,1]]);
});

test('new styles survive save, reload and undo without changing individual scenes or media', () => {
  for (const style of STYLES.filter(style => style.fresh)) {
    const photos = [{id:'p',type:'image',width:900,height:600,caption:''}, {id:'v',type:'video',width:900,height:600,duration:7.4,caption:''}];
    const settings = normalizeSettings({includeCover:false});
    const project = hydrateProject({photos,settings,plan:buildPlan(photos,settings)});
    project.plan.scenes[0].duration = 9;
    project.plan.scenes[0].durationOverride = true;
    project.plan.scenes[0].transition = 'wipeleft';
    project.plan.scenes[0].transitionOverride = true;
    const original = structuredClone(editorDocument(project));
    updateSettings(project, {style:style.id});
    restoreDocument(project, structuredClone(editorDocument(project)));
    assert.equal(project.settings.style, style.id);
    assert.deepEqual(project.plan.scenes.map(s => [s.id,s.layout,s.duration,s.transition]), original.scenes.map(s => [s.id,s.layout,s.duration,s.transition]));
    assert.equal(project.settings.includeCover, false);
    assert.equal(project.photos[0].caption, '');
    restoreDocument(project, original);
    assert.equal(project.settings.style, 'film');
  }
});

test('existing film frame geometry stays unchanged', () => {
  assert.deepEqual(styleRects({style:'film',filmTemplate:'colorprint'}, 'solo-wide'), [{x:78,y:88,w:1764,h:900}]);
  assert.deepEqual(styleRects({style:'film',filmTemplate:'none'}, 'solo-wide'), [{x:0,y:0,w:1920,h:1080}]);
  assert.equal(frameGeometry({style:'film',filmTemplate:'colorprint'},{w:1764,h:900}).innerRadius,34);
});

test('black cinema is borderless and ungraded, with a genuinely solid black backdrop', async () => {
  const style = getStyle('black');
  assert.equal(style.background, '#000000');
  assert.equal(style.frame, '#000000');
  assert.equal(style.cssFilter, 'none');
  assert.equal(videoGrade('black'), '');
  assert.equal(style.border, 0);
  assert.equal(style.radius, 0);
  assert.deepEqual([style.saturation, style.brightness, style.contrast, style.sepia], [1, 1, 1, 0]);
  const svg = backdropSvg('black');
  assert.doesNotMatch(svg, /filter|gradient|text|image|animate/i);
  const pixels = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer();
  assert.ok(pixels.every(value => value === 0));
});

test('all new backdrops rasterize and contain no mandatory text or time-based effects', async () => {
  for (const style of STYLES.filter(style => style.fresh)) {
    const source = backdropSvg(style.id);
    assert.equal(source, backdropSvg(style.id));
    assert.doesNotMatch(source, /<text|<animate|<script|<image/i);
    const { info } = await sharp(Buffer.from(source)).png().toBuffer({resolveWithObject:true});
    assert.equal(info.width,1920);
    assert.equal(info.height,1080);
  }
});
