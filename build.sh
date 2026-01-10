#!/bin/bash

# build.sh - Automated Helper for Production Build

DB_FILE="sqlite.db"

echo "--------------------------------------------------------"
echo "  🛠️  Smart Tank Monitor - Production Builder"
echo "--------------------------------------------------------"

# 1. Install Dependencies
echo "📦 Installing Dependencies..."
npm install

# 2. Check Database Status & Push Schema
# In production, we always want to ensure schema is up to date
if [ -f "$DB_FILE" ]; then
    echo "✅ Database found ($DB_FILE). Syncing Schema..."
else
    echo "⚠️  Database missing. Creating..."
fi

npx drizzle-kit push
if [ $? -eq 0 ]; then
    echo "✅ Schema synced successfully."
else
    echo "❌ Failed to sync database schema."
    exit 1
fi

# 3. Build Application
echo "🏗️  Building Next.js Application..."
npm run build

if [ $? -eq 0 ]; then
    echo "--------------------------------------------------------"
    echo "✅ Build Complete! Run 'npm start' to launch."
    echo "--------------------------------------------------------"
else
    echo "❌ Build Failed."
    exit 1
fi
