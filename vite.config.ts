import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const allowed = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']
  if (Object.keys(env).some((name) => !allowed.includes(name))) {
    throw new Error(
      'Unexpected VITE_ variable: only the Supabase URL and publishable key may be exposed.',
    )
  }
  if (
    env.VITE_SUPABASE_PUBLISHABLE_KEY &&
    !env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')
  ) {
    throw new Error(
      'Use a Supabase publishable key. Secret and legacy JWT keys must not enter the browser bundle.',
    )
  }
  return {
    plugins: [react()],
    test: { include: ['tests/**/*.test.ts'], testTimeout: 20000 },
  }
})
