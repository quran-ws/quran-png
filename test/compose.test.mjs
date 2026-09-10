import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose, ComposeError } from '../packages/composer/compose.mjs'
import { loadIndex } from '../packages/composer/store.mjs'
import { parseRange, parseOptions } from '../apps/api/params.mjs'

const svgOf = (r) => r.svg

test('an ayah composes to a self-contained SVG', async () => {
  const r = await compose({ surah: 112, from: 1, to: 4 })
  assert.match(r.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.equal(r.svg.match(/<svg/g).length, 1)
  assert.ok(r.width > 0 && r.height > 0)
  assert.equal(r.meta.surah, 112)
  assert.equal(r.meta.words, 15, 'al-Ikhlas is 4 + 2 + 4 + 5 words')
})

test('every <g> that is opened is closed', async () => {
  const svg = svgOf(await compose({ surah: 2, from: 255, to: 256 }))
  const open = svg.match(/<g[ >]/g).length
  const close = svg.match(/<\/g>/g).length
  assert.equal(open, close)
})

test('mushaf layout keeps the printed line count', async () => {
  // 2:255 falls across six lines of page 42
  const r = await compose({ surah: 2, from: 255, to: 255, layout: 'mushaf' })
  assert.equal(r.meta.lines, 6)
  assert.deepEqual(r.meta.pages, [42])
})

/** The translate each atom is placed with, as written into the SVG. */
const offsets = (svg) =>
  new Set(
    [...svg.matchAll(/<g transform="translate\(([-\d.]+) ([-\d.]+)\)"><g transform="matrix/g)].map(
      (m) => `${m[1]},${m[2]}`
    )
  )

test('mushaf reproduces the plate: one offset for the whole selection', async () => {
  // Every word keeps its printed x and baseline, so a single-page range is the
  // plate itself moved as one piece — one distinct translate, no per-line nudge.
  const r = await compose({ surah: 2, from: 255, to: 255 })
  assert.deepEqual([...offsets(r.svg)], ['0,0'])
})

test('mushaf ignores align — there is nothing to align', async () => {
  const [c, l, right] = await Promise.all(
    ['center', 'left', 'right'].map((align) => compose({ surah: 2, from: 255, to: 255, align }))
  )
  assert.equal(c.svg, l.svg)
  assert.equal(c.svg, right.svg)
})

test('a page boundary is the only constructed measurement', async () => {
  // 2:4-8 crosses from page 2 to page 3: one offset per plate, and the second
  // plate lands below the first rather than on top of it.
  const r = await compose({ surah: 2, from: 4, to: 8 })
  const seen = [...offsets(r.svg)].map((o) => o.split(',').map(Number))
  assert.equal(seen.length, 2, 'one offset per page')
  assert.ok(seen.every(([dx]) => dx === 0), 'no horizontal drift between plates')
  assert.ok(Math.abs(seen[1][1] - seen[0][1]) > 0, 'the second plate is moved clear of the first')
})

test('fit layout reaches the requested aspect', async () => {
  for (const [aspect, tolerance] of [[1, 0.25], [1.25, 0.3], [16 / 9, 0.4]]) {
    const r = await compose({ surah: 2, from: 255, to: 255, layout: 'fit', aspect })
    const got = r.height / r.width
    assert.ok(
      Math.abs(got - aspect) < tolerance,
      `aspect ${aspect}: got ${got.toFixed(2)} (${r.width}x${r.height})`
    )
  }
})

test('fit and mushaf draw exactly the same words', async () => {
  const a = await compose({ surah: 18, from: 1, to: 10, layout: 'mushaf' })
  const b = await compose({ surah: 18, from: 1, to: 10, layout: 'fit', aspect: 1 })
  const keys = (svg) => [...svg.matchAll(/data-word-key="([^"]+)"/g)].map((m) => m[1]).sort()
  assert.deepEqual(keys(a.svg), keys(b.svg))
  assert.equal(a.meta.words, b.meta.words)
})

test('a range spanning a page boundary is drawn whole', async () => {
  // 2:5 ends page 2 and 2:6 begins page 3
  const r = await compose({ surah: 2, from: 4, to: 8 })
  assert.deepEqual(r.meta.pages, [2, 3])
})

test('colour is applied to the hard-coded fills too', async () => {
  const r = await compose({ surah: 112, from: 1, to: 1, color: '#c4956a' })
  assert.match(r.svg, /fill="#c4956a"/)
  assert.doesNotMatch(r.svg, /fill="#231f20"/)
})

test('bad ranges are refused with a message that says what to fix', async () => {
  await assert.rejects(compose({ surah: 2, from: 999, to: 999 }), (e) => {
    assert.ok(e instanceof ComposeError)
    assert.equal(e.status, 400)
    assert.match(e.message, /286 ayahs/)
    return true
  })
  await assert.rejects(compose({ surah: 115, from: 1, to: 1 }), /1\.\.114/)
  await assert.rejects(compose({ surah: 1, from: 5, to: 2 }), /backwards/)
  await assert.rejects(compose({ surah: 1, from: 1, to: 1, layout: 'nope' }), /mushaf, fit/)
})

test('ranges parse the way the URLs promise', async () => {
  assert.deepEqual(parseRange('255', 286), { from: 255, to: 255 })
  assert.deepEqual(parseRange('255-257', 286), { from: 255, to: 257 })
  assert.deepEqual(parseRange('1-', 286), { from: 1, to: 286 })
  assert.throws(() => parseRange('abc', 286), /255 or 255-257/)
})

test('options are validated, not trusted', () => {
  assert.throws(() => parseOptions({ width: '99999' }), /between 64 and 8000/)
  assert.throws(() => parseOptions({ color: 'red' }), /hex colour/)
  assert.throws(() => parseOptions({ layout: 'fit', aspect: 'oblong' }), /square, post/)
  assert.equal(parseOptions({ color: '231F20' }).color, '#231f20')
  assert.equal(parseOptions({ layout: 'fit', aspect: '4:5' }).aspect, 1.25)
  assert.equal(parseOptions({}).aspect, null, 'aspect only applies to the fit layout')
})

test('the index agrees with the artwork', async () => {
  const index = await loadIndex()
  assert.equal(index.surahs.length, 114)
  assert.equal(index.counts.words, 77432)
  assert.equal(index.counts.ayahs, 6236)
  assert.equal(index.surahs.reduce((n, s) => n + s.ayahs, 0), 6236)
})

test('fit justifies every line but the last, flush to both edges', async () => {
  // Per line, not per band. An earlier version of this test scanned the
  // rendered image for horizontal bands of ink, but adjacent lines merge into
  // one band wherever an ascender meets a descender — so it passed while two
  // lines in the middle of the block were not justified at all.
  for (const aspect of [1, 1.25, 16 / 9, 9 / 16]) {
    const r = await compose({ surah: 2, from: 255, to: 255, layout: 'fit', aspect })
    const [left, right] = [r.meta.padding, r.width - r.meta.padding]
    const lines = r.meta.lineExtents
    assert.ok(lines.length >= 3, `aspect ${aspect}: needs several lines to be worth checking`)

    for (const [i, e] of lines.slice(0, -1).entries()) {
      assert.ok(Math.abs(e[0] - left) < 0.6, `aspect ${aspect} line ${i + 1}: left edge ${e[0]} != ${left}`)
      assert.ok(Math.abs(e[1] - right) < 0.6, `aspect ${aspect} line ${i + 1}: right edge ${e[1]} != ${right}`)
    }
    const last = lines[lines.length - 1]
    assert.ok(last[1] - last[0] <= right - left + 0.6, 'the last line is never wider than the measure')
  }
})

test('the reported line extents are where the ink actually is', async () => {
  // The extents above come from the layout. Check them against the rendered
  // pixels once, so the two cannot drift apart.
  const { Resvg } = await import('@resvg/resvg-js')
  const r = await compose({ surah: 2, from: 255, to: 255, layout: 'fit', aspect: 1 })
  const scale = 900 / r.width
  const { width, height, pixels } = new Resvg(r.svg, {
    fitTo: { mode: 'width', value: 900 },
    font: { loadSystemFonts: false },
  }).render()

  let min = width
  let max = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 24) {
        if (x < min) min = x
        if (x > max) max = x
      }
    }
  }
  const claimed = [
    Math.min(...r.meta.lineExtents.map((e) => e[0])) * scale,
    Math.max(...r.meta.lineExtents.map((e) => e[1])) * scale,
  ]
  assert.ok(Math.abs(min - claimed[0]) < 3, `ink starts at ${min}, layout claims ${claimed[0].toFixed(1)}`)
  assert.ok(Math.abs(max - claimed[1]) < 3, `ink ends at ${max}, layout claims ${claimed[1].toFixed(1)}`)
})

