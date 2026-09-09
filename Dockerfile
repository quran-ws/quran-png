FROM node:20-slim AS base
WORKDIR /app

# @resvg/resvg-js ships prebuilt binaries; nothing to compile.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# Fetch the 108 MB artwork bundle and turn it into the render store. This is the
# slow step, and it is deterministic — the checksum in fetch-data.mjs pins it.
RUN node scripts/fetch-data.mjs \
 && node scripts/build-store.mjs \
 && node scripts/build-pages.mjs \
 && rm -f .data/quran-svg-hafs-kfgqpc.tar.gz \
 && rm -rf .data/quran-svg-hafs-kfgqpc/pages

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "fetch('http://localhost:8787/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "apps/api/server.mjs"]
