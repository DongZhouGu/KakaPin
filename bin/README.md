# 本机视频工具

可把与你的系统匹配的 FFmpeg / ffprobe 放在这个目录，启动器自动识别：

- Windows：`ffmpeg.exe`、`ffprobe.exe`（如所用构建依赖 DLL，一并保留）。
- macOS：`ffmpeg`、`ffprobe`，并保留可执行权限。

也支持按平台存放：`darwin-arm64/`、`darwin-x64/`、`win32-x64/`、`win32-arm64/`。
不要把 Mac 的二进制复制给 Windows 使用。也可把工具加入 PATH，或在配置文件中指定位置。

请从 [FFmpeg 官方下载页](https://ffmpeg.org/download.html) 选择对应平台的构建。启动器要求 `libx264` 编码器和 `xfade` 滤镜。此目录不随项目分发第三方二进制。
