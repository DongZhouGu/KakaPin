# Third-party and asset notices

This file records the scope of the source repository. It does not replace the license files shipped by upstream packages or grant rights to user-provided media.

## Runtime dependencies

| Component | Role | Upstream license / source |
| --- | --- | --- |
| Express | Local HTTP server | MIT · [expressjs/express](https://github.com/expressjs/express) |
| Multer | Multipart imports | MIT · [expressjs/multer](https://github.com/expressjs/multer) |
| Sharp | Image decoding and compositing | Apache-2.0 · [lovell/sharp](https://github.com/lovell/sharp) |
| libvips and codec dependencies | Installed through Sharp's platform packages | See the license files in the installed packages; they have their own terms |
| FFmpeg / ffprobe | External video tools | Not bundled; license depends on the selected build · [FFmpeg](https://ffmpeg.org/legal.html) |

Exact npm versions and platform packages are recorded in `package-lock.json`. Preserve their notices when redistributing dependencies; this source repository does not vendor `node_modules` or FFmpeg binaries.

## Fonts and user media

The Momo Zhuanji (默陌专辑) font is **not included**. Users must supply a font they are allowed to use. Photos, videos, music, lyrics, and captions are also supplied by users and are not covered by the application's license.

System font names used as fallbacks do not indicate that those font files are distributed or licensed by this project.

## Project artwork and references

- `public/assets/brand/kakapin-mark.svg` and `public/favicon.svg` implement the KakaPin playback variant of the KakaPick double-frame brand language.
- `lib/template-art.mjs` and `lib/template-motion.mjs` contain the project's vector constructions, masks, and motion formulas. Visual references are listed in [the collection brief](docs/collection-brief.md); their commercial templates, photographs, fonts, and code are not bundled.
- The three active PNG files in `public/assets/film-templates/` are generated decorative frame assets from the project's design workflow, not user photographs or scans included from the reference video. Unused experiments are excluded from source control.
- Documentation interface screenshots are captured from an isolated demo instance. `docs/assets/kakapin-start.png` uses the built-in placeholder illustration; the other five interface screenshots use real photos selected with the user's authorization, limited to back views and hand details without front-facing faces. Original photos and demo project data are not distributed. The photographs retain their own rights; their appearance in screenshots does not grant a separate license to extract or reuse them. See [the screenshot tour](docs/screenshots.md).
- OpenCut / OpenReel informed the separation of library, preview, inspector, and storyboard. Their editor code is not incorporated here.

Third-party names are mentioned for attribution or identification; no endorsement is implied. If you find a missing notice or a disputed asset, contact the maintainer with the relevant path and source information, without uploading private media.
