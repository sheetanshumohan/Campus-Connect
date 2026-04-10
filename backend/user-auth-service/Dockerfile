# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove dev-only files
RUN rm -f .env

USER appuser

EXPOSE 3001
CMD ["node", "server.js"]
