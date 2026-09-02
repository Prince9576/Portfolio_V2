import { Sparkles } from '@react-three/drei'
import meta from '../content/worldMeta.json'
import Player from './Player/Player.jsx'
import AboutBillboard from './About/AboutBillboard.jsx'
import SkillDeck from './Skills/SkillDeck.jsx'
import BlackHolePortal from './Shrines/BlackHolePortal.jsx'
import Shrines from './Shrines/Shrines.jsx'
import BeerMug from './EasterEgg/BeerMug.jsx'
import TransformFx from './EasterEgg/TransformFx.jsx'
import DrinkTuner from './EasterEgg/DrinkTuner.jsx'
import DrivableCar from './Vehicle/DrivableCar.jsx'
import TheatreDoor from './Theatre/TheatreDoor.jsx'
import TheatreRoom from './Theatre/TheatreRoom.jsx'
import Effects from './World/Effects.jsx'
import City from './World/City.jsx'
import Rain from './World/Rain.jsx'
import SkyAndLight from './World/SkyAndLight.jsx'

const FLAGS = new URLSearchParams(window.location.search)

export default function Experience() {
  return (
    <>
      <SkyAndLight />
      <City />
      {!FLAGS.has('noshrine') && <Shrines />}
      {!FLAGS.has('notheatre') && <TheatreDoor />}
      {!FLAGS.has('notheatre') && <TheatreRoom />}
      {!FLAGS.has('noportal') && <BlackHolePortal />}
      {!FLAGS.has('noskills') && <SkillDeck />}
      {!FLAGS.has('noabout') && <AboutBillboard />}
      {!FLAGS.has('nocar') && <DrivableCar />}
      {!FLAGS.has('noegg') && <BeerMug />}
      {!FLAGS.has('noegg') && <TransformFx />}
      {FLAGS.has('drinktune') && <DrinkTuner />}
      {!FLAGS.has('norain') && <Rain />}
      <Player />
      <Sparkles
        count={80}
        scale={[16, 4, 16]}
        position={[meta.spawn.x, meta.spawnGroundY + 2, meta.spawn.z]}
        size={3}
        speed={0.22}
        opacity={0.8}
        color="#ffce6b"
      />
      <Sparkles
        count={160}
        scale={[110, 6, 130]}
        position={[0, meta.groundY + 3, 0]}
        size={2.2}
        speed={0.16}
        opacity={0.45}
        color="#ffd98c"
      />
      {!FLAGS.has('nofx') && <Effects />}
    </>
  )
}
