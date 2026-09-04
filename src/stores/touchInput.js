// The on-screen stick, normalised, for anything that isn't the character.
//
// ecctrl's own joystick store carries the stick's push in *pixels* (its own
// controller divides by a travel it measures itself), so it can't be read by the
// car. This holds the same push as -1..1 on each axis instead.
//
// A plain mutable singleton, not a zustand store: driving input changes every
// frame and pushing it through React would re-render the tree at 60Hz. Same
// pattern as `playerRef` and `drinkPose`.
export const touchInput = {
  x: 0, // -1 full left .. +1 full right
  y: 0, // -1 full back .. +1 full forward
  boost: false, // the action button, doubling as turbo while driving
}

export function resetTouchStick() {
  touchInput.x = 0
  touchInput.y = 0
}
