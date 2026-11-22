import { expect, test } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import { example } from '../src/partner'

test('legal links navigate to Japanese pages with direct SPA access', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const textarea = page.getByLabel('1. 台詞のJSONを貼り付ける')
  const draft = JSON.stringify({ ...example, partnerName: '未保存の台詞' })
  await textarea.fill(draft)
  await page.getByRole('button', { name: '台詞を確認する' }).click()
  for (const link of await page.locator('.legal-links a').all()) {
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  const termsOpened = context.waitForEvent('page')
  await page
    .getByRole('link', { name: '利用規約', exact: true })
    .first()
    .click()
  const legalPage = await termsOpened
  await expect(legalPage).toHaveURL(/\/terms$/)
  await expect(
    legalPage.getByRole('heading', { name: '利用規約', exact: true }),
  ).toBeVisible()
  await expect(legalPage.getByRole('main')).toContainText('日本法')
  await expect(legalPage.getByRole('main')).toContainText('【お問い合わせ先】')
  await legalPage
    .getByRole('link', { name: 'プライバシーポリシー', exact: true })
    .click()
  await expect(legalPage).toHaveURL(/\/privacy$/)
  await expect(legalPage.getByRole('main')).toContainText('localStorage')
  await expect(legalPage.getByRole('main')).toContainText('owner_id')
  await expect(legalPage.getByRole('main')).toContainText('Cloudflare')
  await legalPage.getByRole('link', { name: '街に戻る', exact: true }).click()
  await expect(legalPage).toHaveURL(/\/$/)
  await legalPage.close()
  await expect(page).toHaveURL(/\/$/)
  const privacyOpened = context.waitForEvent('page')
  await page
    .locator('footer')
    .getByRole('link', { name: 'プライバシーポリシー', exact: true })
    .click()
  const privacyPage = await privacyOpened
  await expect(privacyPage).toHaveURL(/\/privacy$/)
  await privacyPage.close()
  await expect(page).toHaveURL(/\/$/)
  await expect(textarea).toHaveValue(draft)
  await expect(page.getByLabel('公開前の台詞プレビュー')).toContainText(
    '未保存の台詞',
  )
  for (const [path, title] of [
    ['/terms', '利用規約'],
    ['/privacy', 'プライバシーポリシー'],
  ]) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: `test-results/${test.info().project.name}-${path.slice(1)}.png`,
      fullPage: true,
    })
  }
  expect(errors).toEqual([])
})

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

test('hides a resident locally without releasing their plot and restores them', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.locator('.bubble').filter({ hasText: 'ハル' }),
  ).toBeVisible()
  await page.getByText('住人の表示設定', { exact: true }).click()
  await page.getByRole('button', { name: 'ハルを非表示にする' }).click()
  await expect(page.locator('.bubble').filter({ hasText: 'ハル' })).toHaveCount(
    0,
  )
  await expect(page.locator('#plot option[value="0"]')).toBeDisabled()
  await page.reload()
  await expect(
    page.getByRole('region', { name: '散歩できる3Dの街' }),
  ).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('.bubble').filter({ hasText: 'ハル' })).toHaveCount(
    0,
  )
  await page.getByText('住人の表示設定（1人を非表示）', { exact: true }).click()
  await page.getByRole('button', { name: '非表示をすべて解除' }).click()
  await expect(
    page.locator('.bubble').filter({ hasText: 'ハル' }),
  ).toBeVisible()
})

test('moves sideways and saves an apartment room across reloads', async ({
  page,
}) => {
  await page.goto('/')
  const town = page.getByRole('region', { name: '散歩できる3Dの街' })
  await expect(town).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: '右へ歩く', exact: true }).click()
  await expect
    .poll(async () => Number(await town.getAttribute('data-position-x')))
    .toBeGreaterThan(1)
  await page.getByLabel('2. 家を置く場所').selectOption('12')
  await page.getByRole('button', { name: '台詞を確認する' }).click()
  await page.getByRole('button', { name: 'このブラウザに家を保存' }).click()
  await expect(page.getByRole('status')).toContainText('このブラウザに保存')
  await page.reload()
  await expect(page.getByLabel('2. 家を置く場所')).toHaveValue('12')
  await page.getByLabel('2. 家を置く場所').selectOption('1')
  await expect(
    page.getByText(
      '保存すると今の住まいから引っ越します。一人につき一軒です。',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: '台詞を確認する' }).click()
  await page.getByRole('button', { name: 'このブラウザに家を保存' }).click()
  await expect(page.getByRole('status')).toContainText('このブラウザに保存')
  await page.reload()
  await expect(page.getByLabel('2. 家を置く場所')).toHaveValue('1')
})

test('selects lots and apartment windows directly on the canvas', async ({
  page,
}) => {
  await page.goto('/')
  const town = page.getByRole('region', { name: '散歩できる3Dの街' })
  const canvas = page.locator('canvas')
  await expect(town).toHaveAttribute('data-ready', 'true')
  const walk = async (name: string, axis: string, value: number) => {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(town).toHaveAttribute(axis, value.toFixed(1))
  }
  const clickWorld = async (x: number, y: number, z: number) => {
    await canvas.scrollIntoViewIfNeeded()
    // The fixed camera eases into place after the walker stops.
    await page.waitForTimeout(600)
    const box = (await canvas.boundingBox())!
    const walkerX = Number(await town.getAttribute('data-position-x'))
    const walkerZ = Number(await town.getAttribute('data-position'))
    const camera = new PerspectiveCamera(48, box.width / box.height, 0.1, 95)
    camera.position.set(walkerX, 13, walkerZ + 15)
    camera.lookAt(walkerX, 0, walkerZ - 3)
    camera.updateMatrixWorld()
    const point = new Vector3(x, y, z).project(camera)
    await canvas.click({
      position: {
        x: ((point.x + 1) * box.width) / 2,
        y: ((1 - point.y) * box.height) / 2,
      },
    })
  }

  await walk('奥へ歩く', 'data-position', 12)
  await clickWorld(-4, 0.85, 9.8)
  await expect(page.locator('#plot')).toHaveValue('2')
  await walk('奥へ歩く', 'data-position', 6)
  await walk('奥へ歩く', 'data-position', 0)
  await walk('左へ歩く', 'data-position-x', -6)
  await walk('左へ歩く', 'data-position-x', -12)
  await clickWorld(-13, 3.55, -4.62)
  await expect(page.locator('#plot')).toHaveValue('16')
  await expect(
    page.getByRole('button', { name: '自分の家を削除する' }),
  ).toHaveCount(0)
})
