import { COMPANIES } from '../../content/companies.js'
import { useShrine } from '../../stores/shrineStore.js'
import { useIsTouch } from '../../utils/device.js'
import ActionKey from './ActionKey.jsx'

// DOM overlay shared by every shrine: a proximity hint plus the experience panel
export default function ShrineUI() {
  const phases = useShrine((s) => s.phases)
  const setPhase = useShrine((s) => s.setPhase)
  const touch = useIsTouch()

  const anyHint = COMPANIES.some((c) => phases[c.id] === 'hint')
  // The open/closing company drives the panel content
  const active = COMPANIES.find((c) => phases[c.id] === 'open' || phases[c.id] === 'closing')
  const isOpen = active && phases[active.id] === 'open'

  return (
    <>
      <div className={`shrine-hint ${anyHint ? 'show' : ''}`}>
        <span className="diamond">◈</span>
        <span>
          <ActionKey /> to view my Work Experience
        </span>
      </div>

      <aside className={`work-panel ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        {/* HUD corner brackets */}
        <span className="cnr tl" />
        <span className="cnr tr" />
        <span className="cnr bl" />
        <span className="cnr br" />
        <button
          className="close"
          onClick={() => active && phases[active.id] === 'open' && setPhase(active.id, 'closing')}
          aria-label="Close"
        >
          ✕
        </button>
        {active && (
          <div className="panel-scroll">
            <p className="eyebrow">
              <span className="diamond">◈</span> Work Experience
            </p>
            <h2>{active.name}</h2>
            <p className="role">{active.role}</p>
            <ul>
              {active.bullets.map((b, i) => (
                <li key={i} style={{ '--i': i }}>
                  {b}
                </li>
              ))}
            </ul>
            <p className="hint-row">
              {touch ? 'Walk away to close' : <><span className="key">Esc</span> or walk away to close</>} ·
              hold &amp; release the mark ✦
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
