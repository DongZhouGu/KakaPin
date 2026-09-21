import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlan} from '../lib/layout-engine.mjs';
import {normalizeSettings,hydrateProject,editorDocument,restoreDocument,excludeMedia,restoreMedia,applyReflow,updateSettings} from '../lib/project-state.mjs';
import {buildTimeline} from '../lib/timeline.mjs';
import {projectSummary} from '../lib/project-summary.mjs';

function fixture(){
  const photos=[
    {id:'a',type:'image',width:900,height:1400,name:'a.jpg',caption:'A',file:'assets/a.jpg',thumb:'/a.jpg'},
    {id:'b',type:'image',width:900,height:1400,name:'b.jpg',caption:'B',file:'assets/b.jpg',thumb:'/b.jpg'},
    {id:'v',type:'video',width:900,height:1400,name:'v.mp4',duration:6.4,caption:'V',file:'assets/v.mp4',thumb:'/v.jpg'},
    {id:'c',type:'image',width:1800,height:1000,name:'c.jpg',caption:'C',file:'assets/c.jpg',thumb:'/c.jpg'},
  ];
  const settings=normalizeSettings({style:'polaroid',backgroundColor:'#000000',includeCover:true,secondsPerScene:4});
  return hydrateProject({id:'test',photos,settings,plan:buildPlan(photos,settings)});
}

test('exclusion adapts only the affected group and retains source files, captions, timing and other pages',()=>{
  const p=fixture(), before=structuredClone(editorDocument(p));
  p.plan.scenes[0].duration=9;p.plan.scenes[0].durationOverride=true;
  p.plan.scenes[0].transition='wipeleft';p.plan.scenes[0].transitionOverride=true;
  excludeMedia(p,['a','unknown','a']);
  assert.deepEqual(p.photos.map(p=>p.id),['b','v','c']);
  assert.equal(p.plan.scenes[0].layout,'solo-portrait');
  assert.equal(p.plan.scenes[0].duration,9);assert.equal(p.plan.scenes[0].transition,'wipeleft');
  assert.deepEqual(editorDocument(p).scenes.slice(1),before.scenes.slice(1));
  assert.equal(p.excludedPhotos[0].file,'assets/a.jpg');assert.equal(p.excludedPhotos[0].caption,'A');
  assert.equal(buildTimeline(p)[0].scene.photos[0].id,'b','cover must not use excluded media');
  assert.equal(projectSummary(p).thumb,'/b.jpg');assert.equal(projectSummary(p).excludedCount,1);
});

test('bulk exclusion removes empty pages, does not reorder survivors, and supports exact undo/redo',()=>{
  const p=fixture(), before=structuredClone(editorDocument(p));
  excludeMedia(p,['a','b','v']);
  const removed=structuredClone(editorDocument(p));
  assert.deepEqual(p.plan.scenes.map(s=>s.photos.map(p=>p.id)),[['c']]);
  restoreDocument(p,removed);assert.deepEqual(editorDocument(p),removed);
  restoreDocument(p,before);assert.deepEqual(editorDocument(p),before);
  assert.equal(p.photos[2].file,'assets/v.mp4');
  restoreDocument(p,removed);assert.deepEqual(editorDocument(p),removed);
});

test('empty projects have no implicit cover, preview media or nonzero duration',()=>{
  const p=fixture();excludeMedia(p,p.photos.map(x=>x.id));
  assert.equal(p.photos.length,0);assert.equal(p.plan.scenes.length,0);
  assert.equal(p.excludedPhotos.length,4);assert.deepEqual(buildTimeline(p),[]);
  restoreDocument(p,structuredClone(editorDocument(p)));
  const summary=projectSummary(p);
  assert.equal(summary.previewScene,null);assert.equal(summary.thumb,undefined);assert.equal(summary.duration,0);
});

test('rejoining appends solo pages with unique ids and full videos without touching other pages',()=>{
  const p=fixture();excludeMedia(p,['a','b','v']);
  const survivor=structuredClone(editorDocument(p).scenes);
  restoreMedia(p,['v','a','b']);
  assert.deepEqual(p.photos.map(x=>x.id),['c','a','b','v']);
  assert.deepEqual(editorDocument(p).scenes.slice(0,1),survivor);
  assert.ok(p.plan.scenes.every(s=>s.photos.length===1));
  assert.equal(new Set(p.plan.scenes.map(s=>s.id)).size,p.plan.scenes.length);
  assert.equal(p.plan.scenes.at(-1).duration,6.4);assert.equal(p.excludedPhotos.length,0);
  restoreDocument(p,structuredClone(editorDocument(p)));
  assert.equal(p.photos.at(-1).caption,'V');
});

test('global regrouping and caption changes do not accidentally reactivate or overwrite excluded assets',()=>{
  const p=fixture();excludeMedia(p,['a','v']);
  const excluded=structuredClone(p.excludedPhotos);
  updateSettings(p,{secondsPerScene:12,layoutDefaults:{single:'solo-wide'}});
  applyReflow(p,'single',false);
  p.photos.forEach(p=>p.caption='');
  restoreDocument(p,structuredClone(editorDocument(p)));
  assert.deepEqual(p.excludedPhotos,excluded);
  assert.deepEqual(p.photos.map(x=>x.id),['b','c']);
  restoreMedia(p,['v']);assert.equal(p.plan.scenes.at(-1).duration,6.4);
});

test('state validation rejects lost, duplicate, unknown or secretly active excluded assets without mutation',()=>{
  const mutators=[
    d=>d.excludedPhotos.pop(),
    d=>d.excludedPhotos.push(d.photos[0]),
    d=>d.excludedPhotos.push({id:'unknown'}),
    d=>d.scenes[0].photos.push(d.excludedPhotos[0].id),
    d=>{d.excludedPhotos={};},
    d=>{d.photos[0]=null;delete d.excludedPhotos;},
  ];
  for(const mutate of mutators){
    const p=fixture();excludeMedia(p,['a']);
    const before=structuredClone(editorDocument(p)), bad=structuredClone(before);mutate(bad);
    assert.throws(()=>restoreDocument(p,bad),{status:400});
    assert.deepEqual(editorDocument(p),before);
  }
});

test('archive restore uses server-owned source metadata and older documents retain the existing archive',()=>{
  const p=fixture();excludeMedia(p,['a']);
  const d=structuredClone(editorDocument(p));d.excludedPhotos[0].file='/untrusted';
  restoreDocument(p,d);assert.equal(p.excludedPhotos[0].file,'assets/a.jpg');
  const legacy=structuredClone(editorDocument(p));delete legacy.excludedPhotos;
  restoreDocument(p,legacy);assert.equal(p.excludedPhotos[0].id,'a');
  restoreMedia(p,['a']);assert.equal(p.photos.at(-1).file,'assets/a.jpg');
});
