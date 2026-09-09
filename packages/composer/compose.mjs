// Lays a range of ayahs out as a standalone SVG.
//
// Two layouts share one placement model. Every atom — a word, an ayah mark — is
// a verbatim snippet of the printed page, placed by a single translate. Nothing
// is ever scaled or stretched, so the artwork stays pixel-identical to print;
// the layouts differ only in where the atoms land.
//
//   mushaf  keep the printed line breaks and the printed spacing within a line
//   fit     repack the same atoms into lines of a target width

import { loadIndex, loadPage } from './store.mjs'
import { unionBBox } from './path-bbox.mjs'

const INK = '#231f20' // the fill the source artwork hard-codes on some paths

export const LAYOUTS = ['mushaf', 'fit']
export const ALIGNMENTS = ['center', 'right', 'left']

export class ComposeError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

const key = (s, a) => `${s}:${a}`
const round = (n) => Number(n.toFixed(3))

/** Resolve and validate a surah + ayah range against the index. */
export async function resolveRange({ surah, from, to }) {
  const index = await loadIndex()
  const meta = index.surahs[surah - 1]
  if (!Number.isInteger(surah) || !meta) throw new ComposeError(`surah must be 1..114, got ${surah}`)

  from = from ?? 1
  to = to ?? from
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new ComposeError('from and to must be whole numbers')
  if (from < 1 || to > meta.ayahs) throw new ComposeError(`surah ${surah} has ${meta.ayahs} ayahs, got ${from}-${to}`)
  if (to < from) throw new ComposeError(`range is backwards: ${from}-${to}`)

  return { index, surah: meta, from, to }
}

/**
 * Collect the atoms for a range, in mushaf reading order, grouped by the
 * printed line they came from.
 */
async function collect({ index, surah, from, to }) {
  // the (page, line) runs the range touches, deduplicated and in order
  const runs = []
  for (let a = from; a <= to; a++) {
    for (const [page, line] of index.ayahs[key(surah.number, a)] ?? []) {
      const last = runs[runs.length - 1]
      if (!last || last[0] !== page || last[1] !== line) runs.push([page, line])
    }
  }
  if (!runs.length) throw new ComposeError(`no artwork for ${surah.number}:${from}-${to}`, 404)

  const inRange = (ayahKey) => {
    const [s, a] = ayahKey.split(':').map(Number)
    return s === surah.number && a >= from && a <= to
  }

  const rows = []
  let lineHeights = []

  for (const [pageNo, lineNo] of runs) {
    const page = await loadPage(pageNo)
    const line = page.lines.find((l) => l.line === lineNo)
    if (!line) continue

    // the printed line-to-line rhythm on this page, used for vertical spacing
    const baselines = page.lines.map((l) => l.baseline).filter(Boolean)
    for (let i = 1; i < baselines.length; i++) {
      const d = baselines[i] - baselines[i - 1]
      if (d > 1) lineHeights.push(d)
    }

    const atoms = []
    for (const frag of line.frags) {
      if (!inRange(frag.ayah)) continue
      for (const w of frag.words) {
        atoms.push({ kind: 'word', box: w.box, svg: w.svg, lineTransform: line.transform, key: w.key })
      }
      // the ayah mark belongs to the fragment that closes the ayah
      if (frag.n === frag.of) {
        const mark = page.marks[frag.ayah]
        if (mark) atoms.push({ kind: 'mark', box: mark.box, svg: mark.svg, lineTransform: null, key: frag.ayah })
      }
    }
    if (!atoms.length) continue

    rows.push({
      page: pageNo,
      line: lineNo,
      baseline: line.baseline,
      matrix: page.outerTransform,
      atoms,
      box: unionBBox(atoms.map((a) => a.box)),
    })
  }

  if (!rows.length) throw new ComposeError(`no artwork for ${surah.number}:${from}-${to}`, 404)

  lineHeights.sort((a, b) => a - b)
  const lineHeight = lineHeights[Math.floor(lineHeights.length / 2)] ?? 26

  return { rows, lineHeight }
}

