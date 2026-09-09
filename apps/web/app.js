// The generator. Every control writes to `state`; `state` writes to the URL and
// to one <img src>. The API is the only thing that knows how to draw.

const API = '/api/v1'

const ASPECTS = [
  ['square', 'Square', 'مربّع'],
  ['post', 'Post 4:5', 'منشور ٤:٥'],
  ['story', 'Story 9:16', 'قصّة ٩:١٦'],
  ['wide', 'Wide 16:9', 'عريض ١٦:٩'],
  ['banner', 'Banner 3:1', 'شريط ٣:١'],
]

const INKS = ['#231f20', '#57534e', '#c4956a', '#1e3a34', '#ffffff']

const DEFAULTS = {
  surah: 2,
  from: 255,
  to: 255,
  layout: 'mushaf',
  aspect: 'square',
  color: '#231f20',
  background: '',
  padding: 24,
  width: 2000,
}

const state = { ...DEFAULTS }
let surahs = []

const $ = (sel) => document.querySelector(sel)
const el = (tag, props = {}, kids = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const k of [].concat(kids)) node.append(k)
  return node
}

// --- URL <-> state --------------------------------------------------------

function readURL() {
  const p = new URLSearchParams(location.search)
  const ayah = p.get('ayah') // "2:255" or "2:255-257"
  if (ayah) {
    const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ayah)
    if (m) {
      state.surah = Number(m[1])
      state.from = Number(m[2])
      state.to = Number(m[3] ?? m[2])
    }
  }
  for (const key of ['layout', 'aspect', 'color', 'background']) {
    if (p.get(key)) state[key] = p.get(key)
  }
  for (const key of ['padding', 'width']) {
    if (p.get(key)) state[key] = Number(p.get(key))
  }
}

function writeURL() {
  const p = new URLSearchParams()
  p.set('ayah', rangeText())
  for (const [key, value] of Object.entries(state)) {
    if (['surah', 'from', 'to'].includes(key)) continue
    if (value !== DEFAULTS[key] && value !== '') p.set(key, value)
  }
  history.replaceState(null, '', `?${p}`)
}

const rangeText = () => `${state.surah}:${state.from}${state.to === state.from ? '' : `-${state.to}`}`

/** The API URL for the current state, in the requested format. */
function imageURL(format, { width } = {}) {
  const p = new URLSearchParams()
  if (state.layout !== 'mushaf') p.set('layout', state.layout)
  if (state.layout === 'fit') p.set('aspect', state.aspect)
  if (state.color !== DEFAULTS.color) p.set('color', state.color)
  if (state.background) p.set('background', state.background)
  if (state.padding !== DEFAULTS.padding) p.set('padding', state.padding)
  if (format === 'png') p.set('width', width ?? state.width)
  const span = state.to === state.from ? state.from : `${state.from}-${state.to}`
  return `${API}/image/${state.surah}/${span}.${format}?${p}`
}

// --- rendering ------------------------------------------------------------

const canvas = $('#canvas')
const preview = $('#preview')
const problem = $('#problem')
let inflight = 0

function refresh() {
  writeURL()
  syncControls()

  canvas.classList.toggle('solid', Boolean(state.background))
  canvas.style.background = state.background || ''
  canvas.dataset.busy = '1'
  problem.hidden = true

  // the preview only needs screen resolution; the download link carries the full size
  const url = imageURL('png', { width: 1200 })
  const token = ++inflight

  const probe = new Image()
  probe.onload = () => {
    if (token !== inflight) return
    preview.src = url
    preview.hidden = false
    canvas.dataset.busy = '0'
  }
  probe.onerror = async () => {
    if (token !== inflight) return
    canvas.dataset.busy = '0'
    preview.hidden = true
    const message = await fetch(url).then((r) => r.json()).then((j) => j.error, () => null)
    problem.textContent = message ?? 'That range could not be drawn.'
    problem.hidden = false
  }
  probe.src = url

  $('#size-note').textContent = `${state.width} px wide`
  $('#width-note').textContent = `${state.width} px`
  $('#bg-note').textContent = state.background ? state.background : 'transparent'

  for (const [format, node] of Object.entries(downloads)) {
    node.href = imageURL(format)
    node.download = `quran-${state.surah}-${state.from}${state.to === state.from ? '' : `-${state.to}`}.${format}`
  }
}

// --- controls -------------------------------------------------------------

