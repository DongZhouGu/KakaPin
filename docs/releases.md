# Release ZIP 与发布范围

首个包：[v1.0.0-beta.1](https://github.com/DongZhouGu/KakaPin/releases/tag/v1.0.0-beta.1)。

- `KakaPin-v1.0.0-beta.1-macOS-Windows.zip`：同一份源码启动包，包含双击启动器；不是免安装的 App / EXE。
- `SHA256SUMS.txt`：下载校验文件。
- [中英文发布说明](releases/v1.0.0-beta.1.md)。

Node.js 22+、FFmpeg / ffprobe、授权字体（可选）和 Node 依赖需在本机准备。完整解压后按[启动说明](../双击启动说明.md)操作，首次安装依赖需要网络。

## 不会打进包的内容

`marketing/` 小红书文案与图文、`videos/` 宣传视频工程、`.runtime/` 项目和原片、`.backups/`、导出结果、`node_modules/`、本机配置、密钥、字体与工具二进制。

`marketing/`、`videos/` 在 `.gitignore` 中按整个目录排除，不只是忽略图片扩展名。`.gitattributes` 的 `export-ignore` 也保护源码归档；正式 ZIP 从固定标签读取已跟踪文件，并使用允许的源码目录及文件列表，不遍历本地工作目录。

产品官网 `site/`、文档 `docs/` 和经过授权、没有正脸的界面截图是产品资料，会随源码启动包分发。它们不属于本地宣发草稿。截图不赋予额外的照片再利用许可。

## 维护者打包

先完成测试并提交源代码，创建指向对应提交的版本标签，再运行：

```bash
node scripts/package-release.mjs v1.0.0-beta.1
```

输出到 `release-artifacts/v1.0.0-beta.1/`（已忽略）。脚本要求标签存在，拒绝覆盖旧包，拒绝所选目录中的敏感文件类型或符号链接。Git 归档保留 Mac 启动器可执行权限，并根据属性生成 Windows 启动脚本的 CRLF 换行。

发布前解压检查文件清单、校验 SHA-256，在新目录运行 `npm ci` 和检查／测试，并验证启动。然后将 ZIP 与 `SHA256SUMS.txt` 附到对应标签的 GitHub Release。预览版应标记为 pre-release，发布说明必须保留已知限制；不要把跨系统单元测试当作 Windows 完整实机验收。

校验示例（将文件名替换为下载的版本）：

```bash
# macOS
shasum -a 256 KakaPin-v1.0.0-beta.1-macOS-Windows.zip
```

```powershell
# Windows PowerShell
Get-FileHash .\KakaPin-v1.0.0-beta.1-macOS-Windows.zip -Algorithm SHA256
```

把结果与 `SHA256SUMS.txt` 比较。校验值用于检查文件完整性，不等同于开发者签名或系统公证。
