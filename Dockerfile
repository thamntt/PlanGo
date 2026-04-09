# ══════════════════════════════════════════════════════════════
# Single stage: All deps needed for Metro static build at startup
# ══════════════════════════════════════════════════════════════
FROM node:22-bookworm

WORKDIR /app

ENV CI=true
# Do NOT set NODE_ENV=production here — npm ci skips devDeps when it's set
# NODE_ENV is set to production at runtime in start.sh

# Copy package files
COPY package.json package-lock.json ./

# Remove postinstall script (patch-package is devDep, fails in clean install)
RUN node -e "const p=require('./package.json'); delete p.scripts.postinstall; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2))"

# Install ALL dependencies including devDeps (Metro/TypeScript/Babel needed at startup)
RUN npm ci

# Copy source code
COPY . .

# Apply patches
RUN npx -y patch-package || true

# Build Express server with esbuild (this doesn't need domain)
RUN npm install -g esbuild && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=server_dist

# Make start script executable
RUN chmod +x scripts/start.sh

# Railway sets PORT automatically
EXPOSE ${PORT:-5001}

# Start script: builds Expo static bundles (needs RAILWAY_PUBLIC_DOMAIN) then starts server
CMD ["sh", "scripts/start.sh"]
