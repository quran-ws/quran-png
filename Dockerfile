# The artwork bundle is fetched at build time from a private release, so this
# build needs a token:
#
#   docker build --secret id=gh_token,env=GH_TOKEN -t quran-png .
#
FROM node:20-slim AS base
WORKDIR /app

# The platform's generated compose healthcheck shells out to `curl` (falling
# back to `wget`), and node:20-slim carries neither — without this the
# container comes up fine and is still marked unhealthy, failing the deploy.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# @resvg/resvg-js ships prebuilt binaries; nothing to compile.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

# The slow, deterministic step: fetch the 108 MB bundle (checksum-pinned in
# fetch-data.mjs) and precompute the render store. The tarball and the page
# SVGs are dropped afterwards — everything the server reads is in .data/store.
RUN --mount=type=secret,id=gh_token \
    GH_TOKEN="$(cat /run/secrets/gh_token 2>/dev/null || true)" \
    node scripts/fetch-data.mjs \
 && node scripts/build-store.mjs \
 && node scripts/build-pages.mjs \
 && rm -rf .data/quran-svg-hafs-kfgqpc .data/*.tar.gz

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# Run unprivileged; nothing here writes to disk at runtime.
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:8787/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "apps/api/server.mjs"]
