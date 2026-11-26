#!/bin/sh
# Hosts mount the persistent disk as root; make it writable by the unprivileged "node" user, then drop privileges.
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown -R node:node "${DATA_DIR:-/data}"
  exec gosu node "$@"
fi
exec "$@"
