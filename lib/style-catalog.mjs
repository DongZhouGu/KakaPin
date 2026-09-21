import { LAYOUTS } from './layout-engine.mjs';
import { COLLECTION_STYLES, COLLECTION_LAYOUTS } from './template-art.mjs';

// One catalog drives the picker, browser preview, still frames and video export.
// Templates never contain captions, rotation or time-dependent image movement.
export const STYLES = [
  ...COLLECTION_STYLES,
  { id: 'black', name: '纯黑影院', note: '纯黑背景 · 原色无框', group: 'minimal', fresh: true, background: '#000000', frame: '#000000', text: '#f5f5f5', accent: '#b7b7b7', border: 0, radius: 0, saturation: 1, brightness: 1, contrast: 1, sepia: 0, caption: '#ffffff', cssFilter: 'none' },
  { id: 'film', name: '复古胶片', note: '黑色相纸 · 温暖颗粒', group: 'film', background: '#090908', frame: '#17130f', text: '#d7a449', accent: '#c9683f', border: 0, radius: 0, saturation: .82, brightness: 1.03, contrast: .97, sepia: 0, caption: '#ead36d', cssFilter: 'sepia(.12) saturate(.82) contrast(.97) brightness(1.03)' },
  { id: 'polaroid', name: '拍立得日记', note: '宽底白框 · 即时相纸', group: 'paper', fresh: true, background: '#d9d3c7', frame: '#fffdf6', text: '#514d43', accent: '#9b8e72', border: 24, radius: 2, paperCaption: true, saturation: .9, brightness: 1.035, contrast: .96, sepia: .1, caption: '#666052', cssFilter: 'saturate(.9) brightness(1.035) sepia(.1) contrast(.96)' },
  { id: 'editorial', name: '留白画报', note: '杂志留白 · 原色影像', group: 'paper', fresh: true, background: '#f6f4ef', frame: '#f6f4ef', text: '#383934', accent: '#a5a093', border: 0, radius: 0, paperCaption: true, saturation: 1, brightness: 1, contrast: 1, sepia: 0, caption: '#55564f', cssFilter: 'none' },
  { id: 'noir', name: '黑白纪事', note: '纯粹黑白 · 银色细边', group: 'film', fresh: true, background: '#141619', frame: '#c5c6c3', text: '#e7e6e1', accent: '#979b9d', border: 2, radius: 0, saturation: 0, brightness: 1, contrast: 1.075, sepia: 0, caption: '#f2f1e9', cssFilter: 'grayscale(1) contrast(1.075)' },
  { id: 'sepia', name: '暖棕相纸', note: '复古棕调 · 旧相册纸', group: 'paper', fresh: true, background: '#cdb68f', frame: '#ede0c4', text: '#654a30', accent: '#a78a5e', border: 18, radius: 6, saturation: .62, brightness: 1.04, contrast: .94, sepia: .72, caption: '#fff4d8', cssFilter: 'saturate(.62) brightness(1.04) sepia(.72) contrast(.94)' },
  { id: 'sage', name: '森系婚礼', note: '鼠尾草绿 · 植物线描', group: 'wedding', fresh: true, background: '#e3e8dc', frame: '#fbfcf5', text: '#4d6252', accent: '#8ca186', border: 16, radius: 12, saturation: .88, brightness: 1.04, contrast: .98, sepia: 0, caption: '#f7faec', cssFilter: 'saturate(.88) brightness(1.04) contrast(.98)' },
  { id: 'blush', name: '樱粉誓言', note: '柔粉花瓣 · 圆角相纸', group: 'wedding', fresh: true, background: '#f3e2de', frame: '#fffaf7', text: '#805d60', accent: '#c59192', border: 16, radius: 46, saturation: .94, brightness: 1.04, contrast: .97, sepia: .08, caption: '#fff5f1', cssFilter: 'saturate(.94) brightness(1.04) sepia(.08) contrast(.97)' },
  { id: 'french', name: '法式留白', note: '奶油纸感 · 轻盈克制', group: 'paper', background: '#ebe6dd', frame: '#fffdf8', text: '#746b61', accent: '#66776c', border: 14, radius: 0, saturation: .76, brightness: 1.05, contrast: 1, sepia: 0, caption: '#fff8eb', cssFilter: 'saturate(.76) brightness(1.05)' },
  { id: 'ceremony', name: '典礼序章', note: '暖调相纸 · 仪式氛围', group: 'wedding', background: '#e9e0d5', frame: '#fffaf2', text: '#776b60', accent: '#9e2f2b', border: 14, radius: 0, saturation: .96, brightness: 1.01, contrast: 1, sepia: 0, caption: '#fff8eb', cssFilter: 'saturate(.96) brightness(1.01)' },
];

