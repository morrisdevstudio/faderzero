#!/usr/bin/env bash
set -eu

APP_GROUP_DIR="/home/docker-yapi/appGroup"
APP_ROOT="$APP_GROUP_DIR/faderzero-pwa"
TAILSCALE_STATE_DIR="$APP_ROOT/tailscale-state"
COMPOSE_FILE="$APP_GROUP_DIR/docker-compose.remote.yml"
CADDYFILE_SOURCE="$APP_GROUP_DIR/Caddyfile"

mkdir -p "$APP_ROOT/releases"
mkdir -p "$TAILSCALE_STATE_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker est requis sur le serveur."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Fichier compose introuvable: $COMPOSE_FILE"
  echo "Copie d'abord pwa/deploy/docker-compose.remote.yml vers le serveur."
  exit 1
fi

if [ ! -f "$CADDYFILE_SOURCE" ]; then
  echo "Fichier Caddy introuvable: $CADDYFILE_SOURCE"
  echo "Copie d'abord pwa/deploy/Caddyfile vers le serveur."
  exit 1
fi

docker rm -f faderzero-tailscale >/dev/null 2>&1 || true
docker run -d \
  --name faderzero-tailscale \
  --restart unless-stopped \
  --network host \
  -v "$TAILSCALE_STATE_DIR:/var/lib/tailscale" \
  tailscale/tailscale:stable \
  tailscaled \
  --tun=userspace-networking \
  --socks5-server=localhost:1055 \
  --outbound-http-proxy-listen=localhost:1056 \
  --state=/var/lib/tailscale/tailscaled.state \
  --socket=/tmp/tailscaled.sock

docker compose -f "$COMPOSE_FILE" up -d --force-recreate

cat <<'EOF'
Bootstrap termine.

Etapes suivantes:
1. Authentifier Tailscale:
   docker exec faderzero-tailscale tailscale --socket=/tmp/tailscaled.sock up --hostname faderzero-server --accept-dns=false

2. Activer Tailscale Serve:
   docker exec faderzero-tailscale tailscale --socket=/tmp/tailscaled.sock serve --bg --yes 8080

3. Verifier:
   docker exec faderzero-tailscale tailscale --socket=/tmp/tailscaled.sock serve status
EOF
