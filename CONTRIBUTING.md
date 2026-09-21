# Contributing to KakaPin

欢迎提交明确的问题反馈、专注的修复、测试和文档改进。KakaPin 延续 KakaPick 的本地优先与克制表达，但不共享全部实现或安全边界。

## 本地开发

需要 Node.js 22 或更新的 LTS。克隆后运行：

```bash
npm ci
npm run dev
```

界面位于 `http://127.0.0.1:4177/`。导入视频和实际导出另需 FFmpeg / ffprobe；带画面小字的导出另需授权默陌字体。环境准备见[启动说明](双击启动说明.md)。

提交前运行：

```bash
npm run check
npm test
```

涉及模板、视频时长、转场或渲染的变更，还需使用独立临时目录进行真实导出回归。详细命令见[测试说明](docs/testing.md)。

## 保持这些约定

- 不修改用户源照片，不让“移出影片”变成物理删除。
- 视频使用完整时长，不继承照片停留秒数。
- 保留单页手动设置，重组素材前给出影响范围，不静默覆盖。
- 预览与渲染共用风格、几何和时间定义；不要加入逐帧随机位置或不稳定运动。
- 保持 `127.0.0.1` 监听；不把本地原型改成开放的网络服务。
- 改动数据格式需兼容旧项目或提供显式迁移，不随意变更历史内部名称。
- 只提交代码和可公开的合成演示素材，不提交 `.runtime`、备份、原片、导出、字体、二进制或本机配置。
- 有行为变化时补测试；有设置、能力或限制变化时同步修改中英文 README 和相关文档。

## Issues 与 Pull Requests

问题反馈请提供系统、Node.js / FFmpeg 版本、复现步骤、预期和实际结果。截图去除人脸、客户姓名、项目路径和私人内容。安全问题不要发公开 Issue，见 [SECURITY.md](SECURITY.md)。

PR 说明修改目的、影响范围、测试结果与未验证的平台。尽量一次解决一个问题，不混入无关格式化和依赖升级。新增依赖说明必要性与许可证；代码、图形和素材需拥有相应提交权限。

## English summary

Use Node.js 22+ LTS, run `npm ci`, `npm run check`, and `npm test`. Real export regressions require FFmpeg and an isolated temporary runtime. Preserve source files, full video duration, manual scene settings, loopback binding, and backwards compatibility. Do not commit personal media, runtime data, fonts, binaries, secrets, or machine-specific configuration. Include focused tests and document platform limitations. Report security issues privately.
