import { photosToGb } from '../lib/format.js'

// How many sample thumbnails a stack shows in the gallery. The stack itself is
// hundreds of photos — the grid shows a representative handful plus a "+N more" tile.
export const SAMPLE_SIZE = 11

// Placeholder photos are drawn with CSS gradients rather than loaded as images:
// nothing touches the network at an exhibition where 35,000 people share the wifi.
const TEMPLATES = [
  {
    id: 'sunset',
    subject: 'the same sunset',
    count: 524,
    subline: 'All from one evening. You kept every single frame.',
    base: 'linear-gradient(180deg, #FFD37A 0%, #FF9F55 40%, #F0603C 66%, #6B3B6E 100%)',
    accent: 'radial-gradient(circle at 50% 62%, #FFF3C4 0 9%, transparent 10%)',
    seedNo: 2391,
  },
  {
    id: 'dog',
    subject: 'the dog, asleep',
    count: 412,
    subline: 'He did not move. You took 412 chances anyway.',
    base: 'linear-gradient(165deg, #C6E395 0%, #93C267 46%, #6C8F4F 100%)',
    accent: 'radial-gradient(ellipse at 46% 64%, #8A6440 0 26%, transparent 27%)',
    seedNo: 4118,
  },
  {
    id: 'screenshots',
    subject: 'screenshots you never opened again',
    count: 333,
    subline: 'Maps, mostly. And other people’s stories.',
    base: 'linear-gradient(180deg, #F3F7FB 0%, #DEE7F0 58%, #C4D2E1 100%)',
    accent:
      'repeating-linear-gradient(115deg, rgba(120,145,175,.35) 0 2px, transparent 2px 13px), radial-gradient(circle at 62% 38%, #E86A5A 0 7%, transparent 8%)',
    seedNo: 7742,
  },
  {
    id: 'latte',
    subject: 'the same latte',
    count: 286,
    subline: 'The foam was slightly different each time.',
    base: 'linear-gradient(150deg, #EBD1AB 0%, #C9905E 52%, #8A5A34 100%)',
    accent: 'radial-gradient(circle at 50% 48%, #F6EBDA 0 30%, transparent 31%)',
    seedNo: 1517,
  },
  {
    id: 'canal',
    subject: 'the same canal house',
    count: 214,
    subline: 'The same house, from four steps apart.',
    base: 'linear-gradient(180deg, #A6CBEA 0%, #C7DCEC 38%, #8B6C5B 39%, #6B5244 100%)',
    accent: 'radial-gradient(circle at 30% 62%, rgba(255,244,220,.85) 0 6%, transparent 7%)',
    seedNo: 6203,
  },
  {
    id: 'tulips',
    subject: 'the same tulip field',
    count: 198,
    subline: 'The field did not move between shots.',
    base:
      'linear-gradient(180deg, #A9CFEC 0%, #A9CFEC 34%, #DC565C 35%, #C43D55 58%, #F0C24E 59%, #D7A542 100%)',
    accent: 'radial-gradient(circle at 74% 22%, #FFF2BC 0 8%, transparent 9%)',
    seedNo: 3860,
  },
  {
    id: 'concert',
    subject: 'one blurry concert',
    count: 176,
    subline: 'Blurry, all of them. You were there anyway.',
    base: 'linear-gradient(180deg, #2C1C3F 0%, #5C2F64 55%, #9C406F 100%)',
    accent: 'radial-gradient(ellipse at 52% 34%, rgba(255,226,150,.75) 0 14%, transparent 15%)',
    seedNo: 9024,
  },
  {
    id: 'play',
    subject: 'the school play, from row 12',
    count: 154,
    subline: 'Nobody is in focus. Not even once.',
    base: 'linear-gradient(180deg, #3B2D40 0%, #7C5C56 58%, #CB9E6C 100%)',
    accent: 'radial-gradient(ellipse at 50% 70%, rgba(255,230,180,.6) 0 22%, transparent 23%)',
    seedNo: 5581,
  },
  {
    id: 'mermaid',
    subject: 'the Little Mermaid',
    count: 132,
    subline: 'You have looked at one of them since 2019.',
    base: 'linear-gradient(180deg, #BBD8E9 0%, #82AAC0 46%, #61808E 100%)',
    accent: 'radial-gradient(ellipse at 48% 58%, #4C6672 0 18%, transparent 19%)',
    seedNo: 2019,
  },
  {
    id: 'receipts',
    subject: 'receipts',
    count: 121,
    subline: 'For a tax return you already filed.',
    base: 'linear-gradient(180deg, #FCFBF6 0%, #EFE9DA 58%, #DAD1BD 100%)',
    accent: 'repeating-linear-gradient(180deg, rgba(150,140,120,.3) 0 1px, transparent 1px 9px)',
    seedNo: 8437,
  },
  {
    id: 'dinner',
    subject: 'a plate of dinner',
    count: 108,
    subline: 'It went cold while you found the angle.',
    base: 'linear-gradient(150deg, #F4E4C6 0%, #DB9354 55%, #A85E33 100%)',
    accent: 'radial-gradient(circle at 52% 54%, #C0442F 0 17%, transparent 18%)',
    seedNo: 3345,
  },
]

const labelFor = (t) => `${t.count.toLocaleString('en-US')} photos of ${t.subject}`

// Deterministic per-photo variation: near-identical, but not identical, which is
// exactly what a duplicate stack looks like.
function buildSamples(template) {
  return Array.from({ length: SAMPLE_SIZE }, (_, i) => ({
    id: `${template.id}-${i}`,
    filename: `IMG_${template.seedNo + i * 3}.HEIC`,
    hue: ((i * 37) % 13) - 6,
    tilt: (((i * 53) % 9) - 4) * 0.35,
    shift: (i * 17) % 20,
  }))
}

export function makeGroup(templateId) {
  const template = TEMPLATES.find((t) => t.id === templateId)
  return {
    id: template.id,
    subject: template.subject,
    label: labelFor(template),
    subline: template.subline,
    count: template.count,
    gb: photosToGb(template.count),
    base: template.base,
    accent: template.accent,
    samples: buildSamples(template),
  }
}

export const ALL_GROUP_IDS = TEMPLATES.map((t) => t.id)

// The opening sky uses the four heaviest stacks; the rest arrive when a visitor
// buys more storage.
export const OPENING_GROUP_IDS = ['sunset', 'dog', 'screenshots', 'latte']
export const SPAWN_GROUP_IDS = ALL_GROUP_IDS.filter((id) => !OPENING_GROUP_IDS.includes(id))
