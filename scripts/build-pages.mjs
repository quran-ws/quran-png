#!/usr/bin/env node
// Generates one landing page per surah, plus the sitemap.
//
// These exist because that is how the search actually happens: nobody searches
// "quran image generator", they search "surah al-kahf png for canva". Each page
// carries facts only this dataset has — where the surah falls in the printed
// mushaf — and a live preview, so it is a real answer rather than a doorway.

import { mkdir, writeFile, readFile } from 'node:fs/promises'

const WEB = new URL('../apps/web/', import.meta.url)
const INDEX = new URL('../data/index.json', import.meta.url)
const ORIGIN = 'https://png.quran.ws'

const slug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’ʿʾĥŝţźďşğ]/gi, (c) => 'aeiou'.includes(c.toLowerCase()) ? c : '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const HEAD = ({ title, description, canonical }) => `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500&family=Noto+Naskh+Arabic:wght@400;500&display=swap">
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header>
  <div class="wrap">
    <a class="brand" href="/"><span class="eyebrow">png</span><span>quran.ws</span></a>
    <nav>
      <a href="/">Generator</a>
      <a href="/api/">API</a>
      <a href="/canva/">Canva app</a>
      <a href="/about/">About the mushaf</a>
    </nav>
  </div>
</header>`

const FOOT = `<footer>
  <div class="wrap">
    <span>quran.ws · free tools for Quranic text</span>
    <span><a href="/">Generator</a> · <a href="/surah/">All 114 surahs</a> · <a href="/about/">Licence</a></span>
  </div>
</footer>
</body>
</html>`

/** A few ranges people actually ask for, so the page links somewhere useful. */
function highlights(s) {
  const picks = []
  if (s.ayahs >= 1) picks.push({ from: 1, to: Math.min(s.ayahs, 1), label: 'First ayah' })
  if (s.ayahs > 5) picks.push({ from: 1, to: 5, label: 'First five ayahs' })
  if (s.ayahs > 10) picks.push({ from: s.ayahs - 2, to: s.ayahs, label: 'Last three ayahs' })
  if (s.ayahs <= 10) picks.push({ from: 1, to: s.ayahs, label: 'The whole surah' })
  const famous = {
    2: [{ from: 255, to: 255, label: 'Ayat al-Kursi' }, { from: 285, to: 286, label: 'The last two ayahs' }],
    18: [{ from: 1, to: 10, label: 'The first ten ayahs' }, { from: 107, to: 110, label: 'The closing ayahs' }],
    36: [{ from: 1, to: 12, label: 'The opening' }],
    55: [{ from: 1, to: 13, label: 'The opening' }],
    67: [{ from: 1, to: 5, label: 'The opening' }],
  }
  return [...(famous[s.number] ?? []), ...picks].slice(0, 4)
}

function surahPage(s, prev, next) {
  const path = `/surah/${s.number}-${slug(s.name_latin)}/`
  const canonical = ORIGIN + path
  const range = `1-${s.ayahs}`
  const preview = `/api/v1/image/${s.number}/1${s.ayahs > 1 ? '-' + Math.min(s.ayahs, 3) : ''}.png?width=1200`
  const title = `Surah ${s.name_latin} for Canva — Transparent PNG of the Madani Mushaf`
  const description =
    `Download any ayah of Surah ${s.name_latin} (${s.name_ar}) as a transparent PNG, SVG or print-ready PDF ` +
    `of the King Fahd Complex Madani mushaf. ${s.ayahs} ayahs, ${s.place === 'makkah' ? 'Makkan' : 'Madinan'}, ` +
    `printed pages ${s.pages[0]}–${s.pages[1]}. Free, no watermark.`

  const links = highlights(s)
    .map(
      (h) =>
        `<a class="btn small" style="flex:1 1 200px" href="/?ayah=${s.number}:${h.from}${h.to === h.from ? '' : `-${h.to}`}">${esc(h.label)} <span style="color:var(--ink-3);margin-inline-start:6px">${h.from}${h.to === h.from ? '' : `–${h.to}`}</span></a>`
    )
    .join('\n        ')

  return `${HEAD({ title, description, canonical })}