const downloads = {
  png: $('#dl-png'),
  svg: $('#dl-svg'),
  pdf: $('#dl-pdf'),
}

function buildChips(host, items, key) {
  host.replaceChildren(
    ...items.map(([value, en, ar]) => {
      const b = el('button', { type: 'button', textContent: document.documentElement.lang === 'ar' ? ar : en })
      b.dataset.value = value
      b.onclick = () => {
        state[key] = value
        refresh()
      }
      return b
    })
  )
}

function buildSwatches() {
  const host = $('#inks')
  host.replaceChildren(
    ...INKS.map((hex) => {
      const b = el('button', { type: 'button', title: hex })
      b.style.background = hex
      b.dataset.value = hex
      b.onclick = () => {
        state.color = hex
        refresh()
      }
      return b
    })
  )
  const custom = el('input', { type: 'color', value: state.color, title: 'Custom colour' })
  custom.oninput = () => {
    state.color = custom.value
    refresh()
  }
  host.append(custom, el('span', { className: 'hex', id: 'hex' }))
}

function syncControls() {
  for (const b of document.querySelectorAll('[data-value]')) {
    const key = b.closest('[data-key]')?.dataset.key
    if (key) b.setAttribute('aria-pressed', String(state[key] === b.dataset.value))
  }
  $('#hex').textContent = state.color
  $('#aspect-group').hidden = state.layout !== 'fit'
  $('#surah').value = String(state.surah)
  $('#from').value = String(state.from)
  $('#to').value = String(state.to)

  const surah = surahs[state.surah - 1]
  if (surah) {
    $('#from').max = surah.ayahs
    $('#to').max = surah.ayahs
    $('#reading').textContent =
      document.documentElement.lang === 'ar'
        ? `${surah.name_ar} · ${surah.ayahs} آية`
        : `${surah.name_latin} · ${surah.ayahs} ayahs`
  }
}

function wire() {
  $('#surah').onchange = (e) => {
    state.surah = Number(e.target.value)
    const surah = surahs[state.surah - 1]
    state.from = Math.min(state.from, surah.ayahs)
    state.to = Math.min(Math.max(state.to, state.from), surah.ayahs)
    refresh()
  }
  $('#from').onchange = (e) => {
    state.from = Math.max(1, Number(e.target.value) || 1)
    if (state.to < state.from) state.to = state.from
    refresh()
  }
  $('#to').onchange = (e) => {
    state.to = Math.max(state.from, Number(e.target.value) || state.from)
    refresh()
  }

  for (const b of document.querySelectorAll('[data-key] button[data-value]')) {
    b.onclick = () => {
      state[b.closest('[data-key]').dataset.key] = b.dataset.value
      refresh()
    }
  }

  $('#bg-transparent').onclick = () => {
    state.background = ''
    refresh()
  }
  $('#bg-solid').onclick = () => {
    state.background = state.background || '#ffffff'
    $('#bg-colour').value = state.background
    refresh()
  }
  $('#bg-colour').oninput = (e) => {
    state.background = e.target.value
    refresh()
  }

  $('#padding').oninput = (e) => {
    state.padding = Number(e.target.value)
    $('#padding-note').textContent = state.padding
    refresh()
  }
  $('#width').oninput = (e) => {
    state.width = Number(e.target.value)
    refresh()
  }

  $('#copy').onclick = async () => {
    await navigator.clipboard.writeText(new URL(imageURL('png'), location.origin).href)
    $('#copy').textContent = 'Copied'
    setTimeout(() => ($('#copy').textContent = $('#copy').dataset.label), 1400)
  }
}

// --- boot -----------------------------------------------------------------

async function main() {
  readURL()

  const data = await fetch(`${API}/surahs`).then((r) => r.json())
  surahs = data.surahs

  $('#surah').replaceChildren(
    ...surahs.map((s) =>
      el('option', {
        value: String(s.number),
        textContent: `${s.number}. ${s.name_latin} — ${s.name_ar}`,
      })
    )
  )

  buildChips($('#layouts'), [
    ['mushaf', 'Mushaf lines', 'سطور المصحف'],
    ['fit', 'Fit to width', 'ملء العرض'],
  ], 'layout')
  buildChips($('#aspects'), ASPECTS, 'aspect')
  buildSwatches()
  wire()

  $('#padding').value = String(state.padding)
  $('#padding-note').textContent = state.padding
  $('#width').value = String(state.width)
  $('#copy').dataset.label = $('#copy').textContent

  refresh()
}

main()
