import { buildPlan, applyTransitionMix, defaultLayout, LAYOUTS } from './layout-engine.mjs';
import { STYLE_IDS, normalizeBackgroundColor } from './style-catalog.mjs';

export const TRANSITIONS = ['fadeblack', 'fade', 'fadewhite', 'slideleft', 'wipeleft', 'vertopen', 'circleopen', 'pagefold', 'inkreveal'];
// Earlier projects used this FFmpeg transition. Keep it during unrelated edits;
// it is not part of the new global transition presets.
export const LEGACY_TRANSITIONS = ['smoothleft'];
const SAVED_TRANSITIONS = [...TRANSITIONS, ...LEGACY_TRANSITIONS];
const valid = (values, value, fallback) => values.includes(value) ? value : fallback;
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;

export function normalizeSettings(input = {}, previous = {}) {
  const s = { ...previous, ...input };
  return {
    ...s,
    title: String(s.title ?? '我们的婚礼').slice(0, 100),
    subtitle: String(s.subtitle ?? '').slice(0, 200),
    date: String(s.date ?? '').slice(0, 30),
    style: valid(STYLE_IDS, s.style, 'film'),
    backgroundColor: normalizeBackgroundColor(s.backgroundColor),
    filmTemplate: valid(['colorprint', 'matteblack', 'silverblack', 'none'], s.filmTemplate, 'colorprint'),
    outputFormat: valid(['landscape', 'landscape4k', 'vertical', 'vertical4k', 'square', 'portrait4x5', 'custom'], s.outputFormat, 'landscape'),
    outputWidth: Math.floor(clamp(s.outputWidth, 320, 7680, 1920) / 2) * 2,
    outputHeight: Math.floor(clamp(s.outputHeight, 320, 7680, 1080) / 2) * 2,
    renderQuality: valid(['fast', 'high'], s.renderQuality, 'fast'),
    secondsPerScene: clamp(s.secondsPerScene, 2, 30, 4.2),
    photoGrouping: valid(['auto', 'single', 'pair', 'grid'], s.photoGrouping, 'auto'),
    templateMotion: s.templateMotion !== false,
    layoutDefaults: {
      single: valid(['auto', 'solo-wide', 'solo-portrait'], s.layoutDefaults?.single, 'auto'),
      pair: valid(['auto', 'portrait-duo', 'hero-aside'], s.layoutDefaults?.pair, 'auto'),
      video: valid(['auto', 'solo-wide', 'solo-portrait'], s.layoutDefaults?.video, 'auto'),
    },
    includeCover: s.includeCover !== false,
    showCaptions: s.showCaptions !== false,
    transitionMix: Object.fromEntries(TRANSITIONS.map(name => [name, clamp(s.transitionMix?.[name], 0, 100, name === 'fadeblack' ? 100 : 0)])),
  };
}

export function hydrateProject(project) {
  project.excludedPhotos ||= [];
  const byId = new Map(project.photos.map(photo => [photo.id, photo]));
  project.settings = normalizeSettings(project.settings);
  const automaticTransitions = project.plan.scenes.map(scene => ({ id: scene.id }));
  applyTransitionMix(automaticTransitions, project.settings.transitionMix);
  // JSON stores scene media separately. Reconnect it so caption edits always
  // affect both the media library and the frames used for preview/export.
  project.plan.scenes.forEach((scene, index) => {
    scene.photos = (scene.photos || []).map(photo => byId.get(photo.id)).filter(Boolean);
    if (scene.kind !== 'quote' && scene.photos.length > (LAYOUTS[scene.layout]?.length || 0)) {
      scene.layout = defaultLayout(scene.photos, project.settings);
    }
    const video = scene.photos.find(photo => photo.type === 'video');
    if (scene.layoutOverride === undefined) scene.layoutOverride = scene.kind !== 'quote' && scene.layout !== defaultLayout(scene.photos, project.settings);
    if (video?.duration > 0) scene.duration = video.duration;
    if (scene.durationOverride === undefined) {
      const defaultDuration = Math.min(30, project.settings.secondsPerScene + (scene.layout === 'editorial-trio' ? .4 : 0));
      scene.durationOverride = !video && Math.abs(scene.duration - defaultDuration) > .01;
    }
    if (scene.transitionOverride === undefined) scene.transitionOverride = Boolean(scene.transition && scene.transition !== automaticTransitions[index].transition);
  });
  return project;
}

export function editorDocument(project) {
  return {
    settings: project.settings,
    photos: project.photos.map(photo => ({ id: photo.id, caption: photo.caption || '' })),
    excludedPhotos: (project.excludedPhotos || []).map(photo => ({ id: photo.id, caption: photo.caption || '' })),
    scenes: project.plan.scenes.map(scene => ({ ...scene, photos: scene.photos.map(photo => photo.id) })),
  };
}

