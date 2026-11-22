import { Canvas, useFrame } from '@react-three/fiber'
import { Html, PerformanceMonitor } from '@react-three/drei'
import {
  Component,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Group, Vector3, type Camera, type Object3D } from 'three'
import { Atmosphere, TiltShift } from './diorama/Atmosphere'
import { Scenery } from './diorama/Scenery'
import { initialLook, lookIds, looks, rememberLook, type LookId } from './looks'
import { currentScene, pickLine } from './partner'
import { apartment, plots, moveToward, type Home, type Position } from './world'

type Props = {
  homes: Home[]
  hour: number
  selectedPlot: number
  onSelectPlot: (plot: number) => void
  hiddenOwners: ReadonlySet<string>
}
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
  selectedPlot,
  onSelectPlot,
  hiddenOwners,
  target,
  setPosition,
  look,
  effects,
}: Props & {
  look: LookId
  effects: boolean
  target: RefObject<Position>
  setPosition: (position: Position) => void
}) {
  const avatar = useRef<Group>(null)
  const position = useRef<Position>({ x: 0, z: 18 })
  const keys = useRef(new Set<string>())
  const [near, setNear] = useState<Position>({ x: 0, z: 18 })
  const [tick, setTick] = useState(0)
  const cameraTarget = useRef(new Vector3())
  const elapsed = useRef(0)
  const occupied = homes.map((home) => home.plot)
  const night = currentScene(hour) === 'night'

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.closest(
          'input,textarea,select,button,[contenteditable="true"]',
        )
      )
        return
      if (
        [
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
          'w',
          'a',
          's',
          'd',
        ].includes(event.key.toLowerCase())
      ) {
        event.preventDefault()
        keys.current.add(event.key.toLowerCase())
      }
    }
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase())
      if (!keys.current.size) target.current = { ...position.current }
    }
    const clear = () => {
      keys.current.clear()
      target.current = { ...position.current }
    }
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
  }, [target])

  useFrame(({ camera }, delta) => {
    const dx =
      Number(keys.current.has('arrowright') || keys.current.has('d')) -
      Number(keys.current.has('arrowleft') || keys.current.has('a'))
    const dz =
      Number(keys.current.has('arrowdown') || keys.current.has('s')) -
      Number(keys.current.has('arrowup') || keys.current.has('w'))
    if (dx || dz)
      target.current = {
        x: position.current.x + dx * 2,
        z: position.current.z + dz * 2,
      }
    const next = moveToward(position.current, target.current, delta, occupied)
    const moved =
      Math.hypot(next.x - position.current.x, next.z - position.current.z) >
      0.001
    if (avatar.current) {
      avatar.current.position.set(
        next.x,
        moved ? Math.sin(Date.now() / 100) * 0.04 : 0,
        next.z,
      )
      if (moved)
        avatar.current.rotation.y = Math.atan2(
          next.x - position.current.x,
          next.z - position.current.z,
        )
    }
    position.current = next
    cameraTarget.current.set(next.x, 13, next.z + 15)
    camera.position.lerp(cameraTarget.current, 1 - Math.exp(-7 * delta))
    camera.lookAt(next.x, 0, next.z - 3)
    elapsed.current += delta
    if (elapsed.current > 0.15) {
      elapsed.current = 0
      setNear(next)
      setPosition(next)
    }
  })

  const speech = (home: Home | undefined, x: number, y: number, z: number) => {
    if (
      !home ||
      hiddenOwners.has(home.owner_id) ||
      Math.hypot(x - near.x, z - near.z) > 6
    )
      return null
    return (
      <Html
        center
        position={[x, y, z]}
        calculatePosition={bubblePosition}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="bubble">
          <small>{home.partner.partnerName}</small>
          <p>{pickLine(home.partner, hour, tick)}</p>
        </div>
      </Html>
    )
  }

  return (
    <>
      <Atmosphere look={looks[look]} night={night} />
      <Scenery
        look={look}
        night={night}
        homes={homes}
        selectedPlot={selectedPlot}
        onSelectPlot={onSelectPlot}
        target={target}
      />
      {homes
        .filter((home) => plots[home.plot]?.kind === 'house')
        .map((home) => (
          <group key={home.owner_id}>
            {speech(home, plots[home.plot].x, 4.3, plots[home.plot].z)}
          </group>
        ))}
      {homes
        .filter((home) => plots[home.plot]?.kind === 'apartment')
        .map((home) => {
          const plot = plots[home.plot]
          return (
            <group key={home.owner_id}>
              {speech(
                home,
                apartment.x + ((plot.room ?? 1) - 2) * 2.5,
                (plot.floor ?? 1) * 2.3 + 1.1,
                apartment.z + 2.5,
              )}
            </group>
          )
        })}
      <group ref={avatar} position={[0, 0, 18]}>
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.42, 20]} />
          <meshBasicMaterial
            color="#1d2a22"
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <capsuleGeometry args={[0.25, 0.45, 4, 8]} />
          <meshStandardMaterial color="#477f82" />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.24, 12, 12]} />
          <meshStandardMaterial color="#ebcfb0" />
        </mesh>
        <mesh position={[0, 1.37, 0]}>
          <cylinderGeometry args={[0.25, 0.34, 0.15, 12]} />
          <meshStandardMaterial color="#d1b77c" />
        </mesh>
      </group>
      {effects && looks[look].post && (
        <TiltShift settings={looks[look].post!} focus={avatar} />
      )}
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
  const target = useRef<Position>({ x: 0, z: 18 })
  const [position, setPosition] = useState<Position>({ x: 0, z: 18 })
  const [ready, setReady] = useState(false)
  const [look, setLook] = useState<LookId>(initialLook)
  const [lowPower, setLowPower] = useState(false)
  return (
    <section
      className="town"
      aria-label="散歩できる3Dの街"
      data-ready={ready}
      data-position={position.z.toFixed(1)}
      data-position-x={position.x.toFixed(1)}
    >
      <CanvasBoundary>
        <Canvas
          shadows
          dpr={lowPower ? 1 : [1, 1.5]}
          camera={{ position: [0, 13, 33], fov: 48, near: 0.1, far: 95 }}
          onCreated={() => setReady(true)}
          fallback={<p>このブラウザでは3D表示を利用できません。</p>}
        >
          <PerformanceMonitor onDecline={() => setLowPower(true)} />
          <Street
            {...props}
            look={look}
            effects={!lowPower}
            target={target}
            setPosition={setPosition}
          />
        </Canvas>
      </CanvasBoundary>
      <div className="town-caption">
        <span className="dot" /> こもれびの街 <span>01</span>
      </div>
      <div
        className="look-switcher"
        role="radiogroup"
        aria-label="街の見た目（試作）"
      >
        <span>見た目の試作</span>
        {lookIds.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === look}
            onClick={(event) => {
              setLook(id)
              rememberLook(id)
              // A focused button swallows WASD, so mouse picks hand focus back to the town.
              if (event.detail > 0) event.currentTarget.blur()
            }}
          >
            {looks[id].label}
          </button>
        ))}
        <small>
          {looks[look].note}
          {lowPower &&
            looks[look].post &&
            ' 描画が重いため、ぼかし効果は省略中です。'}
        </small>
      </div>
      <div className="walk-controls">
        <button
          type="button"
          aria-label="左へ歩く"
          onClick={() => {
            target.current = { x: position.x - 6, z: position.z }
          }}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="手前へ歩く"
          onClick={() => {
            target.current = { x: position.x, z: position.z + 6 }
          }}
        >
          ↓
        </button>
        <span>
          道をタップして散歩
          <br />
          <small>↑ ↓ ← → / W A S D</small>
        </span>
        <button
          type="button"
          aria-label="奥へ歩く"
          onClick={() => {
            target.current = { x: position.x, z: position.z - 6 }
          }}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="右へ歩く"
          onClick={() => {
            target.current = { x: position.x + 6, z: position.z }
          }}
        >
          →
        </button>
      </div>
    </section>
  )
}
