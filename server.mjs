import express from "express";
import multer from "multer";
import sharp from "sharp";
import { spawn, execFile } from "node:child_process";
import { mkdir, readFile, writeFile, access, unlink, rename, readdir } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildPlan } from "./lib/layout-engine.mjs";
import { hydrateProject, restoreDocument, updateSettings, normalizeSettings, TRANSITIONS } from "./lib/project-state.mjs";
import { transitionOverlap } from "./lib/timeline.mjs";
import { projectSummary } from "./lib/project-summary.mjs";
import { STYLE_IDS, getStyle, styleRects, sceneRects, frameGeometry, sepiaMatrix, videoGrade, backdropSvg, backgroundTextColor } from "./lib/style-catalog.mjs";
import { readRuntimeConfig, inspectTools } from './lib/runtime-config.mjs';
import { templateUnderlaySvg, templateDecorationSvg, mediaMaskSvg, COLLECTION_STYLES } from './lib/template-art.mjs';
import { galleryPhases, galleryExpression, transitionFilter } from './lib/template-motion.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const runtimeConfig = await readRuntimeConfig(root);
const runtimeTools = await inspectTools(runtimeConfig);
const runtimeDir = runtimeConfig.runtimeDir;
const projectsDir = path.join(runtimeDir, "projects");
const outputsDir = path.join(runtimeDir, "outputs");
const incomingDir = path.join(runtimeDir, "incoming");
const momoFontPath = runtimeConfig.font;
const OUTPUT_PRESETS = {
  landscape: { width: 1920, height: 1080 },
  landscape4k: { width: 3840, height: 2160 },
  vertical: { width: 1080, height: 1920 },
  vertical4k: { width: 2160, height: 3840 },
  square: { width: 1080, height: 1080 },
  portrait4x5: { width: 1080, height: 1350 },
};
const app = express();
await mkdir(projectsDir, { recursive: true });
await mkdir(outputsDir, { recursive: true });
await mkdir(incomingDir, { recursive: true });

const upload = multer({
  dest: incomingDir,
  // Wedding source videos are often high-bitrate 4K MOV files. Keep this high;
  // processing remains streamed to disk rather than held in memory.
  limits: { fileSize: 8 * 1024 * 1024 * 1024, files: 1001 },
});
const jobs = new Map();
const execFileAsync = promisify(execFile);

function even(value, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < 320 || number > 7680) return fallback;
  return number % 2 === 0 ? number : number - 1;
}

function outputSpec(settings = {}) {
  if (settings.outputFormat === "custom") {
    return { width: even(settings.outputWidth, 1920), height: even(settings.outputHeight, 1080) };
  }
  return OUTPUT_PRESETS[settings.outputFormat] || OUTPUT_PRESETS.landscape;
}

app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(root, "public")));
app.use("/modules", express.static(path.join(root, "lib")));
app.use("/media", express.static(projectsDir));
app.use("/outputs", express.static(outputsDir));
app.get("/assets/momo.ttf", (_req, res) => momoFontPath ? res.sendFile(momoFontPath) : res.status(404).end());

function cleanName(name) {
  return name.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-100);
}

