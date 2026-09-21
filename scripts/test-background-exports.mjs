// Run only against an isolated server on port 4182. Arguments: runtime, photo, video.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import {buildTimeline} from '../lib/timeline.mjs';
import {styleRects,frameGeometry} from '../lib/style-catalog.mjs';

const [directory,photoPath,videoPath]=process.argv.slice(2);
assert.ok(directory&&photoPath&&videoPath,'Supply isolated runtime, photo and video paths');
const runtime=path.resolve(directory);
assert.ok(runtime.startsWith(path.resolve(os.tmpdir())+path.sep)||runtime.startsWith('/tmp/'));
const run=promisify(execFile), base='http://127.0.0.1:4182';
const request=async(route,options)=>{const response=await fetch(base+route,options);const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;};
const body=value=>({headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const samples=await Promise.all([photoPath,videoPath].map(file=>readFile(file)));
const near=(actual,expected,tolerance=4)=>assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<=tolerance),JSON.stringify({actual,expected}));
const pixel=async(file,left,top)=>[...await sharp(file).extract({left,top,width:1,height:1}).removeAlpha().raw().toBuffer()];
const frameAt=async(file,time)=> (await run('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],{encoding:'buffer',maxBuffer:20*1024*1024})).stdout;
let originalPhotoPixel;
for(const custom of [null,'#000000','#234a65']){
  const form=new FormData();
  form.append('photos',new Blob([samples[0]],{type:'image/jpeg'}),'couple.jpg');
  form.append('photos',new Blob([samples[1]],{type:'video/mp4'}),'full-video.mp4');
  for(const [key,value] of Object.entries({title:'拍立得 · '+(custom||'模板默认'),style:'polaroid',secondsPerScene:2,includeCover:true}))form.append(key,String(value));
  let p=await request('/api/projects',{method:'POST',body:form});
  p=await request('/api/projects/'+p.id+'/settings',{method:'PATCH',...body({baseRevision:p.revision,settings:{backgroundColor:custom,outputFormat:custom==='#234a65'?'custom':'landscape',outputWidth:640,outputHeight:640}})});
  assert.equal(p.settings.backgroundColor,custom);
  console.log('Rendering',custom||'default',p.id);
  let job=await request('/api/projects/'+p.id+'/render',{method:'POST'});
  const deadline=Date.now()+120000;
  while(job.status==='running'&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,500));job=await request('/api/projects/'+p.id+'/render');}
  assert.equal(job.status,'done',job.message);
  const frames=path.join(runtime,'projects',p.id,'frames');
  const photoFile=path.join(frames,'frame-001.jpg');
  const rect=styleRects(p.settings,p.plan.scenes[0].layout)[0], geometry=frameGeometry(p.settings,rect);
  near(await pixel(photoFile,rect.x+10,rect.y+100),[255,253,246]);
  const imagePixel=await pixel(photoFile,rect.x+geometry.left+100,rect.y+geometry.top+100);
  if(originalPhotoPixel)near(imagePixel,originalPhotoPixel,1);else originalPhotoPixel=imagePixel;
  const movie=path.join(runtime,job.output);
  const probe=JSON.parse((await run('ffprobe',['-v','error','-show_entries','format=duration:stream=width,height','-of','json',movie])).stdout);
  assert.ok(Math.abs(Number(probe.format.duration)-buildTimeline(p).at(-1).end)<.1);
  const motion=path.join(frames,'motion-002.mp4');
  const duration=Number((await run('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',motion])).stdout);
  assert.ok(Math.abs(duration-p.photos[1].duration)<.05);
  if(custom){
    const rgb=[1,3,5].map(i=>parseInt(custom.slice(i,i+2),16));
    near(await pixel(photoFile,100,100),rgb);
    near(await pixel(path.join(frames,'frame-title.jpg'),100,100),rgb);
    near(await pixel(await frameAt(motion,.8),100,100),rgb);
    near(await pixel(await frameAt(movie,1),100,100),rgb);
    if(custom==='#234a65'){
      assert.equal(probe.streams[0].width,640);assert.equal(probe.streams[0].height,640);
      // Outside the 16:9 composition: letterboxing must use the same custom color.
      near(await pixel(await frameAt(movie,1),30,30),rgb);
    }
  }
  const summary=(await request('/api/projects')).find(item=>item.id===p.id);
  assert.equal(summary.previewSettings.backgroundColor,custom);
  console.log('PASS',JSON.stringify({id:p.id,color:custom,duration:Number(probe.format.duration),sourceVideo:duration,output:job.output}));
}
