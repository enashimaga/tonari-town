import {
  Color,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Material,
} from 'three'
import type { Finish, Look } from '../looks'
import { texture, type TextureKind } from './textures'

type SurfaceOptions = {
  roughness?: number
  metalness?: number
  kind?: TextureKind
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
}

function surface(color: string, options: SurfaceOptions = {}) {
  const map = options.kind ? texture(options.kind) : null
  const roughness = options.roughness ?? 0.8
  const metalness = options.metalness ?? 0
  // Rough dielectrics show almost no highlight, so the cheaper Lambert model
  // looks the same while sparing most of the per-pixel cost on large surfaces.
  const diffuseOnly = roughness >= 0.85 && metalness === 0
  return new (diffuseOnly ? MeshLambertMaterial : MeshStandardMaterial)({
    color,
    ...(diffuseOnly ? {} : { roughness, metalness }),
    map,
    emissive: options.emissive ?? '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    depthWrite: !options.transparent,
  })
}

const kinds: Record<
  Finish,
  {
    grass: TextureKind
    wall?: TextureKind
    roof?: TextureKind
    road: TextureKind
    wood?: TextureKind
    roughness: number
  }
> = {
  smooth: { grass: 'grain', road: 'pavers', roughness: 0.55 },
  crafted: {
    grass: 'felt',
    wall: 'grain',
    roof: 'roof',
    road: 'grain',
    wood: 'planks',

    roughness: 0.95,
  },
  real: {
    grass: 'grain',
    wall: 'siding',
    roof: 'roof',
    road: 'pavers',
    wood: 'planks',

    roughness: 0.75,
  },
}

export function createMaterials(look: Look, night: boolean) {
  const p = look.palette
  const k = kinds[look.finish]
  const r = k.roughness
  const textured = (
    color: string,
    kind: TextureKind | undefined,
    roughness = r,
  ) => surface(color, { kind, roughness })
  const glow = night ? 1.5 : 0
  return {
    grass: textured(p.grass, k.grass, 0.95),
    lawn: textured(p.lawn, k.grass, 0.95),
    hedge: textured(p.hedge, look.finish === 'crafted' ? 'felt' : 'grain', 0.9),
    road: textured(p.road, k.road, 0.9),
    path: textured(p.path, 'grain', 0.95),
    paving: textured(p.paving, 'pavers', 0.85),
    water: surface(p.water, {
      roughness: look.finish === 'crafted' ? 0.03 : 0.08,
      metalness: 0.15,
    }),
    stone: textured(p.stone, 'grain', 0.9),
    wood: textured(p.wood, k.wood ?? 'planks', 0.8),
    metal: surface('#4f5754', { roughness: 0.45, metalness: 0.6 }),
    lamp: surface('#fff3cf', {
      roughness: 0.3,
      emissive: '#ffd98f',
      emissiveIntensity: night ? 3 : 0.25,
    }),
    foundation: textured('#a9a397', 'grain', 0.9),
    trim: surface(p.trim, { roughness: Math.min(r, 0.6) }),
    door: textured(p.door, k.wood, 0.6),
    glass: surface('#9db7c3', {
      roughness: 0.06,
      metalness: 0.7,
      emissive: '#ffcf87',
      emissiveIntensity: glow,
    }),
    walls: p.walls.map((color) => textured(color, k.wall)),
    roofs: p.roofs.map((color) =>
      textured(color, k.roof, Math.max(r - 0.15, 0.35)),
    ),
    ghostWall: surface(p.walls[0], { transparent: true, opacity: 0.4 }),
    ghostRoof: surface(p.roofs[0], { transparent: true, opacity: 0.4 }),
    plotVacant: textured(
      new Color(p.path).multiplyScalar(0.85).getStyle(),
      'grain',
      0.95,
    ),
    plotSelected: surface('#e2bd5c', {
      roughness: 0.6,
      emissive: '#7a5a10',
      emissiveIntensity: 0.25,
    }),
    signPost: textured('#8f775b', k.wood),
    signBoard: surface('#f4edda', { roughness: 0.7 }),
    apartment: textured(p.apartment, k.wall === 'siding' ? 'grain' : k.wall),
    apartmentTrim: surface(p.apartmentTrim, { roughness: Math.min(r, 0.6) }),
    apartmentFrame: surface('#7d7466', { roughness: 0.5, metalness: 0.3 }),
    apartmentFrameSelected: surface('#e7bb58', {
      roughness: 0.5,
      emissive: '#7a5a10',
      emissiveIntensity: 0.35,
    }),
    windowLit: surface('#f1e3ac', {
      roughness: 0.25,
      emissive: '#ffc970',
      emissiveIntensity: night ? 1.6 : 0.12,
    }),
    trunk: textured(
      p.trunk,
      look.finish === 'crafted' ? 'planks' : 'grain',
      0.9,
    ),
    leaves: textured(
      '#ffffff',
      look.finish === 'crafted' ? 'felt' : 'grain',
      0.85,
    ),
    tuft: surface('#ffffff', { roughness: 0.9 }),
    flower: surface('#ffffff', { roughness: 0.6 }),
    plinthSide: surface('#ffffff', {
      kind: 'strata',
      roughness: 0.95,
    }),
    plinthFrame: surface('#5a3f2c', {
      kind: 'planks',
      roughness: 0.55,
    }),
  }
}

export type Materials = ReturnType<typeof createMaterials>

export function disposeMaterials(materials: Materials) {
  for (const value of Object.values(materials))
    (Array.isArray(value) ? value : [value]).forEach((material: Material) =>
      material.dispose(),
    )
}
