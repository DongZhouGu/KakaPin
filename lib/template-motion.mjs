// Seek-safe motion: all positions depend only on local time, never on frame history.
export const clamp01 = value => Math.max(0, Math.min(1, value));
export function transitionEdge(type, progress, y) {
  const p = clamp01(progress);
  return type === 'pagefold'
    ? 1 - p + Math.sin(y * Math.PI) * Math.sin(p * Math.PI) * .065
    : p * 1.2 - .1 + .045 * Math.sin(y * 19) + .024 * Math.sin(y * 53) + .009 * Math.sin(y * 191);
}
export function transitionClip(type, progress) {
  if (progress <= 0) return 'inset(0 100% 0 0)';
  if (progress >= 1) return 'inset(0)';
  const side = type === 'pagefold' ? 100 : 0;
  const edge = Array.from({length:161}, (_, i) => transitionEdge(type, progress, i/160) * 100 + '% ' + i/160 * 100 + '%');
  return 'polygon(' + [side + '% 0%', ...edge, side + '% 100%'].join(',') + ')';
}
export function transitionFilter(type, duration, offset) {
  if (!['pagefold','inkreveal'].includes(type)) return `xfade=transition=${type}:duration=${duration}:offset=${offset}`;
  // FFmpeg's custom P runs from 1 (A) to 0 (B).
  const edge = type === 'pagefold' ? 'W*(P+sin(Y/H*PI)*sin((1-P)*PI)*0.065)'
    : 'W*((1-P)*1.2-0.1+0.045*sin(Y/H*19)+0.024*sin(Y/H*53)+0.009*sin(Y/H*191))';
  const test = type === 'pagefold' ? `gte(X,${edge})` : `lte(X,${edge})`;
  const fold = type === 'pagefold' ? `if(gt(X,(${edge})-W*0.028*sin((1-P)*PI)),A*0.52+if(eq(PLANE,0),235,128)*0.48,A)` : 'A';
  const expr = `if(gte(P,1),A,if(lte(P,0),B,if(${test},B,${fold})))`;
  return `xfade=transition=custom:duration=${duration}:offset=${offset}:expr='${expr}'`;
}

export function pageFoldSvg(progress) {
  const width = .028 * Math.sin(progress * Math.PI), points = [];
  for (let i=0;i<=80;i++) points.push([(transitionEdge('pagefold',progress,i/80)-width)*1920,i/80*1080]);
  for (let i=80;i>=0;i--) points.push([transitionEdge('pagefold',progress,i/80)*1920,i/80*1080]);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1920 1080"><polygon points="'+points.map(p=>p.join(',')).join(' ')+'" fill="#ffffff" opacity=".48"/></svg>';
}

export function galleryPhases(scene) {
  const duration = Number(scene.duration), count = scene.photos.length;
  if (count < 2 || scene.kind === 'cover' || scene.photos.some(p => p.type === 'video')) return [];
  const margin = Math.min(.8, duration * .15), slot = (duration - 2*margin) / count;
  return scene.photos.map((_, index) => ({ index, start: margin + index*slot, end: margin + (index+1)*slot, ramp: Math.min(.38, slot*.32) }));
}
export function galleryAmount(phase, time) {
  const a = clamp01(Math.min((time - phase.start)/phase.ramp, (phase.end - time)/phase.ramp));
  return Math.sin(a * Math.PI / 2) ** 2;
}
export function galleryExpression(phase) {
  return `pow(sin(min(1,max(0,min((t-${phase.start})/${phase.ramp},(${phase.end}-t)/${phase.ramp})))*PI/2),2)`;
}
export function focusRect(rect, amount, target) {
  return Object.fromEntries(['x','y','w','h'].map(key => [key, rect[key] + (target[key] - rect[key])*amount]));
}
