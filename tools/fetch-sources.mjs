/**
 * Downloads freely-licensed source photographs from Wikimedia Commons.
 *
 * Build-time only — nothing here ships to the browser. Accepts public domain
 * and CC0 only, so the exhibition carries no attribution obligations it might
 * fail to meet, and records provenance for every file anyway.
 *
 *   node tools/fetch-sources.mjs
 *
 * Results are cached on disk; re-running only fetches what is missing.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = join(HERE, 'sources')
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'CloudyDDWPrototype/1.0 (design-school project; contact via github.com/Glitterrosie/cloudy)'

// Themes a visitor might recognise in their own camera roll. The first group are
// the "burst" subjects that become duplicate stacks; the rest fill the library
// with one-off photos that have no duplicates.
export const BURST_THEMES = [
  { id: 'sunset', query: 'sunset sea horizon', subject: 'the same sunset' },
  { id: 'tulips', query: 'tulip field Netherlands', subject: 'the same tulip field' },
  { id: 'canal', query: 'Amsterdam canal houses', subject: 'the same canal house' },
  { id: 'latte', query: 'latte art coffee cup', subject: 'the same coffee' },
  { id: 'dog', query: 'dog', subject: 'the dog, not moving' },
  { id: 'windmill', query: 'Kinderdijk windmill photograph', subject: 'the same windmill' },
  { id: 'dinner', query: 'plate of food restaurant', subject: 'a plate of dinner' },
  { id: 'concert', query: 'concert stage crowd lights', subject: 'one blurry concert' },
  { id: 'beach', query: 'beach sand sea summer', subject: 'the same stretch of beach' },
  { id: 'cat', query: 'cat sitting window', subject: 'the cat, not moving' },
  { id: 'bike', query: 'bicycle parked street', subject: 'your bike, where you left it' },
  { id: 'church', query: 'church tower architecture', subject: 'the same church tower' },
]

export const FILLER_THEMES = [
  'landscape mountain',
  'forest path trees',
  'city street architecture',
  'flowers garden macro',
  'bird wildlife',
  'bridge river',
  'market stall vegetables',
  'harbour boats',
  'snow winter landscape',
  'lighthouse coast',
  'train station platform',
  'park bench autumn',
]

// CC0 and public domain carry no obligations; CC BY only needs a credit, which
// CREDITS.md and the in-app info panel provide. Share-alike is excluded on
// purpose: the burst variants are derivative works, and inheriting SA would drag
// the whole piece into share-alike terms.
const FREE_LICENCES = /^(cc0|public domain|pd|no restrictions|cc by [0-9.]+$|attribution$)/i

// Commons is full of digitised artwork. This is meant to look like a camera roll.
const NOT_A_PHOTO =
  /(painting|oil on canvas|museum|Yale Center|engraving|lithograph|drawing|sketch|portrait of|woodcut|etching|manuscript|coat of arms|\bmap\b|poster)/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`
  let lastError = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (res.ok) return await res.json()
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastError = err
    }
    await sleep(2500 * (attempt + 1))
  }
  throw new Error(`Commons API failed (${lastError?.message}): ${params.srsearch ?? params.titles}`)
}

/** Search Commons and keep only images we are certain we may redistribute. */
async function findFreeImages(query, limit) {
  // Commons hosts a large CC0 import from Unsplash: real photographs, freely
  // reusable, no credit required. Prefer those, then widen if we come up short.
  const attempts = [`${query} Unsplash`, query]
  const titles = []
  for (const attempt of attempts) {
    const search = await api({
      action: 'query',
      list: 'search',
      srsearch: `${attempt} filetype:bitmap`,
      srnamespace: '6',
      srlimit: '50',
    })
    for (const hit of search.query?.search ?? []) {
      if (!titles.includes(hit.title) && !NOT_A_PHOTO.test(hit.title)) titles.push(hit.title)
    }
    if (titles.length >= limit * 5) break
    await sleep(1200)
  }
  if (!titles.length) return []

  const found = []
  // imageinfo accepts 50 titles at a time
  for (let i = 0; i < titles.length && found.length < limit; i += 25) {
    const info = await api({
      action: 'query',
      titles: titles.slice(i, i + 25).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: '1200',
    })
    for (const page of Object.values(info.query?.pages ?? {})) {
      const ii = page.imageinfo?.[0]
      if (!ii || ii.mime !== 'image/jpeg') continue
      const meta = ii.extmetadata ?? {}
      const licence = meta.LicenseShortName?.value ?? ''
      if (!FREE_LICENCES.test(licence)) continue
      if ((ii.width ?? 0) < 900) continue
      if (NOT_A_PHOTO.test(page.title)) continue
      found.push({
        title: page.title,
        url: ii.thumburl ?? ii.url,
        licence,
        artist: (meta.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 120),
        descriptionUrl: ii.descriptionurl,
      })
      if (found.length >= limit) break
    }
  }
  return found
}

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  )

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`download ${res.status}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

async function main() {
  await mkdir(SOURCE_DIR, { recursive: true })
  const manifestPath = join(SOURCE_DIR, 'sources.json')
  const manifest = (await exists(manifestPath))
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : { bursts: {}, fillers: [] }

  // The originals are too large to keep in the repository, but sources.json is
  // committed — so a fresh clone can restore exactly the same photographs from
  // the recorded URLs rather than searching again and getting a different set.
  let restored = 0
  for (const entry of [...Object.values(manifest.bursts), ...manifest.fillers]) {
    if (await exists(join(SOURCE_DIR, entry.file))) continue
    try {
      await download(entry.url, join(SOURCE_DIR, entry.file))
      restored += 1
      await sleep(400)
    } catch {
      console.warn(`  ! could not restore ${entry.file}`)
    }
  }
  if (restored) console.log(`  restored ${restored} previously-recorded photos`)

  // One strong base photo per burst theme — it becomes a whole duplicate stack.
  for (const theme of BURST_THEMES) {
    if (manifest.bursts[theme.id]) continue
    try {
      const [image] = await findFreeImages(theme.query, 1)
      if (!image) {
        console.warn(`  ! no free photo found for burst theme "${theme.id}"`)
        continue
      }
      const file = `burst-${theme.id}.jpg`
      await download(image.url, join(SOURCE_DIR, file))
      manifest.bursts[theme.id] = { ...image, file, subject: theme.subject }
      console.log(`  burst  ${theme.id.padEnd(10)} ${image.licence.padEnd(12)} ${image.title.slice(5, 60)}`)
    } catch (err) {
      console.warn(`  ! burst "${theme.id}" failed: ${err.message}`)
    }
    await sleep(1500)
  }

  // Ordinary one-off photos, which are what "unique data" is made of.
  const perFiller = 12
  for (const query of FILLER_THEMES) {
    const have = manifest.fillers.filter((f) => f.query === query).length
    if (have >= perFiller) continue
    let images = []
    try {
      images = await findFreeImages(query, perFiller - have)
    } catch (err) {
      console.warn(`  ! filler "${query}" failed: ${err.message}`)
      continue
    }
    for (const [i, image] of images.entries()) {
      const file = `filler-${query.split(' ')[0]}-${have + i}.jpg`
      if (await exists(join(SOURCE_DIR, file))) continue
      try {
        await download(image.url, join(SOURCE_DIR, file))
        manifest.fillers.push({ ...image, file, query })
      } catch {
        // one missing photo is not worth failing the run over
      }
      await sleep(700)
    }
    console.log(`  filler ${query.padEnd(28)} ${manifest.fillers.filter((f) => f.query === query).length}`)
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(
    `\nsources: ${Object.keys(manifest.bursts).length} burst bases, ${manifest.fillers.length} one-offs`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
