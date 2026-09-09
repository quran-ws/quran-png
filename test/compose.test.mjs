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
