# Marble Symphony

A browser instrument you can build: release marbles into a miniature machine of ramps, musical bars, bells, bumpers, funnels, and catchers. Every note comes from a physical collision and live Web Audio synthesis. Everything runs locally in your browser; no account, keys, backend, or runtime CDN is required.

## Run locally

Use Node.js **22.12 or newer** (Node 22 is used in CI).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Start with **First Melody**, then click **Start music** to unlock audio and release marbles. The app opens paused so you can inspect the machine first. **Bell Garden** and **Percussion Playground** offer two more compositions.

```sh
npm test                         # focused unit and physics tests
npm run build                   # TypeScript checks and static production build
npm run preview                 # preview dist locally
npx playwright install          # one-time Chromium, Firefox, WebKit installation
npm run test:e2e                 # production browser acceptance tests
npm run test:e2e -- --project=chromium
```

On Linux, Playwright may need `npx playwright install --with-deps`. The browser suite builds the application and serves `dist/` from a plain static host. It checks the root URL and `/marble-symphony/` to catch repository-subpath asset failures. Playwright reports and traces are written to ignored test output directories.

## Playing and building

- **Start music / Pause / Resume music:** control playback; **Reset** clears marbles and impact effects while preserving the design. **Step** advances a paused machine.
- Click a palette object and then the canvas to place it, or drag it from the palette. Drag a selected object to move it. Use its rotation handle or the inspector's numeric rotation field.
- The object list offers selection without dragging. The inspector exposes position, geometry, sound, and emitter settings. Editing during playback pauses the machine first.
- Duplicate or delete the selection with the inspector actions. **Delete / Backspace** also deletes; **Escape** cancels placement or clears selection.
- **Ctrl/Cmd+Z** undoes a design edit. **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** redoes it. A drag is one history entry; physics frames never enter undo history.
- **Space** plays or pauses when a form field does not have focus. Use **Fit machine**, zoom, and pan controls to navigate; grid snapping is optional.
- Tempo controls emitter timing. Root and scale constrain note choices; choose **Chromatic** for all semitones. Each instrument stores a MIDI pitch.
- Master volume and mute are independent of playback. **Snap notes to rhythm** intentionally delays collisions until the next selected subdivision; leave it off for immediate response.
- Hidden tabs pause. Return to the tab and explicitly resume; missed beats are discarded.

Emitters use quarter, eighth, or sixteenth notes, an optional beat offset, launch direction/speed, and marble size. Musical bars, optionally musical bumpers, and optionally musical catchers synthesize their assigned notes. Funnels guide marbles through real sloped walls. Decorative labels are plain text and have no physical body. The responsive panels leave room for the canvas on tablets.

## Save, recover, and share

**Local** storage belongs to the current browser and site origin. Debounced autosave recovers the latest design after reload; named local saves let you keep several machines. Clearing browser data or moving to a different origin does not carry local saves with you. Storage failures are reported while the editor remains usable.

**Portable** JSON exports contain a versioned machine document. Import JSON to restore it elsewhere. A share link packs the same design into compact tuples and encodes them as a URL fragment, which is not sent to a backend. Projects exceeding the 12,000-character link limit should use file export. Treat a link or export as a copy of the design, with no ongoing synchronization.

Documents include the project name, music settings, object properties, and separate editor preferences. Physics bodies, marbles, audio nodes, and playback state are never saved. Imports and links are validated for version, object counts, unique IDs, allowed values, bounded dimensions/coordinates, and text lengths. Unsupported or malformed documents show an error. Replacing unsaved work requires confirmation.

## GitHub Pages

1. Push the repository and lockfile to GitHub, with the deployment branch named `main` (or update the workflow branch filters).
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main`, or run **Test and deploy Pages** on `main` from the Actions tab. The workflow installs locked dependencies, runs unit and Chromium acceptance tests against the production build, and deploys `dist/` after success.

Pull requests run checks without deployment privileges. Only the deploy job gets `pages: write` and `id-token: write`; no repository secrets are needed. The `github-pages` environment exposes the deployed URL. See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Vite uses `base: './'`: the same output supports `https://owner.github.io/repository/` and a custom-domain root. There is no server routing; sharing uses fragments. Configure a custom domain in Pages settings if desired. Do not replace relative asset paths with root-relative paths.

## Architecture

The serializable document is the source of truth; runtime structures are separate and keyed by object ID.

| Area | Responsibility |
| --- | --- |
| `src/model/` | Document types, defaults, limits, validation |
| `src/physics/` | Matter.js 0.20 bodies, collision detection/cooldown, bounded marble lifetime |
| `src/audio/` | Audio-clock transport, beat calculations, three voices, gain envelopes, master compression |
| `src/canvas/` | Canvas 2D drawing, world/display coordinates, selection and impact feedback |
| `src/editor/` | Design commands and undo/redo history |
| `src/persistence/` | Local recovery, named saves, JSON and compact fragment encoding |
| `src/presets/` | Authored starter machines |
| `src/runtime/` | Fixed-step orchestration, editor pointer interaction, transport and audio integration |
| `src/components/` and `src/App.tsx` | Accessible controls, inspector, panels and application integration |

Physics runs outside React using a fixed step and bounded catch-up accumulator. World coordinates do not change on resize or device-pixel-ratio changes. Emissions are scheduled against the audio clock with a short look-ahead, then released at the matching physics step. Per-marble/per-instrument cooldown and impact thresholds prevent resting contacts from retriggering. Reset clears runtime state without changing the document.

## Limits and verification

The simulation caps active marbles at 120 and removes escaped marbles or marbles older than 45 seconds. The editor permits 100 placed objects; validated imports permit up to 200. Synthesis caps polyphony at 32 voices. This is discrete 2D rigid-body physics: very fast, tiny marbles or densely intersecting shapes can produce imperfect contacts. Editor/import limits keep geometry and launch speeds within useful ranges. The canvas is visual; accessible object selection and numeric editing are available through the surrounding controls.

Tests check document round trips and invalid inputs, design undo/redo, timing/subdivisions, impact cooldowns, reset behavior, and production browser flows. Browser collision tests exercise the actual physics-to-audio event path, but automated tests **do not establish sound quality**. Manual listening on real speakers/headphones remains necessary, as does interactive testing on physical tablets and current desktop browsers. Audio requires an initial user gesture and may be unavailable under restrictive browser/device policies; visual playback still works.
