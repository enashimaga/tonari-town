# となり街 / tonari-town

AIパートナーとの日常が、小さな街に並ぶWebアプリ。
三人称視点で街を散歩すると、家からパートナーの言葉が吹き出しで見えます。

## PoCを動かす

Node.js 22.12以降を使用します。

```sh
npm ci
npm run dev
```

`http://127.0.0.1:5201/` を開いてください。ポートが使用中の場合は、別のポートへ自動変更せず停止します。Supabase未設定でも架空の住人がいる街を試せます。
このモードの保存先はブラウザのlocalStorageです。クラウドには保存・公開しません。

1. 道のタップ、矢印ボタン、↑↓ / W S キーで通りを歩く。
2. 台詞のJSONを貼り付けて「台詞を確認する」を押す。
3. プレビューを確認し、空いている番地を選んで家を保存する。
4. 再読み込みして、自分の家と台詞が残ることを確認する。

PoCでは移動を通りの前後方向に限定しています。3D表示・台詞・入力・保存の動作確認が目的で、街の外観や操作の完成版ではありません。

## 別のPCから開く

LAN経由で開く場合は、開発サーバーを `npm run dev:lan` で起動し、`http://<開発PCのLANアドレス>:5201/` にアクセスします。

VS Code Remote SSHでは「ポート」タブから5201を転送すると、手元のPCの `http://127.0.0.1:5201/` で開けます。Xログインの検証には、この方法を推奨します。ブラウザの認証用暗号機能を利用でき、既存のローカル用Redirect URLも使えます。

## 構成

- React / TypeScript / Three.js / React Three Fiber：画面と3Dの街
- Cloudflare Workers Static Assets：静的ファイル配信
- Supabase Auth：X OAuth 2.0ログイン
- Supabase PostgreSQL：家と台詞の保存、所有者と公開状態によるRLS

共通3D素材はコードで生成するため、PoCでファイルストレージは使いません。
ユーザー同士のチャット、移動のリアルタイム同期、アプリ内でのAI生成は範囲外です。

## 検証

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run format:check
```

ブラウザテストは接続設定のないお試しモード向けです。ブラウザを取得できない環境では、`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` に既存のChromium実行ファイルを指定できます。

SQLテストはPGlite上で実際のマイグレーションを実行し、匿名・所有者・別ユーザーの権限とデータ制約を検証します。Supabaseの認証部分はテスト用のユーザーと `auth.uid()` で代替しており、XやホストされたSupabaseの接続確認にはなりません。

Cloudflareのローカル配信は、ビルド後に次で確認できます。

```sh
npm run cf:dev
```

## 外部サービスへの接続

アカウント作成後の設定方法と、確認済み・未確認の項目は [docs/poc.md](docs/poc.md) に記録しています。

公開用のSupabase URL・Publishable keyだけを `.env.local` に設定します。XのClient SecretはSupabaseの管理画面に設定し、このアプリの環境変数には入れません。
開発ルールは [AGENTS.md](AGENTS.md) を参照してください。
