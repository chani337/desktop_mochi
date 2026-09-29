#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
./prepare-sparkle.command
mkdir -p DesktopCat.app/Contents/MacOS DesktopCat.app/Contents/Resources DesktopCat.app/Contents/Frameworks
ditto Vendor/Sparkle/Sparkle.framework DesktopCat.app/Contents/Frameworks/Sparkle.framework
cp Info.plist DesktopCat.app/Contents/Info.plist
cp Resources/*.png DesktopCat.app/Contents/Resources/
cp Vendor/Sparkle/LICENSE DesktopCat.app/Contents/Resources/Sparkle-LICENSE.txt
swiftc Sources/*.swift -o DesktopCat.app/Contents/MacOS/DesktopCat -framework AppKit -framework Sparkle -F Vendor/Sparkle -Xlinker -rpath -Xlinker @executable_path/../Frameworks -module-cache-path "${TMPDIR:-/tmp}/desktopcat-module-cache"
codesign --force --sign - DesktopCat.app
echo '빌드 완료: DesktopCat.app'
