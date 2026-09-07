import { example, type Partner } from './partner'

export type Home = {
  owner_id: string
  district: number
  plot: number
  partner: Partner
  published: boolean
}
export const plots = Array.from({ length: 12 }, (_, i) => ({
  x: i % 2 === 0 ? -4 : 4,
  z: 15 - Math.floor(i / 2) * 6,
}))
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
