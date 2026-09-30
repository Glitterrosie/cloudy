/**
 * How the library's photographs are divided into clouds.
 *
 * Shared deliberately between the build script and the browser: the build has to
 * ship thumbnails for exactly the photographs the gallery will later ask for, and
 * the only way to guarantee that is for both sides to slice the list the same
 * way. Get these out of step and a unique cloud opens onto empty tiles.
 */

/** A cluster this size or larger is a "stack" worth showing as a duplicate cloud. */
export const MIN_STACK = 3

/** How many clouds the photos with no duplicates are spread across. */
export const UNIQUE_CHUNKS = 3

/** 11 samples plus the "+N more" tile fills a 3-across grid exactly. */
export const SAMPLE_LIMIT = 11

/**
 * Split the one-off photographs into consecutive chunks, one per blue cloud.
 * Consecutive rather than interleaved so that a chunk's thumbnails sit together
 * in the build's output and a reader can check the two sides agree by eye.
 */
export function splitSingles(singles, chunks = UNIQUE_CHUNKS) {
  const per = Math.ceil(singles.length / chunks)
  return Array.from({ length: chunks }, (_, i) => singles.slice(i * per, (i + 1) * per))
}
