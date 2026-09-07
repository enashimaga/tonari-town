import { createClient } from '@supabase/supabase-js'
import { validatePartner, type Partner } from './partner'
import type { Home } from './world'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const configured = Boolean(
  url && key && !url.includes('your-project') && !key.includes('REPLACE_ME'),
)
export const supabase =
  configured && key?.startsWith('sb_publishable_')
    ? createClient(url!, key, {
        auth: { flowType: 'pkce', detectSessionInUrl: true },
      })
    : null
export const configurationError =
  configured && !supabase
    ? '公開用の sb_publishable_ キーを設定してください。管理用キーは使用できません。'
    : null
const fields = 'owner_id,district,plot,partner,published'

export async function readDistrict(district: number): Promise<Home[]> {
  if (!supabase) throw new Error('接続設定がありません。')
  const { data, error } = await supabase
    .from('homes')
    .select(fields)
    .eq('district', district)
    .eq('published', true)
  if (error)
    throw new Error(
      '街を読み込めませんでした。接続とデータベースの設定を確認してください。',
    )
  return data.map((home) => ({
    ...home,
    partner: validatePartner(home.partner),
  }))
}

export async function readOwnHome(): Promise<Home | null> {
  if (!supabase) return null
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user)
    throw new Error('ログイン状態を確認できませんでした。')
  const { data, error } = await supabase
    .from('homes')
    .select(fields)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (error) throw new Error('自分の家を読み込めませんでした。')
  return data ? { ...data, partner: validatePartner(data.partner) } : null
}

export async function saveHome(
  partner: Partner,
  district: number,
  plot: number,
  published: boolean,
): Promise<Home> {
  if (!supabase) throw new Error('接続設定がありません。')
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('保存するにはログインしてください。')
  const home: Home = {
    owner_id: user.id,
    district,
    plot,
    partner: validatePartner(partner),
    published,
  }
  const { error } = await supabase
    .from('homes')
    .upsert(home, { onConflict: 'owner_id' })
  if (error?.code === '23505')
    throw new Error('この区画は既に使われています。別の区画を選んでください。')
  if (error)
    throw new Error(
      '保存できませんでした。ログイン状態と入力内容を確認してください。',
    )
  return home
}

export async function deleteHome() {
  if (!supabase) throw new Error('接続設定がありません。')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('ログインしてください。')
  const { error } = await supabase
    .from('homes')
    .delete()
    .eq('owner_id', user.id)
  if (error) throw new Error('家を削除できませんでした。')
}