function readableName(name) {
  // Multipart filenames arrive as Latin-1 in Busboy by default. Decode valid
  // UTF-8 only; leave genuine Unicode and non-UTF-8 names untouched.
  if (!name || /[^\u0000-\u00ff]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? name : decoded;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

async function processUpload(file, index, dir, projectId) {
  file.originalname = readableName(file.originalname);
  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const filename = `${String(index + 1).padStart(3, "0")}-${cleanName(path.basename(file.originalname, ext))}${ext}`;
  const assetPath = path.join(dir, "assets", filename);
  const isVideo = file.mimetype.startsWith("video/") || [".mp4", ".mov", ".m4v", ".webm"].includes(ext);
  let thumb;
  let preview;
  let meta;
  let duration = null;

  await rename(file.path, assetPath);
  if (isVideo) {
    const { stdout } = await execFileAsync(runtimeConfig.ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", assetPath], { maxBuffer: 1024 * 1024, windowsHide: true });
    const probe = JSON.parse(stdout);
    meta = probe.streams?.[0] || {};
    duration = Number(probe.format?.duration || 0);
    thumb = `${String(index + 1).padStart(3, "0")}.jpg`;
    await run("ffmpeg", ["-ss", String(Math.min(1, duration * 0.15)), "-i", assetPath, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "4", "-y", path.join(dir, "thumbs", thumb)]);
    preview = `assets/${filename}`;
  } else {
    const rawMeta = await sharp(assetPath).metadata();
    meta = { width: rawMeta.width, height: rawMeta.height };
    thumb = `${String(index + 1).padStart(3, "0")}.webp`;
    preview = `previews/${String(index + 1).padStart(3, "0")}.webp`;
    const image = sharp(assetPath);
    await Promise.all([
      image.clone().resize(360, 260, { fit: "cover", position: "attention" }).webp({ quality: 74, effort: 2 }).toFile(path.join(dir, "thumbs", thumb)),
      image.clone().resize({ width: 1600, height: 1080, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 2 }).toFile(path.join(dir, preview)),
    ]);
  }

  return {
    id: crypto.randomUUID(),
    name: file.originalname,
    type: isVideo ? "video" : "image",
    file: `assets/${filename}`,
    url: `/media/${projectId}/${preview}`,
    thumb: `/media/${projectId}/thumbs/${thumb}`,
    thumbFile: `thumbs/${thumb}`,
    width: meta.width,
    height: meta.height,
    duration,
  };
}

async function saveProject(project) {
  project.updatedAt = new Date().toISOString();
  project.revision = (Number(project.revision) || 0) + 1;
  const filename = path.join(projectsDir, project.id, "project.json");
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(project, null, 2));
  await rename(temporary, filename);
}

async function loadProject(id) {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Object.assign(new Error("项目不存在"), { status: 404 });
  const project = JSON.parse(await readFile(path.join(projectsDir, id, "project.json"), "utf8"));
  [...project.photos, ...(project.excludedPhotos || [])].forEach(photo => { photo.name = readableName(photo.name); });
  if (project.music) project.music.name = readableName(project.music.name);
  return hydrateProject(project);
}


const projectWrites = new Map();
function serialise(handler) {
  return async (req, res, next) => {
    const id = req.params.id;
    const previous = projectWrites.get(id) || Promise.resolve();
    let release;
    const complete = new Promise(resolve => { release = resolve; });
    const tail = previous.then(() => complete);
    projectWrites.set(id, tail);
    await previous;
    try { await handler(req, res, next); }
    catch (error) { next(error); }
    finally { release(); if (projectWrites.get(id) === tail) projectWrites.delete(id); }
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, app: 'kakapin', instance: runtimeConfig.instance, ffmpeg: runtimeTools.ffmpeg.available, tools: runtimeTools }));

app.get("/api/projects", async (_req, res, next) => {
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    const projects = await mapLimit(entries.filter(entry => entry.isDirectory()), 4, async entry => {
      try {
        const p = await loadProject(entry.name);
        return projectSummary(p);
      } catch { return null; }
    });
    res.json(projects.filter(Boolean).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  } catch (error) { next(error); }
});

app.get("/api/projects/:id", async (req, res, next) => {
  try { res.json(await loadProject(req.params.id)); } catch (error) { next(error); }
});

app.put("/api/projects/:id/state", serialise(async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (Number(req.body.baseRevision || 0) !== Number(project.revision || 0)) {
      return res.status(409).json({ error: "项目已在其他窗口修改。请先保留当前编辑，再重新打开项目。" });
    }
    restoreDocument(project, req.body.document || {});
    await saveProject(project);
    res.json({ revision: project.revision, updatedAt: project.updatedAt });
  } catch (error) { next(error); }
}));

app.patch("/api/projects/:id/settings", serialise(async (req, res, next) => {
  try {
    const current = await loadProject(req.params.id);
    if (req.body.baseRevision !== undefined && Number(req.body.baseRevision) !== Number(current.revision || 0)) {
      return res.status(409).json({ error: '项目已在其他窗口更新，请关闭此窗口、刷新项目列表后重试。' });
    }
    const project = updateSettings(current, req.body.settings || {});
    await saveProject(project);
    res.json(project);
  } catch (error) { next(error); }
}));

app.post("/api/projects", upload.fields([{ name: "photos", maxCount: 1000 }, { name: "music", maxCount: 1 }]), async (req, res, next) => {
  try {
    const files = req.files?.photos || [];
    if (!files.length) return res.status(400).json({ error: "请至少选择一张照片" });
    const id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
    const dir = path.join(projectsDir, id);
    await mkdir(path.join(dir, "assets"), { recursive: true });
    await mkdir(path.join(dir, "thumbs"), { recursive: true });
    await mkdir(path.join(dir, "previews"), { recursive: true });
    await mkdir(path.join(dir, "frames"), { recursive: true });

    const photos = await mapLimit(files, 4, (file, index) => processUpload(file, index, dir, id));

    let music = null;
    const musicFile = req.files?.music?.[0];
    if (musicFile) {
      const ext = path.extname(musicFile.originalname).toLowerCase() || ".mp3";
      const filename = `music${ext}`;
      await writeFile(path.join(dir, filename), await readFile(musicFile.path));
      await unlink(musicFile.path).catch(() => {});
      music = { name: musicFile.originalname, file: filename };
    }

    const captionLines = String(req.body.captions || "").split(/\r?\n/);
    photos.forEach((photo, index) => { photo.caption = (captionLines[index] || "").trim(); });

    const settings = {
      title: req.body.title || "我们的婚礼",
      subtitle: req.body.subtitle || "",
      date: req.body.date || "",
      style: STYLE_IDS.includes(req.body.style) ? req.body.style : "film",
      filmTemplate: ["colorprint", "matteblack", "silverblack", "none"].includes(req.body.filmTemplate) ? req.body.filmTemplate : "colorprint",
      outputFormat: ["landscape", "landscape4k", "vertical", "vertical4k", "square", "portrait4x5", "custom"].includes(req.body.outputFormat) ? req.body.outputFormat : "landscape",
      outputWidth: even(req.body.outputWidth, 1920),
      outputHeight: even(req.body.outputHeight, 1080),
      renderQuality: req.body.renderQuality === "high" ? "high" : "fast",
      secondsPerScene: Number(req.body.secondsPerScene) || 4.2,
      includeCover: req.body.includeCover === "true",
      showCaptions: true,
      transitionMix: {
        fadeblack: Math.max(0, Number(req.body.transitionBlack) || 0),
        fade: Math.max(0, Number(req.body.transitionFade) || 0),
        fadewhite: Math.max(0, Number(req.body.transitionWhite) || 0),
        slideleft: Math.max(0, Number(req.body.transitionPush) || 0),
        wipeleft: Math.max(0, Number(req.body.transitionWipe) || 0),
        vertopen: Math.max(0, Number(req.body.transitionSplit) || 0),
        circleopen: Math.max(0, Number(req.body.transitionZoom) || 0),
      },
    };
    const project = { id, createdAt: new Date().toISOString(), photos, music, settings: normalizeSettings(settings), plan: buildPlan(photos, settings) };
    await saveProject(project);
    res.json(project);
  } catch (error) {
    const uploaded = Object.values(req.files || {}).flat();
    await Promise.all(uploaded.map((file) => file.path ? unlink(file.path).catch(() => {}) : null));
    next(error);
  }
});

