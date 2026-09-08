# PoCの検証記録と接続手順

## 検証対象

| 対象                         | 状態                       | 検証方法・範囲                                                          |
| ---------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| React / TypeScript / Vite    | 確認済み                   | 型チェックと本番ビルド                                                  |
| Three.js / React Three Fiber | 確認済み                   | ChromiumでCanvas描画、移動、家のHTML吹き出しを確認                      |
| スマートフォン向けレイアウト | エミュレーションで確認済み | Pixel 7相当の画面・タッチ設定。実機の性能・Safariは未確認               |
| JSON取り込み                 | 確認済み                   | コードブロック、形式・件数・長さ・サイズ制約、HTML文字列の安全な表示    |
| ブラウザ保存                 | 確認済み                   | 保存・再読み込み・削除。クラウド保存とは別                              |
| PostgreSQL / RLS             | ローカルで確認済み         | PGliteでマイグレーション実行、公開範囲、他人の更新拒否、区画の重複拒否  |
| Supabaseの実データ保存       | 未確認                     | プロジェクト作成・マイグレーション適用後に確認                          |
| X OAuth 2.0                  | 未確認                     | 実装済み。XとSupabaseの設定、実アカウントでの往復が必要                 |
| Cloudflare配信               | ローカルで確認済み         | Wranglerで `/` と `/auth/callback` を配信。クラウドへのデプロイは未実施 |
| 画像ストレージ               | 今回は対象外               | 外部画像を使わず、共通3D形状はコードで生成                              |

ブラウザ検証は既存のChromiumを指定して実行しました。ソフトウェア描画を使用するため、実機のGPU性能はこの結果から判断できません。
3D部分は遅延ロードしますが、ビルド時に約900KB（圧縮前）のチャンク警告があります。転送圧縮後は約240KBです。実機での初回表示速度は次の検証対象です。

## 1. Supabaseを用意する

1. 新しいプロジェクトを作成する。PoCでは無料プランから始められます。
2. SQL Editorで `supabase/migrations/202609080001_create_homes.sql` を実行する。新規プロジェクト向けで、同じSQLの再実行は想定していません。
3. Connect画面などからProject URLと新形式のPublishable key（`sb_publishable_`）を取得する。
4. `.env.example` を `.env.local` にコピーし、上記2項目だけを設定する。
5. `npm run dev` を再起動する。本番ビルドの場合は再ビルドする。

このPoCは新形式の公開キーだけを受け付けます。Secret key・service_role・古いJWT形式のキーを使いません。ビルド設定でも許可した2項目以外の `VITE_` 変数を拒否します。

Supabaseの既定のテーブル権限に依存せず、マイグレーション内でRLSとアクセス権を設定します。所有者は1軒のみ、地区0の12区画が対象です。非公開の家も区画を占有するので、空き表示から保存するまでに競合した場合は保存エラーになります。

## 2. Xログインを接続する

1. X開発者アカウントでこのアプリを登録する。
2. SupabaseのAuthentication → Sign In / Providersで **X / Twitter (OAuth 2.0)** を選び、Callback URLを確認する。
3. X側のユーザー認証設定でWeb Appを選び、Callback URLにSupabaseのURLを登録する。
4. X側にWebサイト、利用規約、プライバシーポリシーのURLを登録する。これらの公開ページはこのPoCにはまだ含まれないため、実際の運用内容に合わせて用意する。
5. XのClient IDとClient SecretをSupabaseのプロバイダー設定に入れる。アプリの `.env.local` には入れない。
6. SupabaseのURL ConfigurationにアプリのSite URLと、許可するRedirect URLを登録する。
7. アプリで「Xでログイン」を押し、同意画面の権限を確認してログインする。

URLの役割は次のように分かれます。

| 設定先                           | URL例                                          | 役割                           |
| -------------------------------- | ---------------------------------------------- | ------------------------------ |
| X側のCallback URL                | `https://PROJECT.supabase.co/auth/v1/callback` | XからSupabaseへ戻る            |
| SupabaseのRedirect URL（開発）   | `http://127.0.0.1:5201/auth/callback`          | Supabaseからローカルの街へ戻る |
| SupabaseのRedirect URL（公開後） | `https://YOUR-APP.workers.dev/auth/callback`   | Supabaseから公開された街へ戻る |

別PCのブラウザで開く場合は、VS Code Remote SSHの「ポート」タブで5201を転送し、`http://127.0.0.1:5201/` からログインしてください。LANのHTTPアドレスではブラウザの認証用暗号機能に制限があるため、ログイン検証にはポート転送を推奨します。

ポートを変えた場合はRedirect URLも合わせます。アプリはOAuth 2.0の `provider: 'x'` とPKCEを使い、ブラウザSDKが戻り先のコード交換とセッション管理を担当します。

現在のSupabase公式手順にはX側のメール取得設定も含まれます。実際の同意画面で要求内容を確認し、投稿・DMなど、このアプリに不要な権限は追加しません。
X APIの課金はログイン時の情報取得も含め、実際のDeveloper Consoleで確認します。ログインが無料とは未確認です。

## 3. Cloudflareに配信する

1. Cloudflareアカウントを作成する。
2. `npx wrangler login` で、使用するアカウントにログインする。
3. `npm run build` と `npm run cf:dev` で配信内容を確認する。
4. 公開するときに `npm run deploy` を実行する。
5. 表示された公開URLをX・Supabaseの設定に反映する。

静的ファイルを配信する構成で、常時起動するNode.jsサーバーは不要です。`/auth/callback` もSPAの入口として配信します。
ブラウザ向けの環境変数はビルド時に埋め込まれるので、Cloudflareの実行時シークレットに設定するだけでは反映されません。

## 実接続後の完了条件

- Xへのログイン・キャンセル・ログアウト後に、画面が正しい状態になる。
- 非公開で保存し、再読み込み・再ログイン後も自分の家を取得できる。
- 公開した家が、別ブラウザの未ログイン状態で表示される。
- 非公開へ戻した家が、別ブラウザの再読み込み後には見えなくなる。
- 別のXユーザーや未ログイン状態から、他人の家を更新・削除できない。
- 同じ区画を二人が選んでも、一方だけ保存される。
- Cloudflareの公開URLとX内ブラウザで、ログインの往復と3D表示を確認する。
- X側の要求権限・API課金と、Supabase側の通信量を記録する。

## 公式資料

- [Supabase：Xログイン](https://supabase.com/docs/guides/auth/social-login/auth-twitter)
- [Supabase：RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase：料金](https://supabase.com/pricing)
- [X：API料金](https://docs.x.com/x-api/getting-started/pricing)
- [Cloudflare：Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/)
- [Cloudflare：Static Assetsの料金](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
