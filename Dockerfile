# ══════════════════════════════════════════════════════════════
# Stage 1: Builder — Install, build static Expo + server
# ══════════════════════════════════════════════════════════════
FROM node:22-bookworm AS builder

WORKDIR /app

# Accept Railway domain as build arg for Expo static build
ARG EXPO_PUBLIC_DOMAIN
ENV EXPO_PUBLIC_DOMAIN=${EXPO_PUBLIC_DOMAIN}
ENV CI=true

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Apply patches (patch-package)
RUN npx patch-package || true

# Build static Expo bundles (iOS + Android) via Metro
RUN node scripts/build.js

# Build Express server with esbuild
RUN npm run server:build

# ══════════════════════════════════════════════════════════════
# Stage 2: Runner — Production-only
# ══════════════════════════════════════════════════════════════
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps only
# Use --ignore-scripts because postinstall runs patch-package (a devDependency)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Apply patches for production deps
COPY patches/ ./patches/
RUN npx -y patch-package || true

# Copy built artifacts from builder
COPY --from=builder /app/server_dist/ ./server_dist/
COPY --from=builder /app/static-build/ ./static-build/

# Copy server templates (landing page)
COPY server/templates/ ./server/templates/

# Copy assets and app config
COPY assets/ ./assets/
COPY app.json ./

# Railway sets PORT automatically
EXPOSE ${PORT:-5000}

CMD ["node", "server_dist/index.js"]
