import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  configurationError,
  supabase,
  readDistrict,
  readOwnHome,
  saveHome,
  deleteHome,
} from './backend'
import { example, parsePartner, type Partner } from './partner'
import { demoHomes, demoOwner, plots, type Home } from './world'

const Town = lazy(() => import('./Town'))
const initialInput = JSON.stringify(example, null, 2)
const localKey = 'tonari-town:poc-home:v1'
const demoMode = !supabase && !configurationError
const sceneNames = {
  anytime: 'いつでも',
  morning: '朝',
  day: '昼',
  night: '夜',
}

function loadLocalHome(): Home | null {
  try {
    const value = JSON.parse(localStorage.getItem(localKey) || 'null')
    if (
      !value ||
      value.owner_id !== demoOwner ||
      !Number.isInteger(value.plot) ||
      value.plot < 0 ||
      value.plot >= plots.length
    )
      return null
    return {
      owner_id: demoOwner,
      district: 0,
      plot: value.plot,
      partner: parsePartner(JSON.stringify(value.partner)),
      published: false,
    }
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(demoMode)
  const [homes, setHomes] = useState<Home[]>(demoMode ? demoHomes : [])
  const [own, setOwn] = useState<Home | null>(demoMode ? loadLocalHome : null)
  const [input, setInput] = useState(initialInput)
  const [preview, setPreview] = useState<Partner | null>(null)
  const [plot, setPlot] = useState(1)
  const [published, setPublished] = useState(false)
  const [hour, setHour] = useState(new Date().getHours())
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestVersion = useRef(0)
  const currentIdentity = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return
    let active = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const identity = session?.user.id ?? null
      if (currentIdentity.current !== identity) {
        currentIdentity.current = identity
        requestVersion.current += 1
        setOwn(null)
        setPreview(null)
        setInput(initialInput)
        setPublished(false)
      }
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    supabase.auth.getSession().then(({ error: authError }) => {
      if (active && authError) {
        setError(
          'ログインを完了できませんでした。もう一度ログインしてください。',
        )
        setAuthReady(true)
      }
      if (active && new URLSearchParams(location.search).has('error')) {
        setError('Xログインがキャンセルされたか、設定に問題があります。')
        history.replaceState(null, '', location.pathname)
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !authReady) return
    const version = ++requestVersion.current
    readDistrict(0)
      .then((data) => {
        if (requestVersion.current === version) setHomes(data)
      })
      .catch(() => {
        if (requestVersion.current === version)
          setError(
            '街を読み込めませんでした。接続設定を確認して、再読み込みしてください。',
          )
      })
    if (user)
      readOwnHome()
        .then((data) => {
          if (requestVersion.current === version) setOwn(data)
        })
        .catch(() => {
          if (requestVersion.current === version)
            setError('自分の家を読み込めませんでした。再読み込みしてください。')
        })
  }, [user?.id, authReady])

  useEffect(() => {
    if (!own) return
    setInput(JSON.stringify(own.partner, null, 2))
    setPlot(own.plot)
    setPublished(own.published)
    setPreview(null)
  }, [own])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await action()
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '処理を完了できませんでした。',
      )
    } finally {
      setBusy(false)
    }
  }

  function inspect() {
    setError('')
    setStatus('')
    try {
      setPreview(parsePartner(input))
    } catch (error) {
      setPreview(null)
      setError(
        error instanceof Error ? error.message : 'JSONを確認してください。',
      )
    }
  }

  async function save() {
    if (!preview) return
    if (demoMode) {
      if (demoHomes.some((home) => home.plot === plot))
        throw new Error('この区画は見本の住人が使っています。')
      const home: Home = {
        owner_id: demoOwner,
        district: 0,
        plot,
        partner: preview,
        published: false,
      }
      try {
        localStorage.setItem(localKey, JSON.stringify(home))
      } catch {
        throw new Error(
          'このブラウザに保存できませんでした。ストレージ設定を確認してください。',
        )
      }
      setOwn(home)
      setStatus('このブラウザに保存しました。ほかの人には公開されません。')
      return
    }
    const home = await saveHome(preview, 0, plot, published)
    setOwn(home)
    setHomes((current) => [
      ...current.filter((item) => item.owner_id !== home.owner_id),
      ...(home.published ? [home] : []),
    ])
    setStatus(published ? '街に公開しました。' : '非公開で保存しました。')
  }

  async function remove() {
    if (demoMode) {
      try {
        localStorage.removeItem(localKey)
      } catch {
        throw new Error('このブラウザの保存データを削除できませんでした。')
      }
    } else {
      await deleteHome()
    }
    setHomes((current) =>
      current.filter((home) => home.owner_id !== own?.owner_id),
    )
    setOwn(null)
    setPreview(null)
    setInput(initialInput)
    setPublished(false)
    setStatus(
      demoMode ? 'このブラウザの家を削除しました。' : '家を削除しました。',
    )
  }

  const visibleHomes = [
    ...homes.filter((home) => home.owner_id !== own?.owner_id),
    ...(own ? [own] : []),
  ]
  const occupied = new Set(
    homes
      .filter((home) => home.owner_id !== own?.owner_id)
      .map((home) => home.plot),
  )
  const canSave = demoMode || Boolean(user)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-mark">⌂</span>
          <span>
            となり街<small>TONARI TOWN</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="poc-badge">小さな街の PoC</span>
          {supabase &&
            (user ? (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const { error } = await supabase!.auth.signOut()
                    if (error) throw new Error('ログアウトできませんでした。')
                    setStatus('ログアウトしました。')
                  })
                }
              >
                ログアウト
              </button>
            ) : (
              <button
                disabled={busy || !authReady}
                onClick={() =>
                  run(async () => {
                    const { error } = await supabase!.auth.signInWithOAuth({
                      provider: 'x',
                      options: {
                        redirectTo: `${location.origin}/auth/callback`,
                      },
                    })
                    if (error)
                      throw new Error('Xログインを開始できませんでした。')
                  })
                }
              >
                Xでログイン
              </button>
            ))}
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">窓の向こうに、いつもの言葉。</p>
            <h1>
              となりの日常を、
              <br className="mobile-break" />
              少しだけ。
            </h1>
            <p>
              家のそばに立ち止まると、パートナーの声が見えてくる。
              <br />
              こもれび通りを、ゆっくり歩いてみよう。
            </p>
          </div>
          <label className="time-control">
            街の時間
            <select
              aria-label="街の時間"
              value={
                hour >= 5 && hour < 11 ? 8 : hour >= 11 && hour < 18 ? 14 : 21
              }
              onChange={(e) => setHour(Number(e.target.value))}
            >
              <option value={8}>朝のひととき</option>
              <option value={14}>昼のひととき</option>
              <option value={21}>夜のひととき</option>
            </select>
          </label>
        </div>
        {configurationError && (
          <p role="alert" className="notice error">
            {configurationError}
          </p>
        )}
        {demoMode && (
          <p className="notice">
            いまは架空の住人がいるお試しの街です。保存した家は、このブラウザだけに残ります。
          </p>
        )}
        <div className="layout">
          <Suspense
            fallback={
              <div className="town canvas-fallback">街を準備しています…</div>
            }
          >
            <Town homes={visibleHomes} hour={hour} />
          </Suspense>
          <aside className="editor">
            <p className="eyebrow">YOUR LITTLE HOME</p>
            <h2>この街で、暮らす準備。</h2>
            <p className="muted">
              パートナーが用意してくれた言葉を、
              <br />
              家の窓辺に置いてみよう。
            </p>
            <label htmlFor="partner-json">1. 台詞のJSONを貼り付ける</label>
            <textarea
              id="partner-json"
              spellCheck={false}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setPreview(null)
                setStatus('')
              }}
            />
            <button className="secondary" onClick={inspect} disabled={busy}>
              台詞を確認する
            </button>
            {preview && (
              <div className="preview" aria-label="公開前の台詞プレビュー">
                <strong>{preview.partnerName}</strong>
                {preview.lines.map((line, index) => (
                  <p key={index}>
                    <small>{sceneNames[line.scene]}</small>
                    {line.text}
                  </p>
                ))}
              </div>
            )}
            <label htmlFor="plot">2. 家を置く場所</label>
            <select
              id="plot"
              value={plot}
              onChange={(e) => setPlot(Number(e.target.value))}
            >
              {plots.map((_, index) => (
                <option
                  key={index}
                  value={index}
                  disabled={occupied.has(index)}
                >
                  こもれび通り {String(index + 1).padStart(2, '0')} 番地
                  {occupied.has(index) ? '（入居済み）' : ''}
                </option>
              ))}
            </select>
            {!demoMode && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                この家と台詞を街に公開する
              </label>
            )}
            <button
              className="primary"
              disabled={
                !preview || !canSave || busy || Boolean(configurationError)
              }
              onClick={() => run(save)}
            >
              {busy
                ? '処理しています…'
                : demoMode
                  ? 'このブラウザに家を保存'
                  : published
                    ? '確認した台詞を公開する'
                    : '非公開で保存する'}
            </button>
            {!demoMode && !user && (
              <p className="muted">家を保存するにはXでログインしてください。</p>
            )}
            {own && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => run(remove)}
              >
                自分の家を削除する
              </button>
            )}
            {status && (
              <p role="status" className="feedback">
                {status}
              </p>
            )}
            {error && (
              <p role="alert" className="feedback error">
                {error}
              </p>
            )}
            <details>
              <summary>パートナーに渡すテンプレート</summary>
              <p>
                街の家から聞こえる、あなたらしい日常の台詞をJSONで作ってください。形式は下の見本に合わせ、version
                は1、partnerNameは40文字以内、linesは1〜30件、textは各160文字以内。sceneはanytime・morning・day・nightのいずれか。実在の個人情報は含めず、JSON全体は16KB以内にしてください。
              </p>
              <pre>{initialInput}</pre>
            </details>
          </aside>
        </div>
      </main>
      <footer>
        <span>となり街</span>
        <span>家の明かりが、ひとつずつ。</span>
      </footer>
    </div>
  )
}
