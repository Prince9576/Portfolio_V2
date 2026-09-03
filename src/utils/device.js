import { useEffect, useState } from 'react'

// Touch layout is decided by pointer capability, not screen width: phones and
// tablets get the on-screen controls, a narrow laptop window does not.
const COARSE = '(pointer: coarse)'

export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.(COARSE).matches === true

export function useIsTouch() {
  const [touch, setTouch] = useState(isTouchDevice)
  useEffect(() => {
    const mq = window.matchMedia(COARSE)
    const onChange = (e) => setTouch(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return touch
}
