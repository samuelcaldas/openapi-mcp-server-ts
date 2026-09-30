# Multi-stage Dockerfile for openapi-mcp-server (Node.js 22 LTS)

# 1. Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency specifications first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build
RUN npm prune --production

# 2. Runtime stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo

# Copy production artifacts and dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-app ./dist-app

# Copy healthcheck script
COPY docker-healthcheck.sh /usr/local/bin/docker-healthcheck.sh
RUN chmod +x /usr/local/bin/docker-healthcheck.sh && \
    chown -R node:node /app

USER node

EXPOSE 8080 9090

HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 CMD ["/usr/local/bin/docker-healthcheck.sh"]

ENTRYPOINT ["node", "dist/cli.js"]
