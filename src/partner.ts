export const scenes = ['anytime', 'morning', 'day', 'night'] as const
export type Scene = (typeof scenes)[number]
export type Partner = {
  version: 1
  partnerName: string
  lines: { scene: Scene; text: string }[]
}
export const maxInputBytes = 16384
export const example: Partner = {
  version: 1,
  partnerName: 'ハル',
  lines: [
    { scene: 'anytime', text: '窓を開けたら、いい風が入ってきたよ。' },
    { scene: 'morning', text: 'おはよう。お茶、もうすぐ淹れられるよ。' },
    { scene: 'day', text: '帰り道に、川沿いを歩いてみようか。' },
    { scene: 'night', text: '今日の続きは、また明日にしよう。' },
  ],
}
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const length = (value: string) => Array.from(value).length

export function validatePartner(value: unknown): Partner {
  if (!isObject(value) || value.version !== 1)
    throw new Error('version は 1 にしてください。')
  if (
    Object.keys(value).some(
      (key) => !['version', 'partnerName', 'lines'].includes(key),
    )
  ) {
    throw new Error('使える項目は version・partnerName・lines です。')
  }
  if (
    typeof value.partnerName !== 'string' ||
    !value.partnerName.trim() ||
    length(value.partnerName) > 40
  ) {
    throw new Error('名前は空白だけにせず、1〜40文字にしてください。')
  }
  if (
    !Array.isArray(value.lines) ||
    value.lines.length < 1 ||
    value.lines.length > 30
  ) {
    throw new Error('台詞は1〜30件にしてください。')
  }
  for (const line of value.lines) {
    if (
      !isObject(line) ||
      Object.keys(line).some((key) => !['scene', 'text'].includes(key)) ||
      !scenes.includes(line.scene as Scene) ||
      typeof line.text !== 'string' ||
      !line.text.trim() ||
      length(line.text) > 160
    ) {
      throw new Error(
        '各台詞には正しい scene と、空白だけではない1〜160文字の text が必要です。',
      )
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > maxInputBytes) {
    throw new Error('JSONは16KB以内にしてください。')
  }
  return value as Partner
}

export function parsePartner(input: string): Partner {
  if (new TextEncoder().encode(input).length > maxInputBytes)
    throw new Error('JSONは16KB以内にしてください。')
  const source = input
    .trim()
    .replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1')
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new Error(
      'JSONの形式を読み取れませんでした。括弧や引用符を確認してください。',
    )
  }
  return validatePartner(parsed)
}

export function currentScene(hour: number): Scene {
  return hour >= 5 && hour < 11
    ? 'morning'
    : hour >= 11 && hour < 18
      ? 'day'
      : 'night'
}

export function pickLine(
  partner: Partner,
  hour: number,
  index: number,
): string {
  const candidates = partner.lines.filter(
    (line) => line.scene === 'anytime' || line.scene === currentScene(hour),
  )
  const lines = candidates.length ? candidates : partner.lines
  return lines[index % lines.length].text
}
