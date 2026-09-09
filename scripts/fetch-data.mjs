#!/usr/bin/env node
// Downloads the quran-svg hafs-kfgqpc bundle from its GitHub release into .data/.
// The bundle is 108 MB, so it is never committed — deploys run `npm run data`.
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Mirrored onto this repo's own release so CI can fetch it with the workflow's
// automatic GITHUB_TOKEN — no cross-repo secret to create, leak or forget. The
// upstream is AbdullahObaid/quran-svg-pipeline v1.0.0; SHA256 below pins it, so
// re-mirror only when that pin changes.
const REPO = process.env.BUNDLE_REPO || 'quran-ws/quran-png'
const TAG = process.env.BUNDLE_TAG || 'artwork-v1.0.0'
const ASSET = 'quran-svg-hafs-kfgqpc.tar.gz'
const SHA256 = '2bff7bcc1d84b61ee9baf2c356ea554b0a1dd317d6a8145406b5cee998914d17'

const DATA = new URL('../.data/', import.meta.url)
const TARBALL = new URL(ASSET, DATA)
const BUNDLE = new URL('quran-svg-hafs-kfgqpc/', DATA)

const exists = async (u) => stat(u).then(() => true, () => false)

async function sha256(url) {
  const hash = createHash('sha256')
  await pipeline((await import('node:fs')).createReadStream(url), hash)
  return hash.digest('hex')
}

/**
 * The bundle lives on a private release, so CI has no `gh` and no anonymous
 * access. With a token we go through the API (which serves private assets);
 * locally, `gh` is the convenience path; without either, the plain URL works
 * once the release is public.
 */
async function download() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN

  if (token) {
    const api = `https://api.github.com/repos/${REPO}`
    const headers = {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'quran-png-fetch-data',
    }

    const release = await fetch(`${api}/releases/tags/${TAG}`, { headers })
    if (!release.ok) throw new Error(`cannot read release ${TAG}: ${release.status} ${release.statusText}`)
    const asset = (await release.json()).assets.find((a) => a.name === ASSET)
    if (!asset) throw new Error(`release ${TAG} has no asset named ${ASSET}`)

    const res = await fetch(`${api}/releases/assets/${asset.id}`, {
      headers: { ...headers, accept: 'application/octet-stream' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`asset download failed: ${res.status} ${res.statusText}`)
    await pipeline(res.body, createWriteStream(TARBALL))
    return
  }

  try {
    await run('gh', ['release', 'download', TAG, '-R', REPO, '-p', ASSET, '-O', TARBALL.pathname, '--clobber'])
    return
  } catch {
    // fall through to the anonymous URL
  }

  const url = `https://github.com/${REPO}/releases/download/${TAG}/${ASSET}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `download failed: ${res.status} ${url}\n` +
        'The release is private — set GH_TOKEN to a token with read access to it.'
    )
  }
  await pipeline(res.body, createWriteStream(TARBALL))
}

async function main() {
  await mkdir(DATA, { recursive: true })

  if (!(await exists(TARBALL))) {
    console.log(`fetching ${ASSET} …`)
    await download()
  }

  const got = await sha256(TARBALL)
  if (got !== SHA256) {
    await rm(TARBALL, { force: true })
    throw new Error(`checksum mismatch\n  expected ${SHA256}\n  got      ${got}\nre-run to download again`)
  }
  console.log(`checksum ok  ${got.slice(0, 12)}…`)

  if (await exists(BUNDLE)) {
    console.log('bundle already extracted')
    return
  }
  console.log('extracting …')
  await run('tar', ['xzf', TARBALL.pathname, '-C', DATA.pathname])
  console.log(`bundle ready at ${BUNDLE.pathname}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
