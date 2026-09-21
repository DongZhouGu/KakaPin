# Changelog

Only shipped code is listed here. Repository setup does not imply that signed installers or a stable release are available.

## Unreleased

### Repository foundation

- Chinese and English product README, startup / migration guide, usage and architecture documentation.
- Contribution and security policies, third-party notices, bug / feature / pull request templates.
- Node.js 22 / 24 syntax and unit-test workflow for macOS, Windows, and Linux.
- Git exclusions for local projects, backups, personal media, configuration, fonts, and video tools.

### Fixed

- Filled the missing Sharp Linux ARM64 optional package in the lockfile so clean Node.js 24 / npm 11 installs can resolve every platform entry. Renderer versions remain unchanged.

### Existing application baseline

- Local photo-and-video album editor with project library, previews, autosave, in-session undo, and storyboard ordering.
- Aspect-aware layouts, per-scene overrides, reversible media exclusion, full-duration video playback and export.
- 16 styles / 19 looks, six keepsake templates, custom backgrounds, 9 transitions, optional captions and background music.
- H.264 MP4 export, common aspect ratios, custom even dimensions and upscaled 4K output.
- macOS `.command` and Windows `.bat` launchers with environment checks and same-instance reuse.

Known limits are documented in the README: fixed landscape composition, no exported source video audio, no native installers, and pending full Windows end-to-end acceptance.
