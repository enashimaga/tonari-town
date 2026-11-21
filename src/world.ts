import { example, type Partner } from './partner'

export type Home = {
  owner_id: string
  district: number
  plot: number
  partner: Partner
  published: boolean
}
export type Plot = {
  x: number
  z: number
  label: string
  kind: 'house' | 'apartment'
  floor?: number
  room?: number
}
export const apartment = { x: -13, z: -7 }
export const plots: Plot[] = [
  ...Array.from({ length: 12 }, (_, i): Plot => ({
    x: i % 2 === 0 ? -4 : 4,
    z: 15 - Math.floor(i / 2) * 6,
    label: `こもれび通り ${i + 1}番地`,
    kind: 'house',
  })),
  ...Array.from({ length: 6 }, (_, i): Plot => ({
    ...apartment,
    label: `こもれび荘 ${Math.floor(i / 3) + 1}0${(i % 3) + 1}号室`,
    kind: 'apartment',
    floor: Math.floor(i / 3) + 1,
    room: (i % 3) + 1,
  })),
]
export type Position = { x: number; z: number }
export const townBounds = { minX: -22, maxX: 27, minZ: -24, maxZ: 22 }
export function canWalk(
  position: Position,
  occupiedPlots: readonly number[] = [],
) {
  const { x, z } = position
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false
  if (
    x < townBounds.minX ||
    x > townBounds.maxX ||
    z < townBounds.minZ ||
    z > townBounds.maxZ
  )
    return false
  if (x > 9.6 && x < 14.4 && Math.abs(z) > 1.55) return false
  if (Math.abs(x - apartment.x) < 4.3 && Math.abs(z - apartment.z) < 2.6)
    return false
  return !occupiedPlots.some((index) => {
    const plot = plots[index]
    return (
      plot?.kind === 'house' &&
      Math.abs(x - plot.x) < 1.75 &&
      Math.abs(z - plot.z) < 1.75
    )
  })
}
export function moveToward(
  position: Position,
  target: Position,
  delta: number,
  occupiedPlots: readonly number[] = [],
): Position {
  const dx = target.x - position.x
  const dz = target.z - position.z
  const distance = Math.hypot(dx, dz)
  if (
    !distance ||
    !Number.isFinite(distance) ||
    !Number.isFinite(delta) ||
    delta <= 0
  )
    return position
  const step = Math.min(distance, 5 * Math.min(delta, 0.1))
  const next = { ...position }
  // Small steps keep narrow obstacles solid even when a frame arrives late.
  const count = Math.ceil(step / 0.1)
  for (let i = 0; i < count; i++) {
    const xStep = { x: next.x + ((dx / distance) * step) / count, z: next.z }
    if (canWalk(xStep, occupiedPlots)) next.x = xStep.x
    const zStep = { x: next.x, z: next.z + ((dz / distance) * step) / count }
    if (canWalk(zStep, occupiedPlots)) next.z = zStep.z
  }
  return next
}
export const demoHomes: Home[] = [
  {
    owner_id: 'demo-haru',
    district: 0,
    plot: 0,
    partner: example,
    published: true,
  },
  {
    owner_id: 'demo-nagi',
    district: 0,
    plot: 3,
    partner: {
      version: 1,
      partnerName: 'ナギ',
      lines: [
        { scene: 'anytime', text: 'スープ、少し多く作りすぎちゃったね。' },
        { scene: 'anytime', text: 'あの雲、さっきより丸くなった気がする。' },
      ],
    },
    published: true,
  },
  {
    owner_id: 'demo-sora',
    district: 0,
    plot: 6,
    partner: {
      version: 1,
      partnerName: 'ソラ',
      lines: [
        { scene: 'anytime', text: 'この本、あとで一緒に読もう。' },
        { scene: 'anytime', text: '今日は少し遠回りして帰ろうか。' },
      ],
    },
    published: true,
  },
]
export const demoOwner = 'local-preview'
export function walkToward(z: number, target: number, delta: number) {
  const distance = Math.min(Math.abs(target - z), 5 * Math.min(delta, 0.1))
  return Math.max(-19, Math.min(19, z + Math.sign(target - z) * distance))
}
