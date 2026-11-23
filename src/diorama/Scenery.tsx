import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react'
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  OctahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
} from 'three'
import { look } from '../look'
import { apartment, plots, type Home, type Position } from '../world'
import {
  box,
  buildApartment,
  buildBalcony,
  buildGround,
  buildHouse,
  buildProps,
  groundRects,
  lumpySphere,
  place,
} from './geometry'
import { createMaterials, disposeMaterials, type Materials } from './materials'

function once<T>(create: () => T) {
  let value: T | undefined
  return () => (value ??= create())
}

const shared = once(() => ({
  houses: [0, 1, 2, 3].map(buildHouse),
  apartment: buildApartment(),
  balcony: buildBalcony(),
  ground: buildGround(),
  props: buildProps(),
  pad: place(box(3.6, 0.08, 4), [0, 0.04, 0]),
  signPost: place(box(0.08, 0.85, 0.08), [0, 0.42, 0.8]),
  signBoard: place(box(0.65, 0.38, 0.1), [0, 0.85, 0.8]),
  windowFrame: box(1.9, 1.6, 0.1),
  windowGlass: place(box(1.65, 1.35, 0.06), [0, 0, 0.07]),
  windowMullion: place(box(0.06, 1.35, 0.04), [0, 0, 0.12]),
  trunk: place(new CylinderGeometry(0.11, 0.2, 2, 7), [0, 1, 0]),
  canopy: lumpySphere(3, 1),
  tuft: place(new ConeGeometry(0.08, 0.3, 3, 1, true), [0, 0.15, 0]),
  flower: new OctahedronGeometry(0.075, 0),
  rock: new DodecahedronGeometry(0.2, 0),
  plinthSides: [
    place(box(62, 4, 0.2), [2, -2.3, 30.9]),
    place(box(62, 4, 0.2), [2, -2.3, -30.9]),
    place(box(0.2, 4, 62), [-28.9, -2.3, 0]),
    place(box(0.2, 4, 62), [32.9, -2.3, 0]),
  ],
  plinthFrame: [
    place(box(63.2, 0.5, 0.6), [2, -0.12, 31.3]),
    place(box(63.2, 0.5, 0.6), [2, -0.12, -31.3]),
    place(box(0.6, 0.5, 63.2), [-29.3, -0.12, 0]),
    place(box(0.6, 0.5, 63.2), [33.3, -0.12, 0]),
    place(box(64.4, 0.5, 64.4), [2, -4.55, 0]),
  ],
}))

function Merged({
  geometries,
  materials,
  cast = true,
  receive = true,
}: {
  geometries: Partial<Record<string, BufferGeometry>>
  materials: { [key: string]: Material | Material[] | undefined }
  cast?: boolean
  receive?: boolean
}) {
  return (
    <>
      {Object.entries(geometries).map(([key, geometry]) =>
        materials[key] && !Array.isArray(materials[key]) ? (
          <mesh
            key={key}
            geometry={geometry}
            material={materials[key]}
            castShadow={cast}
            receiveShadow={receive}
          />
        ) : null,
      )}
    </>
  )
}

function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

function onGrass(x: number, z: number) {
  if (x < -28.6 || x > 32.6 || z < -30.6 || z > 30.6) return false
  if (
    groundRects.some(
      ([cx, cz, w, d]) =>
        Math.abs(x - cx) < w / 2 + 0.15 && Math.abs(z - cz) < d / 2 + 0.15,
    )
  )
    return false
  if (Math.abs(x - apartment.x) < 4.5 && Math.abs(z - apartment.z) < 3.6)
    return false
  return !plots.some(
    (plot) =>
      plot.kind === 'house' &&
      Math.abs(x - plot.x) < 2 &&
      Math.abs(z - plot.z) < 2.2,
  )
}

const treeSpots = [
  ...Array.from({ length: 27 }, (_, i) => [
    18 + (i % 3) * 4 + (i % 2) * 0.5,
    -23 + Math.floor(i / 3) * 5.3,
  ]),
  ...[-18, -12, -6, 6, 12, 18].map((z) => [7, z]),
  ...[-20, -16, -8].map((x) => [x, 15]),
] as [number, number][]

const blobs: [number, number, number, number][] = [
  [0, 2.45, 0, 1.25],
  [0.6, 2.0, 0.35, 0.85],
  [-0.55, 2.1, -0.3, 0.9],
  [0.1, 3.1, -0.15, 0.75],
]

type Instance = { matrix: Matrix4; color: Color }

