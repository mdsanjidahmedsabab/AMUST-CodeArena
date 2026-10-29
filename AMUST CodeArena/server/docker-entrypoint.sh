#!/bin/sh
set -e

echo "================================================================"
echo "   AMUST CodeArena — Production Server Boot & Initialization    "
echo "================================================================"

echo "📦 [1/3] Synchronizing Prisma Database Schema..."
npx prisma db push --skip-generate

echo "🌱 [2/3] Checking and Running Production Database Seed..."
node prisma/seed.js

echo "🚀 [3/3] Starting AMUST CodeArena Production Server..."
exec node src/index.js
