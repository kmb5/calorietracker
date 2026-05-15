#!/bin/sh
# entrypoint.sh — run migrations then start the server.
# Using 'exec' replaces this shell with the server process so that signals
# (SIGTERM on docker stop) are delivered directly to uvicorn.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
exec "$@"
