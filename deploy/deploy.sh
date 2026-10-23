#!/usr/bin/env bash
# Deploys one image tag on the server:
#   migrations in a one-off container -> new app container -> smoke /health -> keep current and previous images.
# Usage: deploy.sh <image-tag>. A manual rollback is the same call with an older tag.
# Never rolls back by itself: if a step fails, the script stops and exits non-zero.
set -euo pipefail

TAG="${1:?usage: deploy.sh <image-tag>}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO=ghcr.io/ekemel737-beep/personal-crm
export APP_IMAGE="$REPO:$TAG"

compose() {
  docker compose -p prod -f "$APP_DIR/deploy/compose.yml" --env-file "$APP_DIR/.env" "$@"
}

# CI logs in to GHCR right before calling this script; drop the credentials when done.
trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

echo "==> Image $APP_IMAGE"
docker image inspect "$APP_IMAGE" >/dev/null 2>&1 || docker pull "$APP_IMAGE"

echo "==> Database"
compose up -d --wait db

echo "==> Migrations"
compose run --rm migrate

echo "==> App"
compose up -d --wait --wait-timeout 120 app

echo "==> Smoke /health"
for url in http://127.0.0.1:3100/health https://app.ekemel.ru/health; do
  if ! body=$(curl -fsS --max-time 10 "$url"); then
    echo "Smoke check FAILED: $url. The new version is running but unhealthy; nothing was rolled back." >&2
    exit 1
  fi
  echo "$url -> $body"
done

echo "==> Cleanup: keep only the current and previous images"
mkdir -p "$APP_DIR/state"
current=$(cat "$APP_DIR/state/current-tag" 2>/dev/null || true)
if [ -n "$current" ] && [ "$current" != "$TAG" ]; then
  echo "$current" > "$APP_DIR/state/previous-tag"
fi
echo "$TAG" > "$APP_DIR/state/current-tag"
previous=$(cat "$APP_DIR/state/previous-tag" 2>/dev/null || true)
docker image ls "$REPO" --format '{{.Tag}}' | while read -r tag; do
  if [ "$tag" != "$TAG" ] && [ "$tag" != "$previous" ]; then
    docker image rm "$REPO:$tag" >/dev/null && echo "removed $REPO:$tag"
  fi
done

echo "==> Deployed $TAG (previous: ${previous:-none})"
