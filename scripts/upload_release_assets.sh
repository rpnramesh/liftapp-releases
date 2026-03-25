#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-rpnramesh/liftapp-releases}"
TAG="${TAG:-testv.02}"
FILES=(/tmp/trainer-apksigner.apk /tmp/member-apksigner.apk)

: "${GITHUB_TOKEN:?Please export GITHUB_TOKEN in this shell (repo scope)}"

# fetch or create release
RELEASE_JSON=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" || true)
if printf '%s' "$RELEASE_JSON" | jq -e 'has("message") and .message=="Not Found"' >/dev/null 2>&1; then
  echo "Release $TAG not found — creating..."
  RELEASE_JSON=$(curl -s -H "Authorization: token $GITHUB_TOKEN" -X POST -d "{\"tag_name\":\"$TAG\",\"name\":\"$TAG\"}" "https://api.github.com/repos/$REPO/releases")
fi

UPLOAD_BASE=$(printf '%s' "$RELEASE_JSON" | jq -r '.upload_url // empty' | sed 's/{.*//')
if [ -z "$UPLOAD_BASE" ]; then
  echo "ERROR: could not determine upload_url from release JSON"
  printf '%s\n' "$RELEASE_JSON"
  exit 1
fi

# iterate files: delete existing same-name assets then upload
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "skip missing $f"
    continue
  fi
  name=$(basename "$f")
  echo "Processing $name..."

  # find existing asset ids for this name
  ASSET_IDS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/releases/tags/$TAG" \
    | jq -r --arg name "$name" '.assets[]? | select(.name == $name) | .id')

  for id in $ASSET_IDS; do
    if [ -n "$id" ]; then
      echo "Deleting existing asset id=$id name=$name"
      curl -s -X DELETE -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/releases/assets/$id"
    fi
  done

  out=$(mktemp)
  echo "Uploading $name..."
  curl -s -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$f" \
    "$UPLOAD_BASE?name=$(printf '%s' "$name" | sed 's/ /%20/g')" -o "$out"

  url=$(jq -r '.browser_download_url // empty' "$out" || true)
  if [ -n "$url" ]; then
    echo "Uploaded: $url"
  else
    echo "Upload failed; server response:"
    cat "$out"
    rm -f "$out"
    exit 1
  fi
  rm -f "$out"
  sleep 1
done

echo "All done." 
