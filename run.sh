#!/bin/bash

# run.sh - Automated Helper for Dev Environment

DB_FILE="sqlite.db"

echo "--------------------------------------------------------"
echo "  🌊 Smart Tank Monitor - Dev Runner"
echo "--------------------------------------------------------"

# 1. Install Dependencies if needed (check for node_modules)
if [ ! -d "node_modules" ]; then
    echo "📦 Dependency folder not found. Installing..."
    npm install
fi

# 2. Check Database Status
if [ -f "$DB_FILE" ]; then
    echo "✅ Database found ($DB_FILE)."
else
    echo "⚠️  Database missing. Initializing Schema..."
    npx drizzle-kit push
    if [ $? -eq 0 ]; then
        echo "✅ Schema initialized successfully."
    else
        echo "❌ Failed to initialize database."
        exit 1
    fi
fi

# 3. Start Server
echo "🚀 Starting Development Server..."
npm run server-dev
