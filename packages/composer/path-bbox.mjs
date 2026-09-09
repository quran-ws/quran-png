// Bounding box of an SVG path `d`, from every coordinate the path names.
// Curve control points bound their curve, so the result is a conservative
// superset of the true ink box — exactly what layout needs.

const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g

// how many numbers each command consumes, and which of them are (x, y) pairs
const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 }

export function pathBBox(d) {
  let x = 0, y = 0, sx = 0, sy = 0
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  const see = (px, py) => {
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }

  for (const [, cmd, body] of d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
    const lower = cmd.toLowerCase()
    const rel = cmd !== cmd.toUpperCase()
    const n = ARITY[lower]
    const args = body.match(NUM)?.map(Number) ?? []

    if (lower === 'z') {
      x = sx; y = sy
      continue
    }
    for (let i = 0; i + n <= args.length || (n === 0 && false); i += n) {
      const a = args.slice(i, i + n)
      if (a.length < n) break

      if (lower === 'h') {
        x = rel ? x + a[0] : a[0]
      } else if (lower === 'v') {
        y = rel ? y + a[0] : a[0]
      } else if (lower === 'a') {
        // only the endpoint is a coordinate; the radii bound nothing useful here
        x = rel ? x + a[5] : a[5]
        y = rel ? y + a[6] : a[6]
      } else {
        // every pair in the argument list is a point in the current space
        for (let k = 0; k + 1 < n; k += 2) {
          see(rel ? x + a[k] : a[k], rel ? y + a[k + 1] : a[k + 1])
        }
        x = rel ? x + a[n - 2] : a[n - 2]
        y = rel ? y + a[n - 1] : a[n - 1]
      }
      see(x, y)
      if (lower === 'm') { sx = x; sy = y }
    }
  }

  if (minX === Infinity) return null
  return [minX, minY, maxX, maxY]
}

// --- 2D affine matrices, as [a, b, c, d, e, f] ---------------------------

export const IDENTITY = [1, 0, 0, 1, 0, 0]

export function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

export function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

export function parseTransform(str) {
  let m = IDENTITY
  if (!str) return m
  for (const [, fn, body] of str.matchAll(/(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g)) {
    const a = body.match(NUM).map(Number)
    if (fn === 'matrix') m = multiply(m, a)
    else if (fn === 'translate') m = multiply(m, [1, 0, 0, 1, a[0], a[1] ?? 0])
    else if (fn === 'scale') m = multiply(m, [a[0], 0, 0, a[1] ?? a[0], 0, 0])
    else if (fn === 'rotate') {
      const r = (a[0] * Math.PI) / 180
      m = multiply(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0])
    }
  }
  return m
}

export function transformBBox(m, [x0, y0, x1, y1]) {
  const pts = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)]
  return [
    Math.min(...pts.map((p) => p[0])),
    Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[0])),
    Math.max(...pts.map((p) => p[1])),
  ]
}

export function unionBBox(boxes) {
  const bs = boxes.filter(Boolean)
  if (!bs.length) return null
  return [
    Math.min(...bs.map((b) => b[0])),
    Math.min(...bs.map((b) => b[1])),
    Math.max(...bs.map((b) => b[2])),
    Math.max(...bs.map((b) => b[3])),
  ]
}
