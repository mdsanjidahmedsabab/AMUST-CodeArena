#!/bin/bash
set -e

echo "================================================================"
echo "   AMUST CodeArena — Master Automated Health Audit Suite"
echo "================================================================"
node server/test/run_all_tests.js
