// Lays a range of ayahs out as a standalone SVG.
//
// Two layouts share one placement model. Every atom — a word, an ayah mark — is
// a verbatim snippet of the printed page, placed by a single translate. Nothing
// is ever scaled or stretched, so the artwork stays pixel-identical to print;
// the layouts differ only in where the atoms land.
//
//   mushaf  reproduce the plate: every word keeps its printed x and baseline
//   fit     repack the same atoms into justified lines of a target width

import { loadIndex, loadPage } from './store.mjs'
import { unionBBox } from './path-bbox.mjs'

const INK = '#231f20' // the fill the source artwork hard-codes on some paths

/**
 * Bumped whenever the same request would now draw something different — a
 * layout change, a spacing change, a fix. Callers cache images for a year, so
 * without this a correction is invisible to anyone who already has the old one.
 */
export const RENDER_VERSION = 3

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
async function collect({ index, surah, from, to }, { basmalah = true } = {}) {
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

  // The mushaf prints the basmalah as its own line above ayah 1 of every surah
  // but At-Tawbah; in Al-Fatihah it is ayah 1 and already in the words above.
  // `has_basmalah` in the index is exactly that distinction, so a range that
  // opens a surah opens it the way the plate does.
  if (basmalah && from === 1 && surah.has_basmalah) {
    const row = await basmalahRow(index, surah)
    if (row) rows.unshift(row)
  }

  lineHeights.sort((a, b) => a - b)
  const lineHeight = lineHeights[Math.floor(lineHeights.length / 2)] ?? 26

  return { rows, lineHeight }
}

/**
 * The basmalah banner that opens `surah`, as a row, or null if the plate has
 * none. It is one atom drawn exactly like a word: same page matrix, same line
 * translate, placed by its printed box. Its baseline is the bottom of that box
 * — banners carry no baseline of their own, and the following line's baseline
 * sits a printed line height below it, which is the gap the plate shows.
 */
async function basmalahRow(index, surah) {
  const start = index.ayahs[key(surah.number, 1)]?.[0]
  if (!start) return null
  const page = await loadPage(start[0])

  const i = page.banners?.findIndex((b) => b.kind === 'basmalah' && b.sid === surah.number)
  if (i === undefined || i < 0) return null
  const banner = page.banners[i]

  // the line group the banner sits in carries the translate its box already includes
  const host = page.lines.find((l) => l.banners?.includes(i))

  const atom = {
    kind: 'basmalah',
    box: banner.box,
    svg: banner.svg,
    lineTransform: host?.transform ?? null,
    key: `${surah.number}:basmalah`,
  }
  return {
    page: start[0],
    line: host?.line ?? 0,
    baseline: banner.box[3],
    matrix: page.outerTransform,
    atoms: [atom],
    box: banner.box,
  }
}

/**
 * Reproduce the printed page: every word keeps the x it has on the plate, and
 * the baseline it sits on.
 *
 * Nothing is re-aligned here. Lines on a printed page are justified to one
 * shared text block, so their horizontal relationship to each other is part of
 * the artwork — nudging each line to its own centre would quietly invent a
 * layout the mushaf does not have. At `lineSpacing: 1` on a single page, every
 * atom is placed with the same offset, so the result is the plate itself,
 * cropped to the selection.
 *
 * The only thing that has to be constructed is a page boundary: two plates have
 * no shared vertical axis, so the first line of the new page is set one printed
 * line height below the last line of the old one.
 */
function layoutMushaf(rows, { lineHeight, lineSpacing }) {
  const placed = []
  let baselineOut = rows[0].baseline
  let previous = null
  let placedLines = 0

  for (const row of rows) {
    if (previous) {
      const printedGap = row.page === previous.page ? row.baseline - previous.baseline : lineHeight
      baselineOut += printedGap * lineSpacing
    }
    const dy = baselineOut - row.baseline
    const line = placedLines++
    for (const atom of row.atoms) placed.push({ ...atom, matrix: row.matrix, dx: 0, dy, line })
    previous = row
  }

  const width = Math.max(...rows.map((r) => r.box[2])) - Math.min(...rows.map((r) => r.box[0]))
  return { placed, width }
}