function useInstances(
  ref: RefObject<InstancedMesh | null>,
  instances: Instance[],
) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    instances.forEach((instance, index) => {
      mesh.setMatrixAt(index, instance.matrix)
      mesh.setColorAt(index, instance.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [ref, instances])
}

function compose(
  position: [number, number, number],
  scale: [number, number, number],
  yaw = 0,
) {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
    new Vector3(...scale),
  )
}

function Trees({ materials }: { materials: Materials }) {
  const geometry = shared()
  const trunks = useRef<InstancedMesh>(null)
  const canopies = useRef<InstancedMesh>(null)
  const { trunkInstances, canopyInstances } = useMemo(() => {
    const next = seeded(11)
    const leaves = look.palette.leaves
    const trunkColor = new Color('#ffffff')
    const trunkInstances: Instance[] = []
    const canopyInstances: Instance[] = []
    treeSpots.forEach(([x, z], index) => {
      const size = 0.85 + next() * 0.35
      const yaw = next() * Math.PI * 2
      trunkInstances.push({
        matrix: compose(
          [x, 0, z],
          [size, size * (0.9 + next() * 0.3), size],
          yaw,
        ),
        color: trunkColor,
      })
      const base = new Color(leaves[index % leaves.length])
      blobs.forEach(([bx, by, bz, radius]) => {
        const c = Math.cos(yaw)
        const s = Math.sin(yaw)
        const r = radius * size * (0.9 + next() * 0.25)
        canopyInstances.push({
          matrix: compose(
            [
              x + (bx * c + bz * s) * size,
              by * size,
              z + (bz * c - bx * s) * size,
            ],
            [r, r * 0.92, r],
            next() * Math.PI,
          ),
          color: base
            .clone()
            .offsetHSL((next() - 0.5) * 0.03, 0, (next() - 0.5) * 0.08),
        })
      })
    })
    return { trunkInstances, canopyInstances }
  }, [])
  useInstances(trunks, trunkInstances)
  useInstances(canopies, canopyInstances)
  return (
    <>
      <instancedMesh
        ref={trunks}
        args={[geometry.trunk, undefined, trunkInstances.length]}
        material={materials.trunk}
        castShadow
      />
      <instancedMesh
        ref={canopies}
        args={[geometry.canopy, undefined, canopyInstances.length]}
        material={materials.leaves}
        castShadow
      />
    </>
  )
}

const flowerColors = ['#fff6e8', '#f4a7b9', '#f6d55c', '#b9a3e3', '#ef8a5b']

function Scatter({ materials }: { materials: Materials }) {
  const geometry = shared()
  const tufts = useRef<InstancedMesh>(null)
  const flowers = useRef<InstancedMesh>(null)
  const rocks = useRef<InstancedMesh>(null)
  const layout = useMemo(() => {
    const next = seeded(29)
    const grass = new Color(look.palette.grass)
    const tuftInstances: Instance[] = []
    while (tuftInstances.length < 300) {
      const x = -28 + next() * 60
      const z = -30 + next() * 60
      if (!onGrass(x, z)) continue
      const size = 0.7 + next() * 0.9
      tuftInstances.push({
        matrix: compose([x, 0, z], [size, size, size], next() * Math.PI),
        color: grass
          .clone()
          .offsetHSL((next() - 0.5) * 0.05, 0.05, (next() - 0.6) * 0.18),
      })
    }
    const flowerInstances: Instance[] = []
    while (flowerInstances.length < 160) {
      const cx = -28 + next() * 60
      const cz = -30 + next() * 60
      if (!onGrass(cx, cz)) continue
      const color = new Color(
        flowerColors[Math.floor(next() * flowerColors.length)],
      )
      for (let i = 0; i < 8; i++) {
        const x = cx + (next() - 0.5) * 1.1
        const z = cz + (next() - 0.5) * 1.1
        if (!onGrass(x, z)) continue
        const size = 0.7 + next() * 0.6
        flowerInstances.push({
          matrix: compose([x, 0.12 + next() * 0.12, z], [size, size, size]),
          color,
        })
      }
    }
    const stone = new Color(look.palette.stone)
    const rockInstances: Instance[] = []
    for (let i = 0; i < 60; i++) {
      const x = i % 2 ? 9.45 : 14.55
      const z = -30 + next() * 60
      if (Math.abs(z) < 2.4) continue
      const size = 0.5 + next() * 0.8
      rockInstances.push({
        matrix: compose(
          [x + (next() - 0.5) * 0.2, 0.05, z],
          [size, size * 0.6, size],
          next() * 6,
        ),
        color: stone.clone().offsetHSL(0, 0, (next() - 0.5) * 0.15),
      })
    }
    return { tuftInstances, flowerInstances, rockInstances }
  }, [])
  useInstances(tufts, layout.tuftInstances)
  useInstances(flowers, layout.flowerInstances)
  useInstances(rocks, layout.rockInstances)
  return (
    <>
      <instancedMesh
        ref={tufts}
        args={[geometry.tuft, undefined, layout.tuftInstances.length]}
        material={materials.tuft}
      />
      <instancedMesh
        ref={flowers}
        args={[geometry.flower, undefined, layout.flowerInstances.length]}
        material={materials.flower}
      />
      <instancedMesh
        ref={rocks}
        args={[geometry.rock, undefined, layout.rockInstances.length]}
        material={materials.stone}
        castShadow
      />
    </>
  )
}

