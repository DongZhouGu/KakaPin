// Original vector artwork. No commercial template assets or mandatory lettering.
const neutral = { fresh: true, border: 0, radius: 0, saturation: 1, brightness: 1, contrast: 1, sepia: 0, caption: '#ffffff', cssFilter: 'none' };
export const COLLECTION_STYLES = [
  { ...neutral, id: 'contact', name: '暗房印样', note: '黑纸印样 · 琥珀刻度', group: 'collection', background: '#161613', frame: '#dfcda8', text: '#e3d5b5', accent: '#ae8b51', border: 4, recommendedTransition: 'fadeblack' },
  { ...neutral, id: 'scrapbook', name: '手工剪贴', note: '牛皮纸 · 半透明胶带', group: 'collection', background: '#cbbb9e', frame: '#fffaf0', text: '#534d3e', accent: '#8e8165', border: 24, recommendedTransition: 'fade' },
  { ...neutral, id: 'magazine', name: '杂志跨页', note: '大图与细节 · 编辑式留白', group: 'collection', background: '#eeeae2', frame: '#faf8f2', text: '#373733', accent: '#929082', border: 0, paperCaption: true, caption: '#57574e', recommendedTransition: 'wipeleft' },
  { ...neutral, id: 'album', name: '实体影集', note: '布面装帧 · 书脊与相角', group: 'collection', background: '#55534b', frame: '#fffaf0', text: '#eee9dd', accent: '#c6b891', border: 12, recommendedTransition: 'pagefold' },
  { ...neutral, id: 'gallery', name: '网格画廊', note: '网格总览 · 逐张展开', group: 'collection', background: '#1a2023', frame: '#1a2023', text: '#e4e9e8', accent: '#8daba6', recommendedTransition: 'fade' },
  { ...neutral, id: 'ink', name: '水墨显影', note: '宣纸肌理 · 笔刷显影', group: 'collection', background: '#eae8df', frame: '#eae8df', text: '#464d48', accent: '#929a91', recommendedTransition: 'inkreveal' },
];
const rects = items => Object.fromEntries(Object.entries(items).map(([id, rows]) => [id, rows.map(([x,y,w,h]) => ({ x,y,w,h }))]));
export const COLLECTION_LAYOUTS = {
  contact: rects({
    'solo-wide': [[132,100,1656,880]], 'solo-portrait': [[620,96,680,888]],
    'portrait-duo': [[230,96,668,888],[1022,96,668,888]],
    'editorial-trio': [[116,110,1016,860],[1200,110,604,400],[1200,570,604,400]],
    'hero-aside': [[116,146,1144,788],[1320,230,484,620]],
    'grid-quad': [[140,82,784,432],[996,82,784,432],[140,566,784,432],[996,566,784,432]],
  }),
  scrapbook: rects({
    'solo-wide': [[234,140,1452,800]], 'solo-portrait': [[614,100,692,880]],
    'portrait-duo': [[258,100,640,880],[1022,142,640,796]],
    'editorial-trio': [[166,132,974,816],[1222,94,532,400],[1222,578,532,400]],
    'hero-aside': [[144,138,1116,802],[1344,218,438,624]],
    'grid-quad': [[200,116,706,392],[1014,100,706,392],[200,592,706,392],[1014,574,706,392]],
  }),
  magazine: rects({
    'solo-wide': [[208,160,1504,760]], 'solo-portrait': [[634,154,652,778]],
    'portrait-duo': [[194,154,668,778],[1058,154,668,778]],
    'editorial-trio': [[178,146,744,804],[1054,158,672,358],[1150,574,488,330]],
    'hero-aside': [[178,146,744,804],[1138,300,504,530]],
    'grid-quad': [[186,138,680,380],[1054,138,680,380],[186,558,680,380],[1054,558,680,380]],
  }),
  album: rects({
    'solo-wide': [[222,176,1476,728]], 'solo-portrait': [[648,138,624,804]],
    'portrait-duo': [[222,174,630,732],[1068,174,630,732]],
    'editorial-trio': [[222,174,630,732],[1082,176,602,332],[1082,574,602,332]],
    'hero-aside': [[194,226,708,624],[1160,260,468,560]],
    'grid-quad': [[218,174,638,332],[1064,174,638,332],[218,574,638,332],[1064,574,638,332]],
  }),
  gallery: rects({
    'solo-wide': [[96,54,1728,972]], 'solo-portrait': [[604,60,712,960]],
    'portrait-duo': [[96,306,832,468],[992,306,832,468]],
    'editorial-trio': [[96,270,960,540],[1120,96,704,396],[1120,588,704,396]],
    'hero-aside': [[48,216,1152,648],[1296,378,576,324]],
    'grid-quad': [[128,66,800,450],[992,66,800,450],[128,564,800,450],[992,564,800,450]],
  }),
  ink: rects({
    'solo-wide': [[166,100,1588,880]], 'solo-portrait': [[604,80,712,920]],
    'portrait-duo': [[224,96,680,888],[1016,96,680,888]],
    'editorial-trio': [[114,96,1000,888],[1200,96,606,418],[1200,566,606,418]],
    'hero-aside': [[126,124,1140,832],[1354,224,440,634]],
    'grid-quad': [[150,90,758,420],[1012,90,758,420],[150,570,758,420],[1012,570,758,420]],
  }),
};
const wrap = (art, width = 1920, height = 1080) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${art}</svg>`;
const grain = '<defs><filter id="fiber"><feTurbulence baseFrequency=".46 .12" numOctaves="2" seed="41" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs>';

export function templateUnderlaySvg(styleId) {
  if (styleId === 'album') return wrap(grain + '<defs><linearGradient id="spine"><stop stop-color="#6a624c" stop-opacity="0"/><stop offset=".43" stop-color="#6a624c" stop-opacity=".13"/><stop offset=".5" stop-color="#3c3425" stop-opacity=".5"/><stop offset=".6" stop-color="#fffef8" stop-opacity=".55"/><stop offset="1" stop-color="#fffef8" stop-opacity="0"/></linearGradient></defs><rect x="110" y="84" width="1700" height="936" rx="12" fill="#171714" opacity=".35"/><rect x="100" y="70" width="1720" height="930" rx="10" fill="#827557"/><rect x="118" y="78" width="1684" height="916" rx="4" fill="#cfc5ae"/><path d="M122 104Q520 66 958 100Q1370 64 1798 104V964Q1390 933 960 974Q530 935 122 964Z" fill="#f7f2e4"/><path d="M132 978Q550 952 956 984M964 984Q1370 952 1788 978" fill="none" stroke="#847b68" stroke-width="2" opacity=".6"/><rect x="128" y="102" width="1664" height="866" filter="url(#fiber)" opacity=".055"/><rect x="876" y="104" width="168" height="860" fill="url(#spine)"/>');
  if (styleId === 'magazine') return wrap('<rect x="98" y="86" width="1730" height="928" fill="#454239" opacity=".1"/><rect x="88" y="74" width="1744" height="926" fill="#faf8f2"/><path d="M960 74V1000" stroke="#d0cbbf" stroke-width="2"/><path d="M166 126H894M1026 954H1754" stroke="#3d413b" stroke-width="2"/><path d="M934 74V1000" stroke="#eeeae0" stroke-width="16" opacity=".35"/>');
  if (styleId === 'ink') return wrap(grain + '<g fill="#65716b" opacity=".065"><path d="M28 180Q170 85 270 160T580 70L732 128Q474 312 202 266Z"/><path d="M1420 972Q1570 838 1848 928L1910 1060H1386Z"/><ellipse cx="1790" cy="118" rx="108" ry="76"/></g><g fill="#5a665e" opacity=".2"><circle cx="1780" cy="228" r="5"/><circle cx="1760" cy="202" r="2"/><circle cx="118" cy="912" r="4"/></g>');
  return null;
}

export function templateDecorationSvg(styleId, rects) {
  let art = '';
  for (const [index, r] of rects.entries()) {
    const { x, y, w, h } = r;
    if (styleId === 'contact') {
      art += `<g stroke="#b39a66" stroke-width="2" fill="none" opacity=".7"><path d="M${x-14} ${y+22}v-36h36M${x+w-22} ${y-14}h36v36M${x-14} ${y+h-22}v36h36M${x+w-22} ${y+h+14}h36v-36"/></g><g fill="#b39a66" opacity=".8"><rect x="${x+4}" y="${y-20}" width="38" height="3"/><rect x="${x+48}" y="${y-20}" width="12" height="3"/></g>`;
    } else if (styleId === 'scrapbook') {
      const tx = x + w * (index % 2 ? .67 : .32), tw = Math.min(172, w * .24);
      art += `<path d="M${tx} ${y-14}l${tw*.23} 3 8-4 ${tw*.29} 3 5-3 ${tw*.36} 2-6 45-${tw*.25} -2-7 3-${tw*.28} -2-5 2-${tw*.28} -1Z" fill="#d8c28c" opacity=".82"/><path d="M${tx+8} ${y+8}h${tw-26}" stroke="#8d7b58" stroke-width="1" opacity=".2"/>`;
      art += `<path d="M${x+8} ${y+h+5}h${w-8}" stroke="#63543e" stroke-opacity=".22" stroke-width="5"/>`;
    } else if (styleId === 'album') {
      art += `<g fill="#cec2a9" stroke="#ac9e83" stroke-width="1"><path d="M${x-5} ${y+29}v-34h34Z"/><path d="M${x+w-29} ${y-5}h34v34Z"/><path d="M${x-5} ${y+h-29}v34h34Z"/><path d="M${x+w-29} ${y+h+5}h34v-34Z"/></g>`;
    }
  }
  return art ? wrap(art) : null;
}

// Seeded, bounded brush edges. Reused as the browser's mask and export's alpha.
export function mediaMaskSvg(styleId, width, height, radius = 0, black = false) {
  let shape = `<rect width="${width}" height="${height}" rx="${radius}" fill="white"/>`;
  if (styleId === 'ink') {
    const points = [], n = 80;
    const rough = i => 3 + (Math.sin(i * 7.41) + 1) * 3 + (Math.sin(i * 1.93) + 1) * 2;
    for (let i=0; i<=n; i++) points.push([i/n*width, rough(i)]);
    for (let i=0; i<=n; i++) points.push([width-rough(i+81), i/n*height]);
    for (let i=n; i>=0; i--) points.push([i/n*width, height-rough(i+162)]);
    for (let i=n; i>=0; i--) points.push([rough(i+243), i/n*height]);
    shape = '<polygon points="' + points.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ') + '" fill="white"/>';
  }
  return wrap((black ? '<rect width="100%" height="100%" fill="black"/>' : '') + shape, width, height);
}
