# KakaPin · Local album films

<img src="public/assets/brand/kakapin-mark.svg" alt="KakaPin mark" width="72" height="72">

**Choose your photos. Make them a film.**

KakaPin is a local photo-and-video album editor. Combine landscape and portrait media, choose paper or film-inspired templates, add your own small captions, set the pacing, and render an MP4 on your computer.

[Download preview ZIP](https://github.com/DongZhouGu/KakaPin/releases/tag/v1.0.0-beta.1) · [Website](https://www.dzgu.top/KakaPin/en/) · [Quick start](#quick-start) · [Documentation](docs/README.md) · [简体中文](README.md)

> Early version · Local server + browser · macOS / Windows launch scripts · Node.js 22+ · FFmpeg

![KakaPin workspace with real photos, instant-paper preview, and storyboard](docs/assets/kakapin-workspace.png)

Real interface captures use user-authorized back-view and hand-detail photos, without front-facing faces. Original photos and demo projects are not distributed. [Full screenshot tour](docs/screenshots.md).

<details>
<summary>More screenshots: projects, templates, media management, and export</summary>

### Project library

![Project thumbnails, search, and resume editing](docs/assets/kakapin-projects.png)

### Templates and whole-film settings

![Scrapbook template, whole-film style, and background colors](docs/assets/kakapin-templates.png)

### Exclude media without deleting the original

![Excluded media remains available to add back](docs/assets/kakapin-media.png)

### Export size and quality

![4K upscaled output and fine quality settings](docs/assets/kakapin-export.png)

4K currently upscales a 1080p composition; it does not provide native 4K detail. See the limitations below.

</details>

## From memories to a film

You decide which moments to include, what to say, and how they should flow. KakaPin handles layout and rendering without making the final aesthetic decisions for you or adding a product watermark.

Made for weddings, travel, family memories, and photography portfolios. [KakaPick](https://github.com/DongZhouGu/KakaPick) helps you select photos; KakaPin turns them into a film. They share a brand language but currently run independently, without automatic project exchange.

1. **Import photos and videos.** Read dimensions and video duration, create lightweight previews, and preserve imported originals.
2. **Choose a look.** Compare 19 templates in the editor, from film and instant paper to scrapbooks, galleries, or a clean black canvas.
3. **Arrange the sequence.** Use automatic grouping or adjust layouts, reorder storyboard scenes, and exclude or restore media.
4. **Add your own words and pacing.** Enter one caption per line, edit or clear captions, set photo holds, and mix transition types by relative weight.
5. **Export locally.** Render H.264 MP4. Videos retain their complete duration rather than following the photo hold time.

## Highlights

- Local processing: no account or cloud upload; media, projects, and exports stay on your computer.
- Mixed photos and videos, aspect-aware grouping, whole-film defaults, and per-scene overrides.
- 16 styles / 19 looks, custom background colors, 9 transitions, and optional gallery focus motion.
- Autosave, in-session undo/redo, reversible media exclusion, project search, and resume editing.
- Optional line-by-line captions and background music; no forced captions or continuous photo jitter.

| Collection | Looks |
| --- | --- |
| Keepsakes | Contact sheet, scrapbook, magazine spread, photo album, grid gallery, ink reveal |
| Film | Color print, matte black, silver frame, frameless cinema, monochrome |
| Paper | Instant diary, editorial white space, sepia paper, French minimal |
| Wedding | Sage, blush, ceremony |
| Minimal | Black cinema |

Film frames have no sprocket holes. Custom background colors do not recolor the white paper around instant photos. Selecting a template does not silently regroup media or overwrite manual transitions.

## Quick start

Install [Node.js](https://nodejs.org/en/download) 22 or a newer LTS release and [FFmpeg / ffprobe](https://ffmpeg.org/download.html). FFmpeg must include `libx264` and `xfade`. Put the tools on PATH or in [`bin/`](bin/README.md).

Download and fully extract `KakaPin-v1.0.0-beta.1-macOS-Windows.zip` from [Releases](https://github.com/DongZhouGu/KakaPin/releases/tag/v1.0.0-beta.1), or clone below. The ZIP contains source and launch scripts, not a standalone installer; Node.js, FFmpeg, fonts, and installed dependencies are not bundled.

```bash
git clone https://github.com/DongZhouGu/KakaPin.git
cd KakaPin
npm ci
npm run launch
```

The launcher checks the environment and opens `http://127.0.0.1:4177/`. Keep the terminal open while editing or exporting; press `Ctrl+C` to stop. Dependencies need an internet connection for initial installation. Normal use does not require Codex.

For later launches, double-click `启动 KakaPin.command` on macOS or `启动 KakaPin.bat` on Windows. These are launch scripts, **not standalone App / EXE installers**. They can install missing Node dependencies with your approval, but do not install system tools or fonts.

For captions, provide a properly licensed **Momo Zhuanji (默陌专辑)** font at `fonts/momo.ttf` or `fonts/momo.otf`. No font is bundled. Caption-free exports work without it. Run `npm run doctor` to check your setup.

See the [startup and migration guide](双击启动说明.md) (Chinese) for configuration and troubleshooting. Do not copy `node_modules` between operating systems; run `npm ci` on the destination.

## Output and limitations

- H.264 MP4 at 30 FPS; 16:9, 9:16, 1:1, 4:5, landscape / portrait 4K, and custom even dimensions from 320 to 7680 pixels.
- **The composition is still 1920×1080 landscape.** Other aspect ratios fit with padding; 4K output is upscaled, not native 4K composition.
- **Source video audio is not included in exports.** Separate background music is supported. Automatic beat detection is not implemented.
- Preview images are lightweight; browser color, text edges, and transitions can differ from final FFmpeg output.
- Up to 1000 media items per import, 8 GB per file. HEIC and video support depend on installed decoders. This is not a RAW processor.
- Startup and real exports have been tested on macOS. Windows launch and path handling are implemented, but full Windows end-to-end acceptance has not yet been completed.
- No cloud sync, multi-user collaboration, installer auto-update, or independent composition system for each aspect ratio. Page folding is a 2D effect, not a physical 3D book simulation.

## Data and security

The default `.runtime/` directory contains imported media copies, previews, project state, and exports. Importing or excluding a file does not modify its original source. Stop the service before backing up or migrating this directory.

The source repository excludes runtime data, backups, local configuration, fonts, video tools, and private media. **Git is not a backup of your albums.** Keep custom runtime directories outside the repository or add appropriate ignore rules.

`marketing/` (Xiaohongshu campaign copy and images) and `videos/` (promo video projects) stay local and are excluded from both Git and Release ZIPs. Authorized product screenshots are included; original photographs are not. See [release packaging](docs/releases.md).

The service binds to loopback and is intended for trusted, single-user local use. Do not expose it through public hosting, reverse proxies, or port forwarding. It does not have all of KakaPick's security hardening. See [SECURITY.md](SECURITY.md).

## Development

Vanilla HTML / CSS / JavaScript, Node.js / Express, Sharp, and FFmpeg. No frontend build step is required.

```bash
npm ci
npm run dev
npm run check
npm test
```

Syntax checks and unit tests need no personal photos, FFmpeg, or fonts. Export regressions have additional requirements. CI checks Node.js 22 / 24 on macOS, Windows, and Linux; it does not certify the full export workflow on those systems.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/architecture.md), [testing](docs/testing.md), and the [changelog](CHANGELOG.md). Most detailed user documentation is currently in Chinese; the application UI is also Chinese.

## License and assets

No open-source license has been selected for this repository yet; do not assume permission to copy, modify, or redistribute it. Third-party dependencies, fonts, music, photos, and videos retain their own terms. Fonts and FFmpeg binaries are not bundled. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
