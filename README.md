# quran-png

Any range of Qurʾānic ayat as a transparent PNG, an SVG or a print-ready PDF of
the **actual printed muṣḥaf** — for Canva, Figma, Illustrator, Keynote, or
anywhere else a designer needs Arabic that renders correctly. One GET, no key.

A [muṣḥaf](https://quran.ws/docs/concepts/glossary/#mushaf) is a printed copy of
the Qurʾān; every image here is cut from one, not typeset from a font.

<p align="center">
  <img src="https://png.quran.ws/api/v1/image/2/255.png?layout=fit&aspect=wide&width=1400" width="700" alt="Ayat al-Kursi, as printed in the Madani mushaf">
</p>

| Service | Renderer | Formats | Auth |
|---|---|---|---|
| [`png.quran.ws`](https://png.quran.ws) | `x-render-version: 3` | PNG · SVG · PDF | None |

> **Quran PNG is a tool, not one of the eight building blocks.** It is a service
> built on the artwork that
> [Quran SVG Elements](https://github.com/quran-ws/quran-svg-elements) publishes,
> and it exists to be the shortest path from a reference to a picture of that
> reference. If you are choosing a block to build on, start at
> <https://quran.ws/blocks/>.

## What it provides

- **An image of the printed page, at any ayah range.** `/api/v1/image/2/255.png`
  is Āyat al-Kursī. Nothing is typeset: every word is vector artwork traced from
  the King Fahd Glorious Qurʾān Printing Complex's own Madani plates — 604 pages
  and 77,432 words, each mark a separate shape with a stable `surah:ayah:word`
  key. Rendering collects exactly the shapes in your range and moves them onto a
  new canvas. No font to go missing, no ligature to get wrong.
- **Three formats from one URL.** `.png` (transparent raster), `.svg` (vector),
  `.pdf` (vector, page-sized and print-ready).
- **Two honest layouts.** `mushaf` reproduces the plate, every word at its
  printed x. `fit` repacks the same artwork, at the same size, into justified
  lines filling an aspect you choose.
- **No key, no signup, no CORS ceremony.** `Access-Control-Allow-Origin: *` is
  set, so an `<img src>` works from a browser.
- **Headers that let you decide before you commit.** `x-quran-lines` and
  `x-quran-words` tell you how the range laid out; `ETag` gives you a `304`.
- **The same picker inside Canva.** `apps/quran-canva` is the service in Canva's
  side panel, so there is no download-and-re-upload step. The one permission it
  asks for is `canva:asset:private:write`, to put the image in your media
  library; it cannot read your designs.

## Use it when you need

- Qurʾānic text in a tool that cannot shape Arabic — Canva, Figma, Illustrator,
  Keynote, a slide, a social card, an email template.
- A print-ready PDF of a specific range, at the letterforms the Complex prints.
- An ayah on a page you do not control the fonts of.
- Artwork with an alpha channel, in an ink colour you choose.

## Not for

| You want | Use |
|---|---|
| The Qurʾān as characters — searchable, word-numbered, in seven riwāyāt | [Quran Text](https://github.com/quran-ws/quran-text) |
| A complete printed page, with an addressable ayah layer, across every vectorised muṣḥaf | [Quran SVG](https://github.com/quran-ws/quran-svg) |
| The word and mark shapes themselves, to compose your own renderer | [Quran SVG Elements](https://github.com/quran-ws/quran-svg-elements) |
| Those same pages rendered fast inside a mobile app, where SVG does not perform | [Quran Engine](https://github.com/quran-ws/quran-engine) |
| [Tajwīd](https://quran.ws/docs/concepts/glossary/#tajweed) rules as spans over the text | [Quran Tajweed](https://github.com/quran-ws/quran-tajweed) |

Also not: a font, a translation, a tafsīr, or a
[riwayah](https://quran.ws/docs/concepts/glossary/#riwayah) switch. This service
serves one edition only.

## See it work

- **[png.quran.ws](https://png.quran.ws)** — the picker, live.
- **[quran.ws/tools/quran-png/](https://quran.ws/tools/quran-png/)** — the same
  picker with the request URL built in front of you, so you can watch a
  parameter change the image.
- **[quran.ws/docs/reference/quran-png/](https://quran.ws/docs/reference/quran-png/)**
  — every parameter, with the traps.

## Supported riwayat

One. A [riwayah](https://quran.ws/docs/concepts/glossary/#riwayah) is a
transmitted reading of the Qurʾān; different riwāyāt are printed from different
plates and number their ayat differently.

```sh
curl -s https://png.quran.ws/api/v1/surahs | head -c 120
# {"edition":"hafs-kfgqpc","print":"KFGQPC Madani mushaf, V4 1441H","render_version":3,"count":114,…
```

Everything here is **Ḥafṣ ʿan ʿĀṣim**, from the KFGQPC Madani muṣḥaf V4 (1441H).
There is no parameter to select another, so the ayah numbers in these URLs are
Kufan numbering throughout. For Warsh or Qālūn artwork, see
[Quran SVG](https://github.com/quran-ws/quran-svg), and for why the numbers
differ, [ayah-counting systems](https://quran.ws/docs/concepts/ayah-counting/).

## Provenance

| | |
|---|---|
| Artwork and text | King Fahd Glorious Qurʾān Printing Complex, Muṣḥaf al-Madīnah V4 (1441H), riwayah of Ḥafṣ |
| Decomposition | The `quran-svg` `hafs-kfgqpc` bundle — the same word-and-mark decomposition [Quran SVG Elements](https://github.com/quran-ws/quran-svg-elements) publishes |
| Bundle | `artwork-v1.0.0`, `quran-svg-hafs-kfgqpc.tar.gz`, 108 MB |
| Digest | `sha256:2bff7bcc1d84b61ee9baf2c356ea554b0a1dd317d6a8145406b5cee998914d17`, verified by `npm run data` on every download |
| Extent | 604 pages · 77,432 words (`counts` in `data/index.json`) |

Read **[NOTICE.md](NOTICE.md)** before you build on this. It reproduces the
Complex's own usage terms in full: free for personal, commercial, governmental,
digital, media, web and software use; the one reserved right is the physical
print-for-commercial-sale muṣḥaf trade, which nothing here touches.

## Quick start

No install, no key. One request:

```sh
curl -o kursi.png \
  "https://png.quran.ws/api/v1/image/2/255.png?layout=fit&aspect=wide&width=1400"
# 1400 × 833 PNG, RGBA, 180 KB
# x-quran-lines: 5   x-quran-words: 50
```

The same URL is an image source:

```html
<img
  src="https://png.quran.ws/api/v1/image/2/255.png?layout=fit&aspect=wide&width=1400"
  alt="Surah 2, ayah 255, from the printed Madani mushaf"
/>
```

## The API

```
GET /api/v1/image/{surah}/{range}.{png|svg|pdf}
```

`surah` is 1–114; anything else is `400 {"error":"surah must be 1..114"}`.
`range` takes three forms:

| Form | Example | Meaning |
|---|---|---|
| A single ayah | `/2/255.png` | Ayah 255 only |
| A closed range | `/2/255-257.svg` | Ayat 255 to 257 |
| An open range | `/112/1-.pdf` | Ayah 1 to the end of the surah |

Ranges do not cross a surah boundary, and a range past the end is rejected
rather than clamped: `/2/300.png` → `{"error":"surah 2 has 286 ayahs, got
300-300"}`.

There is a second, equivalent form for callers who would rather not build a
path. Omitting `to` renders a single ayah; omitting `from` starts at 1:

```
GET /api/v1/image?surah=112&from=1&to=4&format=svg
```

Every parameter, as validated in `apps/api/params.mjs`:

| Parameter | Values | Default | Notes |
|---|---|---|---|
| `layout` | `mushaf` · `fit` | `mushaf` | |
| `aspect` | `square` `post` `story` `wide` `banner`, or any `w:h` | `square` | `fit` only |
| `align` | `center` · `right` · `left` | `center` | `fit` only |
| `justify` | `0` to switch off | on | `fit` only |
| `wordSpacing` | 0.3 – 4 | `1` | Multiplier on the printed word gap; `fit` only |
| `lineSpacing` | 0.6 – 3 | `1` | Multiplier on the printed line height |
| `width` | 64 – 8000 | `2000` | Output pixel width; PNG only |
| `color` | any hex, `#` optional | `#231f20` | The ink |
| `background` | any hex | transparent | Omit it and you get alpha |
| `padding` | 0 – 400 | `24` | Artwork units, not pixels |
| `basmalah` | `0` to omit | on | Only affects a range starting at ayah 1 |
| `v` | any value | unpinned | Changes caching only — see below |

`0`, `false`, `no` and `off` all read as false for `justify` and `basmalah`; any
other value is true. Named aspects are `square` 1:1, `post` 4:5, `story` 9:16,
`wide` 16:9, `banner` 3:1 — and an explicit ratio such as `aspect=2.5:1` is
valid, though `/api/v1/options` lists only the five names.

The [basmalah](https://quran.ws/docs/concepts/glossary/#basmalah) — the opening
formula *bismillāh…* — is drawn for a range starting at ayah 1, as the plate
does. At-Tawbah (surah 9) has none; in al-Fātiḥah it **is** ayah 1, so `/1/1.png`
is the basmalah by itself.

Also `GET /api/v1/surahs`, `/api/v1/surahs/{n}`, `/api/v1/options` and
`/healthz`.

### Caching, and what `v` actually does

Renders are cached server-side and every response carries an `ETag`, so a
conditional request costs a `304`.

`v` is treated as **present-or-absent**. Any value flips the response to
`cache-control: public, max-age=31536000, immutable`. It does *not* select a
renderer version — there is only one renderer, and `?v=3` and `?v=9` both return
today's:

```sh
curl -sD - -o /dev/null "https://png.quran.ws/api/v1/image/112/1-.png?v=9" \
  | grep -i 'cache-control\|x-render-version'
# cache-control: public, max-age=31536000, immutable
# x-render-version: 3
```

So pin `v` when the image is embedded in something that must not change under
you — a printed document, a published asset, a design file someone else owns —
and understand what you are taking on: if the renderer is corrected, caches keep
serving your frozen bytes while a cold fetch returns the new layout, with no
error anywhere. Watch `x-render-version` and re-pin deliberately.

Without `v`, the response is short-lived and revalidates. The origin sets
`max-age=300`; the CDN in front of it currently serves `max-age=14400`, so four
hours is what you will measure.

### Limits

- **Rate limit.** Per IP, `429` with `{"error":"too many requests, slow down"}`
  over it. The service's own default is 120 requests a minute
  (`RATE_PER_MIN` in `apps/api/server.mjs`), but it is set by an environment
  variable, so the deployed number is not readable from outside. Throttle a bulk
  export, and treat a `429` as expected.
- **Errors are JSON, not images.** Every rejection is a `400` with
  `content-type: application/json`. Check the status before you write the body to
  a `.png`, or you get JSON with a PNG extension and a failure much later. The
  messages name the parameter and the value:
  `{"error":"width must be between 64 and 8000, got 9000"}`.
- **`width` is PNG only.** SVG and PDF are vector; scale them at use.
- **Justification moves the gaps only.** The printed muṣḥaf stretches letters to
  justify a line; doing that here would distort the artwork, so a line needing
  more than 3× its natural word spacing is left ragged.

## Works with

| | |
|---|---|
| [Quran SVG Elements](https://github.com/quran-ws/quran-svg-elements) | The word and mark artwork every image is cut from. This repository is the worked example of consuming it. |
| [Quran SVG](https://github.com/quran-ws/quran-svg) | Where the pages, and the other muṣḥafs, come from. |
| [Quran Text](https://github.com/quran-ws/quran-text) | The characters behind the shapes, when you need to search or store what you are showing. |

## Running your own

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

## Documentation

- [Reference: Quran PNG](https://quran.ws/docs/reference/quran-png/) — every
  parameter, the caching trap, and the response headers worth reading.
- [Choosing a block](https://quran.ws/docs/start/choosing-a-block/) — if you are
  not sure this is the piece you need.
- [Glossary](https://quran.ws/docs/concepts/glossary/) — muṣḥaf, riwayah,
  basmalah and the rest, in plain English.

## Licence

Code is **MIT**. Data and design content are **CC BY 4.0**, with a standing
waiver of attribution for use inside a product — see [LICENSE](LICENSE).

The Qurʾānic text and the muṣḥaf artwork are the **King Fahd Glorious Qurʾān
Printing Complex's**, used under the Complex's own published free digital
licence, and are not ours to relicense. The decomposition comes from
[Quran SVG Elements](https://github.com/quran-ws/quran-svg-elements), whose
licence is still being settled — ask before redistributing that layer. [NOTICE.md](NOTICE.md) carries all of it,
including the Complex's terms in Arabic and English.

These are images of the Qurʾān. The service renders the text and nothing else:
no translation, no commentary, no alteration, no partial word. A range is either
drawn in full or refused. Please handle the output accordingly.
