# Contributing to Quran PNG

How to run and change this repository. Everything about *using* the service is on
<https://quran.ws/docs/reference/quran-png>.

## Running it locally

Almost nobody needs to: `png.quran.ws` is live, free and unauthenticated.

```sh
npm install
npm run data     # fetch the 108 MB artwork bundle, verify its SHA-256, build the store
npm start        # http://localhost:8787
npm test
```

`npm run data` downloads the release tarball, checks it against the digest above
and precomputes one JSON file per printed page, so the server never parses XML at
request time. Pages load lazily behind an LRU; a render is a few milliseconds of
string concatenation plus `resvg`. Or
`docker build -t quran-png . && docker run -p 8787:8787 quran-png`, which does
the fetch and the store build at image build time.

> While this repository and the artwork release are private, `npm run data`
> needs a `GH_TOKEN` with access to them. The hosted service needs nothing.

```
packages/composer/   compose.mjs   ayah range → laid-out SVG
                     render.mjs    SVG → PNG (resvg) / PDF (pdfkit)
                     store.mjs     lazy page loader
                     path-bbox.mjs path and affine geometry
apps/api/            Hono server, validation, cache, rate limit
apps/web/            the site — vanilla, no build step
apps/quran-canva/    the Canva app (see its README)
scripts/             fetch-data · build-store · build-pages
data/index.json      committed: surah metadata, ayah → pages/lines
```
