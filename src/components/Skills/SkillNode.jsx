import { useEffect, useMemo, useRef } from 'react'
import { Text, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const COL_H = 1.7 // light-column height
const ICON_Y = 0.92 // icon centre above the cell floor

// Glowing rectangular frame + faint inner fill for the floor cell (additive).
function makeBorderMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uBoost: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uBoost; uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float border = 1.0 - smoothstep(0.012, 0.055, edge);
        float fill = 0.09 + 0.04 * sin(uTime * 2.0);
        float a = (border * (0.85 + 0.6 * uBoost) + fill) * uOpacity;
        a = a == a ? clamp(a, 0.0, 1.0) : 0.0;
        vec3 col = mix(uColor, vec3(1.0), border * 0.45);
        gl_FragColor = vec4(col, a);
      }
    `,
  })
}

// Rectangular column of light rising parallel from the cell (additive, fades up).
function makeColumnMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uBoost: { value: 0 }, uH: { value: COL_H }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      uniform float uH; varying float vFrac; varying vec3 vN; varying vec3 vView;
      void main() {
        vFrac = clamp((position.y + uH * 0.5) / uH, 0.0, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uBoost; uniform vec3 uColor;
      varying float vFrac; varying vec3 vN; varying vec3 vView;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vView)));
        float vert = pow(1.0 - vFrac, 1.4);
        float rise = 0.85 + 0.15 * sin(vFrac * 6.0 - uTime * 2.4);
        float a = vert * (0.22 + 0.5 * facing) * rise * (0.7 + 0.6 * uBoost) * uOpacity;
        a = a == a ? clamp(a, 0.0, 1.0) : 0.0;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.2), a);
      }
    `,
  })
}

export default function SkillNode({ skill, position, cellW, cellD, level, index, focusRef }) {
  const camera = useThree((s) => s.camera)
  const tex = useTexture(skill.logo)
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.needsUpdate = true
  }, [tex])

  const borderMat = useMemo(() => makeBorderMaterial(skill.color), [skill.color])
  const columnMat = useMemo(() => makeColumnMaterial(skill.color), [skill.color])
  const baseMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(skill.color).multiplyScalar(0.08), transparent: true, depthWrite: false }),
    [skill.color],
  )
  const glyphMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, depthWrite: false, toneMapped: false }),
    [tex],
  )

  const billboard = useRef()
  const colRef = useRef()
  const noteRef = useRef()
  const startT = useRef(0)
  const focusVal = useRef(0)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!startT.current) startT.current = t
    const env = THREE.MathUtils.smoothstep(t - startT.current, index * 0.06, index * 0.06 + 0.5)
    const f = (focusVal.current += ((focusRef.current === index ? 1 : 0) - focusVal.current) * 0.12)

    borderMat.uniforms.uTime.value = t
    borderMat.uniforms.uOpacity.value = env
    borderMat.uniforms.uBoost.value = f
    columnMat.uniforms.uTime.value = t
    columnMat.uniforms.uOpacity.value = env
    columnMat.uniforms.uBoost.value = f
    baseMat.opacity = env * 0.85
    glyphMat.opacity = env

    if (colRef.current) {
      colRef.current.scale.y = Math.max(0.001, env)
      colRef.current.position.y = (COL_H * env) / 2 + 0.04
    }
    const bb = billboard.current
    if (bb) {
      bb.rotation.y = Math.atan2(camera.position.x - position[0], camera.position.z - position[2])
      bb.position.y = ICON_Y + Math.sin(t * 1.5 + index) * 0.06
      bb.scale.setScalar(env * (1 + 0.18 * f))
    }
    if (noteRef.current) noteRef.current.visible = env > 0.7 && f > 0.4
  })

  return (
    <group position={position}>
      {/* dark cell base (occludes the baked grid 1.5m below) */}
      <mesh material={baseMat} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <planeGeometry args={[cellW, cellD]} />
      </mesh>
      {/* glowing rectangular border */}
      <mesh material={borderMat} rotation-x={-Math.PI / 2} position={[0, 0.035, 0]} renderOrder={1}>
        <planeGeometry args={[cellW, cellD]} />
      </mesh>
      {/* rectangular light column rising parallel from the cell */}
      <mesh ref={colRef} material={columnMat} position={[0, COL_H / 2 + 0.04, 0]}>
        <boxGeometry args={[cellW * 0.8, COL_H, cellD * 0.8]} />
      </mesh>
      {/* small billboarded icon + labels, inside the column */}
      <group ref={billboard}>
        <mesh material={glyphMat}>
          <planeGeometry args={[0.82, 0.82]} />
        </mesh>
        <Text position={[0, 0.62, 0]} fontSize={0.24} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#05030f">
          {skill.name}
        </Text>
        <Text ref={noteRef} position={[0, -0.55, 0]} fontSize={0.19} color={skill.color} anchorX="center" anchorY="middle" visible={false}>
          {level}
        </Text>
      </group>
    </group>
  )
}
