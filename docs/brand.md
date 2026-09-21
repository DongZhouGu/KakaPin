# KakaPin 品牌规范

## 同一品牌，不同工作环节

KakaPick 帮助摄影师选片，KakaPin 把照片与视频组合成相册影片。
用户可见产品名统一为 **KakaPin**，功能描述为「本地相册成片」。暂不另设中文产品名。

- 主文案：选好照片，轻松拼成片。
- 功能说明：导入照片和视频，自动组合画面。调整风格、文字和节奏，在本机导出。
- 语气：轻松、直接、可信；优先短句和明确动作，不夸大自动化能力。
- 隐私说明：本地处理、原片保留，不宣称不存在的云端或项目互通能力。

## 与 KakaPick 共用的视觉语言

依据本机 KakaPick 项目的 `docs/brand.md`、`src/client/styles.css` 和 `BrandMark.tsx`，沿用以下约定：

| Token | 值 | 用途 |
| --- | --- | --- |
| brand-orange | #FF7A1A | 主行动、选中边框、键盘焦点 |
| brand-orange-hover | #FF8F3D | 主行动悬停 |
| brand-orange-pressed | #E86100 | 主行动按下 |
| canvas | #0B0C0E | 画布与页面背景 |
| surface | #181A1E | 面板与卡片 |
| surface-raised | #24272D | 浮层、辅助控件 |
| text-primary | #F7F7F5 | 主文字 |
| text-secondary | #A6A8AD | 辅助说明 |
| success | #35C76F | 已保存、导出成功 |
| warning | #FFB547 | 待保存、保存中 |
| danger | #FF5C57 | 保存与导出错误 |

中文使用苹方等系统无衬线字体，英文优先 SF Pro。品牌名使用 700 字重，数字使用等宽数字特性。
橙色实心按钮使用深色文字以保证对比度；状态色不被品牌橙替代。
按钮与状态反馈保持 120–200ms，键盘焦点有可见轮廓，并尊重减少动态效果偏好。

## 标志

- 延续 KakaPick 的两层圆角取景框：48×48 画布，27×27 框，7px 圆角，4px 线宽，后框透明度 0.58。
- KakaPick 中心是勾选，KakaPin 中心改为播放符号，表示照片成片。
- 不引入穿孔、相机机身、光圈、拟人形象或复杂渐变。
- 主标志：`public/assets/brand/kakapin-mark.svg`。
- 浏览器图标：`public/favicon.svg`。
- Logo 不循环运动，不能覆盖照片预览，也不作为导出水印。

## 迁移边界

仅更新名称、品牌资产、界面色彩、文案与状态表现。
保留历史目录 `wedding-album-studio`、npm 内部包名、API 路径和 `.runtime` 数据目录，避免项目失效。
不改动用户项目标题、素材、相册模板、图片调色、排版或导出参数。