export function updateSettings(project, input) {
  const previous = normalizeSettings(project.settings);
  const settings = normalizeSettings(input, previous);
  if (settings.secondsPerScene !== previous.secondsPerScene) {
    project.plan.scenes.forEach(scene => {
      if (scene.photos.some(photo => photo.type === 'video') || scene.durationOverride) return;
      const oldDefault = previous.secondsPerScene + (scene.layout === 'editorial-trio' ? 0.4 : 0);
      // Preserve custom durations in older projects, which had no override flag.
      if (scene.durationOverride === undefined && Math.abs(scene.duration - oldDefault) > 0.01) { scene.durationOverride = true; return; }
      scene.duration = Math.min(30, settings.secondsPerScene + (scene.layout === 'editorial-trio' ? 0.4 : 0));
    });
  }
  project.settings = settings;
  const metadata = buildPlan([], settings);
  Object.assign(project.plan, { ...metadata, scenes: project.plan.scenes });
  if (JSON.stringify(previous.transitionMix) !== JSON.stringify(settings.transitionMix)) {
    const manual = new Map(project.plan.scenes.filter(s => s.transitionOverride).map(s => [s.id, s.transition]));
    applyTransitionMix(project.plan.scenes, settings.transitionMix);
    project.plan.scenes.forEach(s => { if (manual.has(s.id)) s.transition = manual.get(s.id); });
  }
  return project;
}

export function restoreDocument(project, document) {
  const fail = () => { throw Object.assign(new Error('项目编辑数据不完整，请重新打开项目'), { status: 400 }); };
  if (!Array.isArray(document.photos) || !Array.isArray(document.scenes)) fail();
  const byId = new Map([...project.photos, ...(project.excludedPhotos || [])].map(photo => [photo.id, photo]));
  const excluded = document.excludedPhotos ?? (project.excludedPhotos || []).filter(photo => !document.photos.some(p => p?.id === photo.id));
  if (!Array.isArray(excluded)) fail();
  const order = [...document.photos, ...excluded].map(photo => photo?.id);
  if (order.length !== byId.size || new Set(order).size !== byId.size || order.some(id => !byId.has(id))) fail();
  const activeIds = new Set(document.photos.map(photo => photo.id));
  const used = [];
  const ids = new Set();
  const scenes = document.scenes.map(raw => {
    if (!raw || typeof raw.id !== 'string' || ids.has(raw.id) || !Array.isArray(raw.photos)) fail();
    ids.add(raw.id);
    const photos = raw.photos.map(id => { if (!activeIds.has(id)) fail(); used.push(id); return byId.get(id); });
    if (raw.kind === 'quote') {
      if (photos.length) fail();
      return { id: raw.id, kind: 'quote', quote: String(raw.quote || '').slice(0, 1000), photos: [], duration: clamp(raw.duration, 2, 30, 4.2), transition: valid(SAVED_TRANSITIONS, raw.transition, 'fadeblack'), durationOverride: Boolean(raw.durationOverride), transitionOverride: Boolean(raw.transitionOverride) };
    }
    if (!LAYOUTS[raw.layout] || !photos.length || photos.length > LAYOUTS[raw.layout].length) fail();
    const video = photos.find(photo => photo.type === 'video');
    if (video && photos.length !== 1) fail();
    return { id: raw.id, kind: 'photos', layout: raw.layout, layoutOverride: raw.layoutOverride === undefined ? raw.layout !== defaultLayout(photos, normalizeSettings(document.settings, project.settings)) : Boolean(raw.layoutOverride), photos, duration: video?.duration > 0 ? video.duration : clamp(raw.duration, 2, 30, 4.2), durationOverride: Boolean(raw.durationOverride), transition: valid(SAVED_TRANSITIONS, raw.transition, 'fadeblack'), transitionOverride: Boolean(raw.transitionOverride) };
  });
  if (used.length !== activeIds.size || new Set(used).size !== activeIds.size) fail();
  project.photos = document.photos.map(photo => ({ ...byId.get(photo.id), caption: String(photo.caption || '').slice(0, 2000) }));
  project.excludedPhotos = excluded.map(photo => ({ ...byId.get(photo.id), caption: String(photo.caption || '').slice(0, 2000) }));
  project.settings = normalizeSettings(document.settings, project.settings);
  project.plan = { ...buildPlan([], project.settings), scenes };
  return hydrateProject(project);
}

// Detach from playback only. Original files and captions stay available in the
// project library; the editor's normal document history restores exact grouping.
export function excludeMedia(project, requestedIds) {
  const ids = new Set(requestedIds);
  const removed = project.photos.filter(photo => ids.has(photo.id));
  if (!removed.length) return project;
  project.excludedPhotos = [...(project.excludedPhotos || []), ...removed];
  project.photos = project.photos.filter(photo => !ids.has(photo.id));
  project.plan.scenes = project.plan.scenes.flatMap(scene => {
    if (scene.kind === 'quote') return [scene];
    const photos = scene.photos.filter(photo => !ids.has(photo.id));
    if (!photos.length) return [];
    if (photos.length === scene.photos.length) return [scene];
    return [{ ...scene, photos, layout: defaultLayout(photos, project.settings), layoutOverride: false }];
  });
  return hydrateProject(project);
}

