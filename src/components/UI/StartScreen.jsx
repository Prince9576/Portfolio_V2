import PrinceParticles from './PrinceParticles.jsx'

// Title card shown on load. The EXPLORE button's click is the user gesture
// browsers require before audio can play, so this is where the wind ambience
// kicks in. The particle portrait fills the whole page and is interactive
// (hover dimples it, click detonates it) — only the button enters the site.
export default function StartScreen({ onStart }) {
  return (
    <div className="start-screen">
      <PrinceParticles />
      <button className="start-btn" onClick={onStart}>EXPLORE</button>
      <style>{`
        .start-screen{position:fixed;inset:0;z-index:50;overflow:hidden;
          background:radial-gradient(circle at 50% 42%, #1a0f3e 0%, #0a0620 55%, #05030f 100%);
          font-family:'Orbitron',system-ui,sans-serif;animation:start-fade .6s ease}
        .prince-portrait{position:fixed;inset:0;z-index:1}
        .start-btn{position:fixed;left:50%;bottom:7vh;transform:translateX(-50%);z-index:3;
          padding:1rem 3.2rem;font-family:inherit;font-weight:700;letter-spacing:.28em;font-size:1.1rem;
          color:#eafaff;background:rgba(90,209,255,.08);border:1.5px solid #5ad1ff;border-radius:999px;cursor:pointer;
          box-shadow:0 0 18px rgba(90,209,255,.5),inset 0 0 12px rgba(90,209,255,.15);transition:all .25s ease;
          animation:start-pulse 2.4s ease-in-out infinite}
        .start-btn:hover{background:rgba(90,209,255,.2);box-shadow:0 0 30px rgba(90,209,255,.9),inset 0 0 16px rgba(90,209,255,.3);transform:translateX(-50%) translateY(-1px)}
        @keyframes start-pulse{0%,100%{box-shadow:0 0 16px rgba(90,209,255,.45),inset 0 0 12px rgba(90,209,255,.12)}50%{box-shadow:0 0 30px rgba(90,209,255,.85),inset 0 0 16px rgba(90,209,255,.28)}}
        @keyframes start-fade{from{opacity:0}to{opacity:1}}
      `}</style>
    </div>
  )
}