app.post("/api/projects/:id/media", upload.array("photos", 1000), serialise(async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!req.files?.length) return res.status(400).json({ error: "请选择照片或视频" });
    const dir = path.join(projectsDir, project.id);
    const assetCount = project.photos.length + project.excludedPhotos.length;
    const photos = await mapLimit(req.files, 4, (file, index) => processUpload(file, assetCount + index, dir, project.id));
    project.photos.push(...photos);
    const extra = buildPlan(photos, project.settings).scenes;
    extra.forEach(scene => { scene.id = `scene-${crypto.randomUUID()}`; });
    project.plan.scenes.push(...extra);
    await saveProject(project);
    res.json(project);
  } catch (error) {
    await Promise.all((req.files || []).map(file => unlink(file.path).catch(() => {})));
    next(error);
  }
}));

app.post("/api/projects/:id/music", upload.single("music"), serialise(async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!req.file) return res.status(400).json({ error: "请选择音频文件" });
    await execFileAsync(runtimeConfig.ffprobe, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", req.file.path], { windowsHide: true }).then(({ stdout }) => {
      if (!stdout.includes("audio")) throw Object.assign(new Error("文件中没有可用的音频"), { status: 400 });
    });
    const filename = `music-${crypto.randomUUID()}${path.extname(req.file.originalname).toLowerCase() || '.audio'}`;
    await rename(req.file.path, path.join(projectsDir, project.id, filename));
    project.music = { name: readableName(req.file.originalname), file: filename };
    await saveProject(project);
    res.json(project);
  } catch (error) { if (req.file) await unlink(req.file.path).catch(() => {}); next(error); }
}));

app.delete("/api/projects/:id/music", serialise(async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    // Detach only: keep the original audio on disk, like other source assets.
    project.music = null;
    await saveProject(project);
    res.json(project);
  } catch (error) { next(error); }
}));

app.post("/api/projects/:id/plan", serialise(async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    const byId = new Map(project.photos.map((photo) => [photo.id, photo]));
    const ordered = [...new Set(req.body.order || [])].map((id) => byId.get(id)).filter(Boolean);
    project.photos = ordered.length === project.photos.length ? ordered : project.photos;
    project.settings = normalizeSettings(req.body.settings, project.settings);
    project.plan = buildPlan(project.photos, project.settings);
    await saveProject(project);
    res.json(project);
  } catch (error) {
    next(error);
  }
}));

app.put("/api/projects/:id/captions", serialise(async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    const captions = Array.isArray(req.body.captions) ? req.body.captions : [];
    project.photos.forEach((photo, index) => {
      photo.caption = String(captions[index] || "").trim();
    });
    await saveProject(project);
    res.json(project);
  } catch (error) {
    next(error);
  }
}));

app.put("/api/projects/:id/scenes/:sceneId", serialise(async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    const scene = project.plan.scenes.find((item) => item.id === req.params.sceneId);
    if (!scene) return res.status(404).json({ error: "没有找到这一页" });
    const allowed = ["solo-wide", "solo-portrait", "portrait-duo", "editorial-trio", "hero-aside"];
    if (allowed.includes(req.body.layout) && scene.photos.length <= layoutRects(req.body.layout).length) {
      scene.layout = req.body.layout;
      scene.layoutOverride = true;
    }
    if (Number(req.body.duration) && !scene.photos.some(photo => photo.type === 'video')) {
      scene.duration = Math.max(2, Math.min(30, Number(req.body.duration)));
      scene.durationOverride = true;
    }
    if (TRANSITIONS.includes(req.body.transition)) { scene.transition = req.body.transition; scene.transitionOverride = true; }
    await saveProject(project);
    res.json(project);
  } catch (error) {
    next(error);
  }
}));

