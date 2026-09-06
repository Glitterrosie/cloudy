/**
 * Turns the downloaded source photographs into Cloudy's photo library.
 *
 * For each "burst" base photo it generates the kind of variation a phone
 * actually produces when you hold the shutter down — a slightly different crop,
 * a touch more or less exposure, a degree of rotation, the occasional missed
 * focus — then perceptually hashes every resulting image. The one-off photos are
 * hashed too, and end up as data with no duplicates.
 *
 * Nothing here decides what is a duplicate. That happens in the browser, at
 * runtime, from these hashes (see src/lib/duplicates.js).
 *
 *   node tools/build-library.mjs
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { clusterPhotos } from '../src/lib/duplicates.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = join(HERE, 'sources')
const THUMB_DIR = join(HERE, '..', 'public', 'photos')
const DATA_OUT = join(HERE, '..', 'src', 'data', 'library.json')
const CREDITS_OUT = join(HERE, '..', 'CREDITS.md')

// Tune these to change the size of the library.
const VARIANTS_PER_BURST = 72 // 12 bursts x 72 ≈ 864 near-duplicates
const THUMBS_PER_CLUSTER = 12 // only what the gallery can actually show is shipped
const FULL_WIDTH = 1600 // the "original" whose real byte size we record
const THUMB_WIDTH = 220

// Wry one-liners, paired to the burst themes by id.
const SUBLINES = {
  sunset: 'All from one evening. You kept every single frame.',
  tulips: 'The field did not move between shots.',
  canal: 'The same house, from four steps apart.',
  latte: 'The foam was slightly different each time.',
  dog: 'He was not going anywhere. You made sure.',
  windmill: 'It turns. You did not need this many.',
  dinner: 'It went cold while you found the angle.',
  concert: 'Blurry, all of them. You were there anyway.',
  beach: 'Same sea, same sand, forty-eight times.',
  cat: 'She had not moved since the last one.',
  bike: 'In case you forgot where you parked it.',
  church: 'You will never look at these again.',
}

const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Difference hash at 16x16 — 256 bits.
 *
 * Downscale to greyscale and record, for each row, whether each pixel is
 * brighter than the one to its right: a description of the image's structure
 * that survives resizing, exposure changes and compression.
 *
 * The obvious 8x8 / 64-bit version is too coarse here. Measured across this
 * library it put unrelated photographs at a distance of zero, and since
 * clustering is transitive, one such collision welds two unrelated stacks
 * together. 256 bits separates cleanly and still costs only 64 bytes a photo.
 */
const HASH_GRID = 16

async function dHash(buffer) {
  const w = HASH_GRID + 1
  const px = await sharp(buffer)
    .greyscale()
    .resize(w, HASH_GRID, { fit: 'fill' })
    .raw()
    .toBuffer()

  let hex = ''
  let nibble = 0
  let bitsInNibble = 0
  for (let row = 0; row < HASH_GRID; row += 1) {
    for (let col = 0; col < HASH_GRID; col += 1) {
      nibble = (nibble << 1) | (px[row * w + col] > px[row * w + col + 1] ? 1 : 0)
      bitsInNibble += 1
      if (bitsInNibble === 4) {
        hex += nibble.toString(16)
        nibble = 0
        bitsInNibble = 0
      }
    }
  }
  return hex
}

/** One frame from a burst: the small, real differences a phone actually produces. */
async function makeVariant(base, rand) {
  const meta = await sharp(base).metadata()
  const zoom = 1 + rand() * 0.06
  const w = Math.floor(meta.width / zoom)
  const h = Math.floor(meta.height / zoom)
  const left = Math.floor(rand() * (meta.width - w))
  const top = Math.floor(rand() * (meta.height - h))

  let img = sharp(base)
    .extract({ left, top, width: w, height: h })
    .rotate(rand() * 3 - 1.5, { background: '#000' })
    .modulate({
      brightness: 0.93 + rand() * 0.14,
      saturation: 0.92 + rand() * 0.16,
    })

  // Roughly one frame in six misses focus, which is true to life.
  if (rand() < 0.16) img = img.blur(0.6 + rand() * 1.6)

  return img
    .resize(FULL_WIDTH, null, { withoutEnlargement: true })
    .jpeg({ quality: 78 + Math.floor(rand() * 12) })
    .toBuffer()
}

