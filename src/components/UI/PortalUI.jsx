import { usePortal } from '../../stores/portalStore.js'

// DOM overlay for the black-hole portals: a proximity prompt (reusing the
// shrine-hint HUD chip) and a brief full-screen flash that masks each teleport
// jump cut. The flash re-triggers its keyframe animation via a changing `key`.
export default function PortalUI() {
  const phase = usePortal((s) => s.phase)
  const flash = usePortal((s) => s.flash)

  const hint = phase === 'hint' ? 'ascend' : phase === 'roofHint' ? 'descend' : null

  return (
    <>
      <div className={`shrine-hint ${hint ? 'show' : ''}`}>
        <span className="diamond">⟢</span>
        <span>
          <span className="key">Enter</span> to {hint ?? 'ascend'}
        </span>
      </div>
      {flash > 0 && <div key={flash} className="portal-flash" aria-hidden="true" />}
    </>
  )
}
