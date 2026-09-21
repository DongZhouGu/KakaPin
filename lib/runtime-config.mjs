import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const exists = async file => Boolean(file) && access(file).then(() => true, () => false);
export const instanceKey = (root, runtimeDir) => createHash('sha256').update(path.resolve(root) + '\n' + path.resolve(runtimeDir)).digest('hex').slice(0, 16);

export function toolCandidates(name, { root, platform = process.platform, arch = process.arch, env = process.env }) {
  const suffix = platform === 'win32' ? '.exe' : '';
  const paths = platform === 'win32' ? path.win32 : path.posix;
  return [
    paths.join(root, 'bin', platform + '-' + arch, name + suffix),
    paths.join(root, 'bin', name + suffix),
    ...(env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':').filter(Boolean).map(dir => paths.join(dir, name + suffix)),
    ...(platform === 'darwin' ? ['/opt/homebrew/bin/', '/usr/local/bin/'].map(dir => dir + name) : []),
  ];
}

async function findTool(name, explicit, context) {
  if (explicit) return path.isAbsolute(explicit) ? explicit : path.resolve(context.root, explicit);
  for (const file of toolCandidates(name, context)) if (await exists(file)) return file;
  return name; // execFile can still find a tool supplied by the calling environment.
}

export async function readRuntimeConfig(root, env = process.env) {
  let config = {};
  try { config = JSON.parse(await readFile(path.join(root, 'kakapin.config.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('kakapin.config.json 不是有效的 JSON：' + error.message); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('kakapin.config.json 必须是配置对象。');
  const port = Number(env.PORT || config.port || 4177);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口必须是 1024–65535 之间的整数。');
  const resolve = file => path.resolve(root, file);
  const runtimeDir = resolve(env.ALBUM_RUNTIME_DIR || config.runtimeDir || '.runtime');
  const context = { root, env };
  const ffmpeg = await findTool('ffmpeg', env.KAKAPIN_FFMPEG || config.ffmpeg, context);
  const ffprobe = await findTool('ffprobe', env.KAKAPIN_FFPROBE || config.ffprobe, context);
  const explicitFont = env.KAKAPIN_FONT || config.font;
  const fonts = explicitFont ? [resolve(explicitFont)] : [
    path.join(root, 'fonts', 'momo.ttf'), path.join(root, 'fonts', 'momo.otf'),
    path.join(os.homedir(), 'Library', 'Fonts', '1610522684528356.ttf'),
    path.join(os.homedir(), 'Library', 'Fonts', 'momo.ttf'),
    ...(env.LOCALAPPDATA ? [path.join(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts', 'momo.ttf')] : []),
  ];
  let font = null;
  for (const file of fonts) if (await exists(file)) { font = file; break; }
  return { port, runtimeDir, ffmpeg, ffprobe, font, instance: instanceKey(root, runtimeDir) };
}

export async function inspectTools(config) {
  const results = await Promise.all(['ffmpeg', 'ffprobe'].map(async name => {
    try {
      const { stdout } = await exec(config[name], ['-version'], { timeout: 8000, windowsHide: true });
      return [name, { available: true, version: stdout.split('\n')[0] }];
    } catch { return [name, { available: false }]; }
  }));
  const result = Object.fromEntries(results);
  if (result.ffmpeg.available) {
    try {
      const [{ stdout: encoders }, { stdout: filters }] = await Promise.all([
        exec(config.ffmpeg, ['-hide_banner', '-encoders'], { timeout: 8000, windowsHide: true }),
        exec(config.ffmpeg, ['-hide_banner', '-filters'], { timeout: 8000, windowsHide: true }),
      ]);
      result.ffmpeg.compatible = /\blibx264\b/.test(encoders) && /\bxfade\b/.test(filters);
    } catch { result.ffmpeg.compatible = false; }
  }
  return { ...result, font: { available: Boolean(config.font) } };
}

export async function runningInstance(url) {
  try {
    const response = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1200) });
    return { occupied: true, health: await response.json().catch(() => null) };
  } catch (error) {
    // Connection-refused means unused. A timeout is not permission to take a port.
    return { occupied: error.cause?.code !== 'ECONNREFUSED', health: null };
  }
}
