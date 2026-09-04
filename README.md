# Cloudy

**Your cloud storage, as weather.** A concept widget that draws your photo storage as a
sky full of clouds, so the invisible weight of data hoarding becomes something you can
see — and something that rains on you.

Built as a single static site for Dutch Design Week: no backend, no login, no install,
nothing saved. Visitors open it by QR code on their own phone, or use it on an
exhibition tablet.

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
- **Nothing is fetched at runtime.** Placeholder photos are drawn with CSS gradients and
  the fonts are the device's own, so a congested hall network can't leave you with blank
  thumbnails or invisible text. Once the page has loaded it will keep working offline.
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
| The duplicate stacks and their copy | `src/data/photoGroups.js` |
| Palette | the custom properties at the top of `src/styles.css` |
| How long the win state holds | `WIN_HOLD_MS` in `src/App.jsx` |

## How it is put together

```
src/
  App.jsx              state, composition, the exhibition safety nets
  data/                the opening sky and the duplicate stacks
  state/               reducer, rain scheduler, idle reset, environment hooks
  components/          sky, clouds, rain, gallery, legend, storage bar
  styles.css           palette, cloud shapes, drift and rain keyframes
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

Sizes assume 4.2 MB per photo, about what a phone camera produces, and the arithmetic
adds up: deleting 523 near-identical sunsets frees 2.1 GB, the photo you keep moves onto
a neighbouring blue cloud, and the storage bar reflects both. It is still a
provocation rather than a utility — it never touches anybody's real photos.

## Credit

Concept and design: Rosie. Built as a prototype for Dutch Design Week.
