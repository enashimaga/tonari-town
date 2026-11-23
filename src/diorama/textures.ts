import {
  CanvasTexture,
  LinearMipmapNearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'

export type TextureKind =
  'grain' | 'felt' | 'pavers' | 'planks' | 'roof' | 'siding' | 'strata'

const tileSize: Record<TextureKind, number> = {
  grain: 3,
  felt: 2,
  pavers: 1.6,
  planks: 1.2,
  roof: 0.9,
  siding: 1.2,
  strata: 4,
}

function random(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

function gray(level: number) {
  const value = Math.max(0, Math.min(255, Math.round(level)))
  return `rgb(${value},${value},${value})`
}

function speckle(
  context: CanvasRenderingContext2D,
  next: () => number,
  count: number,
  spread: number,
  base: number,
) {
  for (let i = 0; i < count; i++) {
    context.fillStyle = gray(base + (next() - 0.5) * spread)
    const size = 1 + next() * 2
    context.fillRect(next() * 256, next() * 256, size, size)
  }
}

const painters: Record<
  TextureKind,
  (context: CanvasRenderingContext2D, next: () => number) => void
> = {
  grain(context, next) {
    context.fillStyle = gray(222)
    context.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 40; i++) {
      context.fillStyle = gray(200 + next() * 50)
      context.globalAlpha = 0.35
      context.beginPath()
      context.arc(next() * 256, next() * 256, 8 + next() * 26, 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1
    speckle(context, next, 5000, 70, 220)
  },
  felt(context, next) {
    context.fillStyle = gray(215)
    context.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 9000; i++) {
      context.strokeStyle = gray(190 + next() * 65)
      const x = next() * 256
      const y = next() * 256
      const angle = next() * Math.PI
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4)
      context.stroke()
    }
  },
  pavers(context, next) {
    context.fillStyle = gray(150)
    context.fillRect(0, 0, 256, 256)
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 ? 32 : 0
      for (let col = -1; col < 4; col++) {
        context.fillStyle = gray(200 + next() * 45)
        context.fillRect(col * 64 + offset + 2, row * 32 + 2, 60, 28)
      }
    }
    speckle(context, next, 2500, 50, 210)
  },
  planks(context, next) {
    for (let row = 0; row < 8; row++) {
      context.fillStyle = gray(195 + next() * 40)
      context.fillRect(0, row * 32, 256, 32)
      context.fillStyle = gray(130)
      context.fillRect(0, row * 32, 256, 2)
      for (let line = 0; line < 6; line++) {
        context.strokeStyle = gray(170 + next() * 30)
        context.beginPath()
        const y = row * 32 + 4 + next() * 26
        context.moveTo(0, y)
        context.bezierCurveTo(80, y + next() * 4, 170, y - next() * 4, 256, y)
        context.stroke()
      }
    }
  },
  roof(context, next) {
    for (let row = 0; row < 8; row++) {
      const offset = row % 2 ? 16 : 0
      for (let col = -1; col < 9; col++) {
        const level = 200 + next() * 40
        const gradient = context.createLinearGradient(
          0,
          row * 32,
          0,
          row * 32 + 32,
        )
        gradient.addColorStop(0, gray(level - 40))
        gradient.addColorStop(0.35, gray(level))
        gradient.addColorStop(1, gray(level - 15))
        context.fillStyle = gradient
        context.fillRect(col * 32 + offset, row * 32, 31, 32)
      }
      context.fillStyle = gray(110)
      context.fillRect(0, row * 32 + 30, 256, 2)
    }
  },
  siding(context, next) {
    context.fillStyle = gray(232)
    context.fillRect(0, 0, 256, 256)
    for (let row = 0; row < 12; row++) {
      const gradient = context.createLinearGradient(
        0,
        row * 21.3,
        0,
        row * 21.3 + 21.3,
      )
      gradient.addColorStop(0, gray(205))
      gradient.addColorStop(0.2, gray(240))
      gradient.addColorStop(1, gray(228))
      context.fillStyle = gradient
      context.fillRect(0, row * 21.3, 256, 21.3)
    }
    speckle(context, next, 1500, 30, 230)
  },
  strata(context, next) {
    const bands = ['#5a4636', '#6d5440', '#4b3a2e', '#7b6248', '#5f4a39']
    let y = 0
    while (y < 256) {
      const height = 18 + next() * 40
      context.fillStyle = bands[Math.floor(next() * bands.length)]
      context.fillRect(0, y, 256, height)
      y += height
    }
    for (let i = 0; i < 260; i++) {
      context.fillStyle = next() > 0.5 ? '#8a7a66' : '#3c2f25'
      context.beginPath()
      context.arc(next() * 256, next() * 256, 1 + next() * 3, 0, Math.PI * 2)
      context.fill()
    }
    context.fillStyle = '#4f6b37'
    context.fillRect(0, 0, 256, 10)
  },
}

const cache = new Map<TextureKind, CanvasTexture>()

export function texture(kind: TextureKind) {
  const cached = cache.get(kind)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!
  painters[kind](context, random(kind.length * 7919 + 17))
  const result = new CanvasTexture(canvas)
  result.wrapS = result.wrapT = RepeatWrapping
  result.repeat.setScalar(1 / tileSize[kind])
  result.colorSpace = SRGBColorSpace
  result.minFilter = LinearMipmapNearestFilter
  cache.set(kind, result)
  return result
}
