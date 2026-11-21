import { describe, expect, it } from 'vitest'
import { canWalk, moveToward, plots } from '../src/world'

describe('town walking', () => {
  it('keeps the original twelve home coordinates and adds six apartment rooms', () => {
    expect(plots.slice(0, 12).map(({ x, z }) => ({ x, z }))).toEqual(
      Array.from({ length: 12 }, (_, i) => ({
        x: i % 2 === 0 ? -4 : 4,
        z: 15 - Math.floor(i / 2) * 6,
      })),
    )
    expect(plots.slice(12).map((plot) => plot.label)).toEqual([
      'こもれび荘 101号室',
      'こもれび荘 102号室',
      'こもれび荘 103号室',
      'こもれび荘 201号室',
      'こもれび荘 202号室',
      'こもれび荘 203号室',
    ])
  })

  it('walks diagonally at the same speed and stops at the target', () => {
    const next = moveToward({ x: 0, z: 0 }, { x: 10, z: 10 }, 0.1)
    expect(Math.hypot(next.x, next.z)).toBeCloseTo(0.5)
    expect(moveToward({ x: 0, z: 0 }, { x: 0.1, z: 0.1 }, 0.1)).toEqual({
      x: 0.1,
      z: 0.1,
    })
  })

  it('blocks the river but allows crossing the bridge', () => {
    let river = { x: 9, z: 6 }
    let bridge = { x: 9, z: 0 }
    for (let frame = 0; frame < 100; frame++) {
      river = moveToward(river, { x: 17, z: 6 }, 0.1)
      bridge = moveToward(bridge, { x: 17, z: 0 }, 0.1)
    }
    expect(river.x).toBeLessThanOrEqual(9.6)
    expect(bridge.x).toBe(17)
    expect(canWalk({ x: 12, z: 6 })).toBe(false)
  })

  it('blocks occupied homes and the permanent apartment, but allows vacant lots', () => {
    expect(canWalk({ x: -4, z: 15 }, [0])).toBe(false)
    expect(canWalk({ x: -4, z: 15 })).toBe(true)
    expect(canWalk({ x: -13, z: -7 })).toBe(false)
    let position = { x: 0, z: 15 }
    for (let frame = 0; frame < 20; frame++)
      position = moveToward(position, { x: -4, z: 15 }, 0.1, [0])
    expect(position.x).toBeGreaterThanOrEqual(-2.25)
  })

  it('keeps walkers within the map and caps delayed frames', () => {
    expect(moveToward({ x: 0, z: 0 }, { x: 0, z: -100 }, 30).z).toBeCloseTo(
      -0.5,
    )
    let position = { x: 0, z: 21.9 }
    for (let frame = 0; frame < 10; frame++)
      position = moveToward(position, { x: 0, z: 100 }, 0.1)
    expect(position.z).toBeLessThanOrEqual(22)
    expect(moveToward(position, { x: NaN, z: 0 }, 0.1)).toEqual(position)
  })
})
