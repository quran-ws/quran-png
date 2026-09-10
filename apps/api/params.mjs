// One place that turns untrusted query strings into a validated render request.
import { ComposeError, LAYOUTS, ALIGNMENTS } from '../../packages/composer/compose.mjs'
import { FORMATS, MAX_PIXELS } from '../../packages/composer/render.mjs'

// aspect is expressed the way designers say it: width:height
export const ASPECTS = {
  square: [1, 1],
  post: [4, 5],
  story: [9, 16],
  wide: [16, 9],
  banner: [3, 1],
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

function num(raw, name, { min, max, fallback }) {
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new ComposeError(`${name} must be a number, got "${raw}"`)
  if (n < min || n > max) throw new ComposeError(`${name} must be between ${min} and ${max}, got ${n}`)
  return n
}

function color(raw, name, fallback) {
  if (raw === undefined || raw === '') return fallback
  const v = raw.startsWith('#') ? raw : `#${raw}`
  if (!HEX.test(v)) throw new ComposeError(`${name} must be a hex colour like #1a1a1a, got "${raw}"`)
  return v.toLowerCase()
}

function bool(raw, fallback) {
  if (raw === undefined || raw === '') return fallback
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase())
}

function one(raw, name, allowed, fallback) {
  if (raw === undefined || raw === '') return fallback
  if (!allowed.includes(raw)) throw new ComposeError(`${name} must be one of ${allowed.join(', ')}, got "${raw}"`)
  return raw
}

/** `255`, `255-257` or `1-` (to the end of the surah). */
export function parseRange(raw, ayahCount) {
  const m = /^(\d+)(?:-(\d*))?$/.exec(raw ?? '')
  if (!m) throw new ComposeError(`range must look like 255 or 255-257, got "${raw}"`)
  const from = Number(m[1])
  const to = m[2] === undefined ? from : m[2] === '' ? ayahCount : Number(m[2])
  return { from, to }
}

export function parseOptions(q, base = {}) {
  const format = one(q.format, 'format', FORMATS, 'png')
  const layout = one(q.layout, 'layout', LAYOUTS, 'mushaf')

  let aspect = null
  if (layout === 'fit') {
    const raw = q.aspect ?? 'square'
    if (ASPECTS[raw]) {
      const [w, h] = ASPECTS[raw]
      aspect = h / w
    } else {
      const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(raw)
      if (!m) {
        throw new ComposeError(
          `aspect must be one of ${Object.keys(ASPECTS).join(', ')} or a ratio like 4:5, got "${raw}"`
        )
      }
      aspect = Number(m[2]) / Number(m[1])
    }
  }

  return {
    ...base,
    format,
    layout,
    aspect,
    align: one(q.align, 'align', ALIGNMENTS, 'center'),
    justify: bool(q.justify, true),
    basmalah: bool(q.basmalah, true),
    color: color(q.color, 'color', '#231f20'),
    background: q.background ? color(q.background, 'background', null) : null,
    padding: num(q.padding, 'padding', { min: 0, max: 400, fallback: 24 }),
    lineSpacing: num(q.lineSpacing, 'lineSpacing', { min: 0.6, max: 3, fallback: 1 }),
    wordSpacing: num(q.wordSpacing, 'wordSpacing', { min: 0.3, max: 4, fallback: 1 }),
    width: num(q.width, 'width', { min: 64, max: MAX_PIXELS, fallback: 2000 }),
  }
}

export function cacheKey(o) {
  return [
    o.surah, o.from, o.to, o.format, o.layout, o.aspect ?? '-', o.align, o.justify ? 'j' : '-',
    o.basmalah ? 'b' : '-',
    o.color, o.background ?? '-', o.padding, o.lineSpacing, o.wordSpacing, o.width,
  ].join('|')
}
