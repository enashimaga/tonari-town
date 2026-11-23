export type Look = {
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
  }
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

// Hand-built model houses and materials on a wooden plinth, photographed like a
// miniature: warm low sun and a tilt-shift focus band that follows the walker.
export const look: Look = {
  background: '#dfe6df',
  fog: ['#dfe6df', 42, 88],
  exposure: 1.05,
  sun: { color: '#fff0d4', intensity: 3.4, position: [-14, 20, 16] },
  hemisphere: { sky: '#dfeaff', ground: '#8b7b5d', intensity: 1.5 },
  post: { blur: 12, band: 0.1, vignette: 0.45, saturation: 1.22 },
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
}