function Plinth({ materials }: { materials: Materials }) {
  const side = materials.plinthSide
  return (
    <group>
      {shared().plinthSides.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={side} renderOrder={1} />
      ))}
      {shared().plinthFrame.map((geometry, index) => (
        <mesh
          key={index}
          geometry={geometry}
          material={materials.plinthFrame}
          renderOrder={1}
        />
      ))}
    </group>
  )
}

type SceneryProps = {
  night: boolean
  homes: Home[]
  selectedPlot: number
  onSelectPlot: (plot: number) => void
  target: RefObject<Position>
}

export const Scenery = memo(function Scenery({
  night,
  homes,
  selectedPlot,
  onSelectPlot,
  target,
}: SceneryProps) {
  const geometry = shared()
  const materials = useMemo(() => createMaterials(look, night), [night])
  useEffect(() => () => disposeMaterials(materials), [materials])
  const gl = useThree((state) => state.gl)
  // Only the avatar moves, and it uses a blob shadow, so the shadow map is
  // rendered once per scenery change instead of every frame.
  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [gl, night, homes, selectedPlot])
  useEffect(
    () => () => {
      gl.shadowMap.autoUpdate = true
    },
    [gl],
  )
  const houseMaterials = (index: number) => ({
    ...materials,
    wall: materials.walls[index % materials.walls.length],
    roof: materials.roofs[(index * 3 + 1) % materials.roofs.length],
  })
  const ghostMaterials = {
    wall: materials.ghostWall,
    roof: materials.ghostRoof,
  }

  return (
    <>
      <group
        onClick={(event) => {
          event.stopPropagation()
          target.current = { x: event.point.x, z: event.point.z }
        }}
      >
        <Merged
          geometries={geometry.ground}
          materials={materials}
          cast={false}
        />
      </group>
      <Merged geometries={geometry.props} materials={materials} />
      <Trees materials={materials} />
      <Scatter materials={materials} />
      <Plinth materials={materials} />
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
              <mesh
                geometry={geometry.pad}
                material={
                  selected
                    ? materials.plotSelected
                    : home
                      ? materials.lawn
                      : materials.plotVacant
                }
                receiveShadow
              />
              {home ? (
                <Merged
                  geometries={geometry.houses[index % geometry.houses.length]}
                  materials={houseMaterials(index)}
                  receive={false}
                />
              ) : selected ? (
                <Merged
                  geometries={geometry.houses[index % geometry.houses.length]}
                  materials={ghostMaterials}
                  cast={false}
                />
              ) : (
                <>
                  <mesh
                    geometry={geometry.signPost}
                    material={materials.signPost}
                    castShadow
                  />
                  <mesh
                    geometry={geometry.signBoard}
                    material={materials.signBoard}
                    castShadow
                  />
                </>
              )}
            </group>
          )
        })}
      <group position={[apartment.x, 0, apartment.z]}>
        <Merged
          receive={false}
          geometries={geometry.apartment}
          materials={{
            ...materials,
            wall: materials.apartment,
            trim: materials.apartmentTrim,
          }}
        />
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
              <mesh
                geometry={geometry.windowFrame}
                material={
                  selectedPlot === index
                    ? materials.apartmentFrameSelected
                    : materials.apartmentFrame
                }
                castShadow
              />
              <mesh
                geometry={geometry.windowGlass}
                material={home ? materials.windowLit : materials.glass}
              />
              <mesh
                geometry={geometry.windowMullion}
                material={materials.apartmentTrim}
              />
              {(plot.floor ?? 1) > 1 && (
                <Merged
                  receive={false}
                  geometries={geometry.balcony}
                  materials={{
                    trim: materials.apartmentTrim,
                    metal: materials.metal,
                  }}
                />
              )}
            </group>
          )
        })}
        <Html
          center
          position={[0, 5.9, 0]}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span className="place-label">こもれび荘</span>
        </Html>
      </group>
    </>
  )
})
