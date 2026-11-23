import { Canvas, useFrame } from '@react-three/fiber'
import { Html, PerformanceMonitor } from '@react-three/drei'
import {
  Component,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Group, Vector3, type Camera, type Object3D } from 'three'
import { Atmosphere, TiltShift } from './diorama/Atmosphere'
import { Scenery } from './diorama/Scenery'
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

function Movement({
  homes,
  target,
  position,
  diagnostics,
  avatar,
}: Pick<Props, 'homes'> & {
  avatar: RefObject<Group | null>
  target: RefObject<Position>
  position: RefObject<Position>
  diagnostics: RefObject<HTMLElement | null>
}) {
  const keys = useRef(new Set<string>())
  const cameraTarget = useRef(new Vector3())
  const lookTarget = useRef(new Vector3(0, 0, 15))
  const elapsed = useRef(0)
  const occupied = useMemo(() => homes.map((home) => home.plot), [homes])

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
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [position, target])

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
    cameraTarget.current.set(next.x, 0, next.z - 3)
    lookTarget.current.lerp(cameraTarget.current, 1 - Math.exp(-7 * delta))
    camera.lookAt(lookTarget.current)
    elapsed.current += delta
    if (elapsed.current > 0.15) {
      elapsed.current = 0
      if (diagnostics.current) {
        diagnostics.current.dataset.position = next.z.toFixed(1)
        diagnostics.current.dataset.positionX = next.x.toFixed(1)
      }
    }
  })

  return (
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
  )
}

function Speech({
  homes,
  hour,
  hiddenOwners,
  position,
}: Pick<Props, 'homes' | 'hour' | 'hiddenOwners'> & {
  position: RefObject<Position>
}) {
  const [visible, setVisible] = useState('')
  const previous = useRef('')
  const [tick, setTick] = useState(0)
  const elapsed = useRef(0.15)
  const labels = useMemo(
    () =>
      homes
        .filter((home) => !hiddenOwners.has(home.owner_id))
        .map((home) => {
          const plot = plots[home.plot]
          return {
            home,
            x:
              plot.kind === 'house'
                ? plot.x
                : apartment.x + ((plot.room ?? 1) - 2) * 2.5,
            y: plot.kind === 'house' ? 4.3 : (plot.floor ?? 1) * 2.3 + 1.1,
            z: plot.kind === 'house' ? plot.z : apartment.z + 2.5,
          }
        }),
    [homes, hiddenOwners],
  )
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 6000)
    return () => window.clearInterval(timer)
  }, [])
  useFrame((_, delta) => {
    elapsed.current += delta
    if (elapsed.current <= 0.15) return
    elapsed.current = 0
    const next = labels
      .map(({ x, z }) =>
        Math.hypot(x - position.current.x, z - position.current.z) <= 6
          ? '1'
          : '0',
      )
      .join('')
    if (next !== previous.current) {
      previous.current = next
      setVisible(next)
    }
  })
  return labels.map(({ home, x, y, z }, index) =>
    visible[index] === '1' ? (
      <Html
        key={home.owner_id}
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
    ) : null,
  )
}

const Street = memo(function Street({
  homes,
  hour,
  selectedPlot,
  onSelectPlot,
  target,
  effects,
  avatar,
}: Pick<Props, 'homes' | 'hour' | 'selectedPlot' | 'onSelectPlot'> & {
  target: RefObject<Position>
  effects: boolean
  avatar: RefObject<Group | null>
}) {
  const night = currentScene(hour) === 'night'
  return (
    <>
      <Atmosphere night={night} />
      <Scenery
        night={night}
        homes={homes}
        selectedPlot={selectedPlot}
        onSelectPlot={onSelectPlot}
        target={target}
      />
      {effects && <TiltShift focus={avatar} />}
    </>
  )
})
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

// 2: full look, 1: DPR 1, 0: no blur or shadows. Fixed bounds because drei's
// default derives them from the highest fps it has seen, so a brief spike over
// 100 fps makes it treat anything under 60 fps as too slow. drei counts both
// ends of each 250 ms window, reading about 4 fps high, so 34 means 30.
type Quality = 0 | 1 | 2
const qualityBounds = () => [34, 54] as [number, number]

export default function Town(props: Props) {
  const target = useRef<Position>({ x: 0, z: 18 })
  const position = useRef<Position>({ x: 0, z: 18 })
  const diagnostics = useRef<HTMLElement>(null)
  const avatar = useRef<Group>(null)
  const [ready, setReady] = useState(false)
  const [quality, setQuality] = useState<Quality>(2)
  return (
    <section
      ref={diagnostics}
      className="town"
      aria-label="散歩できる3Dの街"
      data-ready={ready}
      data-position="18.0"
      data-position-x="0.0"
    >
      <CanvasBoundary>
        <Canvas
          shadows={quality > 0}
          dpr={quality === 2 ? [1, 1.25] : 1}
          camera={{ position: [0, 13, 33], fov: 48, near: 0.1, far: 95 }}
          onCreated={() => setReady(true)}
          fallback={<p>このブラウザでは3D表示を利用できません。</p>}
        >
          <PerformanceMonitor
            bounds={qualityBounds}
            onDecline={() =>
              setQuality((level) => (level > 0 ? ((level - 1) as Quality) : 0))
            }
          />
          <Street
            homes={props.homes}
            hour={props.hour}
            selectedPlot={props.selectedPlot}
            onSelectPlot={props.onSelectPlot}
            target={target}
            effects={quality > 0}
            avatar={avatar}
          />
          <Movement
            homes={props.homes}
            target={target}
            position={position}
            diagnostics={diagnostics}
            avatar={avatar}
          />
          <Speech
            homes={props.homes}
            hour={props.hour}
            hiddenOwners={props.hiddenOwners}
            position={position}
          />
        </Canvas>
      </CanvasBoundary>
      <div className="town-caption">
        <span className="dot" /> こもれびの街 <span>01</span>
      </div>
      <div className="walk-controls">
        <button
          type="button"
          aria-label="左へ歩く"
          onClick={() => {
            target.current = {
              x: position.current.x - 6,
              z: position.current.z,
            }
          }}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="手前へ歩く"
          onClick={() => {
            target.current = {
              x: position.current.x,
              z: position.current.z + 6,
            }
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
            target.current = {
              x: position.current.x,
              z: position.current.z - 6,
            }
          }}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="右へ歩く"
          onClick={() => {
            target.current = {
              x: position.current.x + 6,
              z: position.current.z,
            }
          }}
        >
          →
        </button>
      </div>
    </section>
  )
}
