import { describe, expect, it } from 'vitest'
import { example, parsePartner, pickLine } from '../src/partner'
import { walkToward } from '../src/world'

describe('JSON input', () => {
  it('accepts AI code fences and preserves literal text', () => {
    const value = {
      ...example,
      lines: [{ scene: 'anytime', text: '<img src=x onerror=alert(1)>' }],
    }
    expect(parsePartner('```json\n' + JSON.stringify(value) + '\n```')).toEqual(
      value,
    )
  })
  it.each([
    'not json',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...example, version: 2 }),
    JSON.stringify({ ...example, partnerName: '   ' }),
    JSON.stringify({ ...example, partnerName: 'a'.repeat(41) }),
    JSON.stringify({ ...example, lines: [] }),
    JSON.stringify({ ...example, lines: Array(31).fill(example.lines[0]) }),
    JSON.stringify({ ...example, lines: [{ text: 'hello' }] }),
    JSON.stringify({ ...example, lines: [{ scene: 'noon', text: 'hello' }] }),
    JSON.stringify({
      ...example,
      lines: [{ scene: 'day', text: 'a'.repeat(161) }],
    }),
    JSON.stringify({ ...example, lines: [{ scene: 'day', text: '\n\t' }] }),
    JSON.stringify({ ...example, owner_id: 'someone-else' }),
    ' '.repeat(16385),
  ])('rejects malformed, unexpected, or oversized input (%#)', (input) => {
    expect(() => parsePartner(input)).toThrow()
  })
  it('counts Unicode characters rather than UTF-16 code units', () => {
    const value = { ...example, partnerName: '🌱'.repeat(40) }
    expect(parsePartner(JSON.stringify(value))).toEqual(value)
  })
  it('selects matching lines and has a fallback when a time has no lines', () => {
    expect(pickLine(example, 8, 1)).toBe(example.lines[1].text)
    expect(pickLine(example, 14, 1)).toBe(example.lines[2].text)
    expect(pickLine({ ...example, lines: [example.lines[3]] }, 8, 0)).toBe(
      example.lines[3].text,
    )
  })
})

describe('walking', () => {
  it('does not overshoot or leave the street after a delayed frame', () => {
    expect(walkToward(0, 0.1, 1)).toBe(0.1)
    expect(walkToward(0, 10, 10)).toBe(0.5)
    expect(walkToward(19, 100, 1)).toBe(19)
    expect(walkToward(-19, -100, 1)).toBe(-19)
  })
})
