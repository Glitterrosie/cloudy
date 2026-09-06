# Cloudy

**Your cloud storage, as weather.** A concept widget that draws your photo storage as a
sky full of clouds, so the invisible weight of data hoarding becomes something you can
see — and something that rains on you.

Built as a single static site for Dutch Design Week: no backend, no login, no install,
nothing saved. Visitors open it by QR code on their own phone, or use it on an
exhibition tablet.

The photographs are real and so is the sorting. Cloudy carries a library of 1,004
freely-licensed photographs, and every time the page loads it compares all of them
against each other and works out which are near-identical **itself**. The stacks in the
sky are whatever it finds — nothing is decided in advance.

---

## The idea in one screen

Every cloud is a piece of your storage.

| Cloud | Means |
| --- | --- |
| **White** | Free space |
| **Slate blue** | Full of near-identical photos — the ones worth your attention |
| **Blue** | Full of photos that only exist once |

The more you store, the more clouds. The more near-duplicate clouds you carry, the more
often it rains on your screen. Tap a slate-blue cloud, keep a favourite, delete the rest
— that cloud turns white and stays, because the space is still yours, just empty again.
The rain eases and the sky brightens.

Two buttons sit **outside** the phone, standing in for things you do in the real world:

- **Take new pictures** adds a slate-blue cloud of near-duplicates and shrinks the white
  clouds to pay for it. Space does not come from nowhere.
- **Get more storage** adds white clouds — capacity you have bought and not yet filled —
  and a storm. Buying your way out just gives you more sky to fill.

## The duplicate detection is real

At build time, `tools/build-library.mjs` computes a 256-bit perceptual hash for every
photograph — a 16×16 greyscale difference hash, which describes an image's structure and
survives resizing, exposure changes and compression. Only the hashes ship (about 130 KB).

At run time, `src/lib/duplicates.js` compares every photo against every other one and
groups anything within 50 bits of Hamming distance, using union-find. Half a million
comparisons, about 20 ms on load. Clusters of three or more become slate-blue clouds;
everything else is unique data.

Two things worth knowing if you change it:

- **The threshold is measured, not guessed.** At 50, no two different subjects are ever
  linked while the frames within a burst still connect. Push it to 70 and it starts
  welding sunsets to beach photos — they genuinely do look alike to a structural hash —
  and since grouping is transitive, one bad link merges two whole stacks.
- **A 64-bit hash is not enough.** The usual 8×8 dHash put unrelated photographs at a
  distance of zero in this library, which is fatal for the same reason. 256 bits
  separates cleanly and still costs 32 bytes a photo.

It also works. Alongside the twelve stacks it was given, the detector finds a stack
nobody planted: a handful of the one-off photographs genuinely resemble each other, and
it groups them on its own.

## Where the photographs come from

Twelve base photographs from Wikimedia Commons — public domain, CC0 or CC BY only — are
each expanded into 72 variants by `tools/build-library.mjs`: a slightly different crop, a
touch more or less exposure, a degree of rotation, and a missed focus about one frame in
six. That is what holding down a shutter actually produces. Another 140 unrelated
photographs fill the library as data with no duplicates.

Every source is listed in [CREDITS.md](CREDITS.md).

```bash
npm run library:fetch    # download the source photographs (slow; Commons rate-limits)
npm run library:build    # generate variants, hash everything, write thumbnails
```

