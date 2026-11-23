import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  Component,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  Group,
  Matrix4,
  Vector3,
  type Camera,
  type InstancedMesh,
  type Object3D,
} from 'three'
import { pickLine } from './partner'
import { apartment, plots, moveToward, type Home, type Position } from './world'

type Props = {
  homes: Home[]
  inputPaused: boolean
  hour: number
  selectedPlot: number
  onSelectPlot: (plot: number) => void
  hiddenOwners: ReadonlySet<string>
}
const colors = ['#dfbba1', '#b1c2ad', '#e4d2a6', '#adc2ca']
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

function Block({
  position,
  size,
  color,
  transparent = false,
  castShadow = false,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  transparent?: boolean
  castShadow?: boolean
}) {
  return (
    <mesh
      position={position}
      castShadow={castShadow && !transparent}
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent={transparent}
        opacity={transparent ? 0.4 : 1}
        depthWrite={!transparent}
      />
    </mesh>
  )
}

const trees = [
  ...Array.from({ length: 27 }, (_, i) => ({
    x: 18 + (i % 3) * 4 + (i % 2) * 0.5,
    z: -23 + Math.floor(i / 3) * 5.3,
    variant: i % 3,
  })),
  ...[-18, -12, -6, 6, 12, 18].map((z, i) => ({ x: 7, z, variant: i % 3 })),
  ...[-20, -16, -8].map((x, i) => ({ x, z: 15, variant: i })),
]

function Trees({ variant }: { variant: number }) {
  const trunks = useRef<InstancedMesh>(null)
  const crowns = useRef<InstancedMesh>(null)
  const instances = useMemo(
    () => trees.filter((tree) => tree.variant === variant),
    [variant],
  )
  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return
    const matrix = new Matrix4()
    instances.forEach(({ x, z }, index) => {
      trunks.current!.setMatrixAt(index, matrix.makeTranslation(x, 0.8, z))
      crowns.current!.setMatrixAt(
        index,
        matrix.makeTranslation(x, 2.3 + variant * 0.15, z),
      )
    })
    for (const mesh of [trunks.current, crowns.current]) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [instances, variant])
  return (
    <group>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, instances.length]}
        castShadow
      >
        <cylinderGeometry args={[0.16, 0.24, 1.6, 6]} />
        <meshStandardMaterial color="#92745b" />
      </instancedMesh>
      <instancedMesh
        ref={crowns}
        args={[undefined, undefined, instances.length]}
        castShadow
      >
        <icosahedronGeometry args={[1.5 + variant * 0.1, 0]} />
        <meshStandardMaterial
          color={['#789a76', '#98b284', '#658b73'][variant % 3]}
        />
      </instancedMesh>
    </group>
  )
}

