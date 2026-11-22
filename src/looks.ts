export type LookId = 'miniature' | 'model' | 'daylight'
export type Finish = 'smooth' | 'crafted' | 'real'

export type Look = {
  label: string
  note: string
  finish: Finish
  background: string
  fog: [color: string, near: number, far: number]
  exposure: number
  sun: { color: string; intensity: number; position: [number, number, number] }
  hemisphere: { sky: string; ground: string; intensity: number }
  post: {
    blur: number
    band: number
    vignette: number
    saturation: number
  } | null
  plinth: boolean
  palette: {
    walls: string[]
    roofs: string[]
    trim: string
    door: string
    grass: string
    lawn: string
    hedge: string
    road: string
    path: string
    paving: string
    water: string
    stone: string
    wood: string
    leaves: string[]
    trunk: string
    apartment: string
    apartmentTrim: string
  }
}

export const looks: Record<LookId, Look> = {
  miniature: {
    label: 'ミニチュア写真',
    note: '上下をぼかした移動ピントと、斜めの日差しで「本物の街を小さく撮った」写真風に。',
    finish: 'smooth',
    background: '#dfe6df',
    fog: ['#dfe6df', 42, 88],
    exposure: 1.05,
    sun: { color: '#fff0d4', intensity: 3.4, position: [-14, 20, 16] },
    hemisphere: { sky: '#dfeaff', ground: '#8b7b5d', intensity: 1.5 },
    post: { blur: 12, band: 0.1, vignette: 0.45, saturation: 1.22 },
    plinth: false,
    palette: {
      walls: ['#f3dcc4', '#d3e3c8', '#f4e5b8', '#cde0e8'],
      roofs: ['#b9573f', '#3f6d8a', '#4f7a57', '#8b4a3b'],
      trim: '#fbf7ee',
      door: '#7a5238',
      grass: '#86b45c',
      lawn: '#97c266',
      hedge: '#4f8a42',
      road: '#dcd3c0',
      path: '#cdb68f',
      paving: '#d8cbb3',
      water: '#4c9fb2',
      stone: '#b9b2a4',
      wood: '#a77b52',
      leaves: ['#5e9944', '#7bb24f', '#4a8648'],
      trunk: '#7a5638',
      apartment: '#e4d6c2',
      apartmentTrim: '#f7f2e8',
    },
  },
  model: {
    label: '手作り模型',
    note: '木の台座に載った展示用ジオラマ。紙・フェルト・木目の質感と、スタジオ照明で。',
    finish: 'crafted',
    background: '#2e2b28',
    fog: ['#2e2b28', 70, 130],
    exposure: 1,
    sun: { color: '#ffe8c8', intensity: 3, position: [10, 26, 9] },
    hemisphere: { sky: '#fff4e2', ground: '#3b3129', intensity: 1.15 },
    post: { blur: 6, band: 0.2, vignette: 0.9, saturation: 1.05 },
    plinth: true,
    palette: {
      walls: ['#ebdfc9', '#d6caae', '#cbd3bf', '#e5ccb2'],
      roofs: ['#8f5b44', '#5e6c71', '#7c6b50', '#6f805d'],
      trim: '#f2ebdc',
      door: '#6c4c36',
      grass: '#93a85f',
      lawn: '#a2b56a',
      hedge: '#62804a',
      road: '#cfc3aa',
      path: '#bda784',
      paving: '#c8bca4',
      water: '#4f8086',
      stone: '#a8a194',
      wood: '#b08a62',
      leaves: ['#6f8f4a', '#8ea65a', '#5d7d44'],
      trunk: '#6b4f3a',
      apartment: '#ddd1bc',
      apartmentTrim: '#efe7d8',
    },
  },
  daylight: {
    label: 'フォトリアル昼景',
    note: '石畳・瓦・ガラスの反射など素材感を写実寄りに。ぼかしなしで一番軽い表示。',
    finish: 'real',
    background: '#cfdae2',
    fog: ['#cfdae2', 32, 82],
    exposure: 1.05,
    sun: { color: '#fffaf0', intensity: 3.1, position: [16, 30, 8] },
    hemisphere: { sky: '#bdd5ee', ground: '#6c6a56', intensity: 1.6 },
    post: null,
    plinth: false,
    palette: {
      walls: ['#ece6da', '#d9d3c5', '#cbbba4', '#e2dccf'],
      roofs: ['#41474b', '#5c3b31', '#4b5046', '#6c6356'],
      trim: '#f4f2ec',
      door: '#4e3b2e',
      grass: '#6f994e',
      lawn: '#7ca657',
      hedge: '#3f6b35',
      road: '#9c9a94',
      path: '#b7a27f',
      paving: '#c3bcae',
      water: '#3c6d77',
      stone: '#9d978b',
      wood: '#8b6a4c',
      leaves: ['#4d7a3a', '#5f8a40', '#3f6a35'],
      trunk: '#5a4535',
      apartment: '#d8d3c8',
      apartmentTrim: '#efede7',
    },
  },
}

export const lookIds = Object.keys(looks) as LookId[]

function isLookId(value: string | null): value is LookId {
  return !!value && value in looks
}

export function initialLook(): LookId {
  const requested = new URLSearchParams(window.location.search).get('look')
  return isLookId(requested) ? requested : 'miniature'
}

export function rememberLook(id: LookId) {
  const url = new URL(window.location.href)
  url.searchParams.set('look', id)
  window.history.replaceState(window.history.state, '', url)
}
