import { expect, test } from '@playwright/test'

const storageKey = 'sb-session-test-auth-token'
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'fictional@example.invalid',
  app_metadata: { provider: 'x' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
function session(expiresAt: number) {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, exp: expiresAt }),
  ).toString('base64url')
  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test_signature`,
    refresh_token: 'fictional-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user,
  }
}

for (const expired of [false, true]) {
  test(`stored session survives revisits (${expired ? 'expired' : 'valid'})`, async ({
    context,
    page,
  }) => {
    let refreshes = 0
    let authorizations = 0
    await context.route(
      'https://session-test.supabase.co/**',
      async (route) => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/authorize')) authorizations++
        if (url.pathname.endsWith('/token')) {
          refreshes++
          expect(url.searchParams.get('grant_type')).toBe('refresh_token')
          await route.fulfill({
            json: session(Math.floor(Date.now() / 1000) + 3600),
          })
        } else if (url.pathname.endsWith('/user')) {
          await route.fulfill({ json: user })
        } else if (url.pathname.endsWith('/logout')) {
          await route.fulfill({ status: 204 })
        } else if (url.pathname === '/rest/v1/homes') {
          await route.fulfill({ json: [] })
        } else {
          await route.abort()
        }
      },
    )
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'Xでログイン' }),
    ).toBeEnabled()
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      {
        key: storageKey,
        value: session(Math.floor(Date.now() / 1000) + (expired ? -120 : 3600)),
      },
    )
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'ログアウト', exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'ログアウト', exact: true }),
    ).toBeVisible()
    await page.close()
    const reopened = await context.newPage()
    await reopened.goto('/')
    await expect(
      reopened.getByRole('button', { name: 'ログアウト', exact: true }),
    ).toBeVisible()
    expect(refreshes).toBe(expired ? 1 : 0)
    expect(authorizations).toBe(0)
    await reopened
      .getByRole('button', { name: 'ログアウト', exact: true })
      .click()
    await expect(
      reopened.getByRole('button', { name: 'Xでログイン' }),
    ).toBeEnabled()
    await reopened.reload()
    await expect(
      reopened.getByRole('button', { name: 'Xでログイン' }),
    ).toBeEnabled()
    expect(
      await reopened.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBeNull()
  })
}