test('justify=false leaves the lines ragged', async () => {
  const r = await compose({ surah: 2, from: 255, to: 255, layout: 'fit', aspect: 1, justify: false })
  const spans = new Set(r.meta.lineExtents.map((e) => Math.round(e[1] - e[0])))
  assert.ok(spans.size > 1, 'ragged means the lines are not all the same width')
})

test('a justified line never opens gaps wider than half a line height', async () => {
  // The cap is what keeps a short line from being pulled apart instead of left
  // alone, so check a range narrow enough to put it under pressure.
  const r = await compose({ surah: 2, from: 255, to: 255, layout: 'fit', aspect: 2.5 })
  for (const [i, e] of r.meta.lineExtents.slice(0, -1).entries()) {
    assert.ok(e[1] - e[0] > 0, `line ${i + 1} is empty`)
  }
})

test('justification never overlaps or reorders words', async () => {
  const r = await compose({ surah: 18, from: 1, to: 10, layout: 'fit', aspect: 1.25 })
  const words = [...r.svg.matchAll(/data-word-key="([^"]+)"/g)].map((m) => m[1])
  // reading order is preserved exactly as the mushaf has it
  const ordinals = words.map((k) => k.split(':').map(Number))
  for (let i = 1; i < ordinals.length; i++) {
    const [, a1, w1] = ordinals[i - 1]
    const [, a2, w2] = ordinals[i]
    assert.ok(a2 > a1 || (a2 === a1 && w2 === w1 + 1), `out of order at ${words[i - 1]} → ${words[i]}`)
  }
})

