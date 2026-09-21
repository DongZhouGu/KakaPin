import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, defaultLayout } from '../lib/layout-engine.mjs';
import { normalizeSettings, hydrateProject, editorDocument, restoreDocument, previewLayoutDefaults, applyLayoutDefaults, previewReflow, applyReflow } from '../lib/project-state.mjs';
import { projectSummary } from '../lib/project-summary.mjs';
import { readWorkspace, saveWorkspacePlace } from '../lib/workspace-memory.mjs';

function fixture() {
  const photos = [
    { id:'a',type:'image',width:900,height:1400,caption:'one',thumb:'/a.webp',file:'assets/a.jpg' },
    { id:'b',type:'image',width:900,height:1400,caption:'two',thumb:'/b.webp' },
    { id:'v',type:'video',width:1800,height:1000,duration:8.4,caption:'video',thumb:'/v.webp' },
    { id:'c',type:'image',width:1800,height:1000,caption:'three',thumb:'/c.webp' },
    { id:'d',type:'image',width:1800,height:1000,caption:'four',thumb:'/d.webp' },
    { id:'e',type:'image',width:1800,height:1000,caption:'five',thumb:'/e.webp' },
  ];
  const settings = normalizeSettings({includeCover:false,style:'black',secondsPerScene:4});
  return hydrateProject({id:'test-project',revision:3,createdAt:'2026-09-20T10:00:00Z',photos,settings,plan:buildPlan(photos,settings)});
}

test('layout defaults normalize independently from grouping', () => {
  const settings = normalizeSettings({photoGrouping:'bogus',layoutDefaults:{single:'portrait-duo',pair:'hero-aside',video:'solo-portrait'}});
  assert.equal(settings.photoGrouping,'auto');
  assert.deepEqual(settings.layoutDefaults,{single:'auto',pair:'hero-aside',video:'solo-portrait'});
});

test('batch layouts preserve groups, captions, custom timing, transitions, full video and protected layouts', () => {
  const p=fixture();
  p.plan.scenes[0].layoutOverride=true;
  p.plan.scenes[2].duration=9; p.plan.scenes[2].durationOverride=true;
  p.plan.scenes[2].transition='wipeleft'; p.plan.scenes[2].transitionOverride=true;
  const before=structuredClone(editorDocument(p));
  const requested={single:'solo-portrait',pair:'hero-aside',video:'solo-portrait'};
  const preview=previewLayoutDefaults(p,requested);
  assert.equal(preview.protectedCount,1);
  assert.deepEqual(editorDocument(p),before, 'preview must not mutate');
  applyLayoutDefaults(p,requested);
  assert.equal(p.plan.scenes[0].layout,'portrait-duo');
  assert.equal(p.plan.scenes[1].layout,'solo-portrait');
  assert.equal(p.plan.scenes[1].duration,8.4);
  assert.equal(p.plan.scenes[2].duration,9);
  for(let i=0;i<p.plan.scenes.length;i++) {
    const s=p.plan.scenes[i], b=before.scenes[i];
    assert.equal(s.id,b.id); assert.equal(s.duration,b.duration); assert.equal(s.transition,b.transition);
    assert.deepEqual(s.photos.map(x=>x.id),b.photos);
  }
  assert.deepEqual(p.photos.map(x=>[x.id,x.caption]),before.photos.map(x=>[x.id,x.caption]));
  assert.equal(p.photos[0].file,'assets/a.jpg');
});

test('explicit layout replacement clears only layout overrides and survives save and undo', () => {
  const p=fixture(), first=p.plan.scenes[0];
  first.layoutOverride=true; first.transitionOverride=true;
  const before=structuredClone(editorDocument(p));
  applyLayoutDefaults(p,{pair:'hero-aside'},false);
  restoreDocument(p,structuredClone(editorDocument(p)));
  assert.equal(p.plan.scenes[0].layout,'hero-aside');
  assert.equal(p.plan.scenes[0].layoutOverride,false);
  assert.equal(p.plan.scenes[0].transitionOverride,true);
  restoreDocument(p,before);
  assert.equal(p.plan.scenes[0].layout,'portrait-duo');
  assert.equal(p.plan.scenes[0].layoutOverride,true);
});

test('legacy custom layouts are protected and new uploads follow saved defaults', () => {
  const p=fixture(); delete p.plan.scenes[2].layoutOverride; p.plan.scenes[2].layout='solo-portrait';
  hydrateProject(p); assert.equal(p.plan.scenes[2].layoutOverride,true);
  applyLayoutDefaults(p,{single:'solo-portrait',pair:'hero-aside',video:'solo-wide'});
  const added=buildPlan(p.photos,p.settings);
  assert.equal(added.scenes[0].layout,'hero-aside');
  assert.equal(added.scenes[2].layout,'solo-portrait');
  assert.equal(defaultLayout([p.photos[2]],p.settings),'solo-wide');
});