async function run(command, args, onProgress) {
  command = command === 'ffmpeg' ? runtimeConfig.ffmpeg : command;
  args = [...args];
  const filterIndex = args.indexOf('-filter_complex');
  let filterFile;
  // A filter file avoids Windows' command-line length limit on larger albums.
  if (filterIndex >= 0) {
    filterFile = path.join(incomingDir, 'filter-' + crypto.randomUUID() + '.txt');
    await writeFile(filterFile, args[filterIndex + 1]);
    args.splice(filterIndex, 2, '-filter_complex_script', filterFile);
  }
  try { return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      const line = chunk.toString();
      stderr = (stderr + line).slice(-12000);
      onProgress?.(line);
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} 退出码 ${code}\n${stderr}`)));
  }); } finally { if (filterFile) await unlink(filterFile).catch(() => {}); }
}

function escapeXml(value = "") {
  return String(value).replace(/[<>&\"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" })[char]);
}

async function captionLayer(text, rect, color = "#ead36d", paperBottom = 0) {
  if (!momoFontPath) throw new Error('缺少默陌字体：请将有使用权的字体放到 fonts/momo.ttf，重新启动后导出；或关闭画面小字。');
  const maxWidth = Math.max(120, Math.round(rect.w * 0.84));
  let textImage = await sharp({
    text: {
      text: `<span foreground="${color}">${escapeXml(text)}</span>`,
      font: "momozhuanji 20",
      dpi: 72,
      fontfile: momoFontPath,
      width: maxWidth,
      align: "center",
      rgba: true,
    },
  }).png().toBuffer();
  let meta = await sharp(textImage).metadata();
  const maxHeight = paperBottom ? Math.max(20, paperBottom - 16) : Math.max(30, Math.min(120, Math.round(rect.h * .18)));
  if (meta.height > maxHeight) {
    textImage = await sharp(textImage).resize({ height: maxHeight, withoutEnlargement: true }).png().toBuffer();
    meta = await sharp(textImage).metadata();
  }
  const left = Math.round(rect.x + (rect.w - meta.width) / 2);
  const top = paperBottom
    ? Math.round(rect.y + rect.h - paperBottom + (paperBottom - meta.height) / 2)
    : Math.max(rect.y + 12, Math.round(rect.y + rect.h - meta.height - 22));
  return sharp({ create: { width: 1920, height: 1080, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: textImage, left, top }])
    .png()
    .toBuffer();
}

async function filmSurfaceLayer() {
  const svg = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".82" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .10"/></feComponentTransfer></filter><radialGradient id="v"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".42"/></radialGradient><linearGradient id="warm"><stop stop-color="#b46d32" stop-opacity=".06"/><stop offset=".58" stop-color="#7e491f" stop-opacity=".02"/><stop offset="1" stop-color="#2b160d" stop-opacity=".08"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#warm)"/><rect width="100%" height="100%" filter="url(#grain)"/><rect width="100%" height="100%" fill="url(#v)"/><g fill="#fff" opacity=".13"><circle cx="330" cy="215" r="1.4"/><circle cx="1445" cy="180" r="1.2"/><circle cx="1210" cy="850" r="1.5"/><circle cx="735" cy="930" r="1"/></g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const FILM_TEMPLATES = {
  colorprint: path.join(root, "public", "assets", "film-templates", "color-print.png"),
  matteblack: path.join(root, "public", "assets", "film-templates", "matte-black.png"),
  silverblack: path.join(root, "public", "assets", "film-templates", "silver-black.png"),
};

function styleFor(project) {
  return getStyle(project.settings.style);
}

function templateFor(project) {
  if (project.settings.style !== "film") return null;
  return FILM_TEMPLATES[project.settings.filmTemplate] || null;
}

function rectsFor(project, layout, photos) {
  return sceneRects(project.settings, layout, photos);
}

function roundedMask(width, height, radius) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${radius}" fill="white"/></svg>`);
}

async function framedPhoto(filePath, rect, settings) {
  const style = getStyle(settings.style), geometry = frameGeometry(settings, rect);
  let photoPipe = sharp(filePath)
    .resize(geometry.width, geometry.height, { fit: "cover", position: COLLECTION_STYLES.some(s => s.id === style.id) ? 'centre' : "attention" })
    .modulate({ saturation: style.saturation, brightness: style.brightness });
  if (style.id === "film") {
    photoPipe = photoPipe.recomb([[1.03, 0.015, -0.01], [0.01, 0.99, 0], [-0.025, 0.025, 0.94]]).linear(0.97, 5);
  } else {
    if (style.sepia) photoPipe = photoPipe.recomb(sepiaMatrix(style.sepia));
    if (style.contrast !== 1) photoPipe = photoPipe.linear(style.contrast, 128 * (1 - style.contrast));
  }
  let photo = await photoPipe.ensureAlpha().png().toBuffer();
  if (geometry.innerRadius > 0) {
    photo = await sharp(photo).composite([{ input: roundedMask(geometry.width, geometry.height, geometry.innerRadius), blend: "dest-in" }]).png().toBuffer();
  }
  let card = await sharp({ create: { width: rect.w, height: rect.h, channels: 4, background: style.frame } })
    .composite([{ input: photo, left: geometry.left, top: geometry.top }]).png().toBuffer();
  if (geometry.radius > 0 || style.id === 'ink') {
    card = await sharp(card).composite([{ input: Buffer.from(mediaMaskSvg(style.id, rect.w, rect.h, geometry.radius)), blend: "dest-in" }]).png().toBuffer();
  }
  return card;
}