async function thumbnail(buffer, dest) {
  await sharp(buffer)
    .resize(THUMB_WIDTH, THUMB_WIDTH, { fit: 'cover', position: 'attention' })
    .webp({ quality: 68 })
    .toFile(dest)
}

async function main() {
  const sources = JSON.parse(await readFile(join(SOURCE_DIR, 'sources.json'), 'utf8'))
  await rm(THUMB_DIR, { recursive: true, force: true })
  await mkdir(THUMB_DIR, { recursive: true })

  const photos = []
  const themes = {}
  const buffers = new Map()
  let fileNo = 2100

  // --- burst stacks -------------------------------------------------------
  for (const [id, source] of Object.entries(sources.bursts)) {
    const base = join(SOURCE_DIR, source.file)
    const rand = mulberry32(
      [...id].reduce((a, c) => a + c.charCodeAt(0) * 31, 7),
    )
    themes[id] = { subject: source.subject, subline: SUBLINES[id] ?? '' }

    for (let i = 0; i < VARIANTS_PER_BURST; i += 1) {
      const buffer = await makeVariant(base, rand)
      const photoId = `${id}-${i}`
      // Keep a few frames per stack in memory; the gallery only ever shows a
      // handful, and which ones those are is decided by clustering below.
      if (i < THUMBS_PER_CLUSTER + 4) buffers.set(photoId, buffer)
      photos.push({
        i: photoId,
        h: await dHash(buffer),
        b: buffer.length,
        n: `IMG_${(fileNo += 3)}.HEIC`,
        t: 0,
        s: id,
      })
    }
    console.log(`  burst  ${id.padEnd(9)} ${VARIANTS_PER_BURST} frames`)
  }

  // --- one-off photos, the "unique data" ----------------------------------
  for (const [n, source] of sources.fillers.entries()) {
    const buffer = await sharp(join(SOURCE_DIR, source.file))
      .resize(FULL_WIDTH, null, { withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
    const photoId = `one-${n}`
    buffers.set(photoId, buffer)
    photos.push({
      i: photoId,
      h: await dHash(buffer),
      b: buffer.length,
      n: `IMG_${(fileNo += 3)}.HEIC`,
      t: 0,
      s: null,
    })
  }
  console.log(`  one-offs ${sources.fillers.length}`)

  // Run the very same detection the browser will run, so that every stack it
  // discovers has thumbnails to show — including stacks nobody planted, where
  // one-off photographs turn out to genuinely resemble each other.
  const clusters = clusterPhotos(photos)
  const byId = new Map(photos.map((p) => [p.i, p]))
  let shipped = 0
  for (const cluster of clusters) {
    if (cluster.length < 3) continue
    for (const photo of cluster.slice(0, THUMBS_PER_CLUSTER)) {
      const buffer = buffers.get(photo.i)
      if (!buffer) continue
      await thumbnail(buffer, join(THUMB_DIR, `${photo.i}.webp`))
      byId.get(photo.i).t = 1
      shipped += 1
    }
  }
  console.log(`  detected ${clusters.filter((c) => c.length >= 3).length} stacks, ${shipped} thumbnails`)

  const totalBytes = photos.reduce((sum, p) => sum + p.b, 0)
  await writeFile(
    DATA_OUT,
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), themes, photos }),
  )

  // --- credits ------------------------------------------------------------
  const rows = [...Object.values(sources.bursts), ...sources.fillers]
    .map((s) => `| ${s.title.replace(/^File:/, '')} | ${s.licence} | ${s.artist || '—'} |`)
    .join('\n')
  await writeFile(
    CREDITS_OUT,
    `# Photo credits\n\nEvery photograph in Cloudy's demo library comes from Wikimedia Commons under a\npublic domain, CC0 or CC BY licence. Burst variants are derived from these\noriginals by \`tools/build-library.mjs\`.\n\n| Source file | Licence | Author |\n| --- | --- | --- |\n${rows}\n`,
  )

  console.log(
    `\nlibrary: ${photos.length} photos, ${(totalBytes / 1e9).toFixed(2)} GB of real image data`,
  )
  console.log(`thumbnails shipped: ${photos.filter((p) => p.t).length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
