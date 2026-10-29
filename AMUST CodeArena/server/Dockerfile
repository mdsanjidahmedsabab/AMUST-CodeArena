# ── AMUST CodeArena API Server Container ─────────────────────────────────────
FROM node:20-bookworm-slim

# Install system dependencies including OpenSSL, g++ compiler, and native tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source code and config
COPY . .
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]