export const LAYOUTS = {
  "grid-quad": [{x:128,y:66,w:800,h:450},{x:992,y:66,w:800,h:450},{x:128,y:564,w:800,h:450},{x:992,y:564,w:800,h:450}],
  "solo-wide": [{ x: 104, y: 82, w: 1712, h: 916 }],
  "solo-portrait": [{ x: 575, y: 64, w: 770, h: 952 }],
  "portrait-duo": [
    { x: 202, y: 78, w: 696, h: 924 },
    { x: 1022, y: 78, w: 696, h: 924 },
  ],
  "editorial-trio": [
    { x: 116, y: 86, w: 1030, h: 908 },
    { x: 1190, y: 86, w: 614, h: 432 },
    { x: 1190, y: 562, w: 614, h: 432 },
  ],
  "hero-aside": [
    { x: 110, y: 96, w: 1196, h: 888 },
    { x: 1350, y: 214, w: 458, h: 650 },
  ],
};

function shape(photo) {
  const ratio = photo.width / photo.height;
  if (ratio > 1.35) return "landscape";
  if (ratio < 0.82) return "portrait";
  return "square";
}

export function defaultLayout(photos, settings = {}) {
  const defaults = settings.layoutDefaults || {};
  if (photos.length === 4) return 'grid-quad';
  if (photos.length === 3) return 'editorial-trio';
  if (photos.length === 2) {
    if (['portrait-duo', 'hero-aside'].includes(defaults.pair)) return defaults.pair;
    return shape(photos[0]) === shape(photos[1]) ? 'portrait-duo' : 'hero-aside';
  }
  const choice = photos[0]?.type === 'video' ? defaults.video : defaults.single;
  return ['solo-wide', 'solo-portrait'].includes(choice) ? choice : shape(photos[0] || {}) === 'portrait' ? 'solo-portrait' : 'solo-wide';
}

function scene(layout, photos, index, duration) {
  return {
    id: `scene-${index + 1}`,
    kind: "photos",
    layout,
    duration,
    transition: "fadeblack",
    durationOverride: false,
    transitionOverride: false,
    layoutOverride: false,
    photos,
  };
}

export function applyTransitionMix(scenes, requestedMix = {}) {
  const fallback = { fadeblack: 100, fade: 0, fadewhite: 0, slideleft: 0, wipeleft: 0, vertopen: 0, circleopen: 0 };
  const weights = Object.entries({ ...fallback, ...requestedMix })
    .map(([name, value]) => ({ name, weight: Math.max(0, Number(value) || 0), score: 0 }))
    .filter((item) => item.weight > 0);
  const active = weights.length ? weights : [{ name: "fadeblack", weight: 100, score: 0 }];
  const total = active.reduce((sum, item) => sum + item.weight, 0);
  for (const item of scenes) {
    for (const option of active) option.score += option.weight;
    const selected = active.reduce((best, option) => option.score > best.score ? option : best);
    item.transition = selected.name;
    selected.score -= total;
  }
}

export function buildPlan(photos, settings = {}) {
  const seconds = Math.max(2, Math.min(30, Number(settings.secondsPerScene) || 4.2));
  const scenes = [];
  let cursor = 0;

  while (cursor < photos.length) {
    const a = photos[cursor];
    const b = photos[cursor + 1];
    const c = photos[cursor + 2];
    const sa = shape(a);
    const sb = b ? shape(b) : null;
    const sc = c ? shape(c) : null;

    if (a.type === "video") {
      // A video is never cut down to the global photo duration: it plays through
      // to its own end, including clips shorter than the default still duration.
      const videoDuration = Number(a.duration) > 0 ? Number(a.duration) : seconds;
      scenes.push(scene(sa === "portrait" ? "solo-portrait" : "solo-wide", [a], scenes.length, videoDuration));
      cursor += 1;
    } else if (settings.photoGrouping === 'grid') {
      const group = [];
      for (let i = cursor; i < Math.min(cursor + 4, photos.length) && photos[i].type !== 'video'; i++) group.push(photos[i]);
      scenes.push(scene(defaultLayout(group, settings), group, scenes.length, seconds));
      cursor += group.length;
    } else if (settings.photoGrouping === 'single') {
      scenes.push(scene(defaultLayout([a], settings), [a], scenes.length, seconds));
      cursor += 1;
    } else if (settings.photoGrouping === 'pair') {
      const pair = b && b.type !== 'video' ? [a, b] : [a];
      scenes.push(scene(defaultLayout(pair, settings), pair, scenes.length, seconds));
      cursor += pair.length;
    } else if (sa === "portrait" && sb === "portrait" && b.type !== "video") {
      scenes.push(scene("portrait-duo", [a, b], scenes.length, seconds));
      cursor += 2;
    } else if (b && c && b.type !== "video" && c.type !== "video" && sa !== "landscape" && sb !== "landscape" && sc !== "landscape") {
      scenes.push(scene("editorial-trio", [a, b, c], scenes.length, Math.min(30, seconds + 0.4)));
      cursor += 3;
    } else if (b && b.type !== "video" && sa !== sb) {
      scenes.push(scene("hero-aside", [a, b], scenes.length, seconds));
      cursor += 2;
    } else {
      scenes.push(scene(sa === "portrait" ? "solo-portrait" : "solo-wide", [a], scenes.length, seconds));
      cursor += 1;
    }
  }

  scenes.forEach(item => { item.layout = defaultLayout(item.photos, settings); });
  applyTransitionMix(scenes, settings.transitionMix);

  const output = settings.outputFormat === "landscape4k" ? { width: 3840, height: 2160 }
    : settings.outputFormat === "vertical" ? { width: 1080, height: 1920 }
    : settings.outputFormat === "vertical4k" ? { width: 2160, height: 3840 }
    : settings.outputFormat === "square" ? { width: 1080, height: 1080 }
      : settings.outputFormat === "portrait4x5" ? { width: 1080, height: 1350 }
        : settings.outputFormat === "custom" ? { width: Number(settings.outputWidth) || 1920, height: Number(settings.outputHeight) || 1080 }
          : { width: 1920, height: 1080 };
  return {
    format: settings.format || "landscape",
    width: output.width,
    height: output.height,
    title: settings.title || "我们的婚礼",
    subtitle: settings.subtitle || "THE WEDDING FILM",
    date: settings.date || "",
    transitionDuration: settings.style === "film" ? 0.48 : 0.72,
    scenes,
  };
}

export function layoutRects(layout) {
  return LAYOUTS[layout] || LAYOUTS["solo-wide"];
}