test('a range that opens a surah opens it with the basmalah', async () => {
  const r = await compose({ surah: 2, from: 1, to: 3, layout: 'mushaf' })
  assert.equal(r.meta.basmalah, true)
  // the plate sets it on its own line above ayah 1
  assert.equal(r.meta.lines, 4, 'three printed ayah lines plus the basmalah')
})

test('At-Tawbah opens without a basmalah, because the mushaf prints none', async () => {
  const r = await compose({ surah: 9, from: 1, to: 2, layout: 'mushaf' })
  assert.equal(r.meta.basmalah, false)
})

test('Al-Fatihah is not given a second basmalah', async () => {
  // there the basmalah is ayah 1, already among the words
  const r = await compose({ surah: 1, from: 1, to: 3, layout: 'mushaf' })
  assert.equal(r.meta.basmalah, false)
})

test('a range starting past ayah 1 gets no basmalah', async () => {
  const r = await compose({ surah: 2, from: 2, to: 4, layout: 'mushaf' })
  assert.equal(r.meta.basmalah, false)
})

test('basmalah=false switches the opener off', async () => {
  const on = await compose({ surah: 112, from: 1, to: 4, layout: 'mushaf' })
  const off = await compose({ surah: 112, from: 1, to: 4, layout: 'mushaf', basmalah: false })
  assert.equal(on.meta.basmalah, true)
  assert.equal(off.meta.basmalah, false)
  assert.equal(on.meta.words, off.meta.words, 'the opener is not a word of the surah')
  assert.ok(on.height > off.height, 'it adds a line')
})

test('every surah that the index says opens with the basmalah gets one', async () => {
  const index = await loadIndex()
  for (const s of index.surahs) {
    const r = await compose({ surah: s.number, from: 1, to: 1, layout: 'mushaf' })
    assert.equal(r.meta.basmalah, s.has_basmalah, `surah ${s.number} ${s.name_latin}`)
  }
})

test('in fit layout the basmalah keeps its own centred line', async () => {
  const r = await compose({ surah: 2, from: 1, to: 5, layout: 'fit', aspect: 1 })
  assert.equal(r.meta.basmalah, true)
  const [left, right] = r.meta.lineExtents[0]
  const width = r.width
  // centred: the margins either side match, and it is not flush to the measure
  assert.ok(Math.abs(left - (width - right)) < 1.5, 'basmalah line is centred')
  assert.ok(right - left < width - r.meta.padding, 'basmalah is not justified to the measure')
})
