#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RELEASE_DIR="${PROJECT_ROOT}/desktop/release"
STAGING_DIR="/tmp/transformo_bootstrap_staging"
APP_BUNDLE="${STAGING_DIR}/Transformo Docs.app"
DMG_OUTPUT="${RELEASE_DIR}/TransformoDocs-0.1.0-arm64-bootstrap.dmg"

echo "=== Building Transformo Docs Bootstrap DMG (< 50MB) ==="

# 1. Clean staging
rm -rf "${STAGING_DIR}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"

# 2. Compile native Swift launcher
echo "Compiling native Swift launcher for macOS arm64..."
swiftc -O \
    -target arm64-apple-macos12.0 \
    "${SCRIPT_DIR}/main.swift" \
    -o "${APP_BUNDLE}/Contents/MacOS/Transformo Docs"

# 3. Copy Info.plist and Icon
cp "${SCRIPT_DIR}/Info.plist" "${APP_BUNDLE}/Contents/Info.plist"

ICON_SRC="${RELEASE_DIR}/mac-arm64/Transformo Docs.app/Contents/Resources/electron.icns"
if [ -f "${ICON_SRC}" ]; then
    cp "${ICON_SRC}" "${APP_BUNDLE}/Contents/Resources/electron.icns"
fi

# 4. Create /Applications symlink
ln -s /Applications "${STAGING_DIR}/Applications"

# 5. Build DMG with hdiutil
mkdir -p "${RELEASE_DIR}"
rm -f "${DMG_OUTPUT}"

echo "Creating compressed DMG..."
hdiutil create \
    -volname "Transformo Docs" \
    -srcfolder "${STAGING_DIR}" \
    -ov \
    -format UDZO \
    "${DMG_OUTPUT}"

# Clean staging
rm -rf "${STAGING_DIR}"

# 6. Verify and report
echo ""
echo "=== Build Complete! ==="
ls -lh "${DMG_OUTPUT}"
shasum -a 256 "${DMG_OUTPUT}"
echo ""
echo "Output DMG location: ${DMG_OUTPUT}"
