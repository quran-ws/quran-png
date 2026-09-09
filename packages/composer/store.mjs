// Lazy, cached access to the render store produced by scripts/build-store.mjs.
import { readFile } from 'node:fs/promises'

const STORE = new URL('../../.data/store/', import.meta.url)
const INDEX = new URL('../../data/index.json', import.meta.url)

const MAX_CACHED_PAGES = 96

let indexPromise = null
const pages = new Map()

export function loadIndex() {
  indexPromise ??= readFile(INDEX, 'utf8').then(JSON.parse)
  return indexPromise
}

export async function loadPage(n) {
  const hit = pages.get(n)
  if (hit) {
    // refresh recency
    pages.delete(n)
    pages.set(n, hit)
    return hit
  }
  const p = readFile(new URL(`${String(n).padStart(3, '0')}.json`, STORE), 'utf8').then(JSON.parse)
  pages.set(n, p)
  if (pages.size > MAX_CACHED_PAGES) pages.delete(pages.keys().next().value)
  return p
}
