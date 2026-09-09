# quran-png

Turn any range of Qur'anic ayahs into a transparent PNG, an SVG or a
print-ready PDF of the **actual printed mushaf** — for Canva, Figma, Illustrator,
Keynote, or anywhere else a designer needs Arabic that renders correctly.

Live at **[png.quran.ws](https://png.quran.ws)**.

```
GET https://png.quran.ws/api/v1/image/2/255.png?layout=fit&aspect=post&width=3000
```

<p align="center">
  <img src="https://png.quran.ws/api/v1/image/2/255.png?layout=fit&aspect=wide&width=1400" width="700" alt="Ayat al-Kursi, as printed in the Madani mushaf">
</p>

## Why images, not a font

Pasting Uthmani script into Canva breaks the diacritics; most "Quran fonts" are
not the mushaf; and page-based glyph fonts need a shaping engine you cannot
control inside someone else's design tool.

So nothing here is typeset. Every word is **vector artwork traced from the King
Fahd Complex's own Madani mushaf plates** — 77,432 words and 436,398 individual
diacritical marks, each one a separate shape with a stable `surah:ayah:word`
key. Rendering an ayah means collecting exactly those shapes and translating
them onto a new canvas. No font to go missing, no ligature to get wrong, and no
difference between the output and what the mushaf prints.

## The two layouts

Because the shapes are only ever *moved*, never scaled or stretched, there are
exactly two honest ways to lay out a range:

| `layout=mushaf` (default) | `layout=fit` |
|---|---|
| Reproduces the plate. Every word keeps the x it has on the printed page and the baseline it sits on — the image is the mushaf, cropped to your selection. | Repacks the same word artwork, at the same size, into justified lines filling a target shape — `square`, `post` 4:5, `story` 9:16, `wide` 16:9, `banner` 3:1. |

`mushaf` has no alignment to offer, by design: printed lines are justified to
one shared text block, so their horizontal relationship to each other *is* the
artwork. Re-centring each line on its own would invent a layout the mushaf does
not have. On a single page every word is placed with the same offset; the only
constructed measurement is a page boundary, where the first line of the new
plate is set one printed line height below the last line of the old one.

`fit` bisects on line width until the block matches the requested aspect, then
places each word by aligning its printed baseline to the target line's baseline.
Every line but the last is justified: first word flush right, last word flush
left, slack shared equally by the gaps between them.

The printed mushaf justifies by *stretching letters* (kashida). We cannot do that
without distorting the artwork, so justification here only moves the gaps — and a
line that would have to stretch past 3× its natural word spacing is left ragged
instead, because a loose line reads better than one pulled apart. Anything that
stretched a letter to fill a box would no longer be the mushaf.

## The API

One GET request, no key, no signup. Responses carry a permanent `ETag` and
`immutable` caching, so hotlinking costs one render, ever.

```
GET /api/v1/image/{surah}/{range}.{png|svg|pdf}

  /2/255.png      one ayah
  /18/1-10.svg    a range, as vectors
  /112/1-.pdf     to the end of the surah
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

Also `GET /api/v1/surahs`, `/api/v1/surahs/{n}` and `/api/v1/options`.

Errors tell you what to fix rather than what went wrong:

```
GET /api/v1/image/2/999.png  →  400
{ "error": "surah 2 has 286 ayahs, got 999-999" }
```

## Running it

```bash
npm install
npm run data     # fetch the 108 MB artwork bundle, build the render store
npm start        # http://localhost:8787
npm test
```

`npm run data` downloads the release tarball from
[`quran-svg-pipeline`](https://github.com/AbdullahObaid/quran-svg-pipeline/releases/tag/v1.0.0),
verifies its SHA-256, and precomputes `.data/store/NNN.json` — one file per
printed page holding raw SVG snippets and page-space boxes, so the server never
parses XML at request time. Pages load lazily behind an LRU; a render is a few
milliseconds of string concatenation plus `resvg`.

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

## The Canva app

[`apps/quran-canva`](apps/quran-canva) is the same picker inside Canva's side
panel, so there is no download-and-re-upload step. It uploads the PNG by URL and
drops it on the page. It asks for no permissions and cannot read your designs.

## Licence

The code here is MIT. The Qur'anic text and the mushaf artwork are the King Fahd
Glorious Qur'an Printing Complex's, used under the Complex's free digital
licence, which expressly permits digital publishing, media use, and use in
websites and software. Read **[NOTICE.md](NOTICE.md)** before you build on this.
