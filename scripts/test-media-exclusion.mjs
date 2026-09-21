// Run against an isolated server on port 4182. Arguments: runtime, photo, video.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {hydrateProject,editorDocument,excludeMedia,restoreMedia} from '../lib/project-state.mjs';
import {buildTimeline} from '../lib/timeline.mjs';

const [directory,photoPath,videoPath]=process.argv.slice(2);
assert.ok(directory&&photoPath&&videoPath,'Supply isolated runtime, photo and video paths');
const runtime=path.resolve(directory),base='http://127.0.0.1:4182';
assert.ok(runtime.startsWith(path.resolve(os.tmpdir())+path.sep)||runtime.startsWith('/tmp/'));
const run=promisify(execFile);
async function request(route,options={},status=200){
  const response=await fetch(base+route,options),value=await response.json();
  assert.equal(response.status,status,JSON.stringify(value));return value;
}
const json=value=>({headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const photo=await readFile(photoPath),video=await readFile(videoPath);
const form=new FormData();
// Same names intentionally exercise index-based file naming after exclusion.
for(let i=0;i<3;i++)form.append('photos',new Blob([photo],{type:'image/jpeg'}),'same-name.jpg');
form.append('photos',new Blob([video],{type:'video/mp4'}),'video.mp4');
for(const [k,v] of Object.entries({title:'素材移出 API 回归',style:'polaroid',secondsPerScene:2,includeCover:true}))form.append(k,String(v));
let p=hydrateProject(await request('/api/projects',{method:'POST',body:form}));
const route='/api/projects/'+p.id,projectDir=path.join(runtime,'projects',p.id);
assert.equal(JSON.parse(await readFile(path.join(projectDir,'project.json'),'utf8')).id,p.id);
const original=structuredClone(editorDocument(p));
const assets=p.photos.flatMap(media=>[media.file,media.thumbFile,media.url.replace('/media/'+p.id+'/','')]);
const hash=async file=>createHash('sha256').update(await readFile(path.join(projectDir,file))).digest('hex');
const hashes=await Promise.all(assets.map(hash));
async function save(document=editorDocument(p)){
  const result=await request(route+'/state',{method:'PUT',...json({baseRevision:p.revision,document})});
  p=hydrateProject(await request(route));assert.equal(p.revision,result.revision);return p;
}

excludeMedia(p,p.photos.slice(0,2).map(p=>p.id));await save();
assert.equal(p.photos.length,2);assert.equal(p.excludedPhotos.length,2);
assert.equal(buildTimeline(p)[0].scene.photos[0].id,p.photos[0].id);
assert.ok(buildTimeline(p).every(e=>e.scene.photos.every(m=>p.photos.some(p=>p.id===m.id))));
const summary=(await request('/api/projects')).find(s=>s.id===p.id);
assert.equal(summary.count,2);assert.equal(summary.excludedCount,2);assert.equal(summary.thumb,p.photos[0].thumb);
const invalid=structuredClone(editorDocument(p));invalid.excludedPhotos.pop();
await request(route+'/state',{method:'PUT',...json({baseRevision:p.revision,document:invalid})},400);
assert.equal((await request(route)).revision,p.revision);
await request(route+'/state',{method:'PUT',...json({baseRevision:0,document:editorDocument(p)})},409);

let job=await request(route+'/render',{method:'POST'});
const deadline=Date.now()+120000;
while(job.status==='running'&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,500));job=await request(route+'/render');}
assert.equal(job.status,'done',job.message);
const duration=async file=>Number((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file])).stdout);
const movie=path.join(runtime,job.output),frames=path.join(projectDir,'frames');
assert.ok(Math.abs(await duration(movie)-buildTimeline(p).at(-1).end)<.1);
assert.ok(Math.abs(await duration(path.join(frames,'motion-002.mp4'))-p.photos[1].duration)<.05);
console.log('PASS active-only cover/export and complete video',job.output);

excludeMedia(p,p.photos.map(p=>p.id));await save();
assert.equal(buildTimeline(p).length,0);assert.equal(p.excludedPhotos.length,4);
await request(route+'/render',{method:'POST'},400);
await save(original);assert.deepEqual(editorDocument(p),original);
excludeMedia(p,p.photos.slice(0,3).map(p=>p.id));await save();
const append=new FormData();append.append('photos',new Blob([photo],{type:'image/jpeg'}),'same-name.jpg');
p=hydrateProject(await request(route+'/media',{method:'POST',body:append}));
assert.equal(p.photos.at(-1).file,'assets/005-same-name.jpg');
assert.deepEqual(await Promise.all(assets.map(hash)),hashes,'Exclusion/append must not alter source, preview or thumbnail files');
const survivorIds=p.photos.map(p=>p.id),oldScenes=structuredClone(editorDocument(p).scenes);
restoreMedia(p,p.excludedPhotos.map(p=>p.id));await save();
assert.deepEqual(p.photos.slice(0,2).map(p=>p.id),survivorIds);
assert.deepEqual(editorDocument(p).scenes.slice(0,2),oldScenes);
assert.equal(p.excludedPhotos.length,0);assert.equal(p.photos.length,5);
assert.equal(new Set(p.plan.scenes.map(s=>s.id)).size,p.plan.scenes.length);
assert.deepEqual(await Promise.all(assets.map(hash)),hashes);
console.log('PASS empty guard, exact undo, validation, append file safety, persisted restore',p.id);
