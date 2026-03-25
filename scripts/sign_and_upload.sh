#!/usr/bin/env bash
set -euo pipefail
LOG=/tmp/sign_upload.log
echo "--- START $(date) ---" > "$LOG"
exec &> >(tee -a "$LOG")

echo "PATH=$PATH"
[ -n "${GITHUB_TOKEN-}" ] && echo "GITHUB_TOKEN=SET" || echo "GITHUB_TOKEN=NOT_SET"

echo "-- Check existing tools --"
command -v brew || true
command -v java || true
java -version 2>&1 || true
command -v keytool || true
command -v jarsigner || true
command -v apksigner || true

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found; attempting non-interactive install (may require password)"
  export NONINTERACTIVE=1
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true
  if [ -d /opt/homebrew/bin ]; then export PATH="/opt/homebrew/bin:$PATH"; fi
  if [ -d /usr/local/bin ]; then export PATH="/usr/local/bin:$PATH"; fi
fi

if command -v brew >/dev/null 2>&1; then
  echo "Installing JDK and Android tools via brew (may prompt)"
  brew update || true
  brew install --cask temurin || true
  brew install --cask android-commandlinetools android-platform-tools || true
fi

# locate sdkmanager
SDKMANAGER=$(command -v sdkmanager || true)
if [ -z "$SDKMANAGER" ]; then
  if [ -x "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager" ]; then
    SDKMANAGER="$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager"
  elif [ -x "/opt/homebrew/share/android-commandlinetools/bin/sdkmanager" ]; then
    SDKMANAGER="/opt/homebrew/share/android-commandlinetools/bin/sdkmanager"
  fi
fi
echo "sdkmanager: ${SDKMANAGER:-not_found}"
if [ -n "$SDKMANAGER" ] && [ -x "$SDKMANAGER" ]; then
  yes | "$SDKMANAGER" "platform-tools" "platforms;android-33" "build-tools;33.0.2" || true
  yes | "$SDKMANAGER" --licenses || true
  export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_SDK_ROOT/build-tools/33.0.2:$ANDROID_SDK_ROOT/platform-tools:$PATH"
fi

echo "-- APK files --"
ls -lh /tmp/trainer-universal.apk /tmp/member-universal.apk /Users/admin/Desktop/LIFT/build-1774117991989.apk || true

KS=/tmp/liftapp_keystore.jks
KS_PASS=password
ALIAS=liftapp
if [ ! -f "$KS" ]; then
  echo "Generating keystore at $KS"
  keytool -genkeypair -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=LiftApp, OU=Dev, O=Lift, L=City, ST=State, C=US" || true
else
  echo "Keystore exists: $KS"
fi

SIGNED=()
for src in /tmp/trainer-universal.apk /tmp/member-universal.apk /Users/admin/Desktop/LIFT/build-1774117991989.apk; do
  if [ ! -f "$src" ]; then
    echo "skip missing $src"
    continue
  fi
  out=/tmp/$(basename "$src" .apk)-signed.apk
  cp "$src" "$out"
  if command -v apksigner >/dev/null 2>&1; then
    echo "Signing $out with apksigner"
    apksigner sign --ks "$KS" --ks-pass pass:$KS_PASS --key-pass pass:$KS_PASS "$out" || true
  elif command -v jarsigner >/dev/null 2>&1; then
    echo "Signing $out with jarsigner"
    jarsigner -keystore "$KS" -storepass "$KS_PASS" -keypass "$KS_PASS" "$out" "$ALIAS" || true
  else
    echo "No signing tool available (apksigner/jarsigner)"
    exit 127
  fi
  SIGNED+=("$out")
done

echo "Signed: ${SIGNED[*]}"

if [ -z "${GITHUB_TOKEN-}" ]; then
  echo "GITHUB_TOKEN not set — set it and re-run to upload signed APKs"
  echo "Log saved to $LOG"
  exit 0
fi

UPLOAD_BASE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/rpnramesh/liftapp-releases/releases/tags/testv.01" | python3 -c "import sys,json; r=json.load(sys.stdin); print((r.get('upload_url') or '').split('{')[0])") || true
echo "UPLOAD_BASE=$UPLOAD_BASE"
if [ -z "$UPLOAD_BASE" ]; then
  echo "Failed to fetch upload base for release tag testv.01"
  echo "Log saved to $LOG"
  exit 1
fi

for s in "${SIGNED[@]}"; do
  [ -f "$s" ] || { echo "skip missing $s"; continue; }
  name=$(basename "$s")
  echo "Uploading $name..."
  out=$(mktemp)
  http_code=$(curl -s -w "%{http_code}" -o "$out" -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/octet-stream" --data-binary @"$s" "$UPLOAD_BASE?name=$name") || true
  echo "HTTP $http_code: $(cat $out)"
done

echo "--- END $(date) ---"
