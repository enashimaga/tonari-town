import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { LegalLinks } from './LegalPage'
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
import {
  hiddenHomesKey,
  loadHiddenOwners,
  saveHiddenOwners,
} from './hiddenHomes'

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
  const [hiddenOwners, setHiddenOwners] = useState(loadHiddenOwners)
  const [enteredTown, setEnteredTown] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mapNotice, setMapNotice] = useState('')
  const townMap = useRef<HTMLElement>(null)
  const guide = useRef<HTMLDialogElement>(null)
  const editor = useRef<HTMLDialogElement>(null)
  const requestVersion = useRef(0)
  const currentIdentity = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === hiddenHomesKey || event.key === null)
        setHiddenOwners(loadHiddenOwners())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function updateHiddenOwners(next: Set<string>) {
    try {
      saveHiddenOwners(next)
      setHiddenOwners(next)
      setError('')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '非表示の設定を保存できませんでした。',
      )
    }
  }

  useEffect(() => {
    if (enteredTown) townMap.current?.focus()
  }, [enteredTown])

  function openDialog(dialog: HTMLDialogElement | null) {
    if (!dialog) return
    dialog.showModal()
    setDialogOpen(true)
  }

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

  if (!enteredTown) {
    return (
      <main className="landing">
        <div className="landing-card">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              ⌂
            </span>
            <span>
              となり街<small>TONARI TOWN</small>
            </span>
          </div>
          <p className="eyebrow">窓の向こうに、いつもの言葉。</p>
          <h1>
            <span>となりの日常を、</span>
            <wbr />
            <span>少しだけ。</span>
          </h1>
          <p>
            川沿いの道を散歩して、家のそばでAIパートナーの台詞を読んでみよう。
            自分の家を選び、パートナーの台詞を置くこともできます。
          </p>
          <p className="muted">
            {demoMode
              ? 'お試しモード：家はこのブラウザーにだけ保存され、ほかの人には共有されません。'
              : '散歩や公開された台詞の閲覧にログインは不要です。家の登録にはXでログインします。'}
          </p>
          {configurationError && (
            <p role="alert" className="feedback error">
              {configurationError}
            </p>
          )}
          {error && (
            <p role="alert" className="feedback error">
              {error}
            </p>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => setEnteredTown(true)}
          >
            散歩する
          </button>
          <LegalLinks newTab />
        </div>
      </main>
    )
  }

  return (
    <main
      className="game"
      id="town-map"
      aria-label="となり街"
      ref={townMap}
      tabIndex={-1}
    >
      <Suspense
        fallback={
          <div className="town canvas-fallback">街を準備しています…</div>
        }
      >
        <Town
          inputPaused={dialogOpen}
          homes={visibleHomes}
          hour={hour}
          selectedPlot={plot}
          hiddenOwners={
            new Set(
              [...hiddenOwners].filter(
                (id) => id !== own?.owner_id && id !== user?.id,
              ),
            )
          }
          onSelectPlot={(next) => {
            if (occupied.has(next)) {
              setMapNotice(
                'この場所は入居済みです。空いている場所を選んでください。',
              )
              return
            }
            setPlot(next)
            setMapNotice(
              `${plots[next].label}を選びました。台詞を確認して保存すると入居できます。`,
            )
          }}
        />
      </Suspense>
      <div className="game-hud">
        <button
          type="button"
          className="game-task"
          aria-haspopup="dialog"
          aria-controls="home-editor"
          onClick={() => {
            setMapNotice('')
            openDialog(editor.current)
          }}
        >
          <span>タスク</span>住む場所を決める
        </button>
        <select
          className="time-control"
          aria-label="街の時間"
          value={hour >= 5 && hour < 11 ? 8 : hour >= 11 && hour < 18 ? 14 : 21}
          onChange={(e) => setHour(Number(e.target.value))}
        >
          <option value={8}>朝のひととき</option>
          <option value={14}>昼のひととき</option>
          <option value={21}>夜のひととき</option>
        </select>
        <button
          type="button"
          className="help-button"
          aria-label="操作ガイド"
          aria-haspopup="dialog"
          aria-controls="controls-guide"
          onClick={() => openDialog(guide.current)}
        >
          ?
        </button>
        <div className="map-notice" role="status">
          {mapNotice}
        </div>
      </div>

      <dialog
        id="controls-guide"
        className="game-dialog controls-guide"
        ref={guide}
        aria-labelledby="controls-guide-title"
        onClose={() => setDialogOpen(false)}
      >
        <div className="dialog-heading">
          <h2 id="controls-guide-title">操作ガイド</h2>
          <button type="button" onClick={() => guide.current?.close()}>
            閉じる
          </button>
        </div>
        <dl>
          <dt>歩く</dt>
          <dd>PC：道をクリック、画面の矢印ボタン、矢印キー／WASD</dd>
          <dd>タッチ：道または画面の矢印ボタンをタップ</dd>
          <dt>視点</dt>
          <dd>カメラは歩く人を自動で追います。</dd>
          <dt>住む場所を選ぶ</dt>
          <dd>
            空き地やこもれび荘の窓を選び、右上のタスクから家を登録できます。
          </dd>
        </dl>
        <LegalLinks newTab />
      </dialog>

      <dialog
        id="home-editor"
        className="game-dialog editor"
        ref={editor}
        aria-labelledby="home-editor-title"
        onClose={() => setDialogOpen(false)}
      >
        <div className="dialog-heading">
          <h2 id="home-editor-title">この街で、暮らす準備。</h2>
          <button type="button" onClick={() => editor.current?.close()}>
            閉じる
          </button>
        </div>
        {configurationError && (
          <p role="alert" className="feedback error">
            {configurationError}
          </p>
        )}
        {supabase && (
          <button
            type="button"
            disabled={busy || !authReady}
            onClick={() =>
              run(async () => {
                if (user) {
                  const { error } = await supabase!.auth.signOut()
                  if (error) throw new Error('ログアウトできませんでした。')
                  setStatus('ログアウトしました。')
                } else {
                  const { error } = await supabase!.auth.signInWithOAuth({
                    provider: 'x',
                    options: { redirectTo: `${location.origin}/auth/callback` },
                  })
                  if (error)
                    throw new Error('Xログインを開始できませんでした。')
                }
              })
            }
          >
            {user ? 'ログアウト' : 'Xでログインして家を登録'}
          </button>
        )}
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
        <p className="muted">
          街の空き地やこもれび荘の窓からも場所を選べます。保存するまでは仮表示です。
        </p>
        <select
          id="plot"
          value={plot}
          onChange={(e) => setPlot(Number(e.target.value))}
        >
          {plots.map((place, index) => (
            <option key={index} value={index} disabled={occupied.has(index)}>
              {place.label}
              {occupied.has(index) ? '（入居済み）' : ''}
            </option>
          ))}
        </select>
        {own && own.plot !== plot && (
          <p className="muted">
            保存すると今の住まいから引っ越します。一人につき一軒です。
          </p>
        )}
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
        {canSave && (
          <p className="muted" id="save-scope">
            公開範囲：
            {demoMode
              ? 'このブラウザーだけに保存し、ほかの人には共有されません。'
              : published
                ? '街を訪れた人に、家と台詞が公開されます。'
                : '保存しても、家と台詞はほかの人には表示されません。'}
          </p>
        )}
        <button
          className="primary"
          aria-describedby={canSave ? 'save-scope' : undefined}
          disabled={!preview || !canSave || busy || Boolean(configurationError)}
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
          <summary>
            住人の表示設定
            {hiddenOwners.size > 0 ? `（${hiddenOwners.size}人を非表示）` : ''}
          </summary>
          <p>
            このブラウザで、選んだ住人の名前と台詞を表示しません。入居済みの建物は残ります。別の端末には引き継がれず、サイトデータを消すと設定も消えます。
          </p>
          <ul className="resident-list">
            {homes
              .filter(
                (home) =>
                  home.owner_id !== own?.owner_id &&
                  home.owner_id !== user?.id &&
                  !hiddenOwners.has(home.owner_id),
              )
              .map((home) => (
                <li key={home.owner_id}>
                  <span>
                    {home.partner.partnerName}
                    <small>{plots[home.plot]?.label}</small>
                  </span>
                  <button
                    type="button"
                    aria-label={`${home.partner.partnerName}を非表示にする`}
                    onClick={() =>
                      updateHiddenOwners(
                        new Set([...hiddenOwners, home.owner_id]),
                      )
                    }
                  >
                    非表示
                  </button>
                </li>
              ))}
          </ul>
          {hiddenOwners.size > 0 && (
            <button type="button" onClick={() => updateHiddenOwners(new Set())}>
              非表示をすべて解除
            </button>
          )}
        </details>
        <details>
          <summary>パートナーに渡すテンプレート</summary>
          <p>
            街の家から聞こえる、あなたらしい日常の台詞をJSONで作ってください。形式は下の見本に合わせ、version
            は1、partnerNameは40文字以内、linesは1〜30件、textは各160文字以内。sceneはanytime・morning・day・nightのいずれか。実在の個人情報は含めず、JSON全体は16KB以内にしてください。
          </p>
          <pre>{initialInput}</pre>
        </details>
        <LegalLinks newTab />
      </dialog>
    </main>
  )
}