test('layout-only edits and undo preserve a legacy transition in an existing project', () => {
  const p=fixture();
  p.plan.scenes[0].transition='smoothleft'; p.plan.scenes[0].transitionOverride=true;
  const before=structuredClone(editorDocument(p));
  applyLayoutDefaults(p,{pair:'hero-aside'});
  restoreDocument(p,structuredClone(editorDocument(p)));
  assert.equal(p.plan.scenes[0].transition,'smoothleft');
  restoreDocument(p,before);
  assert.deepEqual(editorDocument(p),before);
});

test('single and pair regrouping keep ordered media exactly once and videos as full solo pages', () => {
  for(const grouping of ['single','pair','auto']) {
    const p=fixture(), before=structuredClone(editorDocument(p));
    const preview=previewReflow(p,grouping,false);
    assert.deepEqual(editorDocument(p),before);
    applyReflow(p,grouping,false);
    const scenes=p.plan.scenes;
    assert.deepEqual(scenes.flatMap(s=>s.photos.map(x=>x.id)),before.photos.map(x=>x.id));
    assert.equal(new Set(scenes.map(s=>s.id)).size,scenes.length);
    assert.ok(scenes.every(s=>s.photos.length <= (grouping==='single'?1:3)));
    const video=scenes.find(s=>s.photos.some(x=>x.id==='v'));
    assert.equal(video.photos.length,1); assert.equal(video.duration,8.4);
    if(grouping==='pair') assert.deepEqual(scenes.map(s=>s.photos.length),[2,1,2,1]);
    restoreDocument(p,structuredClone(editorDocument(p)));
    assert.equal(p.settings.photoGrouping,grouping);
    restoreDocument(p,before); assert.deepEqual(editorDocument(p),before);
  }
});

test('reflow keeps customized pages as anchors without resetting overrides or crossing video/text pages', () => {
  const p=fixture();
  p.plan.scenes[0].layout='hero-aside'; p.plan.scenes[0].layoutOverride=true;
  p.plan.scenes[2].duration=11; p.plan.scenes[2].durationOverride=true;
  p.plan.scenes[2].transition='circleopen'; p.plan.scenes[2].transitionOverride=true;
  const customized=structuredClone(p.plan.scenes[2]);
  const preview=previewReflow(p,'single',true); assert.equal(preview.protectedCount,2);
  applyReflow(p,'single',true);
  assert.equal(p.plan.scenes[0].photos.length,2); assert.equal(p.plan.scenes[0].layout,'hero-aside');
  const retained=p.plan.scenes.find(s=>s.id===customized.id);
  assert.equal(retained.duration,11); assert.equal(retained.transition,'circleopen');
  assert.equal(retained.transitionOverride,true);
  const quote={id:'quote',kind:'quote',quote:'Hello',photos:[],duration:3,transition:'fade',transitionOverride:true};
  p.plan.scenes.splice(3,0,quote);
  applyReflow(p,'pair',true);
  assert.equal(p.plan.scenes.find(s=>s.id==='quote').quote,'Hello');
  assert.equal(p.plan.scenes.find(s=>s.id==='quote').transition,'fade');
});

test('project summaries expose recognizable previews and timing, not original asset paths', () => {
  const p=fixture(), summary=projectSummary(p);
  assert.equal(summary.scenes,5); assert.equal(summary.videos,1);
  assert.ok(summary.duration>20); assert.equal(summary.previewScene.layout,'portrait-duo');
  assert.equal(summary.previewScene.photos.length,2);
  assert.equal(summary.previewSettings.showCaptions,false);
  assert.doesNotMatch(JSON.stringify(summary),/assets\/a.jpg/);
});

test('workspace remembers last opened, not last modified, and tolerates corrupt or denied storage', () => {
  let value=null; const storage={getItem:()=>value,setItem:(_key,next)=>{value=next;}};
  saveWorkspacePlace(storage,'one',{sceneId:'scene-3',offset:1.25,libraryTab:'templates',inspectorTab:'global'},true);
  saveWorkspacePlace(storage,'two',{sceneId:'scene-2',offset:2},true);
  saveWorkspacePlace(storage,'one',{offset:3});
  let state=readWorkspace(storage);
  assert.equal(state.lastProjectId,'two'); assert.equal(state.places.one.offset,3);
  assert.equal(state.places.one.sceneId,'scene-3'); assert.equal(state.places.one.inspectorTab,'global');
  value='bad json'; assert.deepEqual(readWorkspace(storage),{lastProjectId:null,places:{}});
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.doesNotThrow(()=>saveWorkspacePlace(denied,'one',{offset:1},true));
  assert.deepEqual(readWorkspace(denied),{lastProjectId:null,places:{}});
});
