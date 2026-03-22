#!/bin/sh
set -e

echo "=== PlanGo Railway Startup ==="

# Build static Expo bundles at runtime (needs RAILWAY_PUBLIC_DOMAIN)
if [ ! -d "static-build" ]; then
  echo "Building static Expo bundles..."
  
  # Use RAILWAY_PUBLIC_DOMAIN if available, fallback to EXPO_PUBLIC_DOMAIN
  if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
    export EXPO_PUBLIC_DOMAIN="$RAILWAY_PUBLIC_DOMAIN"
    echo "Using RAILWAY_PUBLIC_DOMAIN: $RAILWAY_PUBLIC_DOMAIN"
  fi
  
  node scripts/build.js
  echo "Static build complete!"
else
  echo "Static build already exists, skipping..."
fi

# Start Express server
echo "Starting Express server on port ${PORT:-5000}..."
exec node server_dist/index.js
