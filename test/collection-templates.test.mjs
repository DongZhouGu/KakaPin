import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { COLLECTION_STYLES, COLLECTION_LAYOUTS, templateUnderlaySvg, templateDecorationSvg, mediaMaskSvg } from '../lib/template-art.mjs';
import { transitionClip, transitionFilter, transitionEdge, galleryPhases, galleryAmount, galleryExpression, focusRect } from '../lib/template-motion.mjs';
import { buildPlan } from '../lib/layout-engine.mjs';
import { sceneRects, frameGeometry } from '../lib/style-catalog.mjs';
import { hydrateProject, normalizeSettings, updateSettings, editorDocument, restoreDocument, applyReflow, excludeMedia, TRANSITIONS } from '../lib/project-state.mjs';

test('six original constructions render without text, sprocket holes, or rotated photos', async () => {
  assert.deepEqual(COLLECTION_STYLES.map(s => s.id), ['contact','scrapbook','magazine','album','gallery','ink']);
  for (const style of COLLECTION_STYLES) {
    assert.ok(TRANSITIONS.includes(style.recommendedTransition));
    const artifacts = [templateUnderlaySvg(style.id), templateDecorationSvg(style.id, COLLECTION_LAYOUTS[style.id]['grid-quad'])].filter(Boolean);
    assert.ok(artifacts.length || style.id === 'gallery');
    for (const svg of artifacts) {
      assert.doesNotMatch(svg, /<text|<animate|<script|<image|rotate|sprocket/);
      const { info } = await sharp(Buffer.from(svg)).png().toBuffer({resolveWithObject:true});
      assert.deepEqual([info.width, info.height], [1920,1080]);
    }
  }
});
test('brush mask is deterministic and has opaque photo interior with transparent ragged edges', async () => {
  const svg = mediaMaskSvg('ink',800,450);
  assert.equal(svg, mediaMaskSvg('ink',800,450));
  const {data,info} = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha = (x,y) => data[(y*info.width+x)*4+3];
  assert.equal(alpha(400,225),255); assert.equal(alpha(0,0),0);
  assert.ok(Array.from({length:800},(_,x)=>alpha(x,8)).some(a=>a===0));
  assert.ok(Array.from({length:800},(_,x)=>alpha(x,8)).some(a=>a===255));
});
test('collection frames preserve portrait and mixed aspect ratios without a sideways crop', () => {
  const portrait=Array.from({length:4},()=>({width:720,height:1080}));
  for (const style of COLLECTION_STYLES) for (const photos of [portrait,[portrait[0],{width:1600,height:900},{width:800,height:800},portrait[1]]]) {
    const rects=sceneRects({style:style.id},'grid-quad',photos);
    if (photos===portrait) assert.equal(new Set(rects.map(r=>r.y)).size,1);
    rects.forEach((rect,i)=>{
      const geometry=frameGeometry({style:style.id},rect);
      assert.ok(Math.abs(geometry.width/geometry.height - photos[i].width/photos[i].height)<.01);
      assert.equal(geometry.width%2,0); assert.equal(geometry.height%2,0);
      assert.ok(rect.x>=0 && rect.y>=0 && rect.x+rect.w<=1920 && rect.y+rect.h<=1080);
    });
  }
});
test('four-photo reflow, exclusion, save and undo preserve order and complete videos', () => {
  const photos = Array.from({length:9},(_,i)=>({id:'p'+i,type:'image',width:1200,height:800,caption:''}));
  photos.splice(5,0,{id:'v',type:'video',width:640,height:960,duration:7.7});
  const settings = normalizeSettings({style:'gallery',photoGrouping:'single',includeCover:false});
  const project = hydrateProject({photos,settings,plan:buildPlan(photos,settings)});
  const original = structuredClone(editorDocument(project));
  applyReflow(project,'grid');
  assert.deepEqual(project.plan.scenes.map(s=>s.photos.length),[4,1,1,4]);
  assert.deepEqual(project.plan.scenes.flatMap(s=>s.photos.map(p=>p.id)),photos.map(p=>p.id));
  assert.equal(project.plan.scenes[2].duration,7.7);
  restoreDocument(project,structuredClone(editorDocument(project)));
  excludeMedia(project,['p1']);
  assert.equal(project.plan.scenes[0].layout,'editorial-trio');
  restoreDocument(project,original);
  assert.equal(project.plan.scenes.length,10);
});
test('template choice and recommendations do not overwrite manual settings', () => {
  const photos=[{id:'1',type:'image',width:1200,height:800},{id:'2',type:'image',width:1200,height:800}];
  const settings=normalizeSettings({photoGrouping:'single'});
  const project=hydrateProject({photos,settings,plan:buildPlan(photos,settings)});
  project.plan.scenes[0].transition='slideleft'; project.plan.scenes[0].transitionOverride=true;
  project.plan.scenes[0].duration=12; project.plan.scenes[0].durationOverride=true;
  updateSettings(project,{style:'album',transitionMix:Object.fromEntries(TRANSITIONS.map(t=>[t,t==='pagefold'?100:0]))});
  assert.equal(project.plan.scenes[0].duration,12);
  assert.equal(project.plan.scenes[0].transition,'slideleft');
  assert.equal(project.plan.scenes[1].transition,'pagefold');
  restoreDocument(project,structuredClone(editorDocument(project)));
  assert.equal(project.plan.scenes[1].transition,'pagefold');
});
test('new transition masks have correct endpoints and matching FFmpeg directions', () => {
  for (const type of ['pagefold','inkreveal']) {
    assert.equal(transitionClip(type,0),'inset(0 100% 0 0)');
    assert.equal(transitionClip(type,1),'inset(0)');
    assert.match(transitionClip(type,.5),/^polygon/);
    assert.match(transitionFilter(type,.72,2),/transition=custom/);
    assert.ok(transitionEdge(type,.5,.5)>0 && transitionEdge(type,.5,.5)<1);
  }
  assert.match(transitionFilter('inkreveal',.72,2), /lte\(X,/);
  assert.match(transitionFilter('pagefold',.72,2), /gte\(X,/);
  assert.equal(transitionFilter('fade',.72,2),'xfade=transition=fade:duration=0.72:offset=2');
});
test('gallery focus is seek-safe, returns to grid, and never animates a video', () => {
  const scene={kind:'photos',duration:8,photos:[{type:'image'},{type:'image'},{type:'image'},{type:'image'}]};
  const phases=galleryPhases(scene);
  assert.equal(phases.length,4);
  for (const phase of phases) {
    assert.equal(galleryAmount(phase,0),0); assert.equal(galleryAmount(phase,8),0);
    assert.equal(galleryAmount(phase,(phase.start+phase.end)/2),1);
    assert.equal(galleryAmount(phase,phase.start),0);
    assert.match(galleryExpression(phase), /pow\(sin/);
    const rect={x:128,y:66,w:800,h:450},target={x:96,y:54,w:1728,h:972};
    assert.deepEqual(focusRect(rect,0,target),rect); assert.deepEqual(focusRect(rect,1,target),target);
  }
  assert.deepEqual(galleryPhases({...scene,photos:[{type:'video'}]}),[]);
  assert.deepEqual(galleryPhases({...scene,kind:'cover'}),[]);
});
