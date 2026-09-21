export const COVER_ID = '__cover__';

export function transitionOverlap(previousDuration, duration, requested = 0.48) {
  return Math.max(0.001, Math.min(requested, previousDuration / 2, duration / 2));
}

export function buildTimeline(project) {
  const scenes = [...project.plan.scenes];
  if (scenes.length && project.settings.includeCover !== false) {
    const photo = project.photos[0];
    scenes.unshift({ id: COVER_ID, kind: 'cover', duration: 3.6, photos: photo ? [photo] : [], layout: photo && photo.width / photo.height < 0.82 ? 'solo-portrait' : 'solo-wide' });
  }
  let end = 0;
  return scenes.map((scene, index) => {
    const duration = Number(scene.photos.find(p => p.type === 'video')?.duration) > 0 && scene.kind !== 'cover'
      ? Number(scene.photos.find(p => p.type === 'video').duration) : scene.duration;
    const overlap = index ? transitionOverlap(scenes[index - 1].duration, duration, project.plan.transitionDuration) : 0;
    const entry = { scene, duration, overlap, start: end - overlap, end: end - overlap + duration };
    end = entry.end;
    return entry;
  });
}

export function entryAt(entries, time) {
  for (let i = entries.length - 1; i >= 0; i--) if (time >= entries[i].start - 0.00001) return i;
  return 0;
}
