import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.auth.e2e.ts',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'off',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://session-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TEST_ONLY',
    },
  },
})
