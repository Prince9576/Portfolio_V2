import { isTouchDevice } from './device.js'

// Mobile/tablet quality tiers. Read once at module load: pointer class doesn't
// change mid-session, and these can't be changed after the Canvas mounts.
//
// Deliberately NOT tiered, so the render stays sharp on a phone and the desktop
// path is provably untouched:
//   dpr        stays [1, 1.5]  — clamping to 1 renders a 3x-DPR phone at a third
//                               of its linear resolution; visibly soft
//   antialias  stays true
//   shadows    stays 'soft'    — the filter isn't where the saving is, the map
//                               resolution below is
//
// Everything here is a strict reduction in GPU work, so none of it can cost
// more than it saves. Caveat worth remembering: the gate is pointer capability,
// so it also applies in a browser's device-emulation mode, not just real phones.
const touch = isTouchDevice()

export const QUALITY = {
  touch,
  shadowMap: touch ? 512 : 1024, // 4x fewer shadow texels
  multisampling: touch ? 0 : 4, // skip the MSAA resolve
  sparklesNear: touch ? 30 : 80,
  sparklesFar: touch ? 50 : 160,
  rainCount: touch ? 1100 : 3500,
  logoParticles: touch ? 2000 : 4500,
  orbSteps: touch ? 16 : 32, // raymarch iterations, the heaviest fragment cost
}
