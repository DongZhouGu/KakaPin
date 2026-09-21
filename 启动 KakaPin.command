#!/bin/bash
# Finder uses a minimal PATH; include standard official/Homebrew locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 LTS 版本：https://nodejs.org/en/download"
  read -r -p "按回车关闭…" answer
  exit 1
fi
node scripts/launch.mjs "$@"
result=$?
if [ "$result" -ne 0 ]; then
  read -r -p "按回车关闭…" answer
fi
exit "$result"
