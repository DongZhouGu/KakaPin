# Security Policy

## Supported scope

Security fixes target the latest default-branch source. KakaPin is early-stage software; there are no separate supported release lines or guaranteed response times.

## Intended environment

KakaPin is a **trusted, single-user local application**, not a hosted service. The HTTP server binds to `127.0.0.1`. Do not expose it through a public host, LAN binding, reverse proxy, tunnel, or port forward.

Loopback binding is not authentication. The current app does **not** implement KakaPick's complete Host / Origin / per-process token checks, user authentication, per-user authorization, or an Electron sandbox. Media and export URLs are served directly by the local service. Other local processes with access to your account or port may access data. Do not assume protection against a malicious local process or untrusted web content.

Only import media you trust. Keep Node.js, npm dependencies, FFmpeg, and system codecs updated. Third-party decoders process complex files; KakaPin does not provide a sandboxed media-analysis boundary. Raw errors and local logs may include file paths, so review and redact them before sharing.

## Known dependency advisories (2026-09-21 snapshot)

The initial source snapshot locks Sharp to **0.34.5**. `npm audit --omit=dev` reports a high-severity affected dependency with these public upstream advisories:

- [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj): inherited libvips vulnerabilities; affects Sharp before 0.35.0.
- [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c): inherited libheif vulnerabilities; affects Sharp before 0.35.4.

This repository/documentation setup does not silently upgrade the existing renderer. A dependency upgrade to a patched version, followed by unit and real export regressions, remains required. **Do not process untrusted media with this baseline.** CI currently covers syntax and unit tests, not a clean dependency-security audit. Re-run `npm audit --omit=dev` for current advisory status.

## Data handling

- Default runtime data is in `.runtime/`; it includes originals, previews, project state, and exports.
- Import preserves the original source file. Excluding media from a film does not erase its stored copy.
- Git excludes the default runtime, backups, local configuration, fonts, and video binaries. Custom runtime paths need their own ignore rules or should live outside the repository.
- Do not attach private albums, personal photos, credentials, unredacted logs, or licensed font files to an Issue or PR.
- Stop the service before backing up or migrating runtime data. Maintain an independent backup of valuable media.

## Reporting a vulnerability

Please do not publish exploitation details or sensitive files in a public issue.

Use the repository's **Security → Report a vulnerability** private reporting option when available. If it is unavailable, open a minimal issue asking the maintainer to arrange a private reporting channel, without including exploit steps, secrets, or private media.

Include the affected commit, OS / Node.js / FFmpeg versions, a minimal reproduction using synthetic files, impact, and any mitigation. Allow time for coordinated review before publishing technical details.

## 中文说明

此应用只面向可信的单用户本机环境，不应暴露到局域网或公网。它目前没有完整的 Host / Origin / token 校验或用户鉴权，不能把“只监听本机”理解成完整安全隔离。请仅导入可信文件、及时更新依赖，并在分享日志前去除个人路径和素材信息。安全问题请通过 GitHub 私密漏洞报告；若入口未开启，先提交不含利用细节的联系请求。
