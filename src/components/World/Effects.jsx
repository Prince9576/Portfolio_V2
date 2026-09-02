import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// Med-tier post pipeline from the plan: bloom + vignette carry the cinematic
// look; ACES at the end because EffectComposer bypasses the renderer's own.
export default function Effects() {
  return (
    <EffectComposer multisampling={4}>
      {/* Night tuning: moon gets a halo (not a flood), mushrooms/fireflies glow */}
      <Bloom mipmapBlur intensity={0.65} luminanceThreshold={0.8} luminanceSmoothing={0.25} />
      <Vignette offset={0.25} darkness={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