/** Place atoms on their printed lines, keeping the printed spacing. */
function layoutMushaf(rows, { lineHeight, lineSpacing, align }) {
  const step = lineHeight * lineSpacing
  const width = Math.max(...rows.map((r) => r.box[2] - r.box[0]))
  const placed = []

  rows.forEach((row, i) => {
    const w = row.box[2] - row.box[0]
    const offsetX = align === 'right' ? width - w : align === 'left' ? 0 : (width - w) / 2
    // the row travels as one unit: dx from its own left edge, dy from its baseline
    const dx = offsetX - row.box[0]
    const dy = i * step - row.baseline
    for (const atom of row.atoms) placed.push({ ...atom, matrix: row.matrix, dx, dy })
  })

  return { placed, width }
}

/** Repack the atoms into lines that fill a target width. */
function layoutFit(rows, { lineHeight, lineSpacing, align, targetWidth, wordSpacing, justify }) {
  // one flat stream of atoms in reading order, each carrying its own baseline
  const stream = rows.flatMap((row) =>
    row.atoms.map((atom) => ({ ...atom, matrix: row.matrix, baseline: row.baseline }))
  )

  // the printed inter-word gap, measured on the source lines
  const gaps = []
  for (const row of rows) {
    for (let i = 1; i < row.atoms.length; i++) {
      const g = row.atoms[i - 1].box[0] - row.atoms[i].box[2] // RTL: next word sits to the left
      if (g > 0 && g < 20) gaps.push(g)
    }
  }
  gaps.sort((a, b) => a - b)
  const space = (gaps[Math.floor(gaps.length / 2)] ?? 2.5) * wordSpacing

  const lines = []
  let current = []
  let used = 0
  for (const atom of stream) {
    const w = atom.box[2] - atom.box[0]
    const advance = current.length ? space + w : w
    if (current.length && used + advance > targetWidth) {
      lines.push({ atoms: current, width: used })
      current = []
      used = 0
      current.push(atom)
      used = w
      continue
    }
    current.push(atom)
    used += advance
  }
  if (current.length) lines.push({ atoms: current, width: used })

  // Justify every line but the last: the first word sits flush against the
  // right edge, the last against the left, and the slack is shared equally by
  // the gaps between them. The printed mushaf justifies by stretching letters
  // (kashida); we cannot do that without distorting the artwork, so a line
  // whose gaps would have to blow out past MAX_STRETCH is left ragged instead —
  // a loose line reads better than a line pulled apart.
  const MAX_STRETCH = 3

  for (const [i, line] of lines.entries()) {
    line.gap = space
    const ink = line.atoms.reduce((sum, a) => sum + (a.box[2] - a.box[0]), 0)
    const gapCount = line.atoms.length - 1
    if (!justify || i === lines.length - 1 || gapCount < 1) continue

    const needed = (targetWidth - ink) / gapCount
    if (needed >= space && needed <= space * MAX_STRETCH) {
      line.gap = needed
      line.width = targetWidth
    }
  }

  const width = Math.max(...lines.map((l) => l.width))
  const step = lineHeight * lineSpacing
  const placed = []

  lines.forEach((line, i) => {
    const offsetX = align === 'right' ? width - line.width : align === 'left' ? 0 : (width - line.width) / 2
    // RTL: fill from the right edge of this line leftwards
    let cursor = offsetX + line.width
    const targetBaseline = i * step
    for (const atom of line.atoms) {
      const w = atom.box[2] - atom.box[0]
      placed.push({
        ...atom,
        dx: cursor - w - atom.box[0],
        dy: targetBaseline - atom.baseline,
      })
      cursor -= w + line.gap
    }
  })

  return { placed, width, lines: lines.length }
}