The originals are ~52 MB and are not committed, but `tools/sources/sources.json` is — so
a fresh clone restores exactly the same photographs rather than searching again and
getting a different set. Only 148 thumbnails (1.4 MB) ship, one screenful per stack,
lazy-loaded: opening three stacks costs a visitor about 250 KB.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # static site in dist/
npm run preview    # serve the built site, also on the local network
```

Requires Node 18 or newer. React + Vite; no other runtime dependencies.

## Deploy it

The build is plain static files with relative paths, so it works at a domain root or in
a subfolder.

- **Netlify** — drag the `dist/` folder onto the Netlify drop page. Or connect the repo:
  build command `npm run build`, publish directory `dist`.
- **Vercel** — import the repo. The Vite preset is detected automatically.
- **GitHub Pages** — push to `main`. The included workflow at
  `.github/workflows/deploy.yml` builds and publishes. Enable it once under
  *Settings → Pages → Source → GitHub Actions*.
- **Any static host** — upload the contents of `dist/`.

### QR code

Point a QR generator at the deployed URL. Keep the URL short — a short URL makes a
sparser QR code, which scans faster in bad exhibition lighting. Test the printed code at
the real size, from about 40 cm away, before the hall opens.

## Exhibition setup

Everything here is designed to survive a week of unattended use.

- **It resets itself.** Any page load returns the same hand-composed opening sky. So
  does the *Reset* button, and so does 60 seconds without a touch — because visitors
  walk away mid-interaction, and the next person needs to meet the problem, not
  somebody else's tidy sky.
- **Nothing is saved.** No localStorage, no cookies, no accounts. Every failure mode
  self-heals with a refresh, and there is nothing to lose by refreshing.
- **The thumbnails are the only thing fetched,** and only when a gallery opens. Fonts are
  the device's own. If a photo cannot load — a phone that dropped the hall wifi — the tile
  falls back to a drawn tint rather than a broken image, and the deletion still makes
  sense. Everything else works offline once the page has loaded.
- **iPad:** Settings → Accessibility → Guided Access, to lock visitors into the browser.
  Turn off Auto-Lock, notifications and True Tone. The page requests a screen wake lock
  where the browser supports it.
- **Android:** Chrome's kiosk/pinned-screen mode. Turn off adaptive brightness.
- **If a screen looks stuck,** pull to refresh or force-reload. There is no saved state
  to lose.

### Things you might want to tune on site

| What | Where |
| --- | --- |
| Idle reset delay (60s) | `IDLE_MS` in `src/state/useIdleReset.js` |
| How often it rains | `GAP_CALM` / `GAP_HEAVY` in `src/state/useRain.js` |
| Opening sky composition | `OPENING_LAYOUT` in `src/data/initialState.js` |
| How many clouds a sky holds | `useCloudCap` in `src/state/useEnvironment.js` |
| Which stacks the opening sky shows | `OPENING_STACKS` in `src/data/initialState.js` |
| Stack captions | `SUBLINES` in `tools/build-library.mjs` |
| Detection sensitivity | `DUPLICATE_THRESHOLD` in `src/lib/duplicates.js` |
| Library size | `VARIANTS_PER_BURST` in `tools/build-library.mjs` |
| Palette | the custom properties at the top of `src/styles.css` |
| How long the win state holds | `WIN_HOLD_MS` in `src/App.jsx` |

## How it is put together

```
src/
  App.jsx              state, composition, the exhibition safety nets
  lib/duplicates.js    perceptual hashing and clustering — the detection itself
  data/library.json    1,004 photo hashes and sizes (generated)
  data/                the opening sky, derived from what the detector finds
  state/               reducer, rain scheduler, idle reset, environment hooks
  components/          sky, clouds, rain, gallery, legend, storage bar
  styles.css           palette, cloud shapes, drift and rain keyframes
tools/                 build-time only: fetch photos, generate variants, hash
public/photos/         the thumbnails the gallery shows
```

All state lives in one `useReducer`. A few decisions worth knowing about if you extend it:

- **Clouds drift with CSS keyframes, not JavaScript.** Compositor-driven animation keeps
  moving through main-thread hiccups, costs nothing per frame, and doesn't cook an old
  tablet over an eight-hour day. One-off choreography — a cloud emptying, thumbnails
  crumpling — uses the Web Animations API.
- **Clouds oscillate a few pixels rather than crossing the screen,** so one never drifts
  out from under a reaching finger.
- **Rain is a fixed pool of drops** that is paused rather than unmounted, so an idle sky
  animates nothing at all.
- **Only slate-blue clouds are tappable.** The others ignore pointer events, so a tap on
  overlapping clouds always reaches the one that matters.
- **Clouds are placed by clearance, not by luck.** `findSpot` in `src/state/skyReducer.js`
  scores candidate positions by edge-to-edge gap, comparing the two axes in the same
  units via the panel's aspect ratio, so new clouds land in real gaps. The opening sky is
  hand-placed on five rows with no overlap at all.
- **Colour is never the only cue.** Duplicate clouds carry a stack-of-photos mark and a
  count, unique clouds a single photo, free clouds nothing — so the three kinds stay
  tellable apart in greyscale, under glare, or with colour-blindness. The palette is a
  deliberate three-step lightness ramp for the same reason.
- **`prefers-reduced-motion` calms it rather than freezing it:** drift slows, rain
  becomes a still pattern that fades, but the colour change and the brightening — which
  carry the meaning — stay.

## Honesty about the numbers

Every size on screen is the real byte count of real image files — no assumed average per
photo, nothing rounded up for effect. Deleting 72 near-identical sunsets frees exactly the
10.7 MB those files occupy, the photo you keep moves onto a neighbouring blue cloud, and
the storage bar reflects both.

The consequence is that the figures are in megabytes rather than the gigabytes a full
camera roll would show: this is a 1,004-photo library, not a 50,000-photo one, and the
images are web-resolution copies. Raising `VARIANTS_PER_BURST` and `FULL_WIDTH` in
`tools/build-library.mjs` scales the numbers up if you would rather the piece spoke in
gigabytes — at the cost of a slower build and a bigger repository.

It never touches anybody's real photos. It is a provocation, not a utility.

## Credit

Concept and design: Rosie. Built as a prototype for Dutch Design Week.