async function makeFrame(project, scene, framePath, index) {
  const style = styleFor(project);
  if (scene.kind === "quote") {
    if (project.settings.backgroundColor) {
      const quote = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${project.settings.backgroundColor}"/><text x="960" y="540" text-anchor="middle" dominant-baseline="middle" fill="${backgroundTextColor(project.settings)}" font-family="STKaiti, KaiTi, serif" font-size="64">${escapeXml(scene.quote)}</text></svg>`;
      await sharp(Buffer.from(quote)).jpeg({ quality: 95 }).toFile(framePath);
      return;
    }
    const quoteSvg = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><defs><filter id="n"><feTurbulence baseFrequency=".68" numOctaves="3"/><feComponentTransfer><feFuncA type="table" tableValues="0 .1"/></feComponentTransfer></filter></defs><rect width="100%" height="100%" fill="#070707"/><rect width="100%" height="100%" filter="url(#n)" opacity=".52"/><g fill="#fff" opacity=".72"><circle cx="340" cy="230" r="2"/><circle cx="1550" cy="310" r="3"/><circle cx="1270" cy="780" r="2"/><circle cx="520" cy="830" r="2"/></g><text x="960" y="520" text-anchor="middle" fill="#f4efe8" font-family="STKaiti, KaiTi, serif" font-size="64" letter-spacing="5">${escapeXml(scene.quote)}</text><text x="960" y="610" text-anchor="middle" fill="#b69a66" font-family="Arial" font-size="16" letter-spacing="10">TOGETHER · FOREVER</text><path d="M640 430 Q760 380 850 430" fill="none" stroke="#fff" stroke-opacity=".45"/></svg>`;
    await sharp(Buffer.from(quoteSvg)).jpeg({ quality: 95 }).toFile(framePath);
    return;
  }
  const filmLabels = "";
  const filmTemplate = templateFor(project);
  let background = filmTemplate
    ? await sharp(filmTemplate).resize(1920, 1080, { fit: "fill" }).ensureAlpha().png().toBuffer()
    : style.fresh || project.settings.backgroundColor ? await sharp(Buffer.from(backdropSvg(style.id, project.settings.backgroundColor))).png().toBuffer()
    : await sharp({ create: { width: 1920, height: 1080, channels: 4, background: style.background } })
    .composite([{
      input: Buffer.from(`<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><defs><filter id="n"><feTurbulence baseFrequency=".72" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer></filter><radialGradient id="leak" cx="100%" cy="15%" r="48%"><stop offset="0" stop-color="${style.accent}" stop-opacity=".3"/><stop offset="1" stop-color="${style.accent}" stop-opacity="0"/></radialGradient><radialGradient id="vig"><stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".52"/></radialGradient></defs><rect width="100%" height="100%" fill="${style.background}"/><g opacity="${project.settings.style === "film" ? ".5" : "0"}" fill="#fff"><circle cx="180" cy="150" r="2"/><circle cx="1580" cy="220" r="2"/><circle cx="380" cy="820" r="1.5"/><circle cx="1710" cy="760" r="2"/><path d="M1460 120l190 100" stroke="#fff" stroke-width="2" opacity=".32"/></g><rect width="100%" height="100%" filter="url(#n)" opacity=".42"/><rect width="100%" height="100%" fill="url(#leak)" opacity="${project.settings.style === "film" ? ".2" : ".08"}"/>${filmLabels}<rect width="100%" height="100%" fill="url(#vig)" opacity="${project.settings.style === "film" ? "1" : "0"}"/></svg>`),
      left: 0,
      top: 0,
    }])
    .png()
    .toBuffer();
  if (filmTemplate) {
    const blackAperture = Buffer.from(`<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><rect x="52" y="70" width="1816" height="940" rx="34" fill="${project.settings.backgroundColor || '#080808'}"/></svg>`);
    background = await sharp(background).composite([{ input: blackAperture, left: 0, top: 0 }]).png().toBuffer();
  }

  const rects = rectsFor(project, scene.layout, scene.photos);
  const overlays = [];
  const underlay = templateUnderlaySvg(style.id);
  if (underlay) overlays.push({ input: Buffer.from(underlay), left: 0, top: 0 });
  for (let i = 0; i < Math.min(scene.photos.length, rects.length); i += 1) {
    const photo = scene.photos[i];
    const rect = rects[i];
    const isVideo = photo.type === "video";
    const source = path.join(projectsDir, project.id, isVideo ? photo.thumbFile : photo.file);
    overlays.push({ input: await framedPhoto(source, rect, project.settings), left: rect.x, top: rect.y });
  }
  const captionOverlays = [];
  for (let i = 0; i < Math.min(scene.photos.length, rects.length); i += 1) {
    if (!scene.photos[i].caption || project.settings.showCaptions === false) continue;
    const paperBottom = style.paperCaption ? frameGeometry(project.settings, rects[i]).bottom : 0;
    captionOverlays.push({ input: await captionLayer(scene.photos[i].caption, rects[i], style.caption, paperBottom), left: 0, top: 0 });
  }
  const surfaceOverlays = project.settings.style === "film" ? [{ input: await filmSurfaceLayer(), left: 0, top: 0 }] : [];
  const decoration = templateDecorationSvg(style.id, rects.slice(0, scene.photos.length));
  if (decoration && !project.settings._videoPoster) surfaceOverlays.push({ input: Buffer.from(decoration), left: 0, top: 0 });
  const highQuality = project.settings.renderQuality === "high";
  const frameQuality = highQuality ? 98 : 90;
  await sharp(background).composite([...overlays, ...surfaceOverlays, ...captionOverlays]).jpeg({ quality: frameQuality, chromaSubsampling: highQuality ? "4:4:4" : "4:2:0" }).toFile(framePath);
}

async function makeVideoScene(project, scene, posterFrame, outputPath) {
  const photo = scene.photos.find((item) => item.type === "video");
  if (!photo) return null;
  const rect = rectsFor(project, scene.layout, scene.photos)[0];
  const geometry = frameGeometry(project.settings, rect);
  const { width, height } = geometry;
  const style = styleFor(project);
  const grade = videoGrade(style.id);
  const radius = geometry.innerRadius;
  const maskPath = outputPath.replace(/\.mp4$/, "-mask.png");
  const maskSvg = mediaMaskSvg(style.id, width, height, radius, true);
  await sharp(Buffer.from(maskSvg)).png().toFile(maskPath);
  const grain = "";
  const captionPath = outputPath.replace(/\.mp4$/, "-caption.png");
  const hasCaption = project.settings.showCaptions !== false && Boolean(photo.caption);
  if (hasCaption) {
    await writeFile(captionPath, await captionLayer(photo.caption, rect, style.caption, style.paperCaption ? geometry.bottom : 0));
  }
  const decoration = templateDecorationSvg(style.id, [rect]);
  const hasSurface = project.settings.style === "film" || Boolean(decoration);
  const surfacePath = outputPath.replace(/\.mp4$/, "-surface.png");
  if (hasSurface) await writeFile(surfacePath, decoration ? await sharp(Buffer.from(decoration)).png().toBuffer() : await filmSurfaceLayer());
  const filters = [`[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=30${grade}${grain},format=rgba,setpts=PTS-STARTPTS[clip]`, `[2:v]format=gray[mask]`, `[clip][mask]alphamerge[rounded]`, `[0:v][rounded]overlay=${rect.x + geometry.left}:${rect.y + geometry.top}:shortest=1[base]`];
  const videoArgs = ["-loop", "1", "-t", String(scene.duration), "-i", posterFrame, "-stream_loop", "-1", "-i", path.join(projectsDir, project.id, photo.file), "-loop", "1", "-t", String(scene.duration), "-i", maskPath];
  let current = "base";
  let inputIndex = 3;
  if (hasSurface) {
    videoArgs.push("-loop", "1", "-t", String(scene.duration), "-i", surfacePath);
    filters.push(`[${current}][${inputIndex}:v]overlay=0:0:shortest=1[filmed]`);
    current = "filmed";
    inputIndex += 1;
  }
  if (hasCaption) {
    videoArgs.push("-loop", "1", "-t", String(scene.duration), "-i", captionPath);
    filters.push(`[${current}][${inputIndex}:v]overlay=0:0:shortest=1[captioned]`);
    current = "captioned";
  }
  filters.push(`[${current}]format=yuv420p[out]`);
  videoArgs.push("-filter_complex", filters.join(";"), "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-t", String(scene.duration), "-pix_fmt", "yuv420p", "-y", outputPath);
  await run("ffmpeg", videoArgs);
  return outputPath;
}

async function makeGalleryScene(project, scene, posterFrame, outputPath) {
  if (project.settings.style !== 'gallery' || !project.settings.templateMotion) return null;
  const phases = galleryPhases(scene);
  if (!phases.length) return null;
  const rects = rectsFor(project, scene.layout, scene.photos);
  const args = ['-loop','1','-framerate','30','-t',String(scene.duration),'-i',posterFrame];
  const filters = ['[0:v]fps=30,format=yuv420p[grid]'];
  let current = 'grid';
  for (const phase of phases) {
    const i = phase.index, photo = scene.photos[i], rect = rects[i];
    const target = rectsFor(project, photo.width / photo.height < .82 ? 'solo-portrait' : 'solo-wide', [photo])[0];
    const cardPath = outputPath.replace(/\.mp4$/, '-focus-' + i + '.png');
    let card = await framedPhoto(path.join(projectsDir, project.id, photo.file), target, project.settings);
    if (photo.caption && project.settings.showCaptions) {
      const caption = await captionLayer(photo.caption, {...target, x:0, y:0}, '#ffffff');
      card = await sharp(card).composite([{input: await sharp(caption).extract({left:0,top:0,width:target.w,height:target.h}).png().toBuffer()}]).png().toBuffer();
    }
    await writeFile(cardPath, card);
    args.push('-loop','1','-framerate','30','-t',String(scene.duration),'-i',cardPath);
    const e = galleryExpression(phase), dimension = key => `${rect[key]}+${target[key]-rect[key]}*(${e})`;
    filters.push(`[${i+1}:v]scale=w='trunc((${dimension('w')})/2)*2':h='trunc((${dimension('h')})/2)*2':eval=frame,setsar=1[focus${i}]`);
    const color = '0x' + (project.settings.backgroundColor || getStyle('gallery').background).slice(1);
    filters.push(`[${current}]drawbox=x=${rect.x}:y=${rect.y}:w=${rect.w}:h=${rect.h}:color=${color}:t=fill:enable='between(t,${phase.start},${phase.end})'[cleared${i}]`);
    filters.push(`[cleared${i}][focus${i}]overlay=x='${dimension('x')}':y='${dimension('y')}':enable='between(t,${phase.start},${phase.end})':shortest=1[gallery${i}]`);
    current = 'gallery' + i;
  }
  args.push('-filter_complex',filters.join(';'),'-map','['+current+']','-an','-c:v','libx264','-preset','veryfast','-crf','18','-t',String(scene.duration),'-pix_fmt','yuv420p','-y',outputPath);
  await run('ffmpeg', args);
  return outputPath;
}

async function renderProject(project, job) {
  const frameDir = path.join(projectsDir, project.id, "frames");
  await mkdir(frameDir, { recursive: true });
  const titleFrame = path.join(frameDir, "frame-title.jpg");
  const titleStyle = styleFor(project);
  const customBackground = project.settings.backgroundColor;
  const titleText = customBackground ? backgroundTextColor(project.settings) : titleStyle.fresh ? titleStyle.text : project.settings.style === "film" ? "#f0e3d0" : project.settings.style === "french" ? "#3e3a34" : "#f5eee4";
  const titleSvg = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><defs><filter id="n"><feTurbulence baseFrequency=".7" numOctaves="3"/><feComponentTransfer><feFuncA type="table" tableValues="0 .1"/></feComponentTransfer></filter></defs><rect width="100%" height="100%" fill="${customBackground || titleStyle.fresh ? "none" : project.settings.style === "ceremony" ? "#861f24" : titleStyle.background}"/><rect width="100%" height="100%" filter="url(#n)" opacity="${customBackground || titleStyle.id === "black" ? "0" : ".42"}"/><rect x="70" y="70" width="1780" height="940" fill="none" stroke="${titleStyle.accent}" stroke-width="2" opacity="${titleStyle.id === "black" ? "0" : "1"}"/><text x="960" y="410" text-anchor="middle" fill="${titleText}" font-family="Georgia" font-size="104" letter-spacing="8">${escapeXml(project.settings.title)}</text><text x="960" y="505" text-anchor="middle" fill="${customBackground ? titleText : titleStyle.text}" font-family="Arial" font-size="25" letter-spacing="13">${escapeXml(project.settings.subtitle)}</text><line x1="790" y1="570" x2="1130" y2="570" stroke="${titleStyle.accent}"/><text x="960" y="650" text-anchor="middle" fill="${titleText}" font-family="Georgia" font-size="34" letter-spacing="5">${escapeXml(project.settings.date)}</text></svg>`;
  if (project.settings.style === "film" && project.photos[0]) {
    const coverScene = { kind: "photos", layout: project.photos[0].width / project.photos[0].height < 0.82 ? "solo-portrait" : "solo-wide", photos: [project.photos[0]], caption: "" };
    await makeFrame(project, coverScene, titleFrame, 0);
  } else if (titleStyle.fresh || customBackground) {
    await sharp(Buffer.from(backdropSvg(titleStyle.id, customBackground))).composite([{ input: Buffer.from(titleSvg) }]).jpeg({ quality: 96 }).toFile(titleFrame);
  } else {
    await sharp(Buffer.from(titleSvg)).jpeg({ quality: 96 }).toFile(titleFrame);
  }

  const sources = project.settings.includeCover === false ? [] : [{ path: titleFrame, video: false }];
  const durations = project.settings.includeCover === false ? [] : [3.6];
  for (let i = 0; i < project.plan.scenes.length; i += 1) {
    job.progress = Math.round(8 + (i / Math.max(1, project.plan.scenes.length)) * 32);
    job.message = `正在制作第 ${i + 1}/${project.plan.scenes.length} 页`;
    const frame = path.join(frameDir, `frame-${String(i + 1).padStart(3, "0")}.jpg`);
    const scene = project.plan.scenes[i];
    const sourceVideo = scene.photos.find((photo) => photo.type === "video");
    // Preserve full playback even for projects whose plan was created before
    // full-length video support was introduced.
    if (Number(sourceVideo?.duration) > 0) scene.duration = Number(sourceVideo.duration);
    // Captions are composited once after the moving image, including paper captions.
    const posterProject = sourceVideo ? { ...project, settings: { ...project.settings, showCaptions: false, _videoPoster: true } } : project;
    await makeFrame(posterProject, scene, frame, i);
    const videoPath = path.join(frameDir, `motion-${String(i + 1).padStart(3, "0")}.mp4`);
    const dynamic = await makeVideoScene(project, scene, frame, videoPath) || await makeGalleryScene(project, scene, frame, videoPath);
    sources.push({ path: dynamic || frame, video: Boolean(dynamic) });
    durations.push(scene.duration);
  }

  const tempVideo = path.join(outputsDir, `${project.id}-silent.mp4`);
  const finalVideo = path.join(outputsDir, `${project.id}-wedding-film.mp4`);
  const output = outputSpec(project.settings);
  const renderPreset = project.settings.renderQuality === "high" ? "slow" : "veryfast";
  const renderCrf = project.settings.renderQuality === "high" ? "16" : "20";
  const transition = project.plan.transitionDuration || 0.72;
  const args = [];
  for (let i = 0; i < sources.length; i += 1) {
    if (sources[i].video) args.push("-stream_loop", "-1", "-t", String(durations[i]), "-i", sources[i].path);
    else args.push("-loop", "1", "-t", String(durations[i]), "-i", sources[i].path);
  }
  const filters = [];
  for (let i = 0; i < sources.length; i += 1) {
    filters.push(sources[i].video
      ? `[${i}:v]fps=30,scale=1920:1080,trim=duration=${durations[i]},setpts=PTS-STARTPTS,format=yuv444p,setsar=1[v${i}]`
      : `[${i}:v]fps=30,scale=1920:1080:flags=lanczos,trim=duration=${durations[i]},setpts=PTS-STARTPTS,format=yuv444p,setsar=1[v${i}]`);
  }
  let last = "v0";
  let accumulated = durations[0];
  for (let i = 1; i < sources.length; i += 1) {
    const output = `x${i}`;
    const overlap = transitionOverlap(durations[i - 1], durations[i], transition);
    const offset = Math.max(0, accumulated - overlap).toFixed(3);
    const incomingScene = project.plan.scenes[project.settings.includeCover === false ? i : i - 1];
    const transitionName = incomingScene?.transition || "fadeblack";
    filters.push(`[${last}][v${i}]${transitionFilter(transitionName, overlap, offset)}[${output}]`);
    last = output;
    accumulated += durations[i] - overlap;
  }
  let finalLabel = last;
  if (output.width !== 1920 || output.height !== 1080) {
    finalLabel = "formatted";
    const paddingColor = project.settings.backgroundColor ? '0x' + project.settings.backgroundColor.slice(1) : 'black';
    filters.push(`[${last}]scale=${output.width}:${output.height}:force_original_aspect_ratio=decrease,pad=${output.width}:${output.height}:(ow-iw)/2:(oh-ih)/2:color=${paddingColor}[${finalLabel}]`);
  }
  args.push("-filter_complex", filters.join(";"), "-map", `[${finalLabel}]`, "-c:v", "libx264", "-preset", renderPreset, "-crf", renderCrf, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", tempVideo);
  job.progress = 45;
  job.message = "正在合成画面与转场";
  await run("ffmpeg", args, (line) => {
    const match = line.match(/frame=\s*(\d+)/);
    if (match) job.progress = Math.min(88, 45 + Math.round(Number(match[1]) / Math.max(1, accumulated * 30) * 43));
  });

  if (project.music) {
    job.message = "正在混合背景音乐";
    const musicPath = path.join(projectsDir, project.id, project.music.file);
    await run("ffmpeg", ["-i", tempVideo, "-stream_loop", "-1", "-i", musicPath, "-filter_complex", `[1:a]volume=0.42,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, accumulated - 3)}:d=3[a]`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-t", String(accumulated), "-movflags", "+faststart", "-y", finalVideo]);
  } else {
    await run("ffmpeg", ["-i", tempVideo, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-t", String(accumulated), "-movflags", "+faststart", "-y", finalVideo]);
  }
  await access(finalVideo);
  job.progress = 100;
  job.status = "done";
  job.message = "渲染完成";
  job.output = `/outputs/${path.basename(finalVideo)}`;
}

app.post("/api/projects/:id/render", async (req, res, next) => {
  try {
    const project = await loadProject(req.params.id);
    if (!project.plan.scenes.length) return res.status(400).json({ error: '影片里没有画面，请先添加或重新加入素材。' });
    if (!runtimeTools.ffmpeg.available || !runtimeTools.ffmpeg.compatible) return res.status(503).json({ error: 'FFmpeg 不可用或缺少 libx264 / xfade，请查看双击启动说明，安装后重新启动。' });
    if (!momoFontPath && project.settings.showCaptions && project.photos.some(p => p.caption)) return res.status(400).json({ error: '缺少默陌字体：请将授权字体放入 fonts/momo.ttf 后重启，或在全片设置中关闭画面小字。' });
    const existing = jobs.get(project.id);
    if (existing?.status === "running") return res.json(existing);
    const job = { id: project.id, status: "running", progress: 2, message: "正在准备照片" };
    jobs.set(project.id, job);
    renderProject(project, job).catch((error) => {
      console.error(error);
      job.status = "error";
      job.message = error.message.split("\n")[0];
    });
    res.json(job);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects/:id/render", (req, res) => res.json(jobs.get(req.params.id) || { status: "idle", progress: 0 }));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "单个素材超过 8GB，暂时无法导入" });
  }
  if (error?.code === "LIMIT_FILE_COUNT" || error?.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(413).json({ error: "一次最多导入 1000 项照片或视频" });
  }
  res.status(error.status || (error.code === "ENOENT" ? 404 : 500)).json({ error: error.code === "ENOENT" ? "找不到项目或素材文件" : error.message || "发生了未知错误" });
});

const port = runtimeConfig.port;
app.listen(port, '127.0.0.1', () => console.log(`KakaPin running at http://127.0.0.1:${port}`))
  .on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请更换端口或打开已经运行的 KakaPin。` : error); process.exitCode = 1; });
