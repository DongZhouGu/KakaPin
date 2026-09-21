import { buildTimeline } from './timeline.mjs';

export function projectSummary(project) {
  const scene = project.plan.scenes.find(s => s.photos.length);
  const { style, filmTemplate, backgroundColor, outputFormat, title } = project.settings;
  return {
    id: project.id, title, revision: project.revision || 0,
    updatedAt: project.updatedAt || project.createdAt,
    count: project.photos.length, excludedCount: project.excludedPhotos?.length || 0, scenes: project.plan.scenes.length,
    thumb: project.photos[0]?.thumb, style, videos: project.photos.filter(p => p.type === 'video').length,
    duration: buildTimeline(project).at(-1)?.end || 0,
    width: project.plan.width, height: project.plan.height, outputFormat,
    previewSettings: { style, filmTemplate, backgroundColor, showCaptions: false },
    previewScene: scene ? { kind: 'photos', layout: scene.layout, photos: scene.photos.map(p => ({ type: p.type, thumb: p.thumb, width: p.width, height: p.height })) } : null,
  };
}
