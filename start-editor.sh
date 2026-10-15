#!/bin/sh
# Open the editor. Optional: ./start-editor.sh /path/to/game
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
if [ -n "$1" ]; then npm run editor -- --open --project "$1"; else npm run editor -- --open; fi
