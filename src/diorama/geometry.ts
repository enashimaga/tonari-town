import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Shape,
  Vector3,
} from 'three'
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js'

type Vec3 = [number, number, number]

// BoxGeometry stretches its 0..1 UVs over each face; scaling them by the face
// size keeps every repeating texture at the same world-space density.
export function box(width: number, height: number, depth: number) {
  const geometry = new BoxGeometry(width, height, depth)
  const uv = geometry.getAttribute('uv')
  const faces = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ]
  for (let face = 0; face < 6; face++)
    for (let corner = 0; corner < 4; corner++) {
      const index = face * 4 + corner
      uv.setXY(
        index,
        uv.getX(index) * faces[face][0],
        uv.getY(index) * faces[face][1],
      )
    }
  return geometry
}

export function place(
  geometry: BufferGeometry,
  position: Vec3 = [0, 0, 0],
  rotation: Vec3 = [0, 0, 0],
) {
  return geometry.applyMatrix4(
    new Matrix4().compose(
      new Vector3(...position),
      new Quaternion().setFromEuler(new Euler(...rotation)),
      new Vector3(1, 1, 1),
    ),
  )
}

export class Parts<Key extends string> {
  private groups = new Map<Key, BufferGeometry[]>()

  add(key: Key, geometry: BufferGeometry, position?: Vec3, rotation?: Vec3) {
    const placed = place(geometry, position, rotation)
    const list = this.groups.get(key) ?? []
    list.push(placed.index ? placed.toNonIndexed() : placed)
    this.groups.set(key, list)
    return this
  }

  build() {
    const result: Partial<Record<Key, BufferGeometry>> = {}
    for (const [key, list] of this.groups) {
      result[key] = mergeGeometries(list)!
      list.forEach((geometry) => geometry.dispose())
    }
    return result
  }
}

export type HouseKey =
  | 'wall'
  | 'roof'
  | 'trim'
  | 'glass'
  | 'door'
  | 'foundation'
  | 'lawn'
  | 'hedge'
  | 'paving'

function windowParts(
  parts: Parts<HouseKey>,
  position: Vec3,
  rotationY: number,
  width = 0.62,
  height = 0.56,
) {
  const local = (x: number, y: number, z: number): Vec3 => [
    position[0] + Math.sin(rotationY) * z + Math.cos(rotationY) * x,
    position[1] + y,
    position[2] + Math.cos(rotationY) * z - Math.sin(rotationY) * x,
  ]
  const rotation: Vec3 = [0, rotationY, 0]
  parts
    .add(
      'trim',
      box(width + 0.16, height + 0.16, 0.06),
      local(0, 0, 0.02),
      rotation,
    )
    .add('glass', box(width, height, 0.04), local(0, 0, 0.045), rotation)
    .add('trim', box(0.04, height, 0.03), local(0, 0, 0.075), rotation)
    .add('trim', box(width, 0.035, 0.03), local(0, 0, 0.075), rotation)
    .add(
      'trim',
      box(width + 0.28, 0.06, 0.16),
      local(0, -height / 2 - 0.1, 0.08),
      rotation,
    )
}

