import { applyTransitionMix, defaultLayout, LAYOUTS } from '/modules/layout-engine.mjs';
import { hydrateProject, editorDocument, restoreDocument, updateSettings, previewLayoutDefaults, applyLayoutDefaults, previewReflow, applyReflow, excludeMedia, restoreMedia, TRANSITIONS, LEGACY_TRANSITIONS } from '/modules/project-state.mjs';
import { buildTimeline, entryAt, COVER_ID } from '/modules/timeline.mjs';
import { STYLES, LOOKS, TEMPLATE_GROUPS, getStyle, selectedLook, hasFilmTemplate, styleRects, sceneRects, frameGeometry, backdropSvg, normalizeBackgroundColor, sceneBackground, backgroundTextColor } from '/modules/style-catalog.mjs';
import { readWorkspace, saveWorkspacePlace } from '/modules/workspace-memory.mjs';
import { templateUnderlaySvg, templateDecorationSvg, mediaMaskSvg } from '/modules/template-art.mjs';
import { transitionClip, pageFoldSvg, galleryPhases, galleryAmount, focusRect } from '/modules/template-motion.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copy = value => structuredClone(value);
const paths = {
  film: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>', redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  sliders: '<path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  export: '<path d="M12 16V3m-4 4 4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>', 'arrow-left': '<path d="M20 12H4m6-6-6 6 6 6"/>',
  shield: '<path d="m12 3 8 3v6c0 4-8 9-8 9s-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  text: '<path d="M4 5V3h16v2M12 3v18m-4 0h8"/>', plus: '<path d="M12 4v16M4 12h16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  ratio: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h4M7 9v4m10 2h-4m4 0v-4"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  'skip-back': '<path d="M5 5v14m14-14L8 12l11 7V5Z"/>', 'skip-forward': '<path d="M19 5v14M5 5l11 7-11 7V5Z"/>',
  play: '<path d="m8 4 12 8-12 8V4Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  minus: '<path d="M5 12h14"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.film) + '</svg>';
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });

