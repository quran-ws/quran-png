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

const REPO = 'AbdullahObaid/quran-svg-pipeline'
const TAG = 'v1.0.0'
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

async function download() {
  // The release is on a private repo today, so prefer `gh` when it is available
  // and fall back to a plain HTTPS fetch once the repo is public.
  try {
    await run('gh', ['release', 'download', TAG, '-R', REPO, '-p', ASSET, '-O', TARBALL.pathname, '--clobber'])
    return
  } catch {
    // fall through
  }
  const url = `https://github.com/${REPO}/releases/download/${TAG}/${ASSET}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${url}`)
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
