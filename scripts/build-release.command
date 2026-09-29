#!/bin/zsh
set -euo pipefail
cd "${0:A:h}/.."
version=$(node -p "require('./windows/mochi-desktop/package.json').version")
mac_version=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' macos/DesktopCat/Info.plist)
[[ "$version" == "$mac_version" ]] || { echo 'Mac and Windows versions must match' >&2; exit 1; }
[[ ! -d "release/v$version" ]] || { echo "release/v$version already exists; inspect it before rebuilding" >&2; exit 1; }
macos/DesktopCat/build.command
npm ci --prefix windows/mochi-desktop --no-audit --no-fund
npm test --prefix windows/mochi-desktop
npm run build:win --prefix windows/mochi-desktop
mkdir -p "release/v$version/mac"
ditto -c -k --sequesterRsrc --keepParent macos/DesktopCat/DesktopCat.app "release/v$version/mac/DesktopCat.zip"
signing_args=(--account desktop-mochi)
if [[ -n "${SPARKLE_ED_KEY_FILE:-}" ]]; then signing_args=(--ed-key-file "$SPARKLE_ED_KEY_FILE"); fi
macos/DesktopCat/Vendor/Sparkle/bin/generate_appcast "${signing_args[@]}" --maximum-deltas 0 --download-url-prefix "https://github.com/chani337/desktop_mochi/releases/download/v$version/" "release/v$version/mac"
cp outputs/Mochi-Windows/"Mochi-Setup-$version.exe" outputs/Mochi-Windows/"Mochi-Setup-$version.exe.blockmap" outputs/Mochi-Windows/"Mochi-$version-win-x64.zip" outputs/Mochi-Windows/latest.yml "release/v$version/"
echo "배포 파일 준비 완료: release/v$version (아직 게시하지 않음)"
