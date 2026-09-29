#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
mkdir -p DesktopCat.app/Contents/MacOS DesktopCat.app/Contents/Resources
cp Info.plist DesktopCat.app/Contents/Info.plist
cp Resources/*.png DesktopCat.app/Contents/Resources/
swiftc Sources/main.swift -o DesktopCat.app/Contents/MacOS/DesktopCat -framework AppKit -module-cache-path "${TMPDIR:-/tmp}/desktopcat-module-cache"
codesign --force --sign - DesktopCat.app
echo '빌드 완료: DesktopCat.app'
