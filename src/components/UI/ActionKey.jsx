import { useIsTouch } from '../../utils/device.js'

// The interact prompt inside a hint chip. TouchGestures replays Enter on a
// double tap, so both inputs reach the same handlers — only the label differs.
export default function ActionKey() {
  const touch = useIsTouch()
  return <span className="key">{touch ? 'Double-tap' : 'Enter'}</span>
}