export const STYLE_IDS = STYLES.map(style => style.id);
export const STYLE_PRESETS = Object.fromEntries(STYLES.map(style => [style.id, style]));
export const TEMPLATE_GROUPS = [{ id: 'all', name: '全部' }, { id: 'collection', name: '珍藏系列 · 新' }, { id: 'minimal', name: '简约' }, { id: 'film', name: '胶片' }, { id: 'paper', name: '相纸' }, { id: 'wedding', name: '婚礼' }];
export const FILM_VARIANTS = [
  { id: 'colorprint', name: '经典彩负', note: '琥珀印字 · 无穿孔' },
  { id: 'matteblack', name: '哑光黑边', note: '细腻纸纹 · 无穿孔' },
  { id: 'silverblack', name: '银盐片框', note: '冷银印字 · 无穿孔' },
  { id: 'none', name: '无框电影', note: '纯净画面 · 黑色背景' },
];
export const LOOKS = [
  ...STYLES.filter(style => style.fresh).map(style => ({ ...style, style: style.id })),
  ...FILM_VARIANTS.map(variant => ({ ...variant, id: 'film-' + variant.id, style: 'film', filmTemplate: variant.id, group: 'film' })),
  ...STYLES.filter(style => !style.fresh && style.id !== 'film').map(style => ({ ...style, style: style.id })),
];
export const getStyle = id => STYLE_PRESETS[id] || STYLE_PRESETS.film;
export function normalizeBackgroundColor(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) return '#' + [...hex].map(c => c + c).join('');
  return /^[0-9a-f]{6}$/.test(hex) ? '#' + hex : null;
}
export const sceneBackground = settings => normalizeBackgroundColor(settings.backgroundColor) || getStyle(settings.style).background;
export function backgroundTextColor(settings) {
  const custom = normalizeBackgroundColor(settings.backgroundColor);
  if (!custom) return getStyle(settings.style).text;
  const rgb = [1, 3, 5].map(i => parseInt(custom.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  const luminance = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  return luminance > .179 ? '#222222' : '#f5f5f5';
}
export const hasFilmTemplate = settings => settings.style === 'film' && ['colorprint', 'matteblack', 'silverblack'].includes(settings.filmTemplate);
export const selectedLook = settings => LOOKS.find(look => look.style === settings.style && (look.style !== 'film' || look.filmTemplate === settings.filmTemplate)) || LOOKS.find(look => look.id === 'film-colorprint');

const rectangles = layouts => Object.fromEntries(Object.entries(layouts).map(([key, rows]) => [key, rows.map(([x,y,w,h]) => ({x,y,w,h}))]));
const FILM_LAYOUTS = rectangles({
  'solo-wide': [[0,0,1920,1080]], 'solo-portrait': [[620,45,680,990]],
  'portrait-duo': [[170,48,700,984],[1050,48,700,984]],
  'editorial-trio': [[0,0,1180,1080],[1200,0,720,530],[1200,550,720,530]],
  'hero-aside': [[0,0,1290,1080],[1320,150,540,780]],
});
const FILM_TEMPLATE_LAYOUTS = rectangles({
  'solo-wide': [[78,88,1764,900]], 'solo-portrait': [[650,105,620,870]],
  'portrait-duo': [[240,112,620,850],[1060,112,620,850]],
  'editorial-trio': [[130,105,1050,870],[1210,105,570,420],[1210,555,570,420]],
  'hero-aside': [[105,110,1160,850],[1310,195,470,690]],
});
const POLAROID_LAYOUTS = rectangles({
  'solo-wide': [[240,90,1440,900]], 'solo-portrait': [[605,70,710,940]],
  'portrait-duo': [[236,86,670,908],[1014,86,670,908]],
  'editorial-trio': [[140,80,960,920],[1160,80,620,440],[1160,560,620,440]],
  'hero-aside': [[130,90,1090,900],[1320,210,470,660]],
});
const EDITORIAL_LAYOUTS = rectangles({
  'solo-wide': [[240,120,1440,840]], 'solo-portrait': [[635,120,650,840]],
  'portrait-duo': [[240,120,650,840],[1030,120,650,840]],
  'editorial-trio': [[160,120,970,840],[1210,120,550,400],[1210,560,550,400]],
  'hero-aside': [[160,120,1100,840],[1380,250,380,580]],
});

export function styleRects(settings, layout) {
  const library = COLLECTION_LAYOUTS[settings.style] || (hasFilmTemplate(settings) ? FILM_TEMPLATE_LAYOUTS : settings.style === 'film' ? FILM_LAYOUTS
    : settings.style === 'polaroid' ? POLAROID_LAYOUTS : settings.style === 'editorial' ? EDITORIAL_LAYOUTS : LAYOUTS);
  return library[layout] || LAYOUTS[layout] || library['solo-wide'];
}

export function frameGeometry(settings, rect) {
  const style = getStyle(settings.style), border = style.border;
  const bottom = style.id === 'polaroid' ? Math.round(Math.min(100, Math.max(52, rect.h * .12)) / 2) * 2
    : ['editorial', 'magazine'].includes(style.id) ? 48 : border;
  const radius = hasFilmTemplate(settings) ? 34 : style.radius;
  return { left: border, top: border, right: border, bottom, width: rect.w - border * 2, height: rect.h - border - bottom, radius, innerRadius: Math.max(0, radius - border) };
}

// Collection layouts are cells, not crop instructions. Fit the entire media
// into each cell; four portrait photos use a single row instead of wide crops.
export function sceneRects(settings, layout, photos = []) {
  let cells = styleRects(settings, layout);
  if (!COLLECTION_LAYOUTS[settings.style]) return cells;
  if (layout === 'grid-quad' && photos.length === 4 && photos.every(p => p.width / p.height < .82)) {
    const book = ['album','magazine'].includes(settings.style);
    const left = book ? 180 : 128, width = book ? 360 : 392, gap = book ? 40 : 32;
    cells = photos.map((_, i) => ({x:left+i*(width+gap),y:120,w:width,h:840}));
  }
  return cells.map((cell, i) => {
    const photo = photos[i];
    if (!photo?.width || !photo?.height) return cell;
    const geometry = frameGeometry(settings, cell), ratio = photo.width / photo.height;
    const width = Math.max(2, Math.floor(Math.min(geometry.width, geometry.height * ratio) / 2)*2);
    const height = Math.max(2, Math.floor(Math.min(geometry.height, geometry.width / ratio) / 2)*2);
    const w = width + geometry.left + geometry.right, h = height + geometry.top + geometry.bottom;
    return { x:Math.round(cell.x + (cell.w-w)/2), y:Math.round(cell.y + (cell.h-h)/2), w, h };
  });
}

export function sepiaMatrix(amount) {
  const s = amount, t = 1 - amount;
  return [[t + .393*s, .769*s, .189*s], [.349*s, t + .686*s, .168*s], [.272*s, .534*s, t + .131*s]];
}

export function videoGrade(styleId) {
  const style = getStyle(styleId);
  if (style.id === 'black') return '';
  // Retain established looks for existing film/french projects.
  if (style.id === 'film') return ',eq=saturation=0.82:contrast=0.94:brightness=0.025,colorbalance=rs=.025:bs=-.018';
  if (style.id === 'french') return ',eq=saturation=0.76:contrast=0.95:brightness=0.035';
  let filter = ',eq=saturation=' + style.saturation + ':contrast=' + style.contrast + ':brightness=' + ((style.brightness - 1) * .6).toFixed(4);
  if (style.sepia) {
    const matrix = sepiaMatrix(style.sepia), names = ['rr','rg','rb','gr','gg','gb','br','bg','bb'];
    filter += ',colorchannelmixer=' + matrix.flat().map((value,i) => names[i] + '=' + value.toFixed(6)).join(':');
  }
  return filter;
}

// Static, text-free artwork at the actual composition dimensions. The browser
// embeds exactly this SVG; Sharp rasterizes the same source for the final video.
export function backdropSvg(styleId, backgroundColor = null) {
  const style = getStyle(styleId), paper = ['polaroid','sepia','sage','blush','french','ceremony','scrapbook','ink','contact','album'].includes(style.id);
  const custom = normalizeBackgroundColor(backgroundColor);
  if (custom || style.id === 'black') return '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="' + (custom || '#000000') + '"/></svg>';
  const defs = '<defs><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".68" numOctaves="2" seed="17" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><radialGradient id="edge"><stop offset="55%" stop-color="#543e28" stop-opacity="0"/><stop offset="100%" stop-color="#543e28" stop-opacity=".14"/></radialGradient></defs>';
  let art = '<rect width="1920" height="1080" fill="' + style.background + '"/>';
  if (paper) art += '<rect width="1920" height="1080" filter="url(#paper)" opacity="' + (style.id === 'sepia' ? '.09' : '.035') + '"/>';
  if (style.id === 'polaroid') art += '<rect width="1920" height="1080" fill="url(#edge)"/>';
  if (style.id === 'editorial') art += '<g stroke="#c5c1b5" stroke-width="2"><path d="M100 66h1720M100 1014h1720"/><path d="M100 66v38m1720-38v38M100 1014v-38m1720 38v-38"/></g><circle cx="960" cy="1014" r="5" fill="#99978b"/>';
  if (style.id === 'noir') art += '<g stroke="#64676a" stroke-width="2" fill="none"><path d="M60 102V54h84m1632 0h84v48M60 978v48h84m1632 0h84v-48"/></g>';
  if (style.id === 'sepia') art += '<rect width="1920" height="1080" fill="url(#edge)"/><g stroke="#94744d" fill="none"><rect x="32" y="32" width="1856" height="1016" stroke-width="2"/><rect x="42" y="42" width="1836" height="996" stroke-width="1"/></g>';
  if (style.id === 'sage') {
    const branch = '<g fill="none" stroke="#81977d" stroke-width="2.2" opacity=".8"><path d="M25 225C78 178 86 89 220 30"/><path d="M60 173C20 159 17 121 25 105C61 110 78 132 60 173ZM91 119C59 86 67 55 83 40C110 59 119 87 91 119ZM130 79C125 48 149 17 174 18C181 47 164 74 130 79ZM68 165C105 155 120 173 119 191C92 201 78 188 68 165ZM102 105C140 94 160 113 159 132C131 142 112 128 102 105Z"/></g>';
    art += branch + '<g transform="translate(1920 1080) rotate(180)">' + branch + '</g>';
  }
  if (style.id === 'blush') {
    art += '<g fill="none" stroke="#c89899" stroke-width="2" opacity=".65"><rect x="36" y="36" width="1848" height="1008" rx="100"/><rect x="48" y="48" width="1824" height="984" rx="92"/></g>';
    const petals = '<g fill="#d8ada9" opacity=".5"><ellipse cx="72" cy="88" rx="36" ry="15" transform="rotate(-35 72 88)"/><ellipse cx="114" cy="58" rx="29" ry="12" transform="rotate(20 114 58)"/><ellipse cx="40" cy="136" rx="12" ry="28" transform="rotate(15 40 136)"/></g>';
    art += petals + '<g transform="translate(1920 1080) rotate(180)">' + petals + '</g>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">' + defs + art + '</svg>';
}