function Movement({
  homes,
  inputPaused,
  target,
  position,
  diagnostics,
}: Pick<Props, 'homes'> & {
  target: RefObject<Position>
  position: RefObject<Position>
  diagnostics: RefObject<HTMLElement | null>
  inputPaused: boolean
}) {
  const avatar = useRef<Group>(null)
  const keys = useRef(new Set<string>())
  const cameraTarget = useRef(new Vector3())
  const lookTarget = useRef(new Vector3(0, 0, 15))
  const elapsed = useRef(0)
  const occupied = useMemo(() => homes.map((home) => home.plot), [homes])

  useEffect(() => {
    if (inputPaused) {
      keys.current.clear()
      target.current = { ...position.current }
      return
    }
    const down = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]',
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
      if (keys.current.delete(event.key.toLowerCase()) && !keys.current.size)
        target.current = { ...position.current }
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
  }, [inputPaused, position, target])

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
    <group ref={avatar}>
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
            y: plot.kind === 'house' ? 3.9 : (plot.floor ?? 1) * 2.3 + 1.1,
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
  selectedPlot,
  onSelectPlot,
  target,
}: Pick<Props, 'homes' | 'selectedPlot' | 'onSelectPlot'> & {
  target: RefObject<Position>
}) {
  return (
    <>
      <color attach="background" args={['#e6eee8']} />
      <fog attach="fog" args={['#e6eee8', 35, 75]} />
      <ambientLight intensity={1.6} />
      <directionalLight
        position={[8, 22, 12]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-normalBias={0.04}
      />
      <group
        onClick={(event) => {
          event.stopPropagation()
          target.current = { x: event.point.x, z: event.point.z }
        }}
      >
        <Block position={[2, -0.15, 0]} size={[62, 0.3, 62]} color="#bdcba5" />
        <Block position={[0, 0.015, 0]} size={[4, 0.03, 43]} color="#e8ddc6" />
        <Block
          position={[3, 0.025, 0]}
          size={[49, 0.04, 3.8]}
          color="#e8ddc6"
        />
        <Block
          position={[-13, 0.025, 3]}
          size={[3.4, 0.04, 18]}
          color="#e8ddc6"
        />
        <Block position={[8.2, 0.02, 0]} size={[2, 0.04, 48]} color="#dcd7b5" />
        <Block
          position={[15.6, 0.02, 0]}
          size={[2, 0.04, 48]}
          color="#dcd7b5"
        />
        <Block
          position={[21, 0.025, -10]}
          size={[2.8, 0.04, 22]}
          color="#d6c8a9"
        />
        <Block
          position={[-10, 0.03, 10]}
          size={[10, 0.04, 7]}
          color="#dfd7bd"
        />
        <Block position={[12, 0.025, 0]} size={[4, 0.04, 62]} color="#85b9c4" />
        <Block
          position={[12, 0.07, 0]}
          size={[5.6, 0.1, 3.8]}
          color="#c5a783"
        />
        {Array.from({ length: 8 }, (_, i) => (
          <Block
            key={i}
            position={[9.6 + i * 0.7, 0.13, 0]}
            size={[0.05, 0.015, 3.75]}
            color="#9b856e"
          />
        ))}
      </group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            castShadow
            position={[12, 0.75, side * 1.9]}
            size={[5.6, 0.14, 0.14]}
            color="#9a7b5e"
          />
          {[9.5, 12, 14.5].map((x) => (
            <Block
              key={x}
              castShadow
              position={[x, 0.4, side * 1.9]}
              size={[0.15, 0.8, 0.15]}
              color="#9a7b5e"
            />
          ))}
        </group>
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <Block
          key={`ripple-${i}`}
          position={[11 + (i % 3) * 0.8, 0.055, -25 + i * 4.4]}
          size={[0.7, 0.012, 0.07]}
          color="#b8d8d9"
        />
      ))}
      {plots
        .filter((plot) => plot.kind === 'house')
        .map((plot, index) => {
          const home = homes.find((entry) => entry.plot === index)
          const selected = selectedPlot === index
          return (
            <group
              key={index}
              position={[plot.x, 0, plot.z]}
              onClick={(event) => {
                event.stopPropagation()
                onSelectPlot(index)
              }}
            >
              <Block
                position={[0, 0.04, 0]}
                size={[3.6, 0.08, 4]}
                color={selected ? '#dfbf6b' : home ? '#cdd5b7' : '#aabb97'}
              />
              {home || selected ? (
                <>
                  <Block
                    castShadow
                    position={[0, 1.05, 0]}
                    size={[2.7, 2, 2.7]}
                    color={colors[index % colors.length]}
                    transparent={!home}
                  />
                  <mesh
                    position={[0, 2.5, 0]}
                    rotation={[0, Math.PI / 4, 0]}
                    castShadow={!!home}
                  >
                    <coneGeometry args={[2.25, 1.3, 4]} />
                    <meshStandardMaterial
                      color="#687d77"
                      transparent={!home}
                      opacity={home ? 1 : 0.4}
                      depthWrite={!!home}
                    />
                  </mesh>
                  <Block
                    position={[0, 0.7, 1.37]}
                    size={[0.65, 1.3, 0.06]}
                    color="#7d8d80"
                    transparent={!home}
                  />
                  <Block
                    position={[0.85, 1.3, 1.38]}
                    size={[0.55, 0.6, 0.07]}
                    color="#f5e7b4"
                    transparent={!home}
                  />
                </>
              ) : (
                <>
                  <Block
                    castShadow
                    position={[0, 0.42, 0.8]}
                    size={[0.08, 0.85, 0.08]}
                    color="#967f63"
                  />
                  <Block
                    castShadow
                    position={[0, 0.85, 0.8]}
                    size={[0.65, 0.38, 0.1]}
                    color="#f2ebd6"
                  />
                </>
              )}
            </group>
          )
        })}
      <group position={[apartment.x, 0, apartment.z]}>
        <Block
          castShadow
          position={[0, 2.4, 0]}
          size={[7.8, 4.8, 4.4]}
          color="#d9ccb8"
        />
        <Block
          castShadow
          position={[0, 4.85, 0]}
          size={[8.2, 0.22, 4.8]}
          color="#718a82"
        />
        <Block
          position={[0, 2.4, 2.3]}
          size={[7.9, 0.2, 0.5]}
          color="#b4a58f"
        />
        <Block position={[0, 0.1, 2.7]} size={[8.1, 0.2, 1]} color="#c5bba5" />
        {plots.slice(12).map((plot, offset) => {
          const index = offset + 12
          const home = homes.find((entry) => entry.plot === index)
          const x = ((plot.room ?? 1) - 2) * 2.5
          const y = ((plot.floor ?? 1) - 1) * 2.3 + 1.25
          return (
            <group
              key={index}
              position={[x, y, 2.26]}
              onClick={(event) => {
                event.stopPropagation()
                onSelectPlot(index)
              }}
            >
              <Block
                position={[0, 0, 0]}
                size={[1.9, 1.6, 0.1]}
                color={selectedPlot === index ? '#e7bb58' : '#897e6d'}
              />
              <Block
                position={[0, 0, 0.07]}
                size={[1.65, 1.35, 0.06]}
                color={home ? '#f1e3ac' : '#91aeb1'}
              />
              <Block
                position={[0, 0, 0.12]}
                size={[0.06, 1.35, 0.04]}
                color="#d7cbb4"
              />
            </group>
          )
        })}
        <Html
          center
          position={[0, 5.5, 0]}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="place-label">こもれび荘</span>
        </Html>
      </group>
      {[0, 1, 2].map((variant) => (
        <Trees key={variant} variant={variant} />
      ))}
      {[-15, -9].map((x) => (
        <group key={`bench-${x}`} position={[x, 0, 12]}>
          <Block
            castShadow
            position={[0, 0.55, 0]}
            size={[2.2, 0.18, 0.6]}
            color="#9a795b"
          />
          <Block
            castShadow
            position={[0, 1, -0.27]}
            size={[2.2, 0.65, 0.12]}
            color="#ae8b66"
          />
          {[-0.8, 0.8].map((leg) => (
            <Block
              key={leg}
              castShadow
              position={[leg, 0.25, 0]}
              size={[0.15, 0.5, 0.45]}
              color="#65746a"
            />
          ))}
        </group>
      ))}
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

export default function Town(props: Props) {
  const target = useRef<Position>({ x: 0, z: 18 })
  const position = useRef<Position>({ x: 0, z: 18 })
  const diagnostics = useRef<HTMLElement>(null)
  const [ready, setReady] = useState(false)
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
          shadows
          dpr={[1, 1.25]}
          camera={{ position: [0, 13, 33], fov: 48, near: 0.1, far: 95 }}
          onCreated={() => setReady(true)}
          fallback={<p>このブラウザでは3D表示を利用できません。</p>}
        >
          <Street
            homes={props.homes}
            selectedPlot={props.selectedPlot}
            onSelectPlot={props.onSelectPlot}
            target={target}
          />
          <Movement
            homes={props.homes}
            inputPaused={props.inputPaused}
            target={target}
            position={position}
            diagnostics={diagnostics}
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
