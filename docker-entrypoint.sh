#!/bin/sh
set -e

echo "🚀 Running database migrations..."
npx typeorm migration:run -d dist/config/typeorm.config.js || echo "Migrations complete or skipped."

echo "🟢 Starting NestJS application..."
exec "$@"
