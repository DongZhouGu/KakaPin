import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { toolCandidates, readRuntimeConfig, inspectTools, runningInstance, instanceKey } from '../lib/runtime-config.mjs';

test('tool discovery uses native Windows separators, spaces and executable suffixes', () => {
  const candidates=toolCandidates('ffmpeg',{root:'C:\\我的相册\\Kaka Pin',platform:'win32',arch:'x64',env:{Path:'C:\\Program Files\\FFmpeg\\bin;D:\\tools'}});
  assert.ok(candidates.includes('C:\\我的相册\\Kaka Pin\\bin\\win32-x64\\ffmpeg.exe'));
  assert.ok(candidates.includes('C:\\Program Files\\FFmpeg\\bin\\ffmpeg.exe'));
  assert.ok(candidates.includes('D:\\tools\\ffmpeg.exe'));
  assert.ok(toolCandidates('ffprobe',{root:'/Users/test/Kaka Pin',platform:'darwin',arch:'arm64',env:{PATH:''}}).includes('/opt/homebrew/bin/ffprobe'));
});
test('portable runtime, explicit tool paths and font paths resolve from the app, not cwd', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'kakapin-config-test-'));
  await mkdir(path.join(root,'fonts'));
  await writeFile(path.join(root,'fonts','momo.ttf'),'test fixture, not an actual font');
  await writeFile(path.join(root,'kakapin.config.json'),JSON.stringify({port:4291,runtimeDir:'my projects',font:'fonts/momo.ttf',ffmpeg:'bin/ffmpeg',ffprobe:'bin/ffprobe'}));
  const config=await readRuntimeConfig(root,{});
  assert.equal(config.runtimeDir,path.join(root,'my projects'));
  assert.equal(config.font,path.join(root,'fonts','momo.ttf'));
  assert.equal(config.ffmpeg,path.join(root,'bin','ffmpeg'));
  assert.equal(config.port,4291);
  assert.equal(config.instance,instanceKey(root,config.runtimeDir));
  assert.notEqual(config.instance,instanceKey(root,path.join(root,'different')));
  const override=await readRuntimeConfig(root,{PORT:'4292',KAKAPIN_FONT:'missing.ttf'});
  assert.equal(override.port,4292); assert.equal(override.font,null);
  await assert.rejects(readRuntimeConfig(root,{PORT:'bad'}),/端口/);
});
test('missing binaries do not report a fake successful environment', async () => {
  const status=await inspectTools({ffmpeg:'/kakapin-test-missing/ffmpeg',ffprobe:'/kakapin-test-missing/ffprobe',font:null});
  assert.equal(status.ffmpeg.available,false); assert.equal(status.ffprobe.available,false); assert.equal(status.font.available,false);
});
test('existing unrelated HTTP services are detected without altering them', async () => {
  const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end('{"app":"unrelated"}');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const status=await runningInstance('http://127.0.0.1:'+server.address().port);
    assert.equal(status.occupied,true); assert.equal(status.health.app,'unrelated'); assert.equal(server.listening,true);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
test('double-click wrappers quote the app directory and preserve error messages', async () => {
  const mac=await readFile(new URL('../启动 KakaPin.command',import.meta.url),'utf8');
  const win=await readFile(new URL('../启动 KakaPin.bat',import.meta.url),'utf8');
  assert.match(mac,/cd -- "\$\(dirname -- "\$0"\)"/);
  assert.match(mac,/node scripts\/launch.mjs "\$@"/);
  assert.match(win,/cd \/d "%~dp0"/); assert.match(win,/pause/);
  assert.doesNotMatch(mac+win,/killall|taskkill|sudo|rm -rf/);
});
