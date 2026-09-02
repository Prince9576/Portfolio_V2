import { useEffect } from 'react'
import { useControls } from 'leva'
import { useFrame } from '@react-three/fiber'
import { drinkPose, drinkTune, useTransform } from '../../stores/transformStore.js'

const BUS_STAND = { x: 46.94, z: -23.46 }

export default function DrinkTuner() {
  const vals = useControls('🍺 Drink Tune', {
    mugHover: { value: drinkTune.mugHover, min: -0.5, max: 2, step: 0.01 },
    mugScale: { value: drinkTune.mugScale, min: 0.3, max: 2.5, step: 0.01 },
    standBack: { value: drinkTune.standBack, min: -1, max: 3, step: 0.01 },
    standSide: { value: drinkTune.standSide, min: -2, max: 2, step: 0.01 },
    yawDeg: { value: drinkTune.yawDeg, min: -180, max: 180, step: 1 },
    standY: { value: drinkTune.standY, min: 0.5, max: 2, step: 0.01 },
  })

  useEffect(() => {
    drinkTune.enabled = true
    useTransform.setState({ phase: 'drinking' })
    return () => {
      drinkTune.enabled = false
      useTransform.setState({ phase: 'human' })
    }
  }, [])

  useFrame(() => {
    drinkTune.mugHover = vals.mugHover
    drinkTune.mugScale = vals.mugScale

    const spotX = BUS_STAND.x + vals.standSide
    const spotZ = BUS_STAND.z - vals.standBack
    drinkPose.x = spotX
    drinkPose.z = spotZ
    drinkPose.y = vals.standY
    const faceMug = Math.atan2(BUS_STAND.x - spotX, BUS_STAND.z - spotZ)
    drinkPose.yaw = faceMug + (vals.yawDeg * Math.PI) / 180

    if (useTransform.getState().phase !== 'drinking') useTransform.setState({ phase: 'drinking' })
  })

  return null
}
