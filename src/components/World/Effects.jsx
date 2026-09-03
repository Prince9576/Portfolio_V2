import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { QUALITY } from '../../utils/quality.js'

// Med-tier post pipeline from the plan: bloom + vignette carry the cinematic look
export default function Effects() {
  return (
    <EffectComposer multisampling={QUALITY.multisampling}>
      {/* Night tuning: moon gets a halo (not a flood), mushrooms/fireflies glow */}
      <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.8} luminanceSmoothing={0.25} />
      <Vignette offset={0.25} darkness={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
