#!/bin/sh
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
mkdir -p "$UPLOAD_DIR" 2>/dev/null || true

# Том должен быть доступен на запись пользователю node (uid 1000)
if ! touch "$UPLOAD_DIR/.write-test" 2>/dev/null; then
  echo "[entrypoint] ERROR: $UPLOAD_DIR is not writable by uid $(id -u)." >&2
  echo "[entrypoint] For a bind mount run on the host: chown -R 1000:1000 <host-dir>" >&2
  exit 1
fi
rm -f "$UPLOAD_DIR/.write-test"

echo "[entrypoint] running database migrations"
node /app/migrate.cjs

echo "[entrypoint] starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
