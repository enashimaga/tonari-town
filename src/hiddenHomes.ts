export const hiddenHomesKey = 'tonari-town:hidden-owners:v1'

export function loadHiddenOwners(): Set<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(hiddenHomesKey) || '[]',
    )
    if (!Array.isArray(value)) return new Set()
    return new Set(
      value
        .filter(
          (id): id is string =>
            typeof id === 'string' && id.length > 0 && id.length <= 100,
        )
        .slice(0, 1000),
    )
  } catch {
    return new Set()
  }
}

export function saveHiddenOwners(owners: ReadonlySet<string>) {
  if (owners.size > 1000)
    throw new Error('非表示にできる住人は1,000人までです。')
  try {
    localStorage.setItem(hiddenHomesKey, JSON.stringify([...owners]))
  } catch {
    throw new Error(
      '非表示の設定を保存できませんでした。ブラウザのストレージ設定を確認してください。',
    )
  }
}
