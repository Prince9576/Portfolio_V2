# 3D Interactive Portfolio — Plan & Architecture

A third-person 3D portfolio you actually *walk around in*: a stylized night city
where a playable character explores, and the "pages" of a résumé are things you
discover in the world — work-experience beacons, a skills deck, an about
billboard, a drivable car, weather, and a hidden Easter egg or two. The goal is a
site that reads as "wow, this is a little game" while still being a real,
crawlable portfolio underneath.

---

## 1. What this is

- **Not** a website with a 3D banner — a small explorable world rendered in the
  browser at 60fps on mid-range hardware.
- A single night-city scene (~120×150m) you roam with WASD + jump, camera on a
  follow-arm you can drag.
- Résumé content surfaces through **in-world interactions**, not scrolling pages.
- Atmosphere over polygon count: dark city, neon emissives, bloom, drifting
  motes, rain — mood is what sells it, not geometric density.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 19 + Vite | Fast dev, easy deploy |
| 3D | Three.js via **@react-three/fiber** | Declarative Three.js in React |
| Helpers | **@react-three/drei** | Loaders, Sparkles, useGLTF/useAnimations, KeyboardControls |
| Physics | **@react-three/rapier** (WASM) | Fast, runs well even on weak CPUs |
| Character controller | **ecctrl** | Third-person controller on Rapier (follow cam, slopes, jump) |
| Post-processing | @react-three/postprocessing | Bloom + vignette (cheap cinematic look) |
| State | **zustand** | Per-system stores: vehicle, shrine, portal, weather, ambient music |
| Dev tooling | leva, r3f-perf | Live tweaking + FPS/draw-call HUD |
| Asset pipeline | Blender + **@gltf-transform** + meshopt + sharp | Mesh/texture compression to runtime GLBs |

---

## 3. World & features (current state)

The world is a compressed night-city GLB (`Cartoon_City_Free`), graded for night
(boosted emissive windows, headlights, neon panel) with a computed walkable
bounds + open spawn point. Layered on top:

| Feature | Component(s) | What it does |
|---|---|---|
| **Player** | `Player/Player.jsx`, `CharacterModel.jsx` | ecctrl capsule + Mixamo character; FSM crossfades Idle/Run/Jump, foot-slide-corrected footsteps, jump SFX on takeoff impulse |
| **Work-experience shrines** | `Shrines/Shrine.jsx`, `ShrineUI.jsx` | Glowing beacon at each fountain → walk close for an "Enter to view" hint → Enter summons the company's mark + a HUD panel of bullets |
| **Skills deck** | `Skills/SkillDeck.jsx`, `SkillNode.jsx` | Materializing deck of skill nodes |
| **About billboard** | `About/AboutBillboard.jsx` | In-world billboard with name/CV |
| **Black-hole portal** | `Shrines/BlackHolePortal.jsx`, `PortalUI.jsx` | Portal effect + UI |
| **Drivable car** | `Vehicle/DrivableCar.jsx`, `CarUI.jsx` | Hop in and drive; hands camera + input to the car |
| **Weather** | `World/Rain.jsx`, `weatherStore.js` | `R` toggles a thunderstorm |
| **Atmosphere** | `World/SkyAndLight.jsx`, `Effects.jsx`, drifting `Sparkles` | Sky, single shadow-casting light, bloom/vignette |
| **HUD** | `UI/Minimap.jsx`, `StartScreen.jsx`, controls hint | Minimap, gated audio start, key legend |
| **Audio** | `utils/sfx.js`, `stores/ambientMusic.js` | One-shot SFX + ambient bed (started on first click) |

**Interaction pattern** (reused everywhere): a per-frame proximity check against
the player body drives a small zustand state machine (`idle → hint → open →
closing`) with hysteresis so prompts never flicker; `Enter`/`Esc` keydown
listeners act only when their own phase matches.

---

## 4. Asset pipeline

Raw downloads live in `assets-raw/` (gitignored, re-downloadable). `tools/`
converts them to compressed runtime GLBs in `public/models/`:

- **`tools/convert_character.py`** (Blender) — merges the Mixamo character FBX +
  per-clip animation FBXs into one GLB with named actions (Idle/Run/RunBack/
  Jump/Attack), with curve surgery: root-motion detrend for seamless loops,
  jump-arc compression (physics provides the arc).
- **`tools/optimize_assets.mjs`** (@gltf-transform) — dedupe/prune/resample,
  textures → 1K WebP (normals stay PNG), meshopt compression; for the city also
  night-grades emissives, GPU-instances repeats, and computes `worldMeta.json`
  (ground height, walkable bounds, spawn point + facing).

Mixamo settings: character = FBX Binary, T-pose, **With Skin**; animations =
FBX Binary, **Without Skin**, 30fps, no keyframe reduction (tick **In Place**
for locomotion).

---

## 5. Performance strategy (low-end laptop is a first-class requirement)

