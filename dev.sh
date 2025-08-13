#!/bin/bash

echo "🚀 Starting Chrome Extension Development Mode..."
echo "📁 Source: ./src and ./public"
echo "📁 Build: ./dist"
echo "🔄 Auto-rebuild on changes: Enabled"
echo ""

# Check if dist folder exists, if not build it first
if [ ! -d "dist" ]; then
    echo "📦 Building extension for the first time..."
    npm run build
fi

echo "👀 Watching for changes..."
echo "💡 Make changes to your source files and they'll auto-rebuild!"
echo "🔄 Reload the extension in Chrome after each rebuild"
echo ""

# Start the watch mode
npm run watch
