#!/bin/bash

# Build script for production deployment
echo "Starting production build..."

# Clean previous build completely
echo "Cleaning previous build..."
rm -rf dist
rm -rf node_modules/.vite

# Run TypeScript check
echo "Running TypeScript check..."
npx tsc --noEmit

# Build the project with clean cache
echo "Building project..."
npm run build

# Verify build output
echo "Build completed. Checking output..."
ls -la dist/

# Check if critical files exist
if [ -f "dist/index.html" ]; then
    echo "✅ index.html generated"
else
    echo "❌ index.html missing"
    exit 1
fi

if [ -d "dist/assets" ]; then
    echo "✅ Assets directory exists"
    echo "Chunk files:"
    ls -la dist/assets/chunks/ | head -10
else
    echo "❌ Assets directory missing"
    exit 1
fi

# Verify HTML references match generated chunks
echo "Verifying HTML chunk references..."
if grep -q "assets/chunks/" dist/index.html; then
    echo "✅ HTML contains chunk references"
else
    echo "⚠️  No chunk references found in HTML"
fi

echo "Build process completed successfully!"