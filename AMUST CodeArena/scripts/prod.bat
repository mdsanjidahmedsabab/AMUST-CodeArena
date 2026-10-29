@echo off
echo ================================================================
echo    AMUST CodeArena — Production Turnkey Docker Compose Boot
echo ================================================================
echo Building and orchestrating Postgres 16, Redis 7, Server, Judge Runner, and Nginx Client...
docker compose up --build
