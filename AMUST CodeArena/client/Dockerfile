# ── Stage 1: Build Client Artifacts ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Build production bundle
COPY . .
RUN npm run build

# ── Stage 2: Production Nginx Server ─────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built Vite assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx reverse proxy configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
