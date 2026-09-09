# Deploying png.quran.ws

This site runs on the `quran.ws-server` platform (Hetzner box, Docker,
Traefik, Cloudflare Tunnel). That repo is the control plane: the server's
state is a function of it. Nothing here deploys anything directly.

## The shape of it

```
push to main
  └─ .github/workflows/deploy.yml
       ├─ test    npm ci, build the render store, npm test
       ├─ build   docker build → push to ghcr.io/quran-ws/quran-png:sha-XXXXXXX
       │          then run the image and smoke-test /healthz + a real render
       └─ bump    open an image-bump PR in quran.ws-server, auto-merge on
                  └─ infra's deploy workflow rolls it out
```

Image-only changes are on the platform's fast lane and need no approval.
Anything else — adding this site in the first place, changing its domain,
its resources — is a config change and a human approves it.

## One-time setup

These have to exist before the first push does anything useful.

**1. The site must exist in the infra repo.** `deploy/site.yaml` here is the
manifest; it belongs at `infra/sites/png/site.yaml` in `quran.ws-server`,
added by a reviewed PR. Validate it first with `infra/bin/render png`.

**2. A self-hosted runner for this repo**, on the server:

```bash
GITHUB_PAT=ghp_xxx sudo -E bash \
  /srv/infra/infra/platform/gha-runner/install.sh quran-ws/quran-png
```

**3. One repo secret on `quran-ws/quran-png`:**

| Secret | What it is |
|---|---|
| `INFRA_REPO_PAT` | fine-grained PAT, `Contents: write` + `Pull requests: write` on `AbdullahObaid/quran.ws-server` |

Set it without the value passing through anything else:

```bash
gh secret set INFRA_REPO_PAT -R quran-ws/quran-png     # prompts for the value
```

`AbdullahObaid/pdf.quran.ws` already carries a secret of the same name for the
same purpose; the same token works if it still has the scopes.

There is deliberately no second secret for the artwork. The bundle is mirrored
onto this repo's own release (`artwork-v1.0.0`), so the build fetches it with
the workflow's automatic `GITHUB_TOKEN`. `scripts/fetch-data.mjs` pins its
SHA-256, so the mirror is a frozen artifact — re-mirror only if that pin
changes, and point `BUNDLE_REPO` / `BUNDLE_TAG` elsewhere if you ever need to.

**4. DNS — already done.** The tunnel has a wildcard route: any `*.quran.ws`
host reaches Traefik, which answers 404 until a router exists for it. You can
confirm the same 404 comes back for a hostname that certainly has no site.
`png.quran.ws` starts serving the moment the site is deployed; no DNS record
needs adding.

## Building the image by hand

The build needs the token as a BuildKit secret, not an env var:

```bash
GH_TOKEN=ghp_xxx docker build --secret id=gh_token,env=GH_TOKEN -t quran-png .
docker run --rm -p 8787:8787 quran-png
```

## What the image contains

The artwork is baked in at build time — 604 pages precomputed into a gzipped
render store (~102 MB). Nothing is fetched at runtime and nothing is written
to disk, so the container runs read-only and unprivileged.

Memory is the thing to watch: the render cache is bounded at 192 MB of image
bytes (`CACHE_BYTES`) and the page LRU holds at most 96 parsed pages, under a
512 MB ceiling. `/healthz` reports both, plus RSS.
