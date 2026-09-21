# 产品官网与 GitHub Pages

- 中文：<https://DongZhouGu.github.io/KakaPin/>
- English：<https://DongZhouGu.github.io/KakaPin/en/>

官网是独立的静态产品介绍页，不运行相册编辑器，不接收照片上传。编辑与视频渲染仍使用本机程序。

## 修改与发布

编辑 `site/index.html`、`site/en/index.html` 和共用的 `site/styles.css`。两个语言版本都有完整静态正文、独立标题和描述、语言切换及 hreflang，不依赖 JavaScript 翻译。现有真实截图复用 `docs/assets/` 中已经授权的五张截图，不复制原片。

推送相关文件到 `main` 后，`.github/workflows/pages.yml` 自动构建和部署，也可在 GitHub Actions 中手动运行 Pages。仓库 Pages 的发布源应为 GitHub Actions。

构建命令：

```bash
node scripts/build-site.mjs
```

构建只复制明确列出的 10 个静态文件到忽略的 `.site-dist/`；不发布仓库根目录、服务端、字体、`.runtime/` 或本机配置。为避免旧文件混入发布，输出目录已存在时构建会拒绝继续。重复本地构建前，将上次的 `.site-dist/` 移走；CI 每次使用干净检出。

本地预览可在构建后运行 `python3 -m http.server 4183 --bind 127.0.0.1 --directory .site-dist`，只服务发布目录。不要把整个项目根目录暴露为静态站点。

仓库公开不等于自动授予 MIT 等开源许可；许可证仍需单独选择。中英文官网明确保留现阶段输出、音频、系统验收和素材权利的限制说明。
