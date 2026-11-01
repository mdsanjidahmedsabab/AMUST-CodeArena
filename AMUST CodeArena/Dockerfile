# ── AMUST CodeArena API Server Container (Root Build Context) ───────────────
FROM node:20-bookworm-slim

# Install system dependencies including OpenSSL, g++ compiler, native tools, and Chromium/Puppeteer shared libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    g++ \
    build-essential \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./
COPY server/prisma ./prisma/
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy server source code and config
COPY server/ .
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
