# ══════════════════════════════════════════════════════════════
# Single stage: All deps needed for Metro static build at startup
# ══════════════════════════════════════════════════════════════
FROM node:22-bookworm-slim

WORKDIR /app

ENV CI=true
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json ./

# Remove postinstall script (patch-package is devDep, fails with --omit=dev behavior)
# but keep all scripts so esbuild postinstall runs correctly
RUN node -e "const p=require('./package.json'); delete p.scripts.postinstall; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2))"

# Install ALL dependencies (Metro needs devDeps for static build at startup)
RUN npm ci

# Copy source code
COPY . .

# Apply patches
RUN npx -y patch-package || true

# Build Express server with esbuild (this doesn't need domain)
RUN npm run server:build

# Make start script executable
RUN chmod +x scripts/start.sh

# Railway sets PORT automatically
EXPOSE ${PORT:-5000}

# Start script: builds Expo static bundles (needs RAILWAY_PUBLIC_DOMAIN) then starts server
CMD ["sh", "scripts/start.sh"]