/** Emit one atom, wrapped in the transforms that put it where layout decided. */
function emit(atom, color) {
  const svg = color === INK ? atom.svg : atom.svg.replaceAll(`fill="${INK}"`, 'fill="currentColor"')
  const inner = atom.lineTransform ? `<g transform="${atom.lineTransform}">${svg}</g>` : svg
  return `<g transform="translate(${round(atom.dx)} ${round(atom.dy)})"><g transform="${atom.matrix}">${inner}</g></g>`
}

/**
 * Compose an ayah range into a standalone SVG.
 *
 * @returns {Promise<{svg: string, width: number, height: number, meta: object}>}
 */
export async function compose(options = {}) {
  const {
    surah,
    from,
    to,
    layout = 'mushaf',
    align = 'center',
    padding = 24,
    lineSpacing = 1,
    wordSpacing = 1,
    color = INK,
    background = null,
    aspect = null,
    justify = true,
  } = options

  if (!LAYOUTS.includes(layout)) throw new ComposeError(`layout must be one of ${LAYOUTS.join(', ')}`)
  if (!ALIGNMENTS.includes(align)) throw new ComposeError(`align must be one of ${ALIGNMENTS.join(', ')}`)

  const range = await resolveRange({ surah, from, to })
  const { rows, lineHeight } = await collect(range)

  let result
  if (layout === 'mushaf') {
    result = layoutMushaf(rows, { lineHeight, lineSpacing, align })
  } else {
    // Solve for the line width whose resulting block matches the target aspect.
    // Each trial is cheap, and the packing is monotone in width, so a short
    // bisection lands within a pixel of the requested shape.
    const total = rows.reduce((s, r) => s + r.atoms.reduce((t, a) => t + (a.box[2] - a.box[0]), 0), 0)
    const ratio = aspect ?? 1
    let lo = Math.max(...rows.flatMap((r) => r.atoms.map((a) => a.box[2] - a.box[0])))
    let hi = Math.max(lo, total * 1.3)
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      const trial = layoutFit(rows, { lineHeight, lineSpacing, align, targetWidth: mid, wordSpacing, justify })
      const height = (trial.lines - 1) * lineHeight * lineSpacing + lineHeight
      if (height / trial.width > ratio) lo = mid
      else hi = mid
    }
    result = layoutFit(rows, { lineHeight, lineSpacing, align, targetWidth: hi, wordSpacing, justify })
  }

  // Measure the real ink, so the image is cropped to the artwork and not to a
  // nominal line box that no glyph reaches.
  const ink = unionBBox(
    result.placed.map((a) => [a.box[0] + a.dx, a.box[1] + a.dy, a.box[2] + a.dx, a.box[3] + a.dy])
  )

  const width = round(ink[2] - ink[0] + padding * 2)
  const height = round(ink[3] - ink[1] + padding * 2)
  const shift = `translate(${round(padding - ink[0])} ${round(padding - ink[1])})`

  const body = result.placed.map((a) => emit(a, color)).join('')
  const bg = background ? `<rect width="100%" height="100%" fill="${background}"/>` : ''

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:ayah="https://quranpedia.net" ` +
    `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
    `fill="${color}" color="${color}" ` +
    `data-mushaf="hafs-kfgqpc" data-riwayah="hafs" data-ayah-range="${range.surah.number}:${range.from}-${range.to}">` +
    `<title>${range.surah.name_ar} ${range.from}${range.to === range.from ? '' : `-${range.to}`}</title>` +
    bg +
    `<g ${shift ? `transform="${shift}"` : ''}>${body}</g>` +
    `</svg>`

  return {
    svg,
    width,
    height,
    meta: {
      surah: range.surah.number,
      surah_name_ar: range.surah.name_ar,
      surah_name_en: range.surah.name_en,
      from: range.from,
      to: range.to,
      layout,
      justified: layout === 'fit' ? justify : false,
      lines: layout === 'mushaf' ? rows.length : result.lines,
      words: result.placed.filter((a) => a.kind === 'word').length,
      pages: [...new Set(rows.map((r) => r.page))],
    },
  }
}
