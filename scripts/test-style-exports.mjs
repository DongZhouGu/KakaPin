// Run against a disposable instance only:
// PORT=4182 ALBUM_RUNTIME_DIR=/tmp/your-qa-directory node server.mjs
// node scripts/test-style-exports.mjs /tmp/your-qa-directory photo.jpg second-photo.jpg
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { LOOKS } from '../lib/style-catalog.mjs';
import { buildTimeline } from '../lib/timeline.mjs';

const [directory, first, second, ...requestedLookIds] = process.argv.slice(2);
assert.ok(directory && first && second, 'Supply an existing temporary QA runtime and two sample photos');
const runtime = path.resolve(directory);
assert.ok(runtime.startsWith(path.resolve(os.tmpdir()) + path.sep) || runtime.startsWith('/tmp/'), 'QA output must live in a temporary directory');
const run = promisify(execFile);
const base = 'http://127.0.0.1:4182';
const testLooks = requestedLookIds.length ? LOOKS.filter(look => requestedLookIds.includes(look.id)) : LOOKS;
assert.equal(testLooks.length, requestedLookIds.length || LOOKS.length, 'Unknown or duplicate look IDs');
const request = async (route, options) => {
  const response = await fetch(base + route, options);
  const result = await response.json();
  assert.ok(response.ok, JSON.stringify(result));
  return result;
};
const samples = await Promise.all([first,second].map(file => sharp(file).resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).jpeg().toBuffer()));
const samplePath = path.join(runtime, 'sample-photo.jpg');
await writeFile(samplePath, samples[0]);
const videoPath = path.join(runtime, 'sample-video.mp4');
await run('ffmpeg', ['-loop','1','-i',samplePath,'-t','1.4','-vf','scale=640:960:force_original_aspect_ratio=decrease,pad=640:960:(ow-iw)/2:(oh-ih)/2','-r','30','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-y',videoPath]);
const video = await readFile(videoPath);
const results = [];
for (const look of testLooks) {
  const form = new FormData();
  samples.forEach((buffer,i) => form.append('photos',new Blob([buffer],{type:'image/jpeg'}),'photo-' + i + '.jpg'));
  form.append('photos',new Blob([video],{type:'video/mp4'}),'full-video.mp4');
  for (const [key,value] of Object.entries({title:'模板测试 · ' + look.name,style:look.style,filmTemplate:look.filmTemplate || 'colorprint',secondsPerScene:2,includeCover:false,captions:'今天也值得珍藏\n\n完整播放'})) form.append(key,String(value));
  const project = await request('/api/projects',{method:'POST',body:form});
  assert.equal(project.settings.style, look.style);
  assert.equal(project.settings.includeCover,false);
  assert.equal(project.plan.scenes.at(-1).duration,1.4);
  console.log('Rendering',look.id,project.id);
  let job = await request('/api/projects/' + project.id + '/render',{method:'POST'});
  const deadline = Date.now() + 120000;
  while (job.status === 'running' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve,500));
    job = await request('/api/projects/' + project.id + '/render');
  }
  assert.equal(job.status,'done',look.id + ': ' + job.message);
  const outputPath = path.join(runtime,job.output);
  const probe = JSON.parse((await run('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height','-of','json',outputPath])).stdout);
  assert.equal(probe.streams[0].width,1920);
  assert.equal(probe.streams[0].height,1080);
  const expected = buildTimeline(project).at(-1).end;
  assert.ok(Math.abs(Number(probe.format.duration) - expected) < .1);
  const motionFile = path.join(runtime,'projects',project.id,'frames','motion-002.mp4');
  const duration = Number((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',motionFile])).stdout);
  assert.ok(Math.abs(duration - 1.4) < .05,'Source video duration must stay complete');
  results.push({look:look.id,name:look.name,id:project.id,output:job.output,duration:Number(probe.format.duration),frame:path.join(runtime,'projects',project.id,'frames','frame-001.jpg')});
  await writeFile(path.join(runtime,'results.json'),JSON.stringify(results,null,2));
  console.log('PASS',look.id,probe.format.duration + 's');
}
const tiles = [];
const contactCount = Math.min(6, results.length);
for (let i = 0; i < contactCount; i++) {
  const tile = await sharp(results[i].frame).resize(640,360).toBuffer();
  tiles.push({input:tile,left:(i%2)*640,top:Math.floor(i/2)*400});
  const label = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="40"><rect width="640" height="40" fill="#fff"/><text x="22" y="26" font-family="PingFang SC, sans-serif" font-size="18" fill="#333">' + results[i].name + '</text></svg>';
  tiles.push({input:Buffer.from(label),left:(i%2)*640,top:Math.floor(i/2)*400+360});
}
await sharp({create:{width:1280,height:Math.ceil(contactCount / 2)*400,channels:3,background:'#fff'}}).composite(tiles).png().toFile(path.join(runtime,'styles-contact.png'));
console.log('All ' + testLooks.length + ' requested looks exported successfully. Contact sheet:',path.join(runtime,'styles-contact.png'));
