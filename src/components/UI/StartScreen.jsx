import { useProgress } from '@react-three/drei'

// Loading screen
export default function StartScreen({ onStart, stage = 'loading', leaving = false }) {
  const { progress } = useProgress()
  const ready = stage === 'ready'

  // Downloading is the only stage with a real byte count, so it drives the bar up to 92%
  const pct = stage === 'loading' ? Math.min(92, Number.isFinite(progress) ? progress : 0) : 100

  return (
    <div className={`start-screen${leaving ? ' leaving' : ''}`}>
      <div className="start-bar">
        <span style={{ width: `${pct}%` }} />
      </div>

      {ready ? (
        <button className="start-btn" onClick={onStart}>Explore</button>
      ) : (
        <p className="start-stage">
          {stage === 'loading' ? 'Loading my portfolio…' : 'Warming up the city…'}
        </p>
      )}

      <style>{`
        .start-screen{position:fixed;inset:0;z-index:50;overflow:hidden;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          background:var(--bg);opacity:1;transition:opacity .4s ease}
        /* On EXPLORE this fades out over an already-running, already-framed world. */
        .start-screen.leaving{opacity:0;pointer-events:none}

        .start-bar{width:min(300px,64vw);height:2px;background:var(--surface-2);overflow:hidden}
        .start-bar span{display:block;height:100%;background:var(--accent);
          transition:width .9s ease}

        /* One line, two states. Reserve the button's height so swapping the
           label for the button doesn't shift the bar. */
        .start-stage,.start-btn{margin-top:1.6rem;height:2.4rem;display:flex;align-items:center}
        .start-stage{font:400 .8rem/1 'Space Grotesk',system-ui,sans-serif;
          letter-spacing:.02em;color:var(--text-dim)}

        .start-btn{padding:0 1.9rem;font:500 .8rem/1 'Space Grotesk',system-ui,sans-serif;
          letter-spacing:.02em;color:var(--accent);background:transparent;
          border:1px solid var(--accent);cursor:pointer;
          transition:background .2s ease,color .2s ease}
        .start-btn:hover{background:var(--accent);color:var(--bg)}
      `}</style>
    </div>
  )
}