/** Fill each line as far as it goes. Used when nothing is being justified. */
function breakGreedy(stream, { targetWidth, space }) {
  const lines = []
  let current = []
  let used = 0
  for (const atom of stream) {
    const w = atom.box[2] - atom.box[0]
    const advance = current.length ? space + w : w
    if (current.length && used + advance > targetWidth) {
      lines.push({ atoms: current })
      current = [atom]
      used = w
      continue
    }
    current.push(atom)
    used += advance
  }
  if (current.length) lines.push({ atoms: current })
  return lines
}

/**
 * Choose line breaks for a justified block by minimising total badness, rather
 * than filling each line as far as it goes.
 *
 * Greedy breaking pushes all the slack onto whichever lines happen to fall
 * short, so a paragraph ends up with some lines set tight and one pulled wide.
 * Looking one line ahead cannot fix that; the whole block has to be solved at
 * once. This is the usual dynamic program: badness is the squared deviation of
 * a line's word gap from the printed one, the last line is free because it does
 * not get justified, and a line needing a gap wider than `maxGap` is not a
 * candidate at all.
 */
function breakLines(stream, { targetWidth, space, maxGap }) {
  const n = stream.length
  const widths = stream.map((a) => a.box[2] - a.box[0])
  const upto = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) upto[i + 1] = upto[i] + widths[i]

  // a mid-block line with no gaps to open cannot be justified at all; allow it
  // only when a single word is genuinely wider than the measure
  const ORPHAN = (maxGap - space) ** 2 * 100

  const cost = new Float64Array(n + 1).fill(Infinity)
  const from = new Int32Array(n + 1).fill(-1)
  cost[0] = 0

  for (let j = 1; j <= n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      const count = j - i
      const ink = upto[j] - upto[i]
      // walking i down only makes the line longer, so this bound ends the scan
      if (ink + (count - 1) * space > targetWidth && count > 1) break
      if (cost[i] === Infinity) continue

      let badness = 0
      if (j < n) {
        if (count === 1) {
          badness = ORPHAN
        } else {
          const gap = (targetWidth - ink) / (count - 1)
          if (gap > maxGap) continue
          badness = (gap - space) ** 2
        }
      }
      if (cost[i] + badness < cost[j]) {
        cost[j] = cost[i] + badness
        from[j] = i
      }
    }
  }

  // no feasible set of breaks (a very narrow measure); fall back rather than fail
  if (cost[n] === Infinity) return breakGreedy(stream, { targetWidth, space })

  const lines = []
  for (let j = n; j > 0; j = from[j]) lines.unshift({ atoms: stream.slice(from[j], j) })
  return lines
}