<script type="application/ld+json">
${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: `Surah ${s.name_latin} — Madani mushaf artwork`,
    inLanguage: 'ar',
    isPartOf: { '@type': 'Book', name: 'Al-Qur’an' },
    url: canonical,
    license: 'https://qurancomplex.gov.sa',
  },
  null,
  2
)}
</script>
<main>
  <section class="prose" style="max-width:820px">
    <p class="eyebrow">Surah ${s.number} of 114</p>
    <h1 class="display" style="font-size:clamp(28px,4vw,42px);line-height:1.12;letter-spacing:-0.02em;margin:14px 0 0">
      Surah ${esc(s.name_latin)} for Canva
    </h1>
    <p style="margin:10px 0 0;font-family:var(--arabic);font-size:26px;color:var(--ink-2)">${esc(s.name_ar)}</p>

    <p style="margin-top:24px">
      Every ayah of <strong style="font-weight:500">${esc(s.name_latin)}</strong> — “${esc(s.name_en)}” — as a
      transparent image cut from the King Fahd Complex's printed Madani mushaf. Pick a range, choose a
      shape, and download a PNG, an SVG or a print-ready PDF.
    </p>

    <div style="margin:32px 0;border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden">
      <div class="canvas" style="min-height:0;padding:40px">
        <img src="${preview}" alt="The opening of Surah ${esc(s.name_latin)} in the Madani mushaf" loading="lazy" style="max-height:280px">
      </div>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${links}
    </div>
    <p style="margin-top:12px">
      <a class="btn primary" href="/?ayah=${s.number}:${range}" style="display:inline-flex;padding:0 20px">Open ${esc(s.name_latin)} in the generator</a>
    </p>

    <h2 class="display" style="margin-top:48px;font-size:26px">Where it sits in the mushaf</h2>
    <div style="border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--white);overflow:hidden;margin-top:16px">
      <div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;padding:14px 20px;border-bottom:1px solid var(--line-soft);font-size:13px"><span style="color:var(--ink-3)">Ayahs</span><span>${s.ayahs}</span></div>
      <div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;padding:14px 20px;border-bottom:1px solid var(--line-soft);font-size:13px"><span style="color:var(--ink-3)">Revealed</span><span>${s.place === 'makkah' ? 'Makkah' : 'Madinah'}</span></div>
      <div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;padding:14px 20px;border-bottom:1px solid var(--line-soft);font-size:13px"><span style="color:var(--ink-3)">Printed pages</span><span>${s.pages[0]}${s.pages[1] === s.pages[0] ? '' : ` – ${s.pages[1]}`}</span></div>
      <div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;padding:14px 20px;font-size:13px"><span style="color:var(--ink-3)">Opens with the basmalah</span><span>${s.has_basmalah ? 'Yes' : 'No'}</span></div>
    </div>

    <h2 class="display" style="margin-top:48px;font-size:26px">Straight from the API</h2>
    <p style="font-size:13px;color:var(--ink-2)">
      <code>${ORIGIN}/api/v1/image/${s.number}/1.png</code> returns the first ayah as a transparent PNG.
      <a href="/api/">The full API</a> is one GET request with no key.
    </p>

    <p style="margin-top:48px;padding-top:24px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:24px;font-size:13px">
      <span>${prev ? `← <a href="/surah/${prev.number}-${slug(prev.name_latin)}/">${esc(prev.name_latin)}</a>` : '&nbsp;'}</span>
      <span><a href="/surah/">All 114 surahs</a></span>
      <span>${next ? `<a href="/surah/${next.number}-${slug(next.name_latin)}/">${esc(next.name_latin)}</a> →` : '&nbsp;'}</span>
    </p>
  </section>
</main>
${FOOT}`
}

function indexPage(surahs) {
  const rows = surahs
    .map(
      (s) =>
        `<a href="/surah/${s.number}-${slug(s.name_latin)}/" style="display:flex;align-items:baseline;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--radius)">
        <span style="color:var(--ink-3);font-size:12px;font-variant-numeric:tabular-nums;min-width:26px">${s.number}</span>
        <span style="color:var(--ink)">${esc(s.name_latin)}</span>
        <span style="font-family:var(--arabic);color:var(--ink-2);margin-inline-start:auto">${esc(s.name_ar)}</span>
      </a>`
    )
    .join('\n      ')

  return `${HEAD({
    title: 'All 114 Surahs as Transparent PNG, SVG and PDF | png.quran.ws',
    description:
      'Every surah of the Quran as print-quality transparent images from the King Fahd Complex Madani mushaf, ready for Canva, Figma and print.',
    canonical: `${ORIGIN}/surah/`,
  })}
<main>
  <section class="prose" style="max-width:900px">
    <p class="eyebrow">Index</p>
    <h1 class="display" style="font-size:clamp(28px,4vw,42px);line-height:1.12;letter-spacing:-0.02em;margin:14px 0 0">All 114 surahs</h1>
    <p style="margin-top:18px">
      Each one links to a page with a live preview and the ranges people ask for most. Or go straight to
      the <a href="/">generator</a> and pick any range you like.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;margin-top:32px">
      ${rows}
    </div>
  </section>
</main>
${FOOT}`
}

async function main() {
  const index = JSON.parse(await readFile(INDEX, 'utf8'))
  const surahs = index.surahs

  const urls = [
    { loc: `${ORIGIN}/`, priority: '1.0' },
    { loc: `${ORIGIN}/ar/`, priority: '0.9' },
    { loc: `${ORIGIN}/api/`, priority: '0.8' },
    { loc: `${ORIGIN}/canva/`, priority: '0.8' },
    { loc: `${ORIGIN}/about/`, priority: '0.5' },
    { loc: `${ORIGIN}/surah/`, priority: '0.7' },
  ]

  await mkdir(new URL('surah/', WEB), { recursive: true })
  await writeFile(new URL('surah/index.html', WEB), indexPage(surahs))

  for (const [i, s] of surahs.entries()) {
    const dir = new URL(`surah/${s.number}-${slug(s.name_latin)}/`, WEB)
    await mkdir(dir, { recursive: true })
    await writeFile(new URL('index.html', dir), surahPage(s, surahs[i - 1], surahs[i + 1]))
    urls.push({ loc: `${ORIGIN}/surah/${s.number}-${slug(s.name_latin)}/`, priority: '0.6' })
  }

  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n') +
    `\n</urlset>\n`
  await writeFile(new URL('sitemap.xml', WEB), sitemap)

  await writeFile(
    new URL('robots.txt', WEB),
    `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`
  )

  console.log(`pages: ${surahs.length} surahs + index, sitemap has ${urls.length} urls`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
