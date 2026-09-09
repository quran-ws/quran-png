import { createHash } from 'node:crypto'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { compose, ComposeError, resolveRange } from '../../packages/composer/compose.mjs'
import { toPNG, toPDF } from '../../packages/composer/render.mjs'
import { loadIndex } from '../../packages/composer/store.mjs'
import { parseOptions, parseRange, cacheKey, ASPECTS } from './params.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const CACHE_MAX = Number(process.env.CACHE_MAX ?? 500)
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN ?? 120)

const app = new Hono()
app.use('/api/*', cors())

// --- a small LRU of finished renders; the same ayah is asked for constantly ---
const cache = new Map()
function cached(key) {
  const hit = cache.get(key)
  if (!hit) return null
  cache.delete(key)
  cache.set(key, hit)
  return hit
}
function store(key, value) {
  cache.set(key, value)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
  return value
}

// --- per-IP token bucket, enough to stop a script pulling all 604 pages ---
const buckets = new Map()
function allow(ip) {
  const now = Date.now()
  const b = buckets.get(ip) ?? { tokens: RATE_PER_MIN, at: now }
  b.tokens = Math.min(RATE_PER_MIN, b.tokens + ((now - b.at) / 60000) * RATE_PER_MIN)
  b.at = now
  buckets.set(ip, b)
  if (buckets.size > 10000) buckets.clear()
  if (b.tokens < 1) return false
  b.tokens -= 1
  return true
}

const clientIP = (c) =>
  c.req.header('cf-connecting-ip') ??
  c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
  'local'

const MIME = { png: 'image/png', svg: 'image/svg+xml; charset=utf-8', pdf: 'application/pdf' }

async function render(options) {
  const key = cacheKey(options)
  const hit = cached(key)
  if (hit) return hit

  const result = await compose(options)
  let body
  if (options.format === 'png') body = toPNG(result.svg, { width: options.width })
  else if (options.format === 'pdf') body = await toPDF(result.svg, result)
  else body = Buffer.from(result.svg, 'utf8')

  const etag = `"${createHash('sha1').update(key).update(body).digest('base64url').slice(0, 27)}"`
  return store(key, { body, etag, meta: result.meta, width: result.width, height: result.height })
}

function sendImage(c, options, out) {
  const name = `${options.surah}-${options.from}${options.to === options.from ? '' : `-${options.to}`}.${options.format}`
  if (c.req.header('if-none-match') === out.etag) return c.body(null, 304)
  return c.body(out.body, 200, {
    'content-type': MIME[options.format],
    'content-length': String(out.body.length),
    etag: out.etag,
    // the artwork for a given set of parameters never changes
    'cache-control': 'public, max-age=31536000, immutable',
    'content-disposition': `inline; filename="quran-${name}"`,
    'x-quran-lines': String(out.meta.lines),
    'x-quran-words': String(out.meta.words),
  })
}

// --- metadata -------------------------------------------------------------

app.get('/api/v1/surahs', async (c) => {
  const index = await loadIndex()
  return c.json({ edition: index.edition, print: index.print, count: index.surahs.length, surahs: index.surahs })
})

app.get('/api/v1/surahs/:n{[0-9]+}', async (c) => {
  const index = await loadIndex()
  const surah = index.surahs[Number(c.req.param('n')) - 1]
  if (!surah) return c.json({ error: 'surah must be 1..114' }, 400)
  return c.json(surah)
})

app.get('/api/v1/options', (c) =>
  c.json({
    layouts: { mushaf: 'keep the printed mushaf line breaks', fit: 'repack the words to a target shape' },
    aspects: ASPECTS,
    formats: { png: 'transparent raster', svg: 'vector', pdf: 'vector, print-ready' },
    params: {
      align: ['center', 'right', 'left'],
      width: 'output pixel width for png, 64..8000',
      color: 'hex ink colour',
      background: 'hex; omit for transparent',
      padding: 'margin in artwork units, 0..400',
      lineSpacing: 'multiplier on the printed line height, 0.6..3',
      wordSpacing: 'multiplier on the printed word gap (fit layout), 0.3..4',
    },
  })
)

// --- images ---------------------------------------------------------------

// /api/v1/image/2/255.png   /api/v1/image/2/255-257.svg   /api/v1/image/112/1-.pdf
app.get('/api/v1/image/:surah{[0-9]+}/:spec', async (c) => {
  if (!allow(clientIP(c))) return c.json({ error: 'too many requests, slow down' }, 429)

  const surah = Number(c.req.param('surah'))
  const spec = c.req.param('spec')
  const dot = spec.lastIndexOf('.')
  const rangeText = dot === -1 ? spec : spec.slice(0, dot)
  const ext = dot === -1 ? undefined : spec.slice(dot + 1)

  const index = await loadIndex()
  const meta = index.surahs[surah - 1]
  if (!meta) return c.json({ error: 'surah must be 1..114' }, 400)

  const { from, to } = parseRange(rangeText, meta.ayahs)
  const options = parseOptions({ ...c.req.query(), format: ext ?? c.req.query('format') }, { surah, from, to })
  await resolveRange(options)

  return sendImage(c, options, await render(options))
})

// query-string form, for callers that would rather not build a path
app.get('/api/v1/image', async (c) => {
  if (!allow(clientIP(c))) return c.json({ error: 'too many requests, slow down' }, 429)
  const q = c.req.query()
  const surah = Number(q.surah)
  const index = await loadIndex()
  const meta = index.surahs[surah - 1]
  if (!meta) return c.json({ error: 'surah must be 1..114' }, 400)
  const from = q.from ? Number(q.from) : 1
  const to = q.to ? Number(q.to) : from
  const options = parseOptions(q, { surah, from, to })
  await resolveRange(options)
  return sendImage(c, options, await render(options))
})

// --- plumbing -------------------------------------------------------------

app.get('/healthz', (c) => c.json({ ok: true, cached: cache.size }))

app.onError((err, c) => {
  if (err instanceof ComposeError) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'internal error' }, 500)
})

app.use('/*', serveStatic({ root: './apps/web' }))
app.notFound((c) =>
  c.req.path.startsWith('/api/')
    ? c.json({ error: `no such endpoint: ${c.req.path}` }, 404)
    : c.redirect('/')
)

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`quran-png listening on http://localhost:${info.port}`)
})
