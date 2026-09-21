// Dedicated disposable-instance regression; never writes to the user's runtime.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { COLLECTION_STYLES } from '../lib/template-art.mjs';
import { TRANSITIONS } from '../lib/project-state.mjs';
import { buildTimeline } from '../lib/timeline.mjs';
import { instanceKey } from '../lib/runtime-config.mjs';
import { fileURLToPath } from 'node:url';
// runtime, four JPEG photos, a short MP4, and optional collection style IDs.
const [directory, first, second, third, fourth, video, ...ids]=process.argv.slice(2);
assert.ok(directory && first && second && third && fourth && video, 'Supply a temporary runtime, four JPEG paths, and a short MP4 path');
const runtime=path.resolve(directory);
assert.ok(runtime.startsWith(path.resolve(os.tmpdir()) + path.sep) || runtime.startsWith('/tmp/'), 'QA output must live in a temporary directory');
const styles=COLLECTION_STYLES.filter(style=>!ids.length||ids.includes(style.id));
assert.equal(styles.length,ids.length||COLLECTION_STYLES.length,'Unknown or duplicate collection IDs');
const base='http://127.0.0.1:4182', exec=promisify(execFile);
async function request(route, options) {
  const response=await fetch(base+route,options), body=await response.json();
  assert.ok(response.ok,JSON.stringify(body));return body;
}
const health=await request('/api/health'); assert.equal(health.app,'kakapin');
assert.equal(health.instance,instanceKey(fileURLToPath(new URL('../',import.meta.url)),runtime),'Port 4182 must belong to this source checkout and the supplied temporary runtime');
const files=['photo-1.jpg','photo-2.jpg','photo-3.jpg','photo-4.jpg','short-video.mp4'];
const buffers=await Promise.all([first,second,third,fourth,video].map(file=>readFile(file)));
const inputProbe=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','json',video])).stdout);
const inputDuration=Number(inputProbe.format.duration);
assert.ok(inputDuration>0 && inputDuration<=10,'Use a short test video (up to 10 seconds)');
const results=[];
for (const style of styles) {
  const form=new FormData();
  buffers.forEach((buffer,i)=>form.append('photos',new Blob([buffer],{type:i===4?'video/mp4':'image/jpeg'}),files[i]));
  form.append('style',style.id); form.append('title','珍藏模板测试 · '+style.name);form.append('includeCover','false');
  let project=await request('/api/projects',{method:'POST',body:form});
  project=await request('/api/projects/'+project.id+'/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({settings:{photoGrouping:'grid',secondsPerScene:6.4,transitionMix:Object.fromEntries(TRANSITIONS.map(t=>[t,t===style.recommendedTransition?100:0]))}})});
  assert.equal(project.plan.scenes[0].photos.length,4); assert.ok(Math.abs(project.plan.scenes[1].duration-inputDuration)<.05);
  console.log('Exporting',style.id,project.id);
  let job=await request('/api/projects/'+project.id+'/render',{method:'POST'});
  const deadline=Date.now()+180000;
  while (job.status==='running'&&Date.now()<deadline) {
    await new Promise(resolve=>setTimeout(resolve,700));job=await request('/api/projects/'+project.id+'/render');
  }
  assert.equal(job.status,'done',style.id+': '+job.message);
  const output=path.join(runtime,job.output);
  const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height','-of','json',output])).stdout);
  assert.deepEqual([probe.streams[0].width,probe.streams[0].height],[1920,1080]);
  const expected=buildTimeline(project).at(-1).end;
  assert.ok(Math.abs(Number(probe.format.duration)-expected)<.1);
  const frames=path.join(runtime,'projects',project.id,'frames');
  const duration=Number((await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',path.join(frames,'motion-002.mp4')])).stdout);
  assert.ok(Math.abs(duration-inputDuration)<.05);
  const result={style:style.id,name:style.name,id:project.id,output,duration:Number(probe.format.duration),frame:path.join(frames,'frame-001.jpg')};
  results.push(result);await writeFile(path.join(runtime,'collection-results.json'),JSON.stringify(results,null,2));
  console.log('PASS',style.id,result.duration+'s; video '+duration+'s');
}
const tiles=[];
for (const [i,r] of results.entries()) {
  tiles.push({input:await sharp(r.frame).resize(640,360).png().toBuffer(),left:i%2*640,top:Math.floor(i/2)*398});
  tiles.push({input:Buffer.from(`<svg width="640" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="38" fill="#f1f0eb"/><text x="16" y="25" fill="#333" font-size="17" font-family="PingFang SC,sans-serif">${r.name}</text></svg>`),left:i%2*640,top:Math.floor(i/2)*398+360});
}
await sharp({create:{width:1280,height:Math.ceil(results.length/2)*398,channels:3,background:'#f1f0eb'}}).composite(tiles).png().toFile(path.join(runtime,'collection-contact.png'));
console.log('Contact sheet:',path.join(runtime,'collection-contact.png'));
