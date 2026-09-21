import { spawn } from 'node:child_process';
import { access, mkdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { readRuntimeConfig, inspectTools, runningInstance, exists } from '../lib/runtime-config.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let child;
function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  const opener = spawn(command, [url], { stdio: 'ignore', windowsHide: true });
  opener.on('error', () => console.log('请在浏览器打开：' + url));
  opener.unref();
}
async function dependenciesReady() {
  try { await Promise.all(['express', 'multer', 'sharp'].map(name => import(name))); return true; }
  catch { return false; }
}
async function installDependencies() {
  if (checkOnly) throw new Error('尚未安装项目依赖。双击启动器并同意首次安装，或在项目目录运行 npm ci。');
  let approved = args.has('--install');
  if (!approved && process.stdin.isTTY) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    approved = /^y(es)?$/i.test((await prompt.question('首次运行需要联网安装项目依赖（不会安装系统软件）。继续？[y/N] ')).trim());
    prompt.close();
  }
  if (!approved) throw new Error('未安装依赖。准备好后重新双击启动，输入 y。');
  const nodeDir = path.dirname(await realpath(process.execPath));
  const candidates = [path.join(nodeDir, 'node_modules/npm/bin/npm-cli.js'), path.resolve(nodeDir, '../lib/node_modules/npm/bin/npm-cli.js')];
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    const npm = path.join(directory, 'npm');
    if (await exists(npm)) candidates.push(await realpath(npm));
  }
  let npmCli;
  for (const candidate of candidates) if (candidate.endsWith('.js') && await exists(candidate)) { npmCli = candidate; break; }
  if (!npmCli) throw new Error('未找到 npm。请使用 Node.js 官方安装包重新安装，或在项目目录运行 npm ci。');
  await new Promise((resolve, reject) => {
    const install = spawn(process.execPath, [npmCli, 'ci', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit', windowsHide: true });
    install.on('error', reject);
    install.on('exit', code => code === 0 ? resolve() : reject(new Error('依赖安装失败。检查网络后重新启动即可重试。')));
  });
  // A failed native import can be cached; validate in a fresh Node process.
  await new Promise((resolve, reject) => {
    const verify = spawn(process.execPath, ['--input-type=module', '-e', "await Promise.all(['express','multer','sharp'].map(x=>import(x)))"], { cwd: root, stdio: 'inherit', windowsHide: true });
    verify.on('error', reject);
    verify.on('exit', code => code === 0 ? resolve() : reject(new Error('本机依赖仍不可用。迁移系统时不要复制 node_modules，请重新 npm ci。')));
  });
}
async function main() {
  console.log('\nKakaPin · 本机相册影片\n');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node.js 22 或更新的 LTS 版本：https://nodejs.org/en/download');
  const config = await readRuntimeConfig(root);
  const url = 'http://127.0.0.1:' + config.port;
  if (!checkOnly) {
    const current = await runningInstance(url);
    if (current.occupied) {
      if (current.health?.app === 'kakapin' && current.health.instance === config.instance) {
        console.log('这个项目已经启动，正在打开：' + url);
        if (!args.has('--no-open')) openBrowser(url);
        return;
      }
      throw new Error('端口 ' + config.port + ' 已被其他服务或另一份 KakaPin 占用。不会关闭它。请修改 kakapin.config.json 的 port。');
    }
  }
  const status = await inspectTools(config);
  for (const name of ['ffmpeg', 'ffprobe']) {
    if (!status[name].available) throw new Error('未找到可运行的 ' + name + '。将 FFmpeg 解压后的 ffmpeg / ffprobe 放进 bin 目录，或在 kakapin.config.json 指定路径。详见「双击启动说明.md」。');
    console.log('✓ ' + name + ' 可用');
  }
  if (!status.ffmpeg.compatible) throw new Error('此 FFmpeg 缺少 libx264 编码器或 xfade 滤镜，请安装完整版本。');
  if (!await dependenciesReady()) await installDependencies();
  console.log('✓ Node.js 和项目依赖可用');
  console.log(status.font.available ? '✓ 默陌字体可用' : '提示：未找到默陌字体。无文字影片可以导出；需要小字时请把授权字体放到 fonts/momo.ttf。');
  await mkdir(config.runtimeDir, { recursive: true });
  await access(config.runtimeDir, constants.W_OK);
  if (checkOnly) { console.log('✓ 检查完成，未启动服务。'); return; }
  let ended = false;
  child = spawn(process.execPath, [path.join(root, 'server.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true });
  const completion = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => { ended = true; code === 0 || signal ? resolve() : reject(new Error('服务退出（' + code + '），请查看上方错误信息。')); });
  });
  completion.catch(() => {});
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { child?.kill(signal); });
  let ready = false;
  for (let i = 0; i < 40 && !ended; i++) {
    await delay(250);
    const result = await runningInstance(url);
    if (result.health?.instance === config.instance) { ready = true; break; }
  }
  if (!ready) { child.kill(); await completion.catch(() => {}); throw new Error('服务没有正常启动，请查看上方日志。'); }
  console.log('\n已启动：' + url + '\n使用期间保留此窗口。停止请按 Ctrl+C；不要在导出中途退出。\n');
  if (!args.has('--no-open')) openBrowser(url);
  await completion;
}
main().catch(error => { console.error('\n启动未完成：' + error.message + '\n'); process.exitCode = 1; });