/** Repack the atoms into lines that fill a target width. */
function layoutFit(rows, { lineHeight, lineSpacing, align, targetWidth, wordSpacing, justify }) {
  // The basmalah is a line on the plate, not a word in the flow: let it keep
  // its own line here too, centred, and pack only the ayah words beneath it.
  // Run through the justifier it would be stretched away from the words it
  // belongs to, or worse, set flush against them.
  const opener = rows[0]?.atoms[0]?.kind === 'basmalah' ? rows[0] : null
  const bodyRows = opener ? rows.slice(1) : rows

  // one flat stream of atoms in reading order, each carrying its own baseline
  const stream = bodyRows.flatMap((row) =>
    row.atoms.map((atom) => ({ ...atom, matrix: row.matrix, baseline: row.baseline }))
  )

  // the printed inter-word gap, measured on the source lines
  const gaps = []
  for (const row of bodyRows) {
    for (let i = 1; i < row.atoms.length; i++) {
      const g = row.atoms[i - 1].box[0] - row.atoms[i].box[2] // RTL: next word sits to the left
      if (g > 0 && g < 20) gaps.push(g)
    }
  }
  gaps.sort((a, b) => a - b)
  const space = (gaps[Math.floor(gaps.length / 2)] ?? 2.5) * wordSpacing

  // The widest a word gap may open to. This is deliberately absolute rather
  // than a multiple of `space`: the mushaf sets words almost touching (the
  // median gap here is under two units), so any ratio of it is meaningless,
  // while what the eye actually judges is the gap against the size of the
  // text. Half a line height is a wide-but-honest word space.
  const maxGap = lineHeight * 0.5

  const body = justify
    ? breakLines(stream, { targetWidth, space, maxGap })
    : breakGreedy(stream, { targetWidth, space })

  for (const [i, line] of body.entries()) {
    line.gap = space
    const ink = line.atoms.reduce((sum, a) => sum + (a.box[2] - a.box[0]), 0)
    const gapCount = line.atoms.length - 1
    line.width = ink + gapCount * space
    if (!justify || i === body.length - 1 || gapCount < 1) continue

    const needed = (targetWidth - ink) / gapCount
    if (needed >= space && needed <= maxGap) {
      line.gap = needed
      line.width = targetWidth
    }
  }

  // the opener sits above the block, centred and never justified
  const lines = body
  if (opener) {
    const atom = { ...opener.atoms[0], matrix: opener.matrix, baseline: opener.baseline }
    lines.unshift({
      atoms: [atom],
      gap: 0,
      width: atom.box[2] - atom.box[0],
      center: true,
    })
  }

  const width = Math.max(targetWidth, ...lines.map((l) => l.width))
  const step = lineHeight * lineSpacing
  const placed = []

  lines.forEach((line, i) => {
    // In a justified block only the last line is free to sit where `align`
    // says; everything above it starts at the leading edge, whether or not it
    // reached the full measure. A short line that got centred instead would
    // read as a deliberate break in the paragraph.
    const follows = !justify || line.center || i === lines.length - 1
    const offsetX = line.center
      ? (width - line.width) / 2
      : follows
        ? align === 'right'
          ? width - line.width
          : align === 'left'
            ? 0
            : (width - line.width) / 2
        : width - line.width
    // RTL: fill from the right edge of this line leftwards
    let cursor = offsetX + line.width
    const targetBaseline = i * step
    for (const atom of line.atoms) {
      const w = atom.box[2] - atom.box[0]
      placed.push({
        ...atom,
        dx: cursor - w - atom.box[0],
        dy: targetBaseline - atom.baseline,
        line: i,
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
    basmalah = true,
  } = options

  if (!LAYOUTS.includes(layout)) throw new ComposeError(`layout must be one of ${LAYOUTS.join(', ')}`)
  if (!ALIGNMENTS.includes(align)) throw new ComposeError(`align must be one of ${ALIGNMENTS.join(', ')}`)

  const range = await resolveRange({ surah, from, to })
  const { rows, lineHeight } = await collect(range, { basmalah })

  let result
  if (layout === 'mushaf') {
    result = layoutMushaf(rows, { lineHeight, lineSpacing })
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

  // where each line actually lands, in image coordinates — the layout's own
  // answer, so a caller (or a test) can check flushness without reading pixels
  const extents = []
  for (const a of result.placed) {
    const e = (extents[a.line] ??= [Infinity, -Infinity])
    e[0] = Math.min(e[0], a.box[0] + a.dx + padding - ink[0])
    e[1] = Math.max(e[1], a.box[2] + a.dx + padding - ink[0])
  }

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
      basmalah: rows[0]?.atoms[0]?.kind === 'basmalah',
      lines: layout === 'mushaf' ? rows.length : result.lines,
      words: result.placed.filter((a) => a.kind === 'word').length,
      padding,
      lineExtents: extents.map((e) => [round(e[0]), round(e[1])]),
      pages: [...new Set(rows.map((r) => r.page))],
    },
  }
}