Targets: 60fps mid-range, ≥30fps on Intel integrated graphics; small initial
download.

1. **Compression** — meshopt geometry + 1K WebP textures keep GLBs small and
   GPU-friendly (matters most on shared-memory integrated GPUs).
2. **GPU instancing** — repeated city props collapse to a handful of draw calls.
3. **Cheap lighting** — one directional shadow light + ambient; "glow" is
   emissive materials + bloom, not many dynamic lights.
4. **`dpr` capped at [1, 1.5]**, soft shadows, bloom + vignette only.
5. **Lazy-load heavy/optional assets** — anything off the main path (e.g. the
   transformation model, see §6) fetches only when first needed, so visitors who
   never trigger it pay zero.
6. **Never cull the skinned player** (`frustumCulled = false`); reuse one physics
   capsule across model swaps.

---

## 6. Easter egg: the weekend transformation 🍺

A hidden, personal bonus — purely opt-in, zero cost unless discovered.

**Concept:** an SDE who drinks on weekends finds a glowing, sparkly beer mug
tucked away in the city. Approaching it pops a toast — *"Hey, it's the weekend,
come on have a sip!"* Press `Enter` to drink; the character downs it, and in a
puff transforms into a hulking monster — *"Oops, drinking is bad for your health…
look what you've done to yourself!"* A **60-second "under the influence" timer**
ticks down bottom-right, after which you puff back to normal. Repeatable.

**Why it's near-zero performance:**
- The monster model (`Orc.glb`, really Mixamo's "Warrok") rides the **exact same
  `mixamorig:` skeleton** as the player and ships Idle/Run/Jumping clips — so it
  slots into the existing ecctrl FSM with **no retargeting, the same capsule, and
  no new animation data**. One mesh, ~7.5k verts, one material.
- Its only weight is 10.6MB of 2K textures → run through `optimize_assets.mjs`
  (1K + WebP + meshopt) to ~1MB, and **lazy-load it** so it's fetched only on the
  first transform. Non-discoverers download nothing extra.

**Sequence:**
1. Roam → find the glowing mug in a hidden spot (emissive + Sparkles + one
   pointLight; trivial).
2. Within range → toast "🍺 Hey, it's the weekend — come on, have a sip!" +
   "Enter to drink".
3. `Enter` → lock controls briefly, ease camera in, play a **drink animation**,
   mug vanishes into a sparkle.
4. Gulp peak → golden/amber puff + `absorb` SFX + a quick drunk blur → swap to
   the monster rig.
5. Toast "😵 Oops… look what you've done to yourself!"; bottom-right shows the
   60s timer (optional subtle drunk camera wobble while active).
6. Timer hits 0 → puff back to the normal character; mug respawns.

**New pieces:** `stores/transformStore.js` (phase + timer), a `BeerMug`
component (glow + proximity, reusing the shrine interaction pattern), an
`OrcRig`/`HumanRig` split inside the player so only the active rig mounts (Orc
lazy-loaded), a small DOM `AlcoholUI` timer, and golden-puff particles reusing
the existing shrine/portal visual language + SFX (`absorb`/`teleport`/`blast`).

**Open dependency:** a "drink" gesture. Cleanest is a Mixamo **Drinking** clip
(Without Skin) dropped in `assets-raw/animations/`, wired into
`convert_character.py`. Until then it can fall back to the unused `Magic Heal`
clip as a raise-to-face stand-in.

---

## 7. Project structure

```
foliov2/
├── public/
│   ├── models/        # compressed .glb (character, city; orc lazy-loaded)
│   ├── hdri/  textures/  images/  videos/  audio/
├── src/
│   ├── components/
│   │   ├── World/     # City, SkyAndLight, Effects, Rain, GradientSky
│   │   ├── Player/    # Player (ecctrl), CharacterModel (animation FSM)
│   │   ├── Shrines/   # Shrine, LogoParticles, BlackHolePortal/Orb
│   │   ├── Skills/    # SkillDeck, SkillNode
│   │   ├── About/     # AboutBillboard
│   │   ├── Vehicle/   # DrivableCar
│   │   └── UI/        # Minimap, StartScreen, Shrine/Portal/Car UI, (Alcohol UI)
│   ├── stores/        # zustand: playerRef, vehicle, shrine, portal, weather, ambientMusic
│   ├── content/       # résumé data, world/anim metadata
│   └── utils/         # sfx
├── tools/             # convert_character.py, optimize_assets.mjs, inspectors, screenshot
└── PLAN.md            # this file
```

---

## 8. Status & next up

- ✅ Playable city, character + animation FSM, shrines + work-experience UI,
  skills deck, about billboard, portal, drivable car, weather, audio, minimap.
- 🔜 **Weekend transformation Easter egg** (§6): optimize + lazy-load the monster
  model, beer-mug trigger, drink→transform sequence, 60s timer, revert.
- 🔜 Polish passes: integrated-GPU perf check, loading/UX, deploy.
```
