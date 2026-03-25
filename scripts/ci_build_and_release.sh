#!/usr/bin/env bash
set -euo pipefail
echo "CI build-and-release script starting"

# Determine tag (when run in Actions this is refs/tags/<tag>)
TAG=${GITHUB_REF##*/}
echo "Tag: ${TAG:-local}"

# Ensure Android SDK root is set
: ${ANDROID_SDK_ROOT:=${HOME}/Android/Sdk}
export ANDROID_SDK_ROOT

# Prepare keystore if provided
if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  echo "Decoding keystore..."
  echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > /tmp/keystore.jks
  KEYSTORE=/tmp/keystore.jks
else
  echo "No ANDROID_KEYSTORE_BASE64 provided; expecting keystore already present" >&2
  KEYSTORE=${KEYSTORE:-}
fi

# Build with Gradle
if [ -f ./gradlew ]; then
  echo "Running Gradle assembleRelease..."
  chmod +x ./gradlew
  ./gradlew clean assembleRelease -x lint || true
else
  echo "gradlew not found; aborting" >&2
  exit 1
fi

# Locate the release APK (first matching)
APK_PATH=$(find . -type f -name "*release*.apk" | grep -v "unaligned" | head -n1 || true)
if [ -z "$APK_PATH" ]; then
  echo "No release APK found" >&2
  exit 1
fi
echo "Found APK: $APK_PATH"

# Tools
BUILD_TOOLS="33.0.2"
ZIPALIGN="$ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS/zipalign"
APKSIGNER="$ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS/apksigner"
AAPT="$ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS/aapt"

if [ ! -x "$ZIPALIGN" ] || [ ! -x "$APKSIGNER" ]; then
  echo "zipalign or apksigner not found under $ANDROID_SDK_ROOT/build-tools/$BUILD_TOOLS" >&2
  exit 1
fi

# Align APK
ALIGNED=/tmp/aligned.apk
echo "Running zipalign..."
rm -f "$ALIGNED"
"$ZIPALIGN" -v -p 4 "$APK_PATH" "$ALIGNED"

# Sign APK
SIGNED=/tmp/signed.apk
cp "$ALIGNED" "$SIGNED"
if [ -n "${KEYSTORE:-}" ]; then
  echo "Signing with apksigner"
  "$APKSIGNER" sign --ks "$KEYSTORE" --ks-pass pass:"${KEYSTORE_PASSWORD}" --ks-key-alias "${KEY_ALIAS}" --key-pass pass:"${KEY_PASSWORD}" "$SIGNED"
else
  echo "No keystore to sign with; skipping signing" >&2
fi

# Verify
echo "Verifying signature"
"$APKSIGNER" verify --verbose "$SIGNED" || true

# Prepare upload to GitHub Release
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN not set; cannot upload release asset" >&2
  exit 1
fi

REPO=${GITHUB_REPOSITORY:-$(git config --get remote.origin.url | sed -E 's|.*[:/](.+/.+)\.git$|\1|')}
TAG_TO_USE=${TAG:-local}

echo "Fetching release for tag $TAG_TO_USE in $REPO"
release=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG_TO_USE" )
release_id=$(echo "$release" | jq -r .id // empty)
if [ -z "$release_id" ] || [ "$release_id" = "null" ]; then
  echo "Release not found; creating release $TAG_TO_USE"
  create_resp=$(curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" \
    -d "{\"tag_name\": \"$TAG_TO_USE\", \"name\": \"$TAG_TO_USE\", \"prerelease\": false}" \
    "https://api.github.com/repos/$REPO/releases")
  release_id=$(echo "$create_resp" | jq -r .id)
fi

if [ -z "$release_id" ] || [ "$release_id" = "null" ]; then
  echo "Failed to create or find release" >&2
  exit 1
fi

upload_url=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/releases/$release_id" | jq -r .upload_url | sed -e 's/{?name,label}//')

# Delete existing asset with same name (if any)
ASSET_NAME="${TAG_TO_USE}-$(basename "$SIGNED")"
echo "Preparing to upload as $ASSET_NAME"
assets=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/releases/$release_id/assets")
existing_id=$(echo "$assets" | jq -r ".[] | select(.name==\"$ASSET_NAME\") | .id" | head -n1 || true)
if [ -n "$existing_id" ]; then
  echo "Deleting existing asset id $existing_id"
  curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/releases/assets/$existing_id"
fi

echo "Uploading asset..."
curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/vnd.android.package-archive" --data-binary "@$SIGNED" "$upload_url?name=$ASSET_NAME" | jq -r .browser_download_url

echo "Done."
