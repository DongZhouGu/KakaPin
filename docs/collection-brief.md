# 珍藏系列 · 制作简报与来源

## 目标与边界

给 KakaPin 本机相册编辑器增加六个不同的构图系统，用纸张、装帧与陈列方式表达珍藏感，让用户照片成为主角。面向婚礼摄影师和自行制作相册的新人，交付可选模板及一致的浏览器预览 / MP4 渲染实现。

沿用已批准的 KakaPick / KakaPin 深灰界面、品牌橙与双框标识；品牌只出现于编辑器。成片无强制文字、水印或品牌色覆盖。素材、照片方向、手动设置与完整视频时长优先。

本轮使用原生 SVG、CSS 与现有 Sharp / FFmpeg 渲染器，不购买商业素材、不下载模板、字体或二进制，也不迁移渲染框架。动效按时间计算，支持任意位置预览；没有累计位移或随机逐帧抖动。

## 六个方向

| 模板 | 构图和材质 | 节奏 |
| --- | --- | --- |
| 暗房印样 | 炭黑相纸、琥珀套准线、网格；无穿孔 | 短闪黑 |
| 手工剪贴 | 暖牛皮纸、白相纸、半透明撕口胶带、少量落影；照片正向 | 淡化 |
| 杂志跨页 | 奶白对开纸、主图和细节区、细分隔线；无强制标题 | 擦除 |
| 实体影集 | 布面衬底、纸页弧线、书脊明暗、相角 | 可选纸页翻动（2D 曲边与折面，不宣称 3D 书籍物理模拟） |
| 网格画廊 | 炭灰展示空间、整齐图组、单张展开再归位 | 时间驱动聚焦，可关闭；四图建议 8–12 秒 |
| 水墨显影 | 浅宣纸、静态墨痕、不规则笔刷边缘；照片原色 | 可选笔刷状横向显影 |

相片按原比例适配单元格；全部竖图的四图页改用四列。纸纹种子固定。小字由用户输入；背景色、分组和转场各自可控，切换模板不静默重排或覆盖手动转场。

## 参考与原创范围

- [FluxVFX Contact Sheet](https://fluxvfx.gumroad.com/l/ultimate-contact-sheet-slideshow-after-effects-template)：借鉴摄影师印样陈列的逻辑。
- [Motion Array Scrapbook Album](https://motionarray.com/after-effects-templates/scrapbook-album-238479/)：手工相册、胶带等材质方向。
- [Wedding Planner Presentation](https://elements.envato.com/wedding-planner-powerpoint-presentation-02-UH54TQT)：跨页、主图与细节的编辑式层次。
- [StPageFlip](https://github.com/Nodlik/StPageFlip)：实体书籍浏览交互方向；未集成其代码，不将网页组件当成 MP4 渲染器。
- [Codrops GridToSlider](https://github.com/codrops/GridToSlider)：网格与单图的空间关系；未复制示例大字、图片或代码。
- [Ink Wedding Slideshow](https://elements.envato.com/ink-wedding-slideshow-i-mogrt-Y6CQ9KZ)：水墨遮罩显影方向。

以上仅作视觉研究，不包含其付费模板、照片、商标或字体。六款图形、遮罩与运动公式在项目内原创实现。FFmpeg 实现依据其 [官方滤镜文档](https://ffmpeg.org/ffmpeg-filters.html#xfade)。

## 验收

单元测试覆盖六款结构、遮罩、边界、四图组合、撤销与完整视频。临时目录中运行真实导出，不接触用户项目；对照输出帧与浏览器预览，检查横竖照片、黑底、模板选择、动效开关及视频时长。Windows 运行验收需在 Windows 机器上完成。
