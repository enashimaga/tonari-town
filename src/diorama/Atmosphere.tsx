import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import {
  Color,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import type { Look } from '../looks'

const nightSky = new Color('#1c2333')

export function Atmosphere({ look, night }: { look: Look; night: boolean }) {
  const gl = useThree((state) => state.gl)
  const background = useMemo(
    () =>
      new Color(look.background).lerp(nightSky, night ? 0.75 : 0).getStyle(),
    [look, night],
  )
  useEffect(() => {
    gl.toneMappingExposure = look.exposure
  }, [gl, look])
  const sun = night ? '#9fb2ff' : look.sun.color
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, look.fog[1], look.fog[2]]} />
      <hemisphereLight
        args={[
          look.hemisphere.sky,
          look.hemisphere.ground,
          look.hemisphere.intensity * (night ? 0.35 : 1),
        ]}
      />
      <directionalLight
        position={look.sun.position}
        color={sun}
        intensity={look.sun.intensity * (night ? 0.18 : 1)}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-far={90}
        shadow-normalBias={0.04}
      />
    </>
  )
}

// Single pass: a 16-tap golden-angle disc blur whose radius grows away from the
// walker's screen row, plus saturation and vignette, so the tilt-shift look adds
// only one full-screen pass before the tone-mapping OutputPass.
const tiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2(1, 1) },
    focus: { value: 0.35 },
    band: { value: 0.1 },
    blur: { value: 10 },
    vignette: { value: 0.4 },
    saturation: { value: 1.2 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float focus;
    uniform float band;
    uniform float blur;
    uniform float vignette;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float distanceFromFocus = max(abs(vUv.y - focus) - band, 0.0);
      float radius = blur * smoothstep(0.0, 0.45, distanceFromFocus);
      if (radius > 0.4) {
        vec3 sum = color.rgb;
        for (int i = 0; i < 16; i++) {
          float index = float(i) + 0.5;
          float angle = index * 2.39996;
          vec2 offset = vec2(cos(angle), sin(angle)) * sqrt(index / 16.0) * radius;
          sum += texture2D(tDiffuse, vUv + offset / resolution).rgb;
        }
        color.rgb = sum / 17.0;
      }
      float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      color.rgb = mix(vec3(luminance), color.rgb, saturation);
      vec2 centered = vUv - 0.5;
      color.rgb *= 1.0 - vignette * dot(centered, centered) * 1.6;
      gl_FragColor = color;
    }
  `,
}

const projected = new Vector3()

export function TiltShift({
  settings,
  focus,
}: {
  settings: NonNullable<Look['post']>
  focus: RefObject<Object3D | null>
}) {
  const { gl, scene, camera, size, viewport } = useThree()
  const { composer, pass } = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, {
      samples: 4,
    })
    const composer = new EffectComposer(gl, target)
    composer.addPass(new RenderPass(scene, camera))
    const pass = new ShaderPass(tiltShiftShader)
    composer.addPass(pass)
    composer.addPass(new OutputPass())
    return { composer, pass }
  }, [gl, scene, camera])
  useEffect(
    () => () => {
      composer.passes.forEach((pass) => pass.dispose())
      composer.dispose()
    },
    [composer],
  )
  useEffect(() => {
    composer.setPixelRatio(viewport.dpr)
    composer.setSize(size.width, size.height)
    pass.uniforms.resolution.value.set(
      size.width * viewport.dpr,
      size.height * viewport.dpr,
    )
  }, [composer, pass, size, viewport.dpr])
  useEffect(() => {
    pass.uniforms.band.value = settings.band
    pass.uniforms.blur.value = settings.blur * viewport.dpr
    pass.uniforms.vignette.value = settings.vignette
    pass.uniforms.saturation.value = settings.saturation
  }, [pass, settings, viewport.dpr])
  useFrame(() => {
    if (focus.current) {
      focus.current.getWorldPosition(projected).project(camera)
      pass.uniforms.focus.value = projected.y * 0.5 + 0.5 + 0.05
    }
    composer.render()
  }, 1)
  return null
}
