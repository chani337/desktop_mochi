#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
if [[ -f Vendor/Sparkle/.verified-2.10.0 ]]; then exit 0; fi
mkdir -p Vendor
archive=$(mktemp "${TMPDIR:-/tmp}/mochi-sparkle.XXXXXX")
trap 'rm -f "$archive"' EXIT
curl -fL --retry 2 -o "$archive" https://github.com/sparkle-project/Sparkle/releases/download/2.10.0/Sparkle-2.10.0.tar.xz
actual=$(shasum -a 256 "$archive" | awk '{print $1}')
[[ "$actual" == "c2bf58aa8387266ac179357b1415d6f2635f044da8be41042af32425dae6da0c" ]] || { echo 'Sparkle checksum mismatch' >&2; exit 1; }
mkdir -p Vendor/Sparkle
tar -xf "$archive" -C Vendor/Sparkle
touch Vendor/Sparkle/.verified-2.10.0
