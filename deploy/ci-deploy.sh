#!/usr/bin/env bash
# Runs on the GitHub Actions runner: copies the deploy files to the server and runs deploy.sh there.
# Env: DEPLOY_SSH_KEY (private deploy key), IMAGE_TAG, GHCR_USER and GHCR_TOKEN (the job's short-lived token).
set -euo pipefail

: "${DEPLOY_SSH_KEY:?}" "${IMAGE_TAG:?}" "${GHCR_USER:?}" "${GHCR_TOKEN:?}"

SERVER=deploy@195.58.55.115
APP_DIR=/srv/personal-crm
here="$(cd "$(dirname "$0")" && pwd)"

key="$(mktemp)"
trap 'rm -f "$key"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$key"
chmod 600 "$key"
ssh_opts=(-i "$key" -o IdentitiesOnly=yes -o BatchMode=yes
          -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$here/known_hosts")

echo "==> Copying deploy files to the server"
tar -C "$here" -cf - compose.yml deploy.sh | ssh "${ssh_opts[@]}" "$SERVER" "tar -C $APP_DIR/deploy -xf -"

echo "==> Logging the server in to GHCR for this deploy"
printf '%s' "$GHCR_TOKEN" | ssh "${ssh_opts[@]}" "$SERVER" "docker login ghcr.io -u $GHCR_USER --password-stdin"

ssh "${ssh_opts[@]}" "$SERVER" "bash $APP_DIR/deploy/deploy.sh $IMAGE_TAG"
