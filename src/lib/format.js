/**
 * Sizes are the real byte counts of the photographs in the library — no
 * assumed per-photo average any more, and nothing rounded up for effect.
 */
export function formatSize(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e8 ? 0 : 1)} MB`
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`
}

export const formatCount = (n) => n.toLocaleString('en-US')
