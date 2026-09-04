// One photo, in gigabytes. A 12-megapixel HEIC lands around 4.2 MB, which is what
// keeps every number on screen honest under design-week scrutiny.
export const GB_PER_PHOTO = 0.0041

export const photosToGb = (count) => count * GB_PER_PHOTO

export function formatSize(gb) {
  if (gb >= 100 || Number.isInteger(gb)) return `${gb.toFixed(0)} GB`
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${Math.round(gb * 1024)} MB`
}

export const formatCount = (n) => n.toLocaleString('en-US')
