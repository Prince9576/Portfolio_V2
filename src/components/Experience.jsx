import { Sparkles } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import meta from '../content/worldMeta.json'
import { QUALITY } from '../utils/quality.js'
import Player from './Player/Player.jsx'
import AboutBillboard from './About/AboutBillboard.jsx'
import SkillDeck from './Skills/SkillDeck.jsx'
import BlackHolePortal from './Shrines/BlackHolePortal.jsx'
import Shrines from './Shrines/Shrines.jsx'
import BeerMug from './EasterEgg/BeerMug.jsx'
import TransformFx from './EasterEgg/TransformFx.jsx'
import DrivableCar from './Vehicle/DrivableCar.jsx'
import TheatreDoor from './Theatre/TheatreDoor.jsx'
import TheatreRoom from './Theatre/TheatreRoom.jsx'
import Effects from './World/Effects.jsx'
import City from './World/City.jsx'
import Rain from './World/Rain.jsx'
import SkyAndLight from './World/SkyAndLight.jsx'

// DEV: expose the r3f store so the headless drink-alignment harness can frame custom verification
function DevThreeHook() {
  const three = useThree()
  window.__three = three
  return null
}

export default function Experience() {
  return (
    <>
      {import.meta.env.DEV && <DevThreeHook />}
      <SkyAndLight />
      <City />
      <Shrines />
      <TheatreDoor />
      <TheatreRoom />
      <BlackHolePortal />
      <SkillDeck />
      <AboutBillboard />
      <DrivableCar />
      <BeerMug />
      <TransformFx />
      <Rain />
      <Player />
      {/* Night air: drifting motes at the spawn plaza, a sparse layer city-wide */}
      <Sparkles
        count={QUALITY.sparklesNear}
        scale={[16, 4, 16]}
        position={[meta.spawn.x, meta.spawnGroundY + 2, meta.spawn.z]}
        size={3}
        speed={0.22}
        opacity={0.8}
        color="#ffce6b"
      />
      <Sparkles
        count={QUALITY.sparklesFar}
        scale={[110, 6, 130]}
        position={[0, meta.groundY + 3, 0]}
        size={2.2}
        speed={0.16}
        opacity={0.45}
        color="#ffd98c"
      />
      <Effects />
    </>
  )
}
