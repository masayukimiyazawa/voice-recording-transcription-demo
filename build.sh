#!/bin/bash
# Build script for VCR deployment
# VCR packages the source without node_modules/ and dist/,
# so dependencies and the TypeScript build must run on the platform.

set -e

echo "Running VCR build script..."

# --include=dev is required: NODE_ENV=production is set on the platform and
# typescript lives in devDependencies. Without it the build cannot compile.
echo "Installing dependencies (including devDependencies for tsc)..."
if [ -f package-lock.json ]; then
  npm ci --include=dev
else
  npm install --include=dev
fi

# Use the local compiler directly. `npx tsc` can resolve the unrelated
# deprecated "tsc" package from the registry instead of the local binary.
echo "Compiling TypeScript..."
./node_modules/.bin/tsc

echo "Verifying build output..."
if [ ! -f dist/index.js ]; then
  echo "ERROR: dist/index.js was not produced by the build" >&2
  exit 1
fi

echo "Build script completed successfully!"
