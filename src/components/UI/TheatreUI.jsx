import { PROJECTS } from '../../content/projects.js'
import { useTheatre } from '../../stores/theatreStore.js'
import { useIsTouch } from '../../utils/device.js'
import ActionKey from './ActionKey.jsx'

// DOM overlay for the Project Theatre: the door proximity hint, the in-room exit hint
export default function TheatreUI() {
  const phase = useTheatre((s) => s.phase)
  const project = useTheatre((s) => s.project)
  const closeProject = useTheatre((s) => s.closeProject)
  const touch = useIsTouch()

  const inside = phase === 'inside'
  const active = project !== null ? PROJECTS[project] : null

  return (
    <>
      <div className={`shrine-hint ${phase === 'hint' ? 'show' : ''}`}>
        <span className="diamond">◈</span>
        <span>
          <ActionKey /> to step into the Project Theatre
        </span>
      </div>

      <div className={`theatre-exit ${inside && project === null ? 'show' : ''}`}>
        <span className="diamond">◈</span>
        <span>
          {touch ? (
            <>Tap a frame to open · <ActionKey /> at the arch to leave</>
          ) : (
            <>Click a frame to open · <span className="key">Esc</span> to leave</>
          )}
        </span>
      </div>

      <aside className={`work-panel ${active ? 'open' : ''}`} aria-hidden={!active}>
        <span className="cnr tl" />
        <span className="cnr tr" />
        <span className="cnr bl" />
        <span className="cnr br" />
        <button className="close" onClick={() => closeProject()} aria-label="Close">
          ✕
        </button>
        {active && (
          <div className="panel-scroll">
            <p className="eyebrow">
              <span className="diamond">◈</span> Project Theatre
            </p>
            <h2>{active.title}</h2>
            <p className="role">{active.role}</p>
            <ul>
              {active.bullets.map((b, i) => (
                <li key={i} style={{ '--i': i }}>
                  <b>{b.label}</b>
                  {b.text}
                </li>
              ))}
            </ul>
            <p className="hint-row">
              {touch ? 'Tap ✕ to close' : <><span className="key">Esc</span> to close</>}
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
