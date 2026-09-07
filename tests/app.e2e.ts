import { expect, test } from '@playwright/test'
import { example } from '../src/partner'

test('renders 3D, walks, validates JSON, saves locally, and reloads', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const town = page.getByRole('region', { name: '散歩できる3Dの街' })
  await expect(town).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('.bubble').first()).toBeVisible()
  await page.getByRole('button', { name: '奥へ歩く' }).click()
  await expect
    .poll(async () => Number(await town.getAttribute('data-position')))
    .toBeLessThan(13)
  const textarea = page.getByLabel('1. 台詞のJSONを貼り付ける')
  await textarea.fill('{broken')
  await page.getByRole('button', { name: '台詞を確認する' }).click()
  await expect(page.getByRole('alert')).toContainText('JSONの形式')
  await expect(
    page.getByRole('button', { name: 'このブラウザに家を保存' }),
  ).toBeDisabled()
  const payload = {
    ...example,
    partnerName: 'テストの住人',
    lines: [{ scene: 'anytime', text: '<img src=x onerror=alert(1)>' }],
  }
  await textarea.fill('```json\n' + JSON.stringify(payload) + '\n```')
  await page.getByRole('button', { name: '台詞を確認する' }).click()
  await expect(page.getByLabel('公開前の台詞プレビュー')).toContainText(
    payload.lines[0].text,
  )
  await expect(
    page.getByLabel('公開前の台詞プレビュー').locator('img'),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'このブラウザに家を保存' }).click()
  await expect(page.getByRole('status')).toContainText('このブラウザに保存')
  await page.reload()
  await expect(textarea).toContainText('テストの住人')
  await page.getByRole('button', { name: '自分の家を削除する' }).click()
  await expect(page.getByRole('status')).toContainText('削除しました')
  await page.reload()
  await expect(
    page.getByRole('button', { name: '自分の家を削除する' }),
  ).toHaveCount(0)
  expect(errors).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await expect(town).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('.bubble').first()).toBeVisible()
  const bubbleBox = await page.locator('.bubble').first().boundingBox()
  const townBox = await town.boundingBox()
  expect(bubbleBox!.x).toBeGreaterThanOrEqual(townBox!.x)
  expect(bubbleBox!.x + bubbleBox!.width).toBeLessThanOrEqual(
    townBox!.x + townBox!.width,
  )
  await page.screenshot({
    path: `test-results/${test.info().project.name}-town.png`,
    fullPage: true,
  })
})

test('serves the OAuth callback route through the SPA fallback', async ({
  page,
}) => {
  const response = await page.goto('/auth/callback')
  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', { name: /となりの日常を、/ }),
  ).toBeVisible()
})