const transitions = { fadeblack: '闪黑', fade: '淡化', fadewhite: '闪白', slideleft: '推进', wipeleft: '擦除', vertopen: '分割', circleopen: '圆形展开', pagefold: '纸页翻动', inkreveal: '水墨显影', smoothleft: '平滑推进（旧版）' };
const layouts = { 'solo-wide': '横向满幅', 'solo-portrait': '竖向居中', 'portrait-duo': '双图并排', 'editorial-trio': '三图组合', 'hero-aside': '主图拼贴', 'grid-quad': '四图网格' };
const presets = [
  { id: 'reference', name: '胶片记忆', note: '闪黑 · 干净利落', mix: [100, 0, 0, 0, 0, 0, 0] },
  { id: 'gentle', name: '柔和叙事', note: '淡化 · 舒缓衔接', mix: [20, 70, 10, 0, 0, 0, 0] },
  { id: 'ppt', name: '经典演示', note: '推进 / 擦除 / 分割', mix: [10, 20, 0, 30, 20, 10, 10] },
];
let project = null, selectedId = null, entries = [], time = 0, playing = false, raf = 0, lastTick = 0;
let version = 0, savedVersion = 0, savePromise = null, saveTimer = 0, saveError = '', saveConflict = false, undo = [], redo = [];
let visualVersion = 0, stageKey = '', inspectorTab = 'scene', libraryTab = 'media', filter = 'all';
let selectedFiles = [], newStyle = 'film', recent = [], draggedId = null, activeRenderId = null, pollTimer = 0;
let toastTimer = 0, musicAudio = null, busy = false;
let lastEdit = { key: null, at: 0 };
let batchDirty = false, templateGroup = 'all';
let navigationBusy = false, renameTarget = null, layoutDraft = null, regroupDraft = null;
let keepLayouts = true, keepReflow = true;
let mediaScope = 'active', selectingMedia = false, selectedMedia = new Set();
const groupingNames = { auto: '自动组合', single: '每张照片独立一页', pair: '每两张照片一页', grid: '每四张照片一页' };
let browserStorage;
try { browserStorage = window.localStorage; } catch { browserStorage = null; }
const workspace = () => readWorkspace(browserStorage);
function rememberPlace(opened = false) {
  if (!project || $('editorView').classList.contains('hidden')) return;
  const entry = entries.find(e => e.scene.id === selectedId);
  saveWorkspacePlace(browserStorage, project.id, { sceneId: selectedId, offset: Math.max(0, time - (entry?.start || 0)), libraryTab, inspectorTab }, opened);
}
function formatName(format, width, height) {
  return ({ landscape: '16:9 · 1080p', landscape4k: '16:9 · 4K', vertical: '9:16 · 1080p', vertical4k: '9:16 · 4K', square: '1:1', portrait4x5: '4:5' })[format] || (width && height ? width + ' × ' + height : '横版');
}
const backgroundUrls = new Map();
function backgroundUrl(settings) {
  const key = settings.style + ':' + (settings.backgroundColor || 'default');
  if (!backgroundUrls.has(key)) {
    if (backgroundUrls.size >= 80) backgroundUrls.delete(backgroundUrls.keys().next().value);
    backgroundUrls.set(key, 'data:image/svg+xml,' + encodeURIComponent(backdropSvg(settings.style, settings.backgroundColor)));
  }
  return backgroundUrls.get(key);
}
const total = () => entries.at(-1)?.end || 0;
const currentScene = () => project?.plan.scenes.find(s => s.id === selectedId);
const durationText = n => Number(n || 0).toFixed(1).replace(/\.0$/, '') + ' 秒';
const clock = n => { const s = Math.max(0, Math.floor(n || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const notify = message => { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3600); };
const handled = action => async (...args) => { try { await action(...args); } catch (error) { console.error(error); notify(error.message || '操作未完成，请重试'); } };
async function api(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, headers: { ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); }
  catch { throw new Error('无法连接本机服务，修改尚未保存。请检查服务后重试。'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || '操作失败（' + response.status + '）'), { status: response.status });
  return data;
}
function updateSaveStatus() {
  $('saveStatus').textContent = saveError ? (saveConflict ? '版本冲突 · 处理' : '保存失败 · 重试') : savePromise ? '保存中…' : version !== savedVersion ? '待保存' : '已自动保存';
  $('saveStatus').dataset.state = saveError ? 'error' : savePromise ? 'saving' : version !== savedVersion ? 'pending' : 'saved';
  $('saveStatus').classList.toggle('save-error', Boolean(saveError));
  $('saveStatus').title = saveError || '修改自动保存在本机';
  $('undoButton').disabled = !undo.length; $('redoButton').disabled = !redo.length;
}
async function flushSave() {
  clearTimeout(saveTimer);
  if (!project || version === savedVersion) return;
  if (savePromise) { await savePromise; if (version !== savedVersion) return flushSave(); return; }
  saveError = ''; saveConflict = false;
  savePromise = (async () => {
    while (version !== savedVersion) {
      const targetVersion = version;
      const result = await api('/api/projects/' + project.id + '/state', { method: 'PUT', body: JSON.stringify({ baseRevision: project.revision || 0, document: editorDocument(project) }) });
      project.revision = result.revision; project.updatedAt = result.updatedAt;
      savedVersion = targetVersion;
    }
  })();
  updateSaveStatus();
  try { await savePromise; } catch (error) { saveError = error.message; saveConflict = error.status === 409; throw error; }
  finally { savePromise = null; updateSaveStatus(); }
}
function markDirty() {
  version++; saveError = ''; updateSaveStatus();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave().catch(error => notify(error.message)), 450);
}
function commit(mutator, options = {}) {
  if (!project) return;
  pause();
  const before = copy(editorDocument(project));
  mutator();
  hydrateProject(project);
  if (JSON.stringify(before) === JSON.stringify(editorDocument(project))) return;
  $('layoutApplied').textContent = '';
  const grouped = options.editKey && options.editKey === lastEdit.key && Date.now() - lastEdit.at < 900;
  if (!grouped) undo.push(before);
  lastEdit = { key: options.editKey || null, at: Date.now() };
  if (undo.length > 40) undo.shift(); redo = [];
  markDirty();
  renderEditor(options);
}
function historyStep(direction) {
  const from = direction === 'undo' ? undo : redo;
  const to = direction === 'undo' ? redo : undo;
  if (!from.length || !project) return;
  pause(); lastEdit.key = null; layoutDraft = null; regroupDraft = null; $('layoutApplied').textContent = ''; to.push(copy(editorDocument(project)));
  restoreDocument(project, from.pop());
  markDirty(); renderEditor({ media: true });
}
function settingsChange(values, options) { commit(() => updateSettings(project, values), options); }
const svgUrl = svg => 'data:image/svg+xml,' + encodeURIComponent(svg);
const artMarkup = (svg, foreground = false) => svg ? '<img class="template-art' + (foreground ? ' foreground-art' : '') + '" src="' + esc(svgUrl(svg)) + '" alt="" draggable="false"/>' : '';
function frameMarkup(scene, settings, miniature = false) {
  const style = getStyle(settings.style), template = hasFilmTemplate(settings) ? settings.filmTemplate : null;
  const customBackground = normalizeBackgroundColor(settings.backgroundColor);
  let content = style.id === 'film' ? '' : '<img class="style-backdrop" src="' + esc(backgroundUrl(settings)) + '" alt="" draggable="false"/>';
  if (scene.kind === 'quote') content = '<div class="quote-card">' + esc(scene.quote) + '</div>';
  else if (scene.kind === 'cover' && style.id !== 'film') content += '<div class="title-page"><h3>' + esc(settings.title) + '</h3><p>' + esc(settings.subtitle) + '</p><time>' + esc(settings.date) + '</time></div>';
  else {
    if (template) content += '<div class="film-paper-template template-' + esc(template) + '"></div>';
    const rects = sceneRects(settings, scene.layout, scene.photos);
    content += artMarkup(templateUnderlaySvg(style.id));
    (scene.photos || []).forEach((photo, i) => {
      const r = rects[i]; if (!r) return;
      const g = frameGeometry(settings, r);
      const media = photo.type === 'video' && !miniature && scene.kind !== 'cover'
        ? '<video data-media-id="' + esc(photo.id) + '" src="' + esc(photo.url) + '" poster="' + esc(photo.thumb) + '" muted playsinline preload="auto"></video>'
        : '<img src="' + esc(photo.type === 'video' ? photo.thumb : miniature ? (style.group === 'collection' ? photo.url || photo.thumb : photo.thumb) : photo.url) + '" alt="" ' + (miniature ? 'loading="lazy" ' : '') + 'draggable="false"/>';
      const windowStyle = 'left:' + g.left/r.w*100 + '%;top:' + g.top/r.h*100 + '%;width:' + g.width/r.w*100 + '%;height:' + g.height/r.h*100 + '%;border-radius:' + g.innerRadius/19.2 + 'cqw';
      const captionStyle = style.paperCaption ? 'bottom:0;height:' + g.bottom/r.h*100 + '%;' : '';
      const mask = style.id === 'ink' ? ';mask-image:url(&quot;' + esc(svgUrl(mediaMaskSvg(style.id, r.w, r.h))) + '&quot;);mask-size:100% 100%' : '';
      content += '<div class="frame-card" style="left:' + r.x/19.2 + '%;top:' + r.y/10.8 + '%;width:' + r.w/19.2 + '%;height:' + r.h/10.8 + '%;border-radius:' + g.radius/19.2 + 'cqw' + mask + '"><div class="media-window" style="' + windowStyle + '">' + media + '</div>' + (!miniature && settings.showCaptions !== false && photo.caption ? '<div class="media-caption' + (style.paperCaption ? ' on-paper' : '') + '" style="' + captionStyle + '">' + esc(photo.caption) + '</div>' : '') + '</div>';
    });
    content += artMarkup(templateDecorationSvg(style.id, rects.slice(0, scene.photos.length)), true);
    if (!miniature && style.id === 'gallery' && settings.templateMotion) {
      for (const phase of galleryPhases(scene)) {
        const photo = scene.photos[phase.index];
        content += '<div class="gallery-floating" data-gallery-photo="' + phase.index + '" hidden><img src="' + esc(photo.url) + '" alt="" draggable="false"/>' + (settings.showCaptions && photo.caption ? '<div class="media-caption">' + esc(photo.caption) + '</div>' : '') + '</div>';
      }
    }
    if (style.id === 'film') content += '<div class="film-surface"></div>';
  }
  return '<div class="scene-content style-' + style.id + (template ? ' has-template' : '') + (customBackground ? ' custom-background' : '') + '" style="--paper:' + sceneBackground(settings) + ';--film-aperture:' + (customBackground || '#080808') + ';--card:' + style.frame + ';--style-text:' + backgroundTextColor(settings) + ';--style-accent:' + style.accent + ';--caption:' + style.caption + ';--photo-filter:' + style.cssFilter + '">' + content + '</div>';
}
function renderHomeStyles() {
  $('homeStyleCount').textContent = STYLES.length + ' 种风格 · 随时调整';
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#c8c7b9"/><circle cx="650" cy="165" r="76" fill="#eee4c9"/><path d="M0 390Q240 160 480 370T900 350V600H0" fill="#7d9185"/><path d="M0 500Q220 330 510 470T900 430V600H0" fill="#405e59"/></svg>');
  const thumb = recent.find(p => p.thumb)?.thumb || placeholder;
  const scene = { kind:'photos', layout:'solo-wide', photos:[{ type:'image', thumb }] };
  $('homeStyles').innerHTML = STYLES.map(s => '<button class="home-style ' + (newStyle === s.id ? 'selected' : '') + '" data-style="' + s.id + '" aria-pressed="' + (newStyle === s.id) + '"><span class="home-style-preview">' + frameMarkup(scene, { style:s.id, filmTemplate:'colorprint', showCaptions:false }, true) + '</span><strong>' + s.name + (s.group === 'collection' ? '<span class="new-style-badge">新</span>' : '') + '</strong><small>' + s.note + '</small></button>').join('');
}
function renderProjects() {
  const memory = workspace(), last = recent.find(p => p.id === memory.lastProjectId);
  $('resumeProject').classList.toggle('hidden', !last);
  if (last) {
    $('resumeTitle').textContent = last.title || '未命名项目';
    $('resumeDescription').textContent = last.count + ' 项素材 · ' + last.scenes + ' 个画面 · 恢复上次浏览位置';
    $('resumeButton').dataset.project = last.id;
  }
  const term = $('projectSearch').value.trim().toLocaleLowerCase();
  const list = recent.filter(p => (p.title + ' ' + p.id).toLocaleLowerCase().includes(term));
  const sort = $('projectSort').value;
  list.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'zh-CN') || b.updatedAt.localeCompare(a.updatedAt)
    : sort === 'opened' ? (memory.places[b.id]?.openedAt || 0) - (memory.places[a.id]?.openedAt || 0) || b.updatedAt.localeCompare(a.updatedAt)
    : b.updatedAt.localeCompare(a.updatedAt));
  $('projectCount').textContent = term ? list.length + ' / ' + recent.length : recent.length + ' 个';
  if (!list.length) {
    $('recentProjects').innerHTML = '<div class="project-empty">' + icon(term ? 'search' : 'film') + '<h3>' + (term ? '没有找到这个项目' : '你的第一部影片，从这里开始') + '</h3><p>' + (term ? '试试其他名称，或清空搜索查看全部项目。' : '导入照片和视频，原始文件会完整保留。') + '</p><button class="button secondary" data-project-empty="' + (term ? 'clear' : 'create') + '">' + (term ? '清空搜索' : '新建影片') + '</button></div>';
    return;
  }
  $('recentProjects').innerHTML = list.map(p => {
    const name = esc(p.title || '未命名项目');
    const preview = p.previewScene ? frameMarkup(p.previewScene, p.previewSettings, true) : p.thumb ? '<img src="' + esc(p.thumb) + '" alt="" loading="lazy"/>' : '<span class="project-empty-cover">没有参与影片的素材</span>';
    const updated = new Date(p.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const look = p.previewSettings ? selectedLook(p.previewSettings).name : getStyle(p.style).name;
    return '<article class="project-card"><button class="project-cover" data-project="' + esc(p.id) + '" aria-label="打开项目：' + name + '，' + p.count + ' 项素材，编号 ' + esc(p.id.slice(-6)) + '">' + preview + '<span class="project-duration">' + clock(p.duration) + '</span></button><div class="project-card-body"><div class="project-card-heading"><h3 title="' + name + '">' + name + '</h3><button class="icon-button" data-rename="' + esc(p.id) + '" aria-label="重命名：' + name + '，编号 ' + esc(p.id.slice(-6)) + '" title="重命名">' + icon('edit') + '</button></div><p class="project-card-spec">' + esc(look) + '<span>·</span>' + esc(formatName(p.outputFormat, p.width, p.height)) + '</p><p class="project-card-count">' + p.count + ' 项素材 · ' + p.scenes + ' 个画面' + (p.videos ? ' · ' + p.videos + ' 段视频' : '') + '</p><div class="project-card-footer"><span><time>' + esc(updated) + '</time><small>#' + esc(p.id.slice(-6)) + '</small></span><button class="text-button" data-project="' + esc(p.id) + '">继续编辑' + icon('arrow-right') + '</button></div></div></article>';
  }).join('');
}
async function loadRecent() {
  try { recent = await api('/api/projects'); renderHomeStyles(); renderProjects(); }
  catch (error) { $('recentProjects').innerHTML = '<p class="empty-copy">' + esc(error.message) + '，可点击右上角刷新重试。</p>'; }
}
async function requestOpenProject(id, historyMode = 'push') {
  if (navigationBusy || busy || !id) return;
  navigationBusy = true; $('projectOpenStatus').textContent = '正在打开项目…';
  $('recentProjects').setAttribute('aria-busy', 'true');
  try { await flushSave(); const data = await api('/api/projects/' + encodeURIComponent(id)); openProject(data, { historyMode }); }
  finally { navigationBusy = false; $('projectOpenStatus').textContent = ''; $('recentProjects').removeAttribute('aria-busy'); }
}
function selectLibrary(tab) {
  libraryTab = tab;
  document.querySelectorAll('[data-library]').forEach(b => { b.setAttribute('aria-selected', b.dataset.library === tab); b.tabIndex = b.dataset.library === tab ? 0 : -1; });
  ['media','templates','text'].forEach(t => $(t + 'Panel').classList.toggle('hidden', t !== tab));
  if (tab === 'templates') renderTemplates();
  if (tab === 'text' && !batchDirty) $('batchCaptions').value = project.photos.map(p => p.caption || '').join('\n');
  rememberPlace();
}
function selectInspector(tab) {
  inspectorTab = tab;
  if (project) { if (tab === 'scene') renderInspector(); else renderGlobal(); }
  document.querySelectorAll('[data-inspector]').forEach(b => { b.setAttribute('aria-selected', b.dataset.inspector === tab); b.tabIndex = b.dataset.inspector === tab ? 0 : -1; });
  $('sceneSettings').classList.toggle('hidden', tab !== 'scene');
  $('globalSettings').classList.toggle('hidden', tab !== 'global');
  rememberPlace();
}
function visibleMedia() {
  const term = $('mediaSearch').value.toLowerCase();
  return (mediaScope === 'active' ? project.photos : project.excludedPhotos).filter(p => (filter === 'all' || p.type === filter) && p.name.toLowerCase().includes(term));
}
function renderMediaSelection() {
  $('mediaSelectionCount').textContent = '已选 ' + selectedMedia.size + ' 项';
  $('applyMediaSelection').textContent = (mediaScope === 'active' ? '移出影片' : '重新加入') + (selectedMedia.size ? '（' + selectedMedia.size + '）' : '');
  $('applyMediaSelection').disabled = !selectedMedia.size;
  const all = visibleMedia();
  $('selectAllMedia').textContent = all.length && all.every(p => selectedMedia.has(p.id)) ? '取消全选' : '全选结果';
  $('selectAllMedia').disabled = !all.length;
  $('mediaGrid').querySelectorAll('[data-select-media]').forEach(input => { input.checked = selectedMedia.has(input.dataset.selectMedia); input.closest('.media-item').classList.toggle('is-checked', input.checked); });
}
function renderMedia() {
  const excluded = mediaScope === 'excluded', photos = visibleMedia();
  selectedMedia = new Set([...selectedMedia].filter(id => photos.some(p => p.id === id)));
  $('mediaCount').textContent = project.photos.length + project.excludedPhotos.length;
  $('activeMediaCount').textContent = project.photos.length; $('excludedMediaCount').textContent = project.excludedPhotos.length;
  $('mediaScopes').querySelectorAll('[data-media-scope]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mediaScope === mediaScope));
  $('mediaScopeHelp').textContent = excluded ? '这些素材不参与成片。重新加入会追加到影片末尾。' : '点击下方“移出影片”，让这项素材不参与成片。';
  $('selectMediaButton').textContent = selectingMedia ? '完成' : '多选'; $('selectMediaButton').setAttribute('aria-pressed', selectingMedia);
  $('mediaBulkActions').classList.toggle('hidden', !selectingMedia);
  $('mediaGrid').innerHTML = photos.length ? photos.map(p => '<article class="media-item' + (excluded ? ' is-excluded' : '') + '">' + (selectingMedia ? '<label class="media-select-check"><input type="checkbox" data-select-media="' + esc(p.id) + '" aria-label="选择素材：' + esc(p.name) + '"/></label>' : '') + '<button class="media-card" data-media="' + esc(p.id) + '" title="' + esc(p.name) + '"><span class="media-thumb"><img src="' + esc(p.thumb) + '" alt="" loading="lazy" draggable="false"/><span class="media-index">' + (excluded ? '已移出' : project.photos.indexOf(p) + 1) + '</span>' + (p.type === 'video' ? '<span class="media-type">' + icon('play') + clock(p.duration) + '</span>' : '') + '</span><p>' + esc(p.name) + '</p></button><button class="media-item-action" data-media-action="' + (excluded ? 'restore' : 'exclude') + '" data-media-target="' + esc(p.id) + '" aria-label="' + (excluded ? '重新加入：' : '移出影片：') + esc(p.name) + '" title="' + (excluded ? '作为独立画面追加到影片末尾' : '不参与预览和导出，原文件保留') + '">' + icon(excluded ? 'plus' : 'minus') + (excluded ? '重新加入' : '移出影片') + '</button></article>').join('') : '<div class="media-empty">' + (excluded ? '没有已移出的匹配素材。' : project.photos.length ? '没有匹配的素材。' : '影片中还没有素材。<button class="text-button" data-show-excluded>查看已移出的素材</button>') + '</div>';
  renderMediaSelection();
  highlightSelection();
}
function showExcludedMedia() {
  mediaScope = 'excluded'; selectedMedia.clear(); $('mediaSearch').value = ''; filter = 'all';
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  selectLibrary('media'); renderMedia(); $('mediaScopes').querySelector('[data-media-scope="excluded"]').focus();
}
async function changeMediaUsage(ids, restore = false) {
  const collection = restore ? project.excludedPhotos : project.photos;
  ids = [...new Set(ids)].filter(id => collection.some(p => p.id === id));
  if (!ids.length) return;
  if (batchDirty && !await confirmAction('分行文字还未应用', '继续会刷新文字对应的素材顺序，未应用的分行文字草稿将被丢弃。已保存的文字不会改变。')) return;
  if (!restore && ids.length === project.photos.length && !await confirmAction('移出全部参与影片的素材？', '影片中将不再有照片或视频。原文件仍在“已移出”中，可以重新加入；也可以撤销恢复原排版。')) return;
  const oldIndex = project.plan.scenes.findIndex(s => s.id === selectedId);
  batchDirty = false;
  commit(() => {
    (restore ? restoreMedia : excludeMedia)(project, ids);
    if (oldIndex >= 0 && !project.plan.scenes.some(s => s.id === selectedId)) selectedId = project.plan.scenes[Math.min(oldIndex, project.plan.scenes.length - 1)]?.id;
  }, { media: true });
  selectedMedia.clear(); renderMedia();
  notify(restore ? '已将 ' + ids.length + ' 项素材追加到影片末尾，可撤销' : '已将 ' + ids.length + ' 项素材移出影片，可撤销或在“已移出”中重新加入');
  const next = $('mediaGrid').querySelector('[data-media-action]');
  const focusTarget = selectingMedia && !$('selectAllMedia').disabled ? $('selectAllMedia') : next || $('mediaScopes').querySelector('[data-media-scope="excluded"]');
  focusTarget.focus({ preventScroll: true });
}
function renderTemplates() {
  const settings = project.settings, active = selectedLook(settings);
  const focused = document.activeElement?.dataset;
  const focusLook = focused?.look, focusGroup = focused?.templateGroup;
  $('stylePicker').innerHTML = TEMPLATE_GROUPS.map(group => '<button data-template-group="' + group.id + '" class="' + (templateGroup === group.id ? 'selected' : '') + '" aria-pressed="' + (templateGroup === group.id) + '">' + group.name + '</button>').join('');
  const candidates = LOOKS.filter(look => templateGroup === 'all' || look.group === templateGroup);
  $('templateSummary').textContent = '当前：' + active.name;
  $('templateCount').textContent = candidates.length + ' 款';
  const style = getStyle(settings.style);
  $('templateGuide').classList.toggle('hidden', !style.recommendedTransition);
  $('templateGuideTitle').textContent = '模板用法与动效';
  const guidance = {
    contact: '推荐四图印样。改变分组需要单独确认，现有顺序和单页设置会保留。',
    scrapbook: '胶带、纸边与照片保持正向。适合双图或主图拼贴，不自动旋转素材。',
    magazine: '适合双图或三图跨页，大图与细节分开呈现，不附带固定标题。',
    album: '双图可分放在书脊两侧。可选纸页翻动转场，照片本身不旋转。',
    gallery: '两张以上照片时，总览后逐张展开。四图建议每页 8–12 秒；视频单独完整播放。',
    ink: '宣纸与不规则笔刷边缘。可选水墨显影转场，原片保持原色。',
  };
  $('templateGuideCopy').textContent = guidance[style.id] || '';
  $('applyTemplateRhythm').textContent = '使用推荐转场 · ' + (transitions[style.recommendedTransition] || '');
  $('templateMotionRow').classList.toggle('hidden', style.id !== 'gallery');
  $('templateMotion').checked = settings.templateMotion;
  const selected = currentScene();
  const first = selected?.photos.length ? selected : project.plan.scenes.find(s => s.photos.length);
  $('templatePicker').innerHTML = candidates.map(look => {
    const chosen = active.id === look.id;
    const previewSettings = { ...settings, style:look.style, ...(look.filmTemplate ? { filmTemplate:look.filmTemplate } : {}) };
    return '<button class="template-option ' + (chosen ? 'selected' : '') + '" data-look="' + look.id + '" aria-pressed="' + chosen + '"><span class="template-thumb">' + (first ? frameMarkup(first, previewSettings, true) : '') + (look.group === 'collection' ? '<span class="template-new">新增</span>' : '') + '</span><span class="template-caption"><strong>' + look.name + '</strong><small>' + look.note + '</small></span>' + (chosen ? icon('check') : '') + '</button>';
  }).join('');
  if (focusLook) $('templatePicker').querySelector('[data-look="' + focusLook + '"]')?.focus({ preventScroll:true });
  if (focusGroup) $('stylePicker').querySelector('[data-template-group="' + focusGroup + '"]')?.focus({ preventScroll:true });
}
function renderGlobal() {
  const s = project.settings;
  $('globalFormat').value = s.outputFormat;
  $('globalWidth').value = s.outputWidth; $('globalHeight').value = s.outputHeight;
  $('globalCustomOutput').classList.toggle('hidden', s.outputFormat !== 'custom');
  $('globalFormatNote').textContent = s.outputFormat.includes('4k') ? '1080p 横版合成后放大至 4K，并非原生 4K 细节。' : s.outputFormat !== 'landscape' ? '横版构图等比适配，空余区域' + (s.backgroundColor ? '使用自定义底色' : '填黑') + '；不会旋转素材。' : '横版构图 · 1920 × 1080';
  $('globalLook').innerHTML = LOOKS.map(look => '<option value="' + look.id + '">' + look.name + '</option>').join('');
  $('globalLook').value = selectedLook(s).id;
  renderBackgroundControls();
  const draft = layoutDraft || s.layoutDefaults;
  $('defaultSingleLayout').value = draft.single; $('defaultPairLayout').value = draft.pair; $('defaultVideoLayout').value = draft.video;
  $('preserveLayouts').checked = keepLayouts;
  $('photoGrouping').value = regroupDraft || s.photoGrouping; $('preserveReflow').checked = keepReflow;
  renderLayoutImpact(); renderReflowImpact();
  $('globalTitle').value = s.title; $('globalSeconds').value = s.secondsPerScene;
  $('globalSubtitle').value = s.subtitle; $('globalDate').value = s.date;
  $('showCaptions').checked = s.showCaptions; $('includeCover').checked = s.includeCover;
  $('coverFields').classList.toggle('hidden', !s.includeCover || s.style === 'film');
  $('transitionPresets').innerHTML = presets.map(p => {
    const active = TRANSITIONS.every((t,i) => Number(s.transitionMix[t]) === (p.mix[i] || 0));
    return '<button class="preset-card ' + (active ? 'active' : '') + '" data-preset="' + p.id + '" aria-pressed="' + active + '"><span class="preset-demo ' + p.id + '"><i></i><b></b></span><span><strong>' + p.name + '</strong><small>' + p.note + '</small></span></button>';
  }).join('');
  $('transitionMix').innerHTML = TRANSITIONS.map(t => '<label class="mix-row"><span>' + transitions[t] + '</span><input data-mix="' + t + '" aria-label="' + transitions[t] + '权重" type="range" min="0" max="100" step="5" value="' + s.transitionMix[t] + '"/><output>' + s.transitionMix[t] + '</output></label>').join('');
  $('mixTotal').textContent = '权重 ' + Object.values(s.transitionMix).reduce((a,b) => a+b,0);
  $('musicName').textContent = project.music?.name || '当前没有背景音乐';
  $('removeMusic').classList.toggle('hidden', !project.music);
  $('musicButton').textContent = project.music ? '更换音乐' : '选择音乐';
  if (!batchDirty) $('batchCaptions').value = project.photos.map(p => p.caption || '').join('\n');
}
function renderBackgroundControls() {
  const s = project.settings, color = sceneBackground(s);
  $('backgroundStatus').textContent = s.backgroundColor ? '自定义 · 全片' : '模板默认';
  $('backgroundColorPicker').value = color; $('backgroundHex').value = color.toUpperCase();
  $('backgroundHex').removeAttribute('aria-invalid'); $('backgroundError').textContent = '';
  $('backgroundPresets').querySelectorAll('[data-background]').forEach(button => button.setAttribute('aria-pressed', (button.dataset.background || null) === s.backgroundColor));
  $('backgroundHelp').textContent = (s.backgroundColor ? '切换模板时保留此底色，点“模板默认”可还原。' : '选预设、使用选色器，或输入色号。') + (s.style === 'film' ? '胶片相纸边缘与颗粒效果仍会保留。' : '');
}
function layoutValues() {
  return { single: $('defaultSingleLayout').value, pair: $('defaultPairLayout').value, video: $('defaultVideoLayout').value };
}
function renderLayoutImpact() {
  const preview = previewLayoutDefaults(project, layoutValues(), keepLayouts);
  const defaultsChanged = JSON.stringify(preview.settings.layoutDefaults) !== JSON.stringify(project.settings.layoutDefaults);
  const resets = !keepLayouts && project.plan.scenes.some(s => s.layoutOverride);
  $('layoutImpact').textContent = (defaultsChanged ? '待应用 · ' : '') + '将改变 ' + preview.changes.length + ' 个画面的版式' + (preview.protectedCount ? '，保留 ' + preview.protectedCount + ' 个单独设置。' : '。') + ' 不改变素材顺序。';
  $('resetLayoutDraft').classList.toggle('hidden', !defaultsChanged);
  $('applyLayouts').disabled = !preview.changes.length && !defaultsChanged && !resets;
  $('applyLayouts').textContent = preview.changes.length ? '应用到 ' + preview.changes.length + ' 个画面' : '保存默认排版';
}
function reflowPreview() { return previewReflow(project, $('photoGrouping').value, keepReflow); }
function renderReflowImpact() {
  const preview = reflowPreview();
  const duration = buildTimeline({ ...project, settings: preview.settings, plan: preview.plan }).at(-1)?.end || 0;
  const pendingLayout = layoutDraft && JSON.stringify(layoutDraft) !== JSON.stringify(project.settings.layoutDefaults);
  $('reflowImpact').textContent = preview.oldCount + ' 个画面 → ' + preview.newCount + ' 个画面 · 预计 ' + clock(duration) + (preview.protectedCount ? '。保留 ' + preview.protectedCount + ' 个单独调整的画面。' : '。') + ' 视频不拆分、不截短。' + (pendingLayout ? '上方默认排版尚未应用，本次使用已保存的排版。' : '');
}
function layoutDiagram(name) {
  return '<svg viewBox="0 0 192 108" aria-hidden="true">' + LAYOUTS[name].map(r => '<rect x="' + r.x/10 + '" y="' + r.y/10 + '" width="' + r.w/10 + '" height="' + r.h/10 + '" rx="5" fill="currentColor" opacity=".65"/>').join('') + '</svg>';
}
function renderInspector() {
  const scene = currentScene();
  if (!scene) {
    if (!project.plan.scenes.length) {
      $('sceneSettings').innerHTML = '<div class="media-empty-inspector"><p>影片还没有画面。可以添加新素材，或从“已移出”中重新加入。</p><button class="button secondary full-width" data-action="excluded">查看已移出的素材</button></div>';
      return;
    }
    $('sceneSettings').innerHTML = '<div class="inspector-title"><strong>片头画面</strong><span>3.6 秒</span></div><div class="cover-note">' + icon('info') + '<p>片头是可选的。你可以在全片设置中关闭，或调整标题与日期。</p></div><button class="button secondary full-width" data-action="global">打开全片设置</button>';
    return;
  }
  const video = scene.photos.find(p => p.type === 'video');
  const index = project.plan.scenes.indexOf(scene);
  let html = '<div class="inspector-title"><strong>画面 ' + String(index+1).padStart(2,'0') + '</strong><span>' + (video ? '视频' : scene.kind === 'quote' ? '文字' : scene.photos.length + ' 张照片') + '</span></div>';
  if (scene.kind !== 'quote') {
    html += '<div class="layout-label">画面排版</div><div class="layout-grid">';
    Object.keys(layouts).filter(l => (LAYOUTS[l].length === scene.photos.length || l === scene.layout) && (!video || LAYOUTS[l].length === 1)).forEach(l => { html += '<button class="layout-choice ' + (scene.layout === l ? 'selected' : '') + '" data-layout="' + l + '" aria-pressed="' + (scene.layout === l) + '">' + layoutDiagram(l) + '<span>' + layouts[l] + '</span></button>'; });
    html += '</div>';
    html += '<div class="override-row"><span>' + (scene.layoutOverride ? '版式已单独设置' : '跟随全片默认排版') + '</span>' + (scene.layoutOverride ? '<button class="text-button" data-action="reset-layout">恢复默认</button>' : '') + '</div>';
  }
  if (video) html += '<div class="duration-info">' + icon('film') + '<div><strong>完整播放 · ' + durationText(video.duration) + '</strong><small>使用原片时长，不受照片停留影响</small></div></div>';
  else html += '<label class="field">画面停留<div class="input-unit"><input data-scene-duration type="number" min="2" max="30" step="0.2" value="' + scene.duration + '"/><span>秒</span></div></label><div class="override-row"><span>' + (scene.durationOverride ? '已单独设置' : '跟随全片默认') + '</span>' + (scene.durationOverride ? '<button class="text-button" data-action="reset-duration">恢复默认</button>' : '') + '</div>';
  const sceneTransitions = LEGACY_TRANSITIONS.includes(scene.transition) ? [...TRANSITIONS, scene.transition] : TRANSITIONS;
  html += '<label class="field">进入此画面的转场<select data-scene-transition>' + sceneTransitions.map(t => '<option value="' + t + '"' + (scene.transition === t ? ' selected' : '') + '>' + transitions[t] + '</option>').join('') + '</select></label><div class="override-row"><span>' + (scene.transitionOverride ? '已单独设置' : '按全片比例分配') + '</span>' + (scene.transitionOverride ? '<button class="text-button" data-action="reset-transition">恢复自动</button>' : '') + '</div>';
  if (index === 0 && !project.settings.includeCover) html += '<p class="help-text">首个画面直接显示；转场从下一个画面开始。</p>';
  if (scene.kind === 'quote') html += '<label class="field">文字内容<textarea data-quote rows="4">' + esc(scene.quote) + '</textarea></label>';
  if (scene.photos.length) {
    html += '<div class="caption-heading"><strong>画面小字</strong><span>默陌字体</span></div>' + (!project.settings.showCaptions ? '<p class="help-text">全片文字已隐藏，内容仍可编辑。</p>' : '');
    html += scene.photos.map((p,i) => '<label class="field">' + (scene.photos.length > 1 ? '照片 ' + (i+1) + ' · ' : '') + esc(p.name) + '<textarea rows="3" maxlength="2000" data-caption="' + esc(p.id) + '" placeholder="可留空，不显示任何文字">' + esc(p.caption) + '</textarea></label>').join('');
  }
  $('sceneSettings').innerHTML = html;
}
function renderStoryboard() {
  $('filmSummary').textContent = project.plan.scenes.length + ' 个画面 · ' + clock(total());
  $('storyboard').innerHTML = entries.map((e,i) => '<button class="story-card" data-scene="' + esc(e.scene.id) + '" draggable="' + (e.scene.id !== COVER_ID) + '" aria-label="' + (e.scene.id === COVER_ID ? '片头' : '画面 ' + (project.plan.scenes.indexOf(e.scene)+1)) + '，' + durationText(e.duration) + '"><span class="story-thumb">' + frameMarkup(e.scene, project.settings, true) + (i ? '<span class="transition-tag">' + transitions[e.scene.transition || 'fadeblack'] + '</span>' : '') + '</span><footer><span>' + (e.scene.id === COVER_ID ? '片头' : String(project.plan.scenes.indexOf(e.scene)+1).padStart(2,'0')) + '</span><span>' + durationText(e.duration) + '</span></footer></button>').join('');
  highlightSelection();
}
function highlightSelection() {
  const selected = currentScene();
  document.querySelectorAll('[data-scene]').forEach(b => { const active = b.dataset.scene === selectedId; b.classList.toggle('selected', active); b.setAttribute('aria-pressed', active); });
  document.querySelectorAll('[data-media]').forEach(b => b.classList.toggle('selected', selected?.photos.some(p => p.id === b.dataset.media)));
  const i = project?.plan.scenes.findIndex(s => s.id === selectedId) ?? -1;
  $('moveLeft').disabled = i <= 0; $('moveRight').disabled = i < 0 || i === project.plan.scenes.length-1;
}
function renderEditor(options = {}) {
  visualVersion++; stageKey = '';
  entries = buildTimeline(project);
  if (!entries.some(e => e.scene.id === selectedId)) selectedId = entries[0]?.scene.id;
  const entry = entries.find(e => e.scene.id === selectedId);
  time = Math.min(total(), Math.max(entry?.start || 0, Math.min(time, entry?.end || total())));
  ['playButton','prevButton','nextButton','playhead','exportButton'].forEach(id => $(id).disabled = !entries.length);
  $('projectName').textContent = project.settings.title || '未命名项目';
  if (!options.editing) { renderGlobal(); renderTemplates(); renderInspector(); }
  renderStoryboard();
  if (options.media) renderMedia();
  draw(time); fitStage(); updateSaveStatus();
}
function fitStage() {
  if (!project || $('editorView').classList.contains('hidden')) return;
  const viewport = $('previewViewport'), css = getComputedStyle(viewport);
  const availableW = viewport.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
  const availableH = viewport.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
  const ratio = project.plan.width / project.plan.height;
  const width = Math.max(1, Math.min(availableW, availableH * ratio)), height = width / ratio;
  $('stage').style.width = width + 'px'; $('stage').style.height = height + 'px';
  $('stage').style.backgroundColor = project.settings.backgroundColor || '#000000';
  const compositionWidth = Math.min(width, height * 16/9);
  $('composition').style.width = compositionWidth + 'px'; $('composition').style.height = compositionWidth * 9/16 + 'px';
  $('canvasLabel').textContent = ({landscape:'16:9',landscape4k:'16:9 · 4K',vertical:'9:16',vertical4k:'9:16 · 4K',square:'1:1',portrait4x5:'4:5'})[project.settings.outputFormat] || project.plan.width + ' × ' + project.plan.height;
}
function syncVideos() {
  let buffering = false;
  $('composition').querySelectorAll('video').forEach(video => {
    const e = entries.find(e => e.scene.id === video.closest('[data-entry]').dataset.entry);
    const desired = Math.max(0, Math.min(e.duration - 0.02, time - e.start));
    if (video.readyState >= 1 && Math.abs(video.currentTime - desired) > (playing ? 0.25 : 0.02)) { try { video.currentTime = desired; } catch {} }
    if (playing && desired < e.duration - 0.03) {
      if (video.readyState < 2) buffering = true;
      if (video.paused) video.play().catch(() => {});
    } else video.pause();
  });
  if (musicAudio) {
    if (Number.isFinite(musicAudio.duration) && musicAudio.duration > 0) {
      const desired = time % musicAudio.duration;
      if (Math.abs(musicAudio.currentTime - desired) > 0.3) musicAudio.currentTime = desired;
    }
    musicAudio.volume = .42 * Math.min(1,time/2,Math.max(0,(total()-time)/3));
    if (playing) musicAudio.play().catch(() => {}); else musicAudio.pause();
  }
  return buffering;
}
function draw(nextTime) {
  time = Math.max(0, Math.min(total(), nextTime));
  const i = entryAt(entries, time), entry = entries[i];
  if (!entry) {
    $('composition').querySelectorAll('video').forEach(v => v.pause());
    $('composition').innerHTML = '<div class="empty-composition"><strong>影片中还没有画面</strong><span>从素材区添加，或到“已移出”重新加入</span></div>';
    stageKey = ''; $('sceneCounter').textContent = '0 / 0'; $('timecode').textContent = '00:00 / 00:00';
    $('playhead').value = 0; $('playhead').max = 1; $('playhead').style.setProperty('--progress', '0%');
    $('playbackStatus').textContent = '没有参与影片的素材';
    return false;
  }
  if (selectedId !== entry.scene.id) {
    selectedId = entry.scene.id; renderInspector(); highlightSelection();
    if (libraryTab === 'templates') renderTemplates();
  }
  const progress = entry.overlap ? Math.min(1, Math.max(0,(time-entry.start)/entry.overlap)) : 1;
  const previous = i > 0 && progress < 1 ? entries[i-1] : null;
  const key = visualVersion + ':' + entry.scene.id + ':' + (previous?.scene.id || '');
  if (stageKey !== key) {
    $('composition').querySelectorAll('video').forEach(v => v.pause());
    $('composition').innerHTML = (previous ? '<div class="preview-layer outgoing" data-entry="' + esc(previous.scene.id) + '">' + frameMarkup(previous.scene,project.settings) + '</div>' : '') + '<div class="preview-layer incoming" data-entry="' + esc(entry.scene.id) + '">' + frameMarkup(entry.scene,project.settings) + '</div>';
    stageKey = key;
  }
  const incoming = $('composition').querySelector('.incoming'), outgoing = $('composition').querySelector('.outgoing');
  incoming.style.cssText = ''; if (outgoing) outgoing.style.cssText = '';
  $('composition').style.backgroundColor = '#000';
  if (previous) {
    const type = entry.scene.transition || 'fadeblack', p = progress;
    if (type === 'fade') incoming.style.opacity = p;
    else if (type === 'fadeblack' || type === 'fadewhite') {
      $('composition').style.backgroundColor = type === 'fadewhite' ? '#fff' : '#000';
      incoming.style.opacity = Math.max(0, p*2-1); outgoing.style.opacity = Math.max(0,1-p*2);
    } else if (type === 'slideleft') { incoming.style.transform = 'translateX(' + (1-p)*100 + '%)'; outgoing.style.transform = 'translateX(' + -p*100 + '%)'; }
    else if (type === 'wipeleft') incoming.style.clipPath = 'inset(0 ' + (1-p)*100 + '% 0 0)';
    else if (type === 'vertopen') incoming.style.clipPath = 'inset(0 ' + (1-p)*50 + '%)';
    else if (type === 'circleopen') incoming.style.clipPath = 'circle(' + p*72 + '% at 50% 50%)';
    else if (type === 'pagefold' || type === 'inkreveal') incoming.style.clipPath = transitionClip(type, p);
  }
  let fold = $('composition').querySelector('.preview-transition-art');
  if (previous && entry.scene.transition === 'pagefold') {
    if (!fold) { fold = document.createElement('div'); fold.className = 'preview-transition-art'; $('composition').append(fold); }
    fold.innerHTML = pageFoldSvg(progress);
  } else fold?.remove();
  if (project.settings.style === 'gallery' && project.settings.templateMotion) {
    $('composition').querySelectorAll('[data-entry]').forEach(layer => {
      const e = entries.find(item => item.scene.id === layer.dataset.entry);
      const rects = sceneRects(project.settings, e.scene.layout, e.scene.photos);
      const originals = layer.querySelectorAll('.frame-card');
      originals.forEach(card => { card.style.visibility = ''; });
      for (const phase of galleryPhases(e.scene)) {
        const photo = e.scene.photos[phase.index];
        const target = sceneRects(project.settings, photo.width / photo.height < .82 ? 'solo-portrait' : 'solo-wide', [photo])[0];
        const card = layer.querySelector('[data-gallery-photo="' + phase.index + '"]');
        if (!card) continue;
        const amount = galleryAmount(phase, time - e.start), rect = focusRect(rects[phase.index], amount, target);
        card.hidden = amount <= 0;
        if (amount > 0) originals[phase.index].style.visibility = 'hidden';
        card.style.cssText = `left:${rect.x/19.2}%;top:${rect.y/10.8}%;width:${rect.w/19.2}%;height:${rect.h/10.8}%;--focus-scale:${rect.w/target.w}`;
      }
    });
  }
  $('timecode').textContent = clock(time) + ' / ' + clock(total());
  $('playhead').max = total(); $('playhead').value = time;
  $('playhead').style.setProperty('--progress', (total() ? time/total()*100 : 0) + '%');
  $('sceneCounter').textContent = entry.scene.kind === 'cover' ? '片头' : (project.plan.scenes.indexOf(entry.scene)+1) + ' / ' + project.plan.scenes.length;
  const buffering = syncVideos();
  $('playbackStatus').textContent = playing ? (buffering ? '正在缓冲视频…' : '正在播放') : '预览已暂停';
  return buffering;
}
function pause() {
  playing = false; cancelAnimationFrame(raf);
  $('playButton').innerHTML = icon('play'); $('playButton').setAttribute('aria-label','播放');
  $('composition').querySelectorAll('video').forEach(v => v.pause()); musicAudio?.pause();
  rememberPlace();
}
function play() {
  if (!project || !entries.length) return;
  if (playing) { pause(); draw(time); return; }
  if (time >= total() - .02) time = 0;
  playing = true; lastTick = performance.now();
  $('playButton').innerHTML = icon('pause'); $('playButton').setAttribute('aria-label','暂停');
  function tick(now) {
    if (!playing) return;
    const delta = Math.min(.1,(now-lastTick)/1000); lastTick = now;
    const buffering = syncVideos();
    draw(time + (buffering ? 0 : delta));
    if (time >= total() - .001) { pause(); $('playbackStatus').textContent = '播放完毕'; return; }
    raf = requestAnimationFrame(tick);
  }
  draw(time); raf = requestAnimationFrame(tick);
}
function chooseScene(id) {
  const entry = entries.find(e => e.scene.id === id); if (!entry) return;
  pause(); selectedId = id;
  // Inspect a fully visible frame, not the black midpoint of its transition.
  draw(Math.min(entry.end - .01, entry.start + entry.overlap));
  renderInspector(); highlightSelection(); selectInspector('scene');
  if (libraryTab === 'templates') renderTemplates();
  rememberPlace();
}
function moveScene(id, targetIndex) {
  commit(() => {
    const list = project.plan.scenes, from = list.findIndex(s => s.id === id);
    if (from < 0) return;
    const [scene] = list.splice(from,1); list.splice(Math.max(0,Math.min(list.length,targetIndex)),0,scene);
    project.photos = list.flatMap(s => s.photos);
  }, { media: true });
  chooseScene(id);
}
function setupMusic() {
  musicAudio?.pause(); musicAudio = null;
  if (project?.music) { musicAudio = new Audio('/media/' + project.id + '/' + project.music.file); musicAudio.loop = true; musicAudio.preload = 'metadata'; }
}
function openProject(data, { historyMode = 'replace' } = {}) {
  pause();
  const sameVersion = project?.id === data.id && project.revision === data.revision;
  project = hydrateProject(data); version = savedVersion = 0; saveError = ''; saveConflict = false;
  if (!sameVersion) { undo = []; redo = []; }
  lastEdit.key = null; batchDirty = false; layoutDraft = null; regroupDraft = null; keepLayouts = keepReflow = true; $('layoutApplied').textContent = '';
  const place = workspace().places[project.id];
  entries = buildTimeline(project);
  const entry = entries.find(e => e.scene.id === place?.sceneId) || entries[0];
  selectedId = entry?.scene.id; time = entry ? Math.min(entry.end - .01, entry.start + Math.min(entry.duration, place?.sceneId === entry.scene.id ? place.offset : entry.overlap)) : 0;
  libraryTab = place?.libraryTab || 'media'; inspectorTab = place?.inspectorTab || 'scene';
  $('homeView').classList.add('hidden'); $('editorView').classList.remove('hidden');
  ['projectToolbar','projectsButton','globalButton','exportButton'].forEach(id => $(id).classList.remove('hidden')); $('localNote').classList.add('hidden');
  const url = '#project=' + encodeURIComponent(project.id);
  if (historyMode !== 'none') history[historyMode === 'push' && location.hash !== url ? 'pushState' : 'replaceState'](null, '', url);
  $('mediaSearch').value = ''; filter = 'all'; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  mediaScope = 'active'; selectingMedia = false; selectedMedia.clear();
  setupMusic(); renderEditor({media:true}); selectLibrary(libraryTab); selectInspector(inspectorTab);
  rememberPlace(true); window.scrollTo(0, 0);
  $('storyboard').querySelector('[data-scene="' + CSS.escape(selectedId || '') + '"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  requestAnimationFrame(fitStage);
}
async function goHome({ historyMode = 'push' } = {}) {
  await flushSave(); pause();
  $('homeView').classList.remove('hidden'); $('editorView').classList.add('hidden');
  ['projectToolbar','projectsButton','globalButton','exportButton'].forEach(id => $(id).classList.add('hidden')); $('localNote').classList.remove('hidden');
  if (historyMode !== 'none') history[historyMode === 'push' && location.hash ? 'pushState' : 'replaceState'](null, '', location.pathname);
  await loadRecent(); window.scrollTo(0, 0);
}
function acceptFiles(files) {
  const list = [...files].filter(f => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|mp4|mov|webm|m4v)$/i.test(f.name));
  if (!list.length) throw new Error('请选择照片或视频文件');
  if (list.length > 1000) throw new Error('一次最多导入 1000 项素材，可以分批添加');
  if (list.some(f => f.size > 8*1024**3)) throw new Error('单个素材不能超过 8GB');
  return list;
}
function setHomeFiles(files) {
  selectedFiles = acceptFiles(files);
  $('selectionSummary').classList.remove('hidden'); $('selectedFiles').classList.remove('hidden');
  $('selectedCount').textContent = '已选择 ' + selectedFiles.length + ' 项素材';
  $('selectedFiles').textContent = selectedFiles.slice(0,4).map(f => f.name).join(' · ') + (selectedFiles.length>4 ? ' …' : '');
  $('createButton').disabled = false; $('createButton').innerHTML = '创建相册，开始编辑' + icon('arrow-right');
}
function uploadFiles(url, body, title) {
  return new Promise((resolve,reject) => {
    busy = true; pause(); $('loadingTitle').textContent = title; $('loadingCopy').textContent = '读取文件并生成轻量预览，原片会完整保留。';
    $('uploadPercent').textContent = '准备中…'; $('uploadProgress').style.width = '0%'; $('loadingDialog').showModal();
    const xhr = new XMLHttpRequest(); xhr.open('POST',url);
    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const percent = Math.round(e.loaded/e.total*100); $('uploadProgress').style.width = percent + '%';
      $('uploadPercent').textContent = percent === 100 ? '已传入本机 · 正在生成预览…' : '传入本机 ' + percent + '%';
    };
    const finish = error => { busy = false; $('loadingDialog').close(); if (error) reject(error); };
    xhr.onload = () => {
      let data; try { data = JSON.parse(xhr.responseText); } catch { finish(new Error('服务没有返回有效结果，请重试')); return; }
      if (xhr.status >= 200 && xhr.status < 300) { finish(); resolve(data); }
      else finish(new Error(data.error || '导入失败，请检查素材后重试'));
    };
    xhr.onerror = () => finish(new Error('连接中断，导入未完成。已有项目不会受影响。'));
    xhr.send(body);
  });
}
async function importFiles(files, append = false) {
  if (busy) return;
  const validFiles = acceptFiles(files); await flushSave();
  const body = new FormData(); validFiles.forEach(f => body.append('photos',f));
  if (!append) {
    body.append('title',$('newTitle').value || '我们的婚礼'); body.append('style',newStyle);
    body.append('secondsPerScene',$('newSeconds').value); body.append('includeCover','false'); body.append('transitionBlack','100');
    $('newProjectDialog').close();
  }
  const data = await uploadFiles(append ? '/api/projects/' + project.id + '/media' : '/api/projects',body,append ? '正在添加素材' : '正在创建你的相册');
  openProject(data, { historyMode: append ? 'replace' : 'push' }); selectedFiles = []; $('mediaInput').value = '';
  $('selectionSummary').classList.add('hidden'); $('selectedFiles').classList.add('hidden'); $('createButton').disabled = true;
  $('createButton').innerHTML = '选择素材后开始' + icon('arrow-right');
  notify(append ? '素材已添加，原有画面和调整已保留' : '相册已就绪，点击下方画面开始编辑');
}
function confirmAction(title,message) {
  return new Promise(resolve => {
    const dialog = $('confirmDialog'); $('confirmTitle').textContent = title; $('confirmMessage').textContent = message;
    let accepted = false;
    $('confirmAccept').onclick = () => { accepted = true; dialog.close(); };
    $('confirmCancel').onclick = () => dialog.close();
    dialog.addEventListener('close',() => resolve(accepted),{once:true}); dialog.showModal();
  });
}
function syncExportDialog() {
  const s = project.settings;
  $('exportTitle').textContent = s.title || '未命名项目';
  $('exportSummary').textContent = project.plan.scenes.length + ' 个画面 · ' + clock(total()) + ' · ' + project.photos.length + ' 项素材';
  $('outputFormat').value = s.outputFormat; $('outputWidth').value = s.outputWidth; $('outputHeight').value = s.outputHeight;
  $('renderQuality').value = s.renderQuality; $('customOutput').classList.toggle('hidden',s.outputFormat !== 'custom');
  $('outputNote').textContent = s.outputFormat.includes('4k') ? '当前模板按 1080p 合成后放大到 4K；输出分辨率更高，但不等同于原生 4K 细节。' : s.outputFormat !== 'landscape' ? '保留横版模板，不拉伸或旋转素材；画幅不匹配的区域使用' + (s.backgroundColor ? '自定义底色' : '黑色') + '，与预览一致。' : '横版模板原始合成尺寸 · 1920 × 1080';
}
function openExport() { pause(); if (!project.plan.scenes.length) { notify('影片里没有画面，请先添加或重新加入素材'); return; } syncExportDialog(); $('exportDialog').showModal(); }
async function startExport() {
  if (busy) return;
  busy = true; $('startExport').disabled = true;
  try {
    await flushSave();
    const job = await api('/api/projects/' + project.id + '/render',{method:'POST'});
    activeRenderId = project.id; $('exportDialog').close(); $('renderDialog').showModal();
    displayJob(job); pollRender();
  } catch (error) {
    $('outputNote').textContent = '未开始导出：' + error.message;
    throw error;
  } finally { busy = false; $('startExport').disabled = false; }
}
function displayJob(job) {
  const running = job.status === 'running', done = job.status === 'done';
  $('renderDialog').dataset.state = job.status;
  $('renderTitle').textContent = done ? '影片已导出' : running ? '正在导出影片' : '导出未完成';
  $('renderMessage').textContent = job.status === 'idle' ? '渲染任务已中断，可以重新导出。' : job.message;
  $('renderProgress').style.width = (job.progress || 0) + '%'; $('renderPercent').textContent = (job.progress || 0) + '%';
  $('downloadButton').classList.toggle('hidden', !done); if (done) $('downloadButton').href = job.output;
  $('renderRetry').classList.toggle('hidden', running || done);
  $('renderBadge').classList.toggle('hidden',!running);
}
async function pollRender() {
  clearTimeout(pollTimer);
  if (!activeRenderId) return;
  try {
    const job = await api('/api/projects/' + activeRenderId + '/render'); displayJob(job);
    if (job.status === 'running') pollTimer = setTimeout(pollRender,1500);
    else { if (!$('renderDialog').open) { $('renderDialog').showModal(); } if (job.status === 'done') notify('影片已导出，可以下载了'); }
  } catch (error) {
    $('renderMessage').textContent = '暂时无法获取进度，正在重试…';
    pollTimer = setTimeout(pollRender,4000);
  }
}

