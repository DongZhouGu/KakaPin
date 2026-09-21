# 架构与数据边界

KakaPin 是单用户本地应用：浏览器负责编辑，Node.js 负责文件与项目，Sharp / FFmpeg 负责图像合成与视频输出。没有云服务、数据库或前端打包器。

## 代码地图

| 位置 | 职责 |
| --- | --- |
| `public/index.html` / `app.js` | 项目库、三栏编辑器、故事板、保存和预览 |
| `public/styles.css` / `workspace.css` | 应用品牌与交互样式 |
| `public/composition.css` | 成片画面在浏览器中的样式 |
| `server.mjs` | HTTP API、导入、存储、图片处理与渲染任务 |
| `lib/layout-engine.mjs` | 按比例规划初始画面与排版 |
| `lib/project-state.mjs` | 文档规范化、编辑操作、素材参与状态与保存校验 |
| `lib/style-catalog.mjs` | 共享风格、胶片变体、几何和调色参数 |
| `lib/template-art.mjs` / `template-motion.mjs` | 珍藏系列图形、遮罩与按时间求值的动效 |
| `lib/timeline.mjs` | 画面起止时间与转场重叠 |
| `lib/project-summary.mjs` / `workspace-memory.mjs` | 项目卡片摘要、浏览器恢复位置 |
| `lib/runtime-config.mjs` / `scripts/launch.mjs` | 配置、工具检查、端口识别与启动 |
| `test/` | 不依赖私人素材的单元测试 |
| `scripts/test-*-exports.mjs` | 需要独立服务的真实渲染回归 |

预览通过 `/modules` 读取共享模块，服务端直接导入相同模块。几何、状态、时间线与新模板图形共享；浏览器 CSS 与 FFmpeg 的栅格化和调色实现并不完全相同，不能宣称逐像素一致。

## 一次编辑如何保存

1. 导入文件复制进运行目录，服务端生成缩略图／预览和媒体元数据。
2. 排版引擎根据素材比例产生初始画面，视频保留完整时长。
3. 浏览器维护编辑文档和会话内撤销历史；保存请求携带基础版本号。
4. 服务端验证媒体引用与文档结构，对同一项目串行写入；临时 JSON 写完后原子替换。
5. 过期版本会返回冲突，不静默覆盖另一个窗口的更新。它不是多人协同算法。

「移出影片」改变参与状态，不删除素材文件。重新加入追加为独立画面；撤销用于恢复原有组合与顺序。追加素材／更换音乐／刷新页面会重置当前撤销历史，详见[使用指南](user-guide.md)。

## 数据目录

默认以程序目录为基准，使用 `.runtime/`：

```text
.runtime/
├── incoming/             上传的临时中转文件
├── projects/<id>/
│   ├── project.json      元数据、设置、画面、版本
│   ├── assets/           导入的照片、视频与音乐
│   ├── thumbs/           素材缩略图
│   ├── previews/         浏览器轻量预览
│   └── frames/           渲染中间文件
└── outputs/              导出的 MP4
```

配置优先级：环境变量 → `kakapin.config.json` → 默认值。路径相对程序目录解析，和启动终端的当前目录无关。配置示例见 [`kakapin.config.example.json`](../kakapin.config.example.json)。

程序包历史名称 `wedding-album-studio` 保留以避免无关兼容性变更；GitHub 仓库与面向用户的名称为 KakaPin。新克隆不会附带作者的相册。迁移要另外复制运行目录，且需先停止服务和渲染。

## 渲染

照片由 Sharp 合成静帧，视频由 FFmpeg 按布局与原时长处理；按时间计算的模板动效和转场在导出阶段合成。最终编码为 H.264、30 FPS，可混入单独提供的背景音乐，暂不保留源视频音轨。

内部画布固定为 1920×1080。其他输出尺寸通过缩放和留边适配。当前没有 GPU 性能保证、原生 4K 构图、断点续渲或跨进程持久化的任务队列；服务退出会中止正在进行的工作。

## 安全边界

服务绑定 `127.0.0.1`，资源通过本地 HTTP 访问。loopback 不等于身份认证；不要将此服务转发到公网或多人网络环境。具体限制见 [SECURITY.md](../SECURITY.md)。

仓库忽略默认运行目录、备份、字体和二进制。自定义运行路径应放在仓库外。文档截图只能使用无隐私的演示素材，测试日志和渲染产物不要提交。
