#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 Python 3。请安装 Python 后再运行；Windows 用户可下载使用版。"
  exit 1
fi
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)'
exec python3 server.py
