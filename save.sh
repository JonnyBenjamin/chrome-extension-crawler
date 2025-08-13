#!/bin/bash

# Quick save script for Chrome extension
echo "🔄 Saving changes to Git..."

# Add all changes
git add .

# Get current timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Commit with timestamp
git commit -m "Auto-save: $TIMESTAMP"

# Push to GitHub
git push

echo "✅ Changes saved and backed up to GitHub!"
echo "📅 Timestamp: $TIMESTAMP"
