#!/bin/sh
cd "$(dirname "$0")"
command -v npm >/dev/null || { echo "Node.js가 필요해요. https://nodejs.org 에서 LTS 버전을 설치해 주세요."; exit 1; }
[ -d node_modules ] || npm install
npm run dev
