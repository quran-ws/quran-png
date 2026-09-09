#!/usr/bin/env node
// Turns the 604 page SVGs into a render store the API can serve without ever
// parsing XML at request time.
//
//   .data/store/NNN.json   one file per page: raw SVG snippets + page-space boxes
//   data/index.json        committed: surah metadata + ayah -> pages/lines
//
// Every snippet is kept verbatim from the source, so output is byte-for-byte
// the same artwork as the print mushaf; we only ever wrap it in a transform.

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { SaxesParser } from 'saxes'
import { pathBBox, parseTransform, multiply, transformBBox, unionBBox, IDENTITY } from '../packages/composer/path-bbox.mjs'

const BUNDLE = new URL('../.data/quran-svg-hafs-kfgqpc/', import.meta.url)
const STORE = new URL('../.data/store/', import.meta.url)
const OUT_INDEX = new URL('../data/index.json', import.meta.url)

const round = (n, p = 3) => Number(n.toFixed(p))
const roundBox = (b) => b && b.map((n) => round(n))

/** Median of the numbers, used to find a line's baseline through its descenders. */
function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

function parsePage(xml, wordBoxes) {
  const parser = new SaxesParser({ position: true })

  let outerTransform = null
  let viewBox = null
  const lines = []
  const marks = {}
  const banners = []

  // transform stack, from the SVG root down to the element being read
  const ctm = [IDENTITY]
  // the unit (word / mark / banner) currently open, if any
  let unit = null
  let unitDepth = -1
  let depth = 0

  let line = null // the <g class="line"> being read
  let frag = null // the <g class="ayah-fragment"> being read

  // saxes reports `position` just past the tag's `>`; XML forbids a raw `<`
  // inside an attribute value, so scanning back for it lands on the tag's start.
  const tagStart = () => xml.lastIndexOf('<', parser.position - 1)

  const openUnit = (kind, attrs) => {
    unit = { kind, attrs, start: tagStart(), box: null }
    unitDepth = depth
  }

  parser.on('opentag', (node) => {
    depth++
    const a = node.attributes
    const cls = a.class

    if (node.name === 'svg') {
      viewBox = a.viewBox
      ctm.push(IDENTITY)
      return
    }

    ctm.push(multiply(ctm[ctm.length - 1], parseTransform(a.transform)))

    if (node.name === 'path' && a.d) {
      const local = pathBBox(a.d)
      if (local && unit) {
        unit.box = unionBBox([unit.box, transformBBox(ctm[ctm.length - 1], local)])
      }
      return
    }
    if (node.name !== 'g') return

    // the single outermost group carries the page's flip matrix
    if (a.transform && outerTransform === null && depth === 2) {
      outerTransform = a.transform
      return
    }
    if (cls === 'line') {
      line = { line: Number(a['data-line']), transform: null, frags: [], banners: [] }
      lines.push(line)
      return
    }
    // the line's inner group holds the shared per-line translate
    if (line && a.transform && line.transform === null && !cls) {
      line.transform = a.transform
      return
    }
    if (cls === 'ayah-fragment') {
      frag = {
        ayah: a['data-ayah-key'],
        n: Number(a['data-fragment']),
        of: Number(a['data-ayah-fragments']),
        words: [],
      }
      line.frags.push(frag)
      return
    }
    if (cls === 'word') {
      openUnit('word', a)
      return
    }
    if (cls === 'ayah-mark') {
      openUnit('mark', a)
      return
    }
    if (cls === 'surah-name' || cls === 'basmalah') {
      openUnit(cls, a)
    }
  })

  parser.on('closetag', () => {
    if (unit && depth === unitDepth) {
      const svg = xml.slice(unit.start, parser.position)
      const a = unit.attrs
      if (unit.kind === 'word') {
        const key = a['data-word-key']
        frag.words.push({ key, box: roundBox(wordBoxes[key] ?? unit.box), svg })
      } else if (unit.kind === 'mark') {
        marks[a['data-ayah-key']] = { box: roundBox(unit.box), svg }
      } else {
        const b = { kind: unit.kind, sid: Number(a['data-sid']), box: roundBox(unit.box), svg }
        banners.push(b)
        if (line) line.banners.push(banners.length - 1)
      }
      unit = null
      unitDepth = -1
    }
    ctm.pop()
    depth--
  })

  parser.write(xml).close()

  // A line's baseline is the median bottom of its words: descenders sit below it,
  // and every word that rests on the line shares it exactly.
  for (const l of lines) {
    const bottoms = l.frags.flatMap((f) => f.words.map((w) => w.box[3]))
    l.baseline = bottoms.length ? round(median(bottoms)) : null
    l.box = roundBox(unionBBox(l.frags.flatMap((f) => f.words.map((w) => w.box))))
  }

  return { viewBox, outerTransform, lines, marks, banners }
}

