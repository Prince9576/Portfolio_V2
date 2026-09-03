import { useMemo, useRef } from 'react'
import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY } from '../../utils/quality.js'

// A gravitationally-lensed accretion-disk black hole, ported from the WebGPU/TSL
// reference shader to plain GLSL so it runs on our existing WebGL canvas.
// Painted on a small camera-facing quad, so the shader only runs over the orb

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec3  uCamDir;   // world-space dir from orb -> camera (tilted, normalized)
  uniform vec3  uGlow;     // tint for the lensed disk (lets us keep the purple identity)

  // ---- tunables (ported from the reference config) -------------------------
  #define STEPS            ${QUALITY.orbSteps}      // raymarch iterations
  #define STEP_SIZE        1.0
  #define BH_MASS          0.4     // rs = mass * 2
  #define DISK_INNER       4.1
  #define DISK_OUTER       14.5
  #define DISK_TEMP        49.78   // peak temperature (x1000 K)
  #define TEMP_FALLOFF     5.22
  #define DISK_BRIGHT      6.8
  #define DISK_ROT_SPEED   -8.7
  #define LENSING          2.4
  #define DOPPLER_STRENGTH 1.0
  #define TURB_SCALE       2.3     // more rings across the disk radius (denser)
  #define TURB_STRETCH     0.75
  #define TURB_SHARP       4.2     // lower = fatter, fuller filaments (was 7.4)
  #define DISK_FILL        0.12    // continuous glow floor so the ring reads from afar
  #define TURB_LAC         2.5
  #define TURB_PERS        0.8
  #define EDGE_IN          0.18
  #define EDGE_OUT         0.5
  #define CAM_DIST         18.0    // virtual camera distance (matches reference framing)
  #define FOV              1.0

  float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = hash31(i);
    float b = hash31(i + vec3(1.0, 0.0, 0.0));
    float c = hash31(i + vec3(0.0, 1.0, 0.0));
    float d = hash31(i + vec3(1.0, 1.0, 0.0));
    float e = hash31(i + vec3(0.0, 0.0, 1.0));
    float f2 = hash31(i + vec3(1.0, 0.0, 1.0));
    float g = hash31(i + vec3(0.0, 1.0, 1.0));
    float h = hash31(i + vec3(1.0, 1.0, 1.0));
    return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
               mix(mix(e, f2, u.x), mix(g, h, u.x), u.y), u.z);
  }

  // 3-octave fbm (reference used 4; one octave dropped to claw back cost)
  float fbm(vec3 p, float lac, float per) {
    float v = 0.0;
    float amp = 0.5;
    vec3 pos = p;
    v += noise3D(pos) * amp; pos *= lac; amp *= per;
    v += noise3D(pos) * amp; pos *= lac; amp *= per;
    v += noise3D(pos) * amp;
    return v;
  }

  vec3 blackbodyColor(float tempK) {
    float t = clamp((tempK - 1000.0) / 9000.0, 0.0, 1.0);
    float red = clamp(1.0 - (t - 0.8) * 2.0, 0.5, 1.0);
    float green = smoothstep(0.0, 0.5, t) * (1.0 - max((t - 0.7) * 0.3, 0.0));
    float blue = smoothstep(0.3, 1.0, t) * t;
    return vec3(red, green, blue);
  }

  vec4 accretionDiskColor(float hitR, float hitAngle, vec3 rayDir) {
    float normR = clamp((hitR - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);

    // blackbody temperature gradient
    float peakTempK = DISK_TEMP * 1000.0;
    float outerTempK = 1500.0;
    float tempFalloff = pow(DISK_INNER / hitR, TEMP_FALLOFF);
    float tempK = mix(outerTempK, peakTempK, tempFalloff);
    vec3 diskColor = blackbodyColor(tempK);

    // doppler beaming
    float rotationSign = sign(DISK_ROT_SPEED);
    vec3 velocityDir = vec3(-sin(hitAngle) * rotationSign, 0.0, cos(hitAngle) * rotationSign);
    float velocityMag = 1.0 / sqrt(hitR / DISK_INNER);
    float beta = velocityMag * 0.3;
    float cosTheta = dot(velocityDir, rayDir);
    float dopplerFactor = 1.0 / (1.0 - beta * cosTheta);
    float dopplerBoost = pow(dopplerFactor, 3.0 * DOPPLER_STRENGTH);
    diskColor *= clamp(dopplerBoost, 0.1, 5.0);

    // edge falloff
    float edge = smoothstep(0.0, EDGE_IN, normR) *
                 smoothstep(1.0, 1.0 - EDGE_OUT, normR);

    // turbulence — continuous keplerian rotation (single fbm, no cyclic blend)
    float keplerPhase = uTime * DISK_ROT_SPEED / pow(hitR, 1.5);
    float ang = hitAngle + keplerPhase;
    vec3 noiseCoord = vec3(
      hitR * TURB_SCALE,
      cos(ang) / max(TURB_STRETCH, 0.1),
      sin(ang) / max(TURB_STRETCH, 0.1)
    );
    float turbulence = fbm(noiseCoord, TURB_LAC, TURB_PERS);
    float ringOpacity = pow(clamp(turbulence, 0.0, 1.0), TURB_SHARP);
    // soft floor so the whole annulus stays visible at a distance
    // spottable from a distance, with the bright turbulent filaments on top.
    ringOpacity = mix(DISK_FILL, 1.0, ringOpacity);

    float opacity = ringOpacity * edge;
    vec3 finalColor = diskColor * DISK_BRIGHT * uGlow;
    return vec4(finalColor, opacity);
  }

  void main() {
    vec2 screenPos = (vUv - 0.5) * 2.0; // square quad -> aspect 1

    // virtual camera orbiting the black hole along the real view direction
    vec3 camPos = uCamDir * CAM_DIST;
    vec3 camForward = normalize(-camPos);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 camRight = normalize(cross(worldUp, camForward));
    vec3 camUp = cross(camForward, camRight);
    vec3 rayDir = normalize(camForward * FOV + camRight * screenPos.x + camUp * screenPos.y);

    vec3 rayPos = camPos;
    vec3 prevPos = camPos;
    vec3 color = vec3(0.0);
    float alpha = 0.0;
    float captured = 0.0;
    float rs = BH_MASS * 2.0;

    for (int i = 0; i < STEPS; i++) {
      if (alpha > 0.99) break;
      float r = length(rayPos);
      if (r < rs * 1.01) { captured = 1.0; break; }
      if (r > 100.0) break;

      vec3 toCenter = -rayPos / r;
      float bend = rs / (r * r) * STEP_SIZE * LENSING;
      rayDir = normalize(rayDir + toCenter * bend);

      prevPos = rayPos;
      rayPos += rayDir * STEP_SIZE;

      // disk-plane crossing
      if (prevPos.y * rayPos.y < 0.0 && alpha < 0.99) {
        float t = -prevPos.y / (rayPos.y - prevPos.y);
        vec3 hitPos = mix(prevPos, rayPos, t);
        float hitR = sqrt(hitPos.x * hitPos.x + hitPos.z * hitPos.z);
        if (hitR > DISK_INNER && hitR < DISK_OUTER) {
          float hitAngle = atan(hitPos.z, hitPos.x);
          vec4 disk = accretionDiskColor(hitR, hitAngle, rayDir);
          float remaining = 1.0 - alpha;
          color += disk.rgb * disk.a * remaining; // premultiplied
          alpha += remaining * disk.a;
        }
      }
    }

    // captured rays -> opaque void (occludes the world behind);
    // escaped rays -> transparent (world shows through).
    float outAlpha = captured > 0.5 ? 1.0 : alpha;
    gl_FragColor = vec4(color, outAlpha); // premultiplied; linear (composer tone-maps)
  }
`

// Reusable bias vector — keeps a gentle top-down tilt so the disk never goes fully edge-on
const MIN_ELEVATION = 0.22

export default function BlackHoleOrb({ worldPos, size = 3, glow = '#9a86ff' }) {
  const matRef = useRef()
  const dir = useMemo(() => new THREE.Vector3(), [])
  const orb = useMemo(
    () => new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z),
    [worldPos.x, worldPos.y, worldPos.z],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCamDir: { value: new THREE.Vector3(0, 0.3, 1) },
      uGlow: { value: new THREE.Color(glow) },
    }),
    [glow],
  )

  useFrame((state) => {
    const u = matRef.current?.uniforms
    if (!u) return
    u.uTime.value = state.clock.elapsedTime
    // direction from orb to camera, with a floor on elevation for a nice tilt
    dir.copy(state.camera.position).sub(orb)
    dir.y = Math.max(dir.y, dir.length() * MIN_ELEVATION)
    dir.normalize()
    u.uCamDir.value.copy(dir)
  })

  return (
    <Billboard position={[orb.x, orb.y, orb.z]}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          premultipliedAlpha
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  )
}