export function buildHouse(variant: number) {
  const parts = new Parts<HouseKey>()
  const half = 1.35
  const wallHeight = variant === 2 ? 2.2 : 1.8
  const top = 0.25 + wallHeight
  const rise = variant === 1 ? 1.25 : 1.0
  const overhang = 0.32
  const ridgeAlongZ = variant % 2 === 1
  const slope = Math.atan2(rise, half)
  const slabLength = (half + overhang) / Math.cos(slope)
  const thickness = 0.12

  parts
    .add('lawn', box(3.5, 0.02, 3.9), [0, 0.09, 0])
    .add('paving', box(0.55, 0.02, 0.62), [-0.55, 0.105, 1.66])
    .add('hedge', box(3.5, 0.38, 0.3), [0, 0.27, -1.8])
    .add('hedge', box(0.3, 0.38, 3.3), [-1.6, 0.27, 0])
    .add('hedge', box(0.3, 0.38, 3.3), [1.6, 0.27, 0])
    .add('hedge', box(0.8, 0.38, 0.3), [-1.35, 0.27, 1.85])
    .add('hedge', box(2.0, 0.38, 0.3), [0.75, 0.27, 1.85])
    .add('foundation', box(2.9, 0.25, 2.9), [0, 0.125, 0])
    .add('wall', box(2.7, wallHeight, 2.7), [0, 0.25 + wallHeight / 2, 0])
  for (const x of [-half, half])
    for (const z of [-half, half])
      parts.add('trim', box(0.09, wallHeight, 0.09), [
        x,
        0.25 + wallHeight / 2,
        z,
      ])

  const ridge: Vec3 = [0, top + rise, 0]
  const roofRotation = ridgeAlongZ ? Math.PI / 2 : 0
  const roof = new Parts<HouseKey>()
  for (const side of [1, -1]) {
    const along = new Vector3(0, -Math.sin(slope), side * Math.cos(slope))
    const normal = new Vector3(0, Math.cos(slope), side * Math.sin(slope))
    const center = new Vector3(...ridge)
      .addScaledVector(along, slabLength / 2)
      .addScaledVector(normal, thickness / 2)
    roof.add(
      'roof',
      box(3.25, thickness, slabLength),
      center.toArray() as Vec3,
      [side * slope, 0, 0],
    )
  }
  roof.add('roof', box(3.3, 0.1, 0.2), [ridge[0], ridge[1] + 0.07, ridge[2]])
  const gable = new Shape()
  gable.moveTo(-half, 0)
  gable.lineTo(half, 0)
  gable.lineTo(0, rise)
  gable.closePath()
  const gableGeometry = new ExtrudeGeometry(gable, {
    depth: 2.7,
    bevelEnabled: false,
  })
  gableGeometry.translate(0, 0, -1.35)
  gableGeometry.rotateY(Math.PI / 2)
  roof.add('wall', gableGeometry, [0, top, 0])
  roof.add('foundation', box(0.34, 1.0, 0.34), [0.75, top + rise * 0.55, -0.55])
  roof.add('trim', box(0.42, 0.08, 0.42), [
    0.75,
    top + rise * 0.55 + 0.52,
    -0.55,
  ])
  const roofParts = roof.build()
  for (const [key, geometry] of Object.entries(roofParts))
    parts.add(key as HouseKey, geometry!, [0, 0, 0], [0, roofRotation, 0])

  parts
    .add('trim', box(0.78, 1.3, 0.04), [-0.55, 0.25 + 0.65, half + 0.01])
    .add('door', box(0.62, 1.2, 0.06), [-0.55, 0.25 + 0.6, half + 0.03])
    .add('trim', box(0.05, 0.05, 0.05), [-0.36, 0.85, half + 0.08])
    .add('roof', box(0.98, 0.07, 0.5), [-0.55, 1.68, half + 0.25])
    .add('foundation', box(0.92, 0.2, 0.36), [-0.55, 0.1, half + 0.2])
  windowParts(parts, [0.62, 1.3, half], 0)
  windowParts(parts, [half, 1.3, 0.2], Math.PI / 2)
  windowParts(parts, [-half, 1.3, -0.2], -Math.PI / 2)
  if (variant === 2) {
    windowParts(parts, [-0.55, 2.05, half], 0, 0.5, 0.36)
    windowParts(parts, [0.62, 2.05, half], 0, 0.5, 0.36)
  }
  if (ridgeAlongZ) windowParts(parts, [0, top + 0.38, half], 0, 0.36, 0.36)
  return parts.build()
}

export type ApartmentKey = 'wall' | 'trim' | 'foundation' | 'metal' | 'paving'

export function buildApartment() {
  const parts = new Parts<ApartmentKey>()
  parts
    .add('foundation', box(8.1, 0.3, 4.7), [0, 0.15, 0])
    .add('wall', box(7.8, 4.8, 4.4), [0, 2.4, 0])
    .add('trim', box(8.2, 0.22, 4.8), [0, 4.85, 0])
    .add('trim', box(8.2, 0.42, 0.12), [0, 5.17, 2.34])
    .add('trim', box(8.2, 0.42, 0.12), [0, 5.17, -2.34])
    .add('trim', box(0.12, 0.42, 4.8), [4.04, 5.17, 0])
    .add('trim', box(0.12, 0.42, 4.8), [-4.04, 5.17, 0])
    .add('trim', box(7.95, 0.18, 0.32), [0, 2.4, 2.3])
    .add('paving', box(8.1, 0.2, 1), [0, 0.1, 2.7])
    .add('metal', box(1.1, 0.65, 0.8), [2.6, 5.29, -0.9])
    .add('metal', box(0.8, 0.5, 0.7), [1.3, 5.22, -1.1])
    .add('metal', new CylinderGeometry(0.5, 0.5, 0.9, 14), [-2.6, 5.41, -0.8])
    .add('metal', box(0.08, 4.6, 0.08), [3.98, 2.5, 2.25])
  for (const x of [-3.85, -1.25, 1.25, 3.85])
    parts.add('trim', box(0.22, 4.8, 0.12), [x, 2.4, 2.24])
  return parts.build()
}