async function main() {
  await mkdir(STORE, { recursive: true })
  await mkdir(new URL('../data/', import.meta.url), { recursive: true })

  const surahs = JSON.parse(await readFile(new URL('index/surahs.json', BUNDLE), 'utf8')).surahs
  const pageMeta = JSON.parse(await readFile(new URL('index/pages.json', BUNDLE), 'utf8')).pages
  const words = JSON.parse(await readFile(new URL('index/words.json', BUNDLE), 'utf8')).rows

  const pages = (await readdir(new URL('pages/', BUNDLE))).filter((f) => f.endsWith('.svg')).sort()

  let totalWords = 0
  let totalMarks = 0

  for (const file of pages) {
    const n = Number(file.slice(0, 3))
    const xml = await readFile(new URL(`pages/${file}`, BUNDLE), 'utf8')
    const byPage = JSON.parse(await readFile(new URL(`index/by-page/${file.replace('.svg', '.json')}`, BUNDLE), 'utf8'))
    const boxes = Object.fromEntries(byPage.words.map((w) => [w.word_key, w.box]))

    const page = parsePage(xml, boxes)
    page.page = n

    const nWords = page.lines.reduce((s, l) => s + l.frags.reduce((t, f) => t + f.words.length, 0), 0)
    const meta = pageMeta[n - 1]
    if (nWords !== meta.words) throw new Error(`page ${n}: got ${nWords} words, index says ${meta.words}`)
    totalWords += nWords
    totalMarks += Object.keys(page.marks).length

    await writeFile(new URL(`${String(n).padStart(3, '0')}.json`, STORE), JSON.stringify(page))
    if (n % 100 === 0) process.stdout.write(`  ${n}/604\n`)
  }

  // ayah -> the (page, line) runs it occupies, in mushaf order
  const ayahs = {}
  for (const [wordKey, page, line] of words) {
    const ayah = wordKey.split(':').slice(0, 2).join(':')
    const runs = (ayahs[ayah] ??= [])
    const last = runs[runs.length - 1]
    if (!last || last[0] !== page || last[1] !== line) runs.push([page, line])
  }

  const index = {
    edition: 'hafs-kfgqpc',
    print: 'KFGQPC Madani mushaf, V4 1441H',
    source: 'https://github.com/AbdullahObaid/quran-svg-pipeline/releases/tag/v1.0.0',
    counts: { pages: 604, words: totalWords, marks: totalMarks, ayahs: Object.keys(ayahs).length },
    surahs: surahs.map((s) => ({
      number: s.number,
      ayahs: s.ayah_count,
      name_ar: s.name_arabic,
      name_en: s.name_english,
      name_latin: s.name_latin,
      place: s.revelation_place,
      pages: s.pages,
      has_basmalah: s.has_basmalah,
    })),
    ayahs,
  }
  await writeFile(OUT_INDEX, JSON.stringify(index))
  console.log(`store: 604 pages, ${totalWords} words, ${totalMarks} marks`)
  console.log(`index: ${index.counts.ayahs} ayahs -> data/index.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
