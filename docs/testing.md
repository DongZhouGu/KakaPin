# 测试与验收

## 基础检查

```bash
npm ci
npm run check
npm test
```

语法检查与单元测试只需要 Node.js 和锁定的 npm 依赖，不读取真实 `.runtime`，也不要求 FFmpeg、授权字体或用户照片。测试覆盖品牌、模板几何、画面状态、素材移出／恢复、排版保护、完整视频时长、转场边界与启动器路径处理。

GitHub Actions 对 Node.js 22 / 24 与 macOS / Windows / Linux 组合运行这些检查。Windows CI 通过只说明这些检查通过，不代表浏览器交互、编解码器或大素材导出完成了 Windows 实机验收。

```bash
npm run doctor
```

环境检查需要实际的视频工具，但不会启动编辑器。它检查 Node.js、FFmpeg / ffprobe、编码器／滤镜、字体与端口，缺少必需项会返回非零状态。

## 实际导出回归

不要在日常使用的 4177 端口上运行导出测试。脚本会创建测试项目和 MP4，应使用 **4182 端口 + 一次性临时目录**。它们要求 `ffmpeg` / `ffprobe` 在 PATH 中。

macOS / Linux，第一个终端：

```bash
qa_runtime=$(mktemp -d "${TMPDIR:-/tmp}/kakapin-qa.XXXXXX")
PORT=4182 ALBUM_RUNTIME_DIR="$qa_runtime" node server.mjs
```

Windows PowerShell，第一个终端：

```powershell
$qaRuntime = Join-Path ([IO.Path]::GetTempPath()) ("kakapin-qa-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $qaRuntime
$env:PORT = "4182"
$env:ALBUM_RUNTIME_DIR = $qaRuntime
node server.mjs
```

记下该临时目录的实际路径，在第二个终端运行对应测试。以下 `RUNTIME`、`PHOTO` 和 `VIDEO` 是需要替换的路径，不是项目内置文件。不要传入真实运行目录。

| 命令 | 验证内容 |
| --- | --- |
| `node scripts/test-style-exports.mjs RUNTIME PHOTO_A PHOTO_B` | 19 款模板、小字、输出尺寸、时间线与视频完整时长；需要授权默陌字体 |
| `node scripts/test-collection-exports.mjs RUNTIME PHOTO_1 PHOTO_2 PHOTO_3 PHOTO_4 VIDEO` | 六款珍藏模板、四图组合与完整视频；不需要文字字体 |
| `node scripts/test-background-exports.mjs RUNTIME PHOTO VIDEO` | 模板默认／黑色／自定义蓝色，白相纸保留，留边颜色与完整视频 |
| `node scripts/test-media-exclusion.mjs RUNTIME PHOTO VIDEO` | 移出素材不进成片、空影片保护、精确撤销、重新加入、原文件哈希不变 |

照片使用 JPG，视频使用一段短 H.264 MP4；不要使用私人或未授权素材。珍藏测试推荐四张竖图和约 1–2 秒短片；其他测试视频也宜短于几秒。测试结果、帧图和合成对照图保存在临时目录。完成后在第一个终端按 `Ctrl+C`，确认没有任务在写入后再清理该目录。

## 手动验收清单

- 项目库：新建、搜索、排序、改名、返回并继续编辑。
- 素材：追加、单项／批量移出、全部移出保护、重新加入、撤销恢复原顺序。
- 排版：单图、混合横竖图、四张竖图、视频；重组前显示影响，保护手动页面。
- 模板：19 款均可切换；不覆盖单页时长／转场；背景色在预览与导出一致。
- 动效：可关闭画廊聚焦；照片不旋转、不持续抖动；转场端点无残留。
- 小字：逐项修改、空行、隐藏、全部清空、缺字库提示；无强制文案。
- 保存：自动保存、失败阻止导出、并发窗口冲突不静默覆盖。
- 视频：完整播放和导出，不按照片秒数截断；明确源视频音频暂不输出。
- 输出：常见比例、自定义尺寸、横／竖 4K；检查留边与固定横版构图提示。
- 启动：缺工具、缺字体、重复启动、端口被其他程序占用、中文／空格路径。

发布前请分别在 macOS 与 Windows 记录真实启动、预览和 MP4 导出结果。不要把测试脚本的路径模拟当作 Windows 实机运行记录。