export function restoreMedia(project, requestedIds) {
  const ids = new Set(requestedIds);
  const restored = (project.excludedPhotos || []).filter(photo => ids.has(photo.id));
  if (!restored.length) return project;
  const occupied = new Set(project.plan.scenes.map(scene => scene.id));
  let serial = 1;
  // Rejoin as solo pages at the end, leaving all existing pages untouched.
  const scenes = buildPlan(restored, { ...project.settings, photoGrouping: 'single' }).scenes;
  for (const scene of scenes) {
    while (occupied.has('scene-' + serial)) serial++;
    scene.id = 'scene-' + serial++; occupied.add(scene.id);
  }
  project.photos.push(...restored);
  project.plan.scenes.push(...scenes);
  project.excludedPhotos = project.excludedPhotos.filter(photo => !ids.has(photo.id));
  return hydrateProject(project);
}

// Applying layout defaults never changes grouping, IDs, timing, transitions or captions.
export function previewLayoutDefaults(project, requested, preserveOverrides = true) {
  const settings = normalizeSettings({ layoutDefaults: requested }, project.settings);
  const eligible = project.plan.scenes.filter(s => s.kind !== 'quote');
  const changes = eligible.filter(s => !(preserveOverrides && s.layoutOverride) && s.layout !== defaultLayout(s.photos, settings));
  return { settings, changes, protectedCount: eligible.filter(s => preserveOverrides && s.layoutOverride).length };
}

export function applyLayoutDefaults(project, requested, preserveOverrides = true) {
  const preview = previewLayoutDefaults(project, requested, preserveOverrides);
  project.settings = preview.settings;
  project.plan.scenes.forEach(scene => {
    if (scene.kind === 'quote' || (preserveOverrides && scene.layoutOverride)) return;
    scene.layout = defaultLayout(scene.photos, project.settings);
    scene.layoutOverride = false;
  });
  return project;
}

// Reflow is explicit. Protected pages, videos and text pages are boundaries:
// photos never cross them or change order, and videos remain full-length solos.
export function previewReflow(project, grouping, preserveOverrides = true) {
  const settings = normalizeSettings({ photoGrouping: grouping }, project.settings);
  const oldScenes = project.plan.scenes;
  const signature = scene => JSON.stringify(scene.photos.map(p => p.id));
  const oldGroups = new Map(oldScenes.filter(s => s.kind !== 'quote').map(s => [signature(s), s]));
  const occupied = new Set(oldScenes.map(s => s.id));
  const retainedTransitions = new Map();
  const scenes = [];
  let pending = [], serial = 1, protectedCount = 0;
  const nextId = () => { while (occupied.has('scene-' + serial)) serial++; const id = 'scene-' + serial++; occupied.add(id); return id; };
  function flush() {
    if (!pending.length) return;
    for (const candidate of buildPlan(pending, settings).scenes) {
      const old = oldGroups.get(signature(candidate));
      // Unchanged groups retain identity; regrouped pages get fresh stable IDs.
      candidate.id = old?.id || nextId();
      scenes.push(candidate);
    }
    pending = [];
  }
  for (const original of oldScenes) {
    const customized = Boolean(original.layoutOverride || original.durationOverride || original.transitionOverride);
    const video = original.photos.find(p => p.type === 'video');
    const protectedPage = preserveOverrides && customized;
    if (protectedPage || video || original.kind === 'quote') {
      flush();
      const retained = { ...original, photos: [...original.photos] };
      if (protectedPage) protectedCount++;
      if (!preserveOverrides && video) {
        retained.layout = defaultLayout(retained.photos, settings);
        retained.layoutOverride = false; retained.transitionOverride = false;
      }
      if (video?.duration > 0) retained.duration = video.duration;
      if (preserveOverrides && retained.transitionOverride) retainedTransitions.set(retained.id, retained.transition);
      scenes.push(retained);
    } else pending.push(...original.photos);
  }
  flush();
  applyTransitionMix(scenes, settings.transitionMix);
  scenes.forEach(scene => { if (retainedTransitions.has(scene.id)) scene.transition = retainedTransitions.get(scene.id); });
  const plan = { ...buildPlan([], settings), scenes };
  return { settings, plan, protectedCount, oldCount: oldScenes.length, newCount: scenes.length };
}

export function applyReflow(project, grouping, preserveOverrides = true) {
  const preview = previewReflow(project, grouping, preserveOverrides);
  project.settings = preview.settings;
  project.plan = preview.plan;
  project.photos = preview.plan.scenes.flatMap(s => s.photos);
  return hydrateProject(project);
}
