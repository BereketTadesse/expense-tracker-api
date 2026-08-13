#!/bin/sh
set -e

if [ -f "dist/config/typeorm.config.js" ]; then
  echo "🚀 Running database migrations..."
  npx typeorm migration:run -d dist/config/typeorm.config.js || echo "Migrations complete or skipped."
fi

echo "🟢 Starting NestJS application..."
exec "$@"