$('homeButton').onclick = handled(goHome);
$('projectsButton').onclick = handled(goHome);
$('resumeButton').onclick = handled(() => requestOpenProject($('resumeButton').dataset.project));
$('newProjectButton').onclick = () => {
  if (!selectedFiles.length && ($('newTitle').value === '我们的婚礼' || /^新的影片 \d+$/.test($('newTitle').value))) {
    let index = 1;
    while (recent.some(p => p.title === '新的影片 ' + String(index).padStart(2, '0'))) index++;
    $('newTitle').value = '新的影片 ' + String(index).padStart(2, '0');
  }
  $('newProjectDialog').showModal();
};
$('refreshProjects').onclick = loadRecent;
$('projectSearch').oninput = renderProjects; $('projectSort').onchange = renderProjects;
$('homeStyles').onclick = event => { const b = event.target.closest('[data-style]'); if (b) { newStyle = b.dataset.style; renderHomeStyles(); } };
$('recentProjects').onclick = handled(async event => {
  if (navigationBusy) return;
  const open = event.target.closest('[data-project]');
  if (open) return requestOpenProject(open.dataset.project);
  const rename = event.target.closest('[data-rename]');
  if (rename) {
    renameTarget = recent.find(p => p.id === rename.dataset.rename);
    $('renameTitle').value = renameTarget.title; $('renameError').textContent = '';
    $('renameDialog').showModal(); $('renameTitle').focus(); $('renameTitle').select();
  }
  const empty = event.target.closest('[data-project-empty]');
  if (empty?.dataset.projectEmpty === 'create') $('newProjectButton').click();
  if (empty?.dataset.projectEmpty === 'clear') { $('projectSearch').value = ''; renderProjects(); $('projectSearch').focus(); }
});
$('renameForm').onsubmit = async event => {
  event.preventDefault(); if (!renameTarget || $('renameSubmit').disabled) return;
  const title = $('renameTitle').value.trim();
  if (!title) { $('renameError').textContent = '请填写项目名称'; return; }
  $('renameSubmit').disabled = true; $('renameError').textContent = '';
  try {
    await api('/api/projects/' + renameTarget.id + '/settings', { method: 'PATCH', body: JSON.stringify({ baseRevision: renameTarget.revision, settings: { title } }) });
    $('renameDialog').close(); await loadRecent(); notify('项目名称已更新，素材和画面设置保持不变');
  } catch (error) { $('renameError').textContent = error.message; }
  finally { $('renameSubmit').disabled = false; }
};
$('homeDrop').onclick = $('chooseAgain').onclick = () => $('mediaInput').click();
$('addMediaButton').onclick = () => $('mediaInput').click();
$('mediaInput').onchange = handled(async e => { if (!e.target.files.length) return; if ($('editorView').classList.contains('hidden')) setHomeFiles(e.target.files); else await importFiles(e.target.files,true); });
$('createButton').onclick = handled(() => importFiles(selectedFiles));
$('saveStatus').onclick = handled(async () => {
  if (saveConflict) {
    if (await confirmAction('载入另一窗口保存的版本？','当前窗口尚未保存的编辑将被放弃，原始素材不会删除。请先复制需要保留的文字，再确认重新载入。')) {
      clearTimeout(saveTimer);
      openProject(await api('/api/projects/' + project.id));
    }
    return;
  }
  await flushSave(); notify('修改已保存在本机');
});
$('undoButton').onclick = () => historyStep('undo'); $('redoButton').onclick = () => historyStep('redo');
document.querySelectorAll('[data-library]').forEach(b => b.onclick = () => selectLibrary(b.dataset.library));
document.querySelectorAll('[data-inspector]').forEach(b => b.onclick = () => selectInspector(b.dataset.inspector));
document.querySelectorAll('[role="tablist"]').forEach(list => list.addEventListener('keydown',e => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')], i = tabs.indexOf(document.activeElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length-1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length)%tabs.length;
  e.preventDefault(); tabs[next].click(); tabs[next].focus();
}));
$('globalButton').onclick = () => { selectInspector('global'); if (innerWidth < 850) $('globalSettings').scrollIntoView({block:'nearest'}); };
document.querySelectorAll('[data-settings-target]').forEach(button => button.onclick = () => {
  const target = $(button.dataset.settingsTarget);
  target.scrollIntoView({ block: 'start' });
  target.querySelector('select,input,button')?.focus({ preventScroll: true });
});
$('browseLooks').onclick = () => { selectLibrary('templates'); $('templatesPanel').scrollIntoView({ block: 'nearest' }); };
$('globalLook').onchange = e => {
  const look = LOOKS.find(item => item.id === e.target.value);
  if (look) settingsChange({ style: look.style, ...(look.filmTemplate ? { filmTemplate: look.filmTemplate } : {}) });
};
$('backgroundPresets').onclick = e => {
  const button = e.target.closest('[data-background]');
  if (button) settingsChange({ backgroundColor: button.dataset.background || null });
};
$('backgroundColorPicker').oninput = e => {
  settingsChange({ backgroundColor: e.target.value }, { editKey: 'background-color', editing: true });
  renderBackgroundControls();
};
$('backgroundColorPicker').onchange = () => renderEditor();
function applyBackgroundHex() {
  const color = normalizeBackgroundColor($('backgroundHex').value);
  if (!color) {
    $('backgroundHex').setAttribute('aria-invalid', 'true');
    $('backgroundError').textContent = '请输入 3 或 6 位十六进制色号，例如 #000000。';
    return;
  }
  settingsChange({ backgroundColor: color }); renderBackgroundControls();
}
$('backgroundHex').onchange = applyBackgroundHex;
$('backgroundHex').onkeydown = e => {
  if (e.key === 'Enter') { e.preventDefault(); applyBackgroundHex(); }
  if (e.key === 'Escape') { e.preventDefault(); renderBackgroundControls(); }
};
$('globalFormat').onchange = e => settingsChange({ outputFormat: e.target.value });
[['globalWidth', 'outputWidth'], ['globalHeight', 'outputHeight']].forEach(([id, key]) => $(id).onchange = e => {
  if (!e.target.value || !e.target.checkValidity()) { notify('尺寸请填写 320–7680 之间的偶数'); renderGlobal(); return; }
  settingsChange({ [key]: Number(e.target.value) });
});
['defaultSingleLayout', 'defaultPairLayout', 'defaultVideoLayout'].forEach(id => $(id).onchange = () => {
  layoutDraft = layoutValues(); $('layoutApplied').textContent = ''; renderLayoutImpact(); renderReflowImpact();
});
$('resetLayoutDraft').onclick = () => { layoutDraft = null; renderGlobal(); };
$('preserveLayouts').onchange = e => { keepLayouts = e.target.checked; renderLayoutImpact(); };
$('applyLayouts').onclick = handled(async () => {
  const values = layoutValues(), preview = previewLayoutDefaults(project, values, keepLayouts);
  if (!keepLayouts && project.plan.scenes.some(s => s.layoutOverride) && !await confirmAction('覆盖单独设置的版式？', '仅覆盖画面版式；素材分组、顺序、停留和转场不会改变。操作后可以撤销。')) return;
  layoutDraft = null;
  commit(() => applyLayoutDefaults(project, values, keepLayouts));
  $('layoutApplied').textContent = '已应用：' + preview.changes.length + ' 个画面更新；时长与转场保持不变。';
  notify('默认排版已应用，可以撤销恢复');
});
$('photoGrouping').onchange = e => { regroupDraft = e.target.value; renderReflowImpact(); };
$('preserveReflow').onchange = e => { keepReflow = e.target.checked; renderReflowImpact(); };
$('mediaSearch').oninput = renderMedia;
document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(el => el.classList.toggle('active',el === b)); renderMedia(); });
$('mediaScopes').onclick = e => { const b = e.target.closest('[data-media-scope]'); if (b) { mediaScope = b.dataset.mediaScope; selectedMedia.clear(); renderMedia(); } };
$('selectMediaButton').onclick = () => { selectingMedia = !selectingMedia; selectedMedia.clear(); renderMedia(); };
$('selectAllMedia').onclick = () => { const photos = visibleMedia(); selectedMedia = photos.every(p => selectedMedia.has(p.id)) ? new Set() : new Set(photos.map(p => p.id)); renderMediaSelection(); };
$('applyMediaSelection').onclick = handled(() => changeMediaUsage([...selectedMedia], mediaScope === 'excluded'));
$('mediaGrid').onchange = e => { if (e.target.dataset.selectMedia) { if (e.target.checked) selectedMedia.add(e.target.dataset.selectMedia); else selectedMedia.delete(e.target.dataset.selectMedia); renderMediaSelection(); } };
$('mediaGrid').onclick = handled(async e => {
  const action = e.target.closest('[data-media-action]');
  if (action) { await changeMediaUsage([action.dataset.mediaTarget], action.dataset.mediaAction === 'restore'); return; }
  if (e.target.closest('[data-show-excluded]')) { showExcludedMedia(); return; }
  const b = e.target.closest('[data-media]'); if (!b) return;
  if (selectingMedia) { if (selectedMedia.has(b.dataset.media)) selectedMedia.delete(b.dataset.media); else selectedMedia.add(b.dataset.media); renderMediaSelection(); return; }
  const scene = project.plan.scenes.find(s => s.photos.some(p => p.id === b.dataset.media));
  if (scene) chooseScene(scene.id); else notify('这项素材不参与影片，点“重新加入”可恢复到影片末尾');
});
$('stylePicker').onclick = e => { const b = e.target.closest('[data-template-group]'); if (b) { templateGroup = b.dataset.templateGroup; renderTemplates(); } };
$('templatePicker').onclick = e => {
  const b = e.target.closest('[data-look]'), look = b && LOOKS.find(look => look.id === b.dataset.look);
  if (!look) return;
  settingsChange({ style:look.style, ...(look.filmTemplate ? { filmTemplate:look.filmTemplate } : {}) });
};
$('applyTemplateRhythm').onclick = () => {
  const transition = getStyle(project.settings.style).recommendedTransition;
  if (!transition) return;
  settingsChange({ transitionMix: Object.fromEntries(TRANSITIONS.map(name => [name, name === transition ? 100 : 0])) });
  notify('已应用推荐转场，保留单独指定的转场；可撤销');
};
$('templateMotion').onchange = e => settingsChange({ templateMotion: e.target.checked });
$('templateLayoutShortcut').onclick = () => {
  selectInspector('global');
  regroupDraft = ['contact','gallery'].includes(project.settings.style) ? 'grid' : 'pair';
  $('photoGrouping').value = regroupDraft;
  $('photoGrouping').closest('details').open = true;
  renderReflowImpact();
  $('photoGrouping').scrollIntoView({ block: 'center' }); $('photoGrouping').focus({ preventScroll:true });
};
$('sceneSettings').onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const scene = currentScene();
  if (b.dataset.action === 'global') { selectInspector('global'); return; }
  if (b.dataset.action === 'excluded') { showExcludedMedia(); return; }
  if (!scene) return;
  if (b.dataset.layout) commit(() => { scene.layout = b.dataset.layout; scene.layoutOverride = true; });
  if (b.dataset.action === 'reset-layout') commit(() => { scene.layout = defaultLayout(scene.photos, project.settings); scene.layoutOverride = false; });
  if (b.dataset.action === 'reset-duration') commit(() => { scene.durationOverride = false; scene.duration = Math.min(30,project.settings.secondsPerScene + (scene.layout === 'editorial-trio' ? .4 : 0)); });
  if (b.dataset.action === 'reset-transition') commit(() => {
    scene.transitionOverride = false;
    const planned = copy(project.plan.scenes); applyTransitionMix(planned,project.settings.transitionMix);
    scene.transition = planned.find(s => s.id === scene.id).transition;
  });
};
$('sceneSettings').onchange = e => {
  const scene = currentScene(); if (!scene) return;
  if (e.target.matches('[data-scene-duration]')) {
    if (!e.target.checkValidity() || !e.target.value) { notify('照片停留时间请填写 2–30 秒'); renderInspector(); return; }
    commit(() => { scene.duration = Number(e.target.value); scene.durationOverride = true; });
  }
  if (e.target.matches('[data-scene-transition]')) commit(() => { scene.transition = e.target.value; scene.transitionOverride = true; });
  if (e.target.dataset.caption) commit(() => { project.photos.find(p => p.id === e.target.dataset.caption).caption = e.target.value; });
  if (e.target.matches('[data-quote]')) commit(() => { scene.quote = e.target.value; });
};
// Persist typing too, not just blur, so another panel action cannot discard a draft.
$('sceneSettings').oninput = e => {
  const scene = currentScene(); if (!scene) return;
  const options = { editing: true, editKey: e.target.dataset.caption || e.target.dataset.quote || scene.id + '-duration' };
  if (e.target.matches('[data-scene-duration]') && e.target.value && e.target.checkValidity()) commit(() => { scene.duration = Number(e.target.value); scene.durationOverride = true; }, options);
  if (e.target.dataset.caption) commit(() => { project.photos.find(p => p.id === e.target.dataset.caption).caption = e.target.value; }, options);
  if (e.target.matches('[data-quote]')) commit(() => { scene.quote = e.target.value; }, options);
};
[['globalTitle','title'],['globalSubtitle','subtitle'],['globalDate','date']].forEach(([id,key]) => $(id).oninput = e => settingsChange({[key]:e.target.value},{editing:true,editKey:id}));
$('globalSeconds').oninput = e => { if (e.target.value && e.target.checkValidity()) settingsChange({secondsPerScene:Number(e.target.value)},{editing:true,editKey:'globalSeconds'}); };
$('globalSeconds').onchange = e => { if (!e.target.checkValidity() || !e.target.value) { notify('照片停留时间请填写 2–30 秒'); renderGlobal(); return; } settingsChange({secondsPerScene:Number(e.target.value)}); };
$('showCaptions').onchange = e => settingsChange({showCaptions:e.target.checked});
$('includeCover').onchange = e => settingsChange({includeCover:e.target.checked});
$('transitionPresets').onclick = e => { const b = e.target.closest('[data-preset]'); if (b) { const p = presets.find(p => p.id === b.dataset.preset); settingsChange({transitionMix:Object.fromEntries(TRANSITIONS.map((t,i) => [t,p.mix[i] || 0]))}); } };
$('transitionMix').oninput = e => { if (e.target.dataset.mix) e.target.nextElementSibling.textContent = e.target.value; };
$('transitionMix').onchange = e => { if (e.target.dataset.mix) settingsChange({transitionMix:{...project.settings.transitionMix,[e.target.dataset.mix]:Number(e.target.value)}}); };
$('reflowButton').onclick = handled(async () => {
  const grouping = $('photoGrouping').value, preview = reflowPreview();
  const retained = keepReflow ? '保留 ' + preview.protectedCount + ' 个单独调整过的画面，其余照片按默认时长与转场重新组合。' : '照片将重新组合，单独设置的版式、停留与转场会恢复默认。';
  if (await confirmAction('应用「' + groupingNames[grouping] + '」？', preview.oldCount + ' 个画面将变为 ' + preview.newCount + ' 个画面。' + retained + ' 素材顺序与文字不变，视频完整播放。操作后可以撤销。')) {
    regroupDraft = null;
    commit(() => applyReflow(project, grouping, keepReflow), { media: true });
    selectInspector('global'); notify('已重新组合照片，可以撤销恢复');
  }
});
$('batchCaptions').oninput = () => { batchDirty = true; };
$('applyCaptions').onclick = () => { const lines = $('batchCaptions').value.split(/\r?\n/); batchDirty = false; commit(() => project.photos.forEach((p,i) => { p.caption = (lines[i] || '').slice(0,2000); })); notify('分行文字已应用'); };
$('clearCaptions').onclick = () => { batchDirty = false; $('batchCaptions').value = ''; commit(() => project.photos.forEach(p => { p.caption = ''; })); notify('画面小字已清空，可以撤销恢复'); };
$('musicButton').onclick = () => $('musicInput').click();
$('musicInput').onchange = handled(async e => {
  if (!e.target.files.length) return; await flushSave(); const body = new FormData(); body.append('music',e.target.files[0]);
  const data = await uploadFiles('/api/projects/' + project.id + '/music',body,'正在导入背景音乐');
  project = hydrateProject(data); undo = []; redo = []; setupMusic(); renderEditor(); $('musicInput').value = ''; notify('音乐已添加，播放预览即可试听');
});
$('removeMusic').onclick = handled(async () => { await flushSave(); pause(); project = hydrateProject(await api('/api/projects/' + project.id + '/music',{method:'DELETE'})); undo = []; redo = []; setupMusic(); renderEditor(); notify('已从影片移除音乐，原文件仍保留'); });
$('storyboard').onclick = e => { const b = e.target.closest('[data-scene]'); if (b) chooseScene(b.dataset.scene); };
$('storyboard').ondragstart = e => { const b = e.target.closest('[data-scene]'); if (!b || b.dataset.scene === COVER_ID) { e.preventDefault(); return; } draggedId = b.dataset.scene; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain',draggedId); b.classList.add('dragging'); };
$('storyboard').ondragover = e => { if (!draggedId) return; const b = e.target.closest('[data-scene]'); if (!b || b.dataset.scene === COVER_ID) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); b.classList.add('drag-over'); };
$('storyboard').ondrop = e => { if (!draggedId) return; e.preventDefault(); const b = e.target.closest('[data-scene]'); if (b && b.dataset.scene !== COVER_ID) moveScene(draggedId,project.plan.scenes.findIndex(s => s.id === b.dataset.scene)); draggedId = null; };
$('storyboard').ondragend = () => { draggedId = null; document.querySelectorAll('.dragging,.drag-over').forEach(el => el.classList.remove('dragging','drag-over')); };
$('moveLeft').onclick = () => moveScene(selectedId,project.plan.scenes.findIndex(s => s.id === selectedId)-1);
$('moveRight').onclick = () => moveScene(selectedId,project.plan.scenes.findIndex(s => s.id === selectedId)+1);
$('playButton').onclick = play;
$('prevButton').onclick = () => chooseScene(entries[Math.max(0,entries.findIndex(e => e.scene.id === selectedId)-1)]?.scene.id);
$('nextButton').onclick = () => chooseScene(entries[Math.min(entries.length-1,entries.findIndex(e => e.scene.id === selectedId)+1)]?.scene.id);
$('playhead').oninput = e => { pause(); draw(Number(e.target.value)); };
$('fullscreenButton').onclick = handled(async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await $('previewViewport').requestFullscreen(); });
document.addEventListener('fullscreenchange',fitStage); new ResizeObserver(fitStage).observe($('previewViewport'));
$('exportButton').onclick = $('canvasSizeButton').onclick = openExport;
$('outputFormat').onchange = e => { settingsChange({outputFormat:e.target.value}); syncExportDialog(); };
['outputWidth','outputHeight'].forEach(id => $(id).onchange = e => {
  if (!e.target.checkValidity() || !e.target.value) { notify('尺寸请填写 320–7680 之间的偶数'); syncExportDialog(); return; }
  settingsChange({[id]:Number(e.target.value)}); syncExportDialog();
});
['outputWidth','outputHeight'].forEach(id => $(id).oninput = e => {
  if (e.target.value && e.target.checkValidity()) settingsChange({[id]:Number(e.target.value)},{editing:true,editKey:id});
});
$('renderQuality').onchange = e => { settingsChange({renderQuality:e.target.value}); syncExportDialog(); };
$('startExport').onclick = handled(startExport);
$('renderBadge').onclick = () => $('renderDialog').showModal();
$('renderRetry').onclick = handled(async () => { if (activeRenderId && activeRenderId !== project?.id) { await flushSave(); openProject(await api('/api/projects/' + activeRenderId)); } $('renderDialog').close(); openExport(); });
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
$('loadingDialog').addEventListener('cancel',e => e.preventDefault());
document.querySelectorAll('dialog:not(#loadingDialog)').forEach(d => d.addEventListener('click',e => { const r = d.getBoundingClientRect(); if (e.target === d && (e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)) d.close(); }));
let dragDepth = 0;
document.addEventListener('dragenter',e => { if (!e.dataTransfer?.types.includes('Files') || busy || document.querySelector('dialog[open]')) return; dragDepth++; $('dropOverlay').classList.remove('hidden'); $('dropOverlay').querySelector('h2').textContent = $('editorView').classList.contains('hidden') ? '松开，选择照片与视频' : '松开，添加到当前项目'; });
document.addEventListener('dragover',e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
document.addEventListener('dragleave',e => { if (e.dataTransfer?.types.includes('Files') && --dragDepth <= 0) $('dropOverlay').classList.add('hidden'); });
document.addEventListener('drop',handled(async e => {
  if (!e.dataTransfer?.files.length) return; e.preventDefault(); dragDepth = 0; $('dropOverlay').classList.add('hidden');
  if (busy || document.querySelector('dialog[open]')) return;
  if ($('editorView').classList.contains('hidden')) setHomeFiles(e.dataTransfer.files); else await importFiles(e.dataTransfer.files,true);
}));
document.addEventListener('keydown',e => {
  if (!project || $('editorView').classList.contains('hidden') || document.querySelector('dialog[open]') || e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); historyStep(e.shiftKey ? 'redo' : 'undo'); }
  else if (e.code === 'Space' && !e.target.closest('button')) { e.preventDefault(); play(); }
  else if (e.key === 'ArrowLeft' && !e.target.closest('[role="tablist"]')) { e.preventDefault(); $('prevButton').click(); }
  else if (e.key === 'ArrowRight' && !e.target.closest('[role="tablist"]')) { e.preventDefault(); $('nextButton').click(); }
});
window.addEventListener('beforeunload',e => { rememberPlace(); if (version !== savedVersion || busy) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange',() => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => rememberPlace());
window.addEventListener('popstate', handled(async () => {
  const id = new URLSearchParams(location.hash.slice(1)).get('project');
  try { if (id) await requestOpenProject(id, 'none'); else await goHome({ historyMode: 'none' }); }
  catch (error) { history.replaceState(null, '', project && !$('editorView').classList.contains('hidden') ? '#project=' + encodeURIComponent(project.id) : location.pathname); throw error; }
}));
setInterval(() => { if (playing) rememberPlace(); }, 5000);
renderHomeStyles(); loadRecent();
const initialId = new URLSearchParams(location.hash.slice(1)).get('project');
if (initialId) requestOpenProject(initialId, 'replace').catch(error => { notify(error.message); history.replaceState(null,'',location.pathname); });
