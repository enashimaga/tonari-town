import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Group, Vector3, type Camera, type Object3D } from 'three'
import { pickLine } from './partner'
import { plots, walkToward, type Home } from './world'

type Props = { homes: Home[]; hour: number }
const colors = ['#d9b299', '#a4b5aa', '#dbc99f', '#9eafbd']
const projectedLabel = new Vector3()

function bubblePosition(
  object: Object3D,
  camera: Camera,
  size: { width: number; height: number },
): [number, number] {
  object.getWorldPosition(projectedLabel).project(camera)
  return [
    Math.max(
      105,
      Math.min(size.width - 105, (projectedLabel.x * 0.5 + 0.5) * size.width),
    ),
    (-projectedLabel.y * 0.5 + 0.5) * size.height,
  ]
}

function Street({
  homes,
  hour,
  target,
  setPosition,
}: Props & {
  target: React.RefObject<number>
  setPosition: (position: number) => void
}) {
  const avatar = useRef<Group>(null)
  const position = useRef(18)
  const keys = useRef(new Set<string>())
  const [near, setNear] = useState(18)
  const [tick, setTick] = useState(0)
  const cameraTarget = useRef(new Vector3())
  const elapsed = useRef(0)

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.closest('input,textarea,select,button')
      )
        return
      if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(event.key)) {
        event.preventDefault()
        keys.current.add(event.key.toLowerCase())
      }
    }
    const up = (event: KeyboardEvent) =>
      keys.current.delete(event.key.toLowerCase())
    const clear = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    const timer = window.setInterval(() => setTick((value) => value + 1), 6000)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      window.clearInterval(timer)
    }
  }, [])

  useFrame(({ camera }, delta) => {
    const direction =
      Number(keys.current.has('arrowdown') || keys.current.has('s')) -
      Number(keys.current.has('arrowup') || keys.current.has('w'))
    if (direction)
      target.current = Math.max(
        -19,
        Math.min(19, position.current + direction * 2),
      )
    const next = walkToward(position.current, target.current, delta)
    if (avatar.current) {
      avatar.current.position.z = next
      avatar.current.position.y =
        Math.abs(next - position.current) > 0.001
          ? Math.sin(Date.now() / 100) * 0.04
          : 0
      avatar.current.rotation.y = next < position.current ? Math.PI : 0
    }
    position.current = next
    cameraTarget.current.set(0, 9, next + 11)
    camera.position.lerp(cameraTarget.current, 1 - Math.exp(-7 * delta))
    camera.lookAt(0, 0, next - 3)
    elapsed.current += delta
    if (elapsed.current > 0.15) {
      elapsed.current = 0
      setNear(next)
      setPosition(next)
    }
  })

  return (
    <>
      <color attach="background" args={['#e8eee5']} />
      <fog attach="fog" args={['#e8eee5', 24, 52]} />
      <ambientLight intensity={1.5} />
      <directionalLight
        position={[8, 15, 4]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={(event) => {
          target.current = Math.max(-19, Math.min(19, event.point.z))
        }}
      >
        <planeGeometry args={[80, 90]} />
        <meshStandardMaterial color="#b8c7a0" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation()
          target.current = Math.max(-19, Math.min(19, event.point.z))
        }}
      >
        <planeGeometry args={[3.8, 42]} />
        <meshStandardMaterial color="#e7dcc6" />
      </mesh>
      {plots.map((plot, index) => (
        <mesh
          key={`plot-${index}`}
          position={[plot.x, 0.02, plot.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[3.4, 3.8]} />
          <meshStandardMaterial color="#c7d3b3" />
        </mesh>
      ))}
      {homes.map((home) => {
        const p = plots[home.plot]
        if (!p) return null
        const nearby = Math.abs(p.z - near) < 5
        return (
          <group key={home.owner_id} position={[p.x, 0, p.z]}>
            <mesh position={[0, 1, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.7, 2, 2.7]} />
              <meshStandardMaterial color={colors[home.plot % colors.length]} />
            </mesh>
            <mesh
              position={[0, 2.5, 0]}
              rotation={[0, Math.PI / 4, 0]}
              castShadow
            >
              <coneGeometry args={[2.25, 1.3, 4]} />
              <meshStandardMaterial color="#5f7470" />
            </mesh>
            <mesh position={[0, 0.65, 1.36]}>
              <boxGeometry args={[0.65, 1.3, 0.05]} />
              <meshStandardMaterial color="#647265" />
            </mesh>
            <mesh position={[0.8, 1.2, 1.38]}>
              <boxGeometry args={[0.55, 0.55, 0.06]} />
              <meshStandardMaterial
                color="#fff1ba"
                emissive="#edc46c"
                emissiveIntensity={0.25}
              />
            </mesh>
            {nearby && (
              <Html
                center
                position={[0, 3.9, 0]}
                calculatePosition={bubblePosition}
                zIndexRange={[10, 0]}
                style={{ pointerEvents: 'none' }}
              >
                <div className="bubble">
                  <small>{home.partner.partnerName}</small>
                  <p>{pickLine(home.partner, hour, tick)}</p>
                </div>
              </Html>
            )}
          </group>
        )
      })}
      {Array.from({ length: 14 }, (_, i) => (
        <group
          key={`tree-${i}`}
          position={[i % 2 ? 8 : -8, 0, Math.floor(i / 2) * 7 - 21]}
        >
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 1.4, 6]} />
            <meshStandardMaterial color="#8d7960" />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow>
            <icosahedronGeometry args={[1.4, 0]} />
            <meshStandardMaterial color={i % 3 ? '#7b9c76' : '#96af80'} />
          </mesh>
        </group>
      ))}
      <group ref={avatar} position={[0, 0, 18]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <capsuleGeometry args={[0.25, 0.45, 4, 8]} />
          <meshStandardMaterial color="#477f82" />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow>
          <sphereGeometry args={[0.24, 12, 12]} />
          <meshStandardMaterial color="#ebcfb0" />
        </mesh>
        <mesh position={[0, 1.37, 0]} castShadow>
          <cylinderGeometry args={[0.25, 0.34, 0.15, 12]} />
          <meshStandardMaterial color="#d1b77c" />
        </mesh>
      </group>
    </>
  )
}

class CanvasBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="canvas-fallback">
        3D表示を開始できませんでした。WebGL
        2対応のブラウザと、ハードウェアアクセラレーションの設定を確認してください。
      </div>
    ) : (
      this.props.children
    )
  }
}

export default function Town(props: Props) {
  const target = useRef(18)
  const [position, setPosition] = useState(18)
  const [ready, setReady] = useState(false)
  return (
    <section
      className="town"
      aria-label="散歩できる3Dの街"
      data-ready={ready}
      data-position={position.toFixed(1)}
    >
      <CanvasBoundary>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 9, 29], fov: 48, near: 0.1, far: 70 }}
          onCreated={() => setReady(true)}
          fallback={<p>このブラウザでは3D表示を利用できません。</p>}
        >
          <Street {...props} target={target} setPosition={setPosition} />
        </Canvas>
      </CanvasBoundary>
      <div className="town-caption">
        <span className="dot" /> こもれび通り <span>01</span>
      </div>
      <div className="walk-controls">
        <button
          type="button"
          aria-label="手前へ歩く"
          onClick={() => {
            target.current = Math.min(19, position + 6)
          }}
        >
          ↓
        </button>
        <span>
          道をタップして散歩
          <br />
          <small>キーボードは ↑ ↓ / W S</small>
        </span>
        <button
          type="button"
          aria-label="奥へ歩く"
          onClick={() => {
            target.current = Math.max(-19, position - 6)
          }}
        >
          ↑
        </button>
      </div>
    </section>
  )
}