export function buildBalcony() {
  const parts = new Parts<'trim' | 'metal'>()
  parts
    .add('trim', box(2.1, 0.1, 0.62), [0, -0.86, 0.3])
    .add('metal', box(2.1, 0.05, 0.05), [0, -0.38, 0.6])
    .add('metal', box(0.05, 0.45, 0.05), [-1.02, -0.6, 0.6])
    .add('metal', box(0.05, 0.45, 0.05), [1.02, -0.6, 0.6])
  for (let i = 1; i < 10; i++)
    parts.add('metal', box(0.025, 0.42, 0.025), [-1.02 + i * 0.204, -0.6, 0.6])
  return parts.build()
}

export type GroundKey =
  'grass' | 'road' | 'path' | 'paving' | 'water' | 'stone' | 'wood'

export const groundRects: [x: number, z: number, w: number, d: number][] = [
  [0, 0, 4, 43],
  [3, 0, 49, 3.8],
  [-13, 3, 3.4, 18],
  [8.2, 0, 2, 48],
  [15.6, 0, 2, 48],
  [21, -10, 2.8, 22],
  [-10, 10, 10, 7],
  [12, 0, 4.6, 62],
]

export function buildGround() {
  const parts = new Parts<GroundKey>()
  parts
    .add('grass', box(62, 0.3, 62), [2, -0.15, 0])
    .add('road', box(4, 0.03, 43), [0, 0.015, 0])
    .add('road', box(49, 0.04, 3.8), [3, 0.025, 0])
    .add('road', box(3.4, 0.04, 18), [-13, 0.025, 3])
    .add('path', box(2, 0.04, 48), [8.2, 0.02, 0])
    .add('path', box(2, 0.04, 48), [15.6, 0.02, 0])
    .add('path', box(2.8, 0.04, 22), [21, 0.025, -10])
    .add('paving', box(10, 0.04, 7), [-10, 0.03, 10])
    .add('water', box(4, 0.04, 62), [12, 0.025, 0])
  for (const x of [9.85, 14.15])
    for (const z of [-16.45, 16.45])
      parts.add('stone', box(0.3, 0.16, 29.1), [x, 0.08, z])
  parts.add('wood', box(5.6, 0.1, 3.8), [12, 0.09, 0])
  for (let i = 0; i < 8; i++)
    parts.add('stone', box(0.05, 0.015, 3.75), [9.6 + i * 0.7, 0.145, 0])
  return parts.build()
}

export function buildProps() {
  const parts = new Parts<'wood' | 'metal' | 'lamp'>()
  for (const side of [-1, 1]) {
    parts.add('wood', box(5.6, 0.12, 0.12), [12, 0.78, side * 1.9])
    for (const x of [9.5, 12, 14.5])
      parts.add('wood', box(0.15, 0.82, 0.15), [x, 0.41, side * 1.9])
  }
  for (const x of [-15, -9]) {
    parts
      .add('wood', box(2.2, 0.1, 0.62), [x, 0.55, 12])
      .add('wood', box(2.2, 0.5, 0.08), [x, 0.95, 11.72], [-0.15, 0, 0])
    for (const leg of [-0.8, 0.8])
      parts.add('metal', box(0.1, 0.5, 0.5), [x + leg, 0.25, 12])
  }
  for (const [x, z] of lampPositions) {
    parts
      .add('metal', new CylinderGeometry(0.05, 0.08, 2.5, 8), [x, 1.25, z])
      .add('metal', box(0.3, 0.06, 0.06), [x - Math.sign(x) * 0.12, 2.48, z])
      .add('lamp', box(0.26, 0.14, 0.22), [x - Math.sign(x) * 0.25, 2.4, z])
  }
  return parts.build()
}

export const lampPositions: [number, number][] = [
  [2.3, 12],
  [-2.3, 6],
  [2.3, -6],
  [-2.3, -12],
  [-14.9, 8],
  [-5.2, 13],
]

function hash(x: number, y: number, z: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return value - Math.floor(value)
}

export function lumpySphere(seed: number, detail = 2) {
  const source = new IcosahedronGeometry(1, detail)
  source.deleteAttribute('normal')
  source.deleteAttribute('uv')
  const geometry = mergeVertices(source)
  source.dispose()
  const position = geometry.getAttribute('position')
  const point = new Vector3()
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i)
    const bump =
      0.86 +
      hash(
        Math.round(point.x * 3) + seed,
        Math.round(point.y * 3),
        Math.round(point.z * 3),
      ) *
        0.26
    point.multiplyScalar(bump)
    position.setXYZ(i, point.x, point.y, point.z)
  }
  geometry.computeVertexNormals()
  return geometry
}
