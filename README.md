# quran-png

Any range of Qur'anic ayahs as a transparent PNG, an SVG or a print-ready PDF of
the **actual printed mushaf** — for Canva, Figma, Illustrator, Keynote, or
anywhere else a designer needs Arabic that renders correctly.

Live at **[png.quran.ws](https://png.quran.ws)**.

<p align="center">
  <img src="https://png.quran.ws/api/v1/image/2/255.png?layout=fit&aspect=wide&width=1400" width="700" alt="Ayat al-Kursi, as printed in the Madani mushaf">
</p>

## Why images, not a font

Pasting Uthmani script into Canva breaks the diacritics; most "Quran fonts" are
not the mushaf; and page-based glyph fonts need a shaping engine you cannot
control inside someone else's design tool.

So nothing here is typeset. Every word is vector artwork traced from the King
Fahd Complex's own Madani mushaf plates — 604 pages, 77,432 words and 436,398
diacritical marks, each a separate shape with a stable `surah:ayah:word` key.
Rendering an ayah collects exactly those shapes and translates them onto a new
canvas. No font to go missing, no ligature to get wrong.

## The two layouts

Because the shapes are only ever *moved*, never scaled or stretched, there are
exactly two honest ways to lay out a range.

**`mushaf`** reproduces the plate: every word keeps the x it has on the printed
page and the baseline it sits on. It offers no alignment, by design — printed
lines are justified to one shared text block, so their horizontal relationship
*is* the artwork.

**`fit`** repacks the same artwork, at the same size, into justified lines
filling a target aspect. Justification only moves the gaps; the printed mushaf
stretches letters (kashida), and doing that here would distort the artwork, so a
line that would need more than 3× its natural word spacing is left ragged.

## The API

One GET request, no key, no signup. Renders are cached server-side and carry an
`ETag`.

```
GET /api/v1/image/{surah}/{range}.{png|svg|pdf}
```

| Parameter | Values | Default |
|---|---|---|
| `layout` | `mushaf` · `fit` | `mushaf` |
| `aspect` | `square` · `post` · `story` · `wide` · `banner` · `4:5` | `square` |
| `width` | 64 – 8000 px (PNG only) | `2000` |
| `color` | any hex | `#231f20` |
| `background` | any hex | transparent |
| `align` | `center` · `right` · `left` (`fit` only) | `center` |
| `padding` | 0 – 400 | `24` |
| `lineSpacing` | 0.6 – 3 | `1` |
| `wordSpacing` | 0.3 – 4 (`fit` only) | `1` |
| `justify` | `0` to switch off (`fit` only) | on |
| `basmalah` | `0` to omit it from a range starting at ayah 1 | on |
| `v` | pin the renderer for permanent caching | unpinned |

Plain URLs cache for five minutes and then revalidate, so a layout fix reaches
you; a URL pinned with `v` is immutable and safe to cache for a year.

Also `GET /api/v1/surahs`, `/api/v1/surahs/{n}` and `/api/v1/options`.

## Running it

```bash
npm install
npm run data     # fetch the 108 MB artwork bundle, build the render store
npm start        # http://localhost:8787
npm test
```

`npm run data` downloads the release tarball from
[`quran-svg-pipeline`](https://github.com/AbdullahObaid/quran-svg-pipeline/releases/tag/v1.0.0),
verifies its SHA-256, and precomputes one JSON file per printed page, so the
server never parses XML at request time. Pages load lazily behind an LRU; a
render is a few milliseconds of string concatenation plus `resvg`.

Or `docker build -t quran-png . && docker run -p 8787:8787 quran-png` — the
image does the fetch and the store build at build time.

## Layout

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

[`apps/quran-canva`](apps/quran-canva) is the same picker inside Canva's side
panel, so there is no download-and-re-upload step. The one permission it asks
for is `canva:asset:private:write`, so it can put the image in your media
library; it cannot read your designs.

## Licence

The code is MIT. The Qur'anic text and the mushaf artwork are the King Fahd
Glorious Qur'an Printing Complex's, used under the Complex's free digital
licence, which permits digital publishing, media use, and use in websites and
software. Read **[NOTICE.md](NOTICE.md)** before you build on this.
