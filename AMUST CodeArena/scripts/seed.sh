#!/bin/bash
set -e

echo "================================================================"
echo "   AMUST CodeArena — Master Database Seeder"
echo "================================================================"
node server/prisma/seed.js
