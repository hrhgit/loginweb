#!/bin/bash

# Build script for production deployment
echo "Starting production build..."

# Clean previous build
rm -rf dist

# Run TypeScript check
echo "Running TypeScript check..."
npx tsc --noEmit

# Build the project
echo "Building project..."
npm run build

# Verify build output
echo "Build completed. Checking output..."
ls -la dist/

echo "Build process completed successfully!"