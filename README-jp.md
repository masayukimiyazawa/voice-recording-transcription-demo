# Vonage Call Proxy

Vonage LVN（仮想番号）経由で着信を受け付け、自動応答メッセージを再生し、設定済みの転送先番号に通話を接続するNode.js/Expressサービスです。通話は話者分離付きで録音され、Vonageネイティブの文字起こし機能によって非同期にトランスクリプトが生成されます。通話メタデータと文字起こしはMongoDB Atlasに保存され、パスワード保護されたWebポータルから管理できます。

## 主な機能

- Vonage Voice API（NCCO方式）による着信ハンドリング
- 話者分離（2チャンネル）付き通話録音
- Vonageネイティブ機能による非同期文字起こし取得
- 通話メタデータ・文字起こしのMongoDB Atlas永続化
- 転送先番号管理・通話履歴閲覧のためのWebポータル（パスワード認証）
- `.env` ファイルによる環境設定管理
- **Vonage Cloud Runtime (VCR) への展開対応**

## 事前準備

- Node.js 24 以降（VCR SDK >= 2.1.0 では必須）
- MongoDB Atlas クラスター（接続URI）
- Vonage アカウント（以下が必要）
  - プロビジョニング済みのVonage LVN（仮想番号）
  - Answer/Event WebhookのURLが設定されたVonage Voice Application
  - VonageダッシュボードからダウンロードしたPrivate Keyファイル
- **VCR展開時**: Vonage Cloud Runtime CLI (`vcr`) がインストール済みであること

## セットアップ

### 1. クローンとインストール

```bash
git clone <リポジトリURL>
cd vonage-call-proxy
npm install
```

### 2. 環境設定

```bash
cp .env.sample .env
```

`.env` を編集して認証情報を設定します：

| 変数名 | 説明 |
|---|---|
| `VONAGE_API_KEY` | VonageのAPIキー |
| `VONAGE_API_SECRET` | VonageのAPIシークレット |
| `VONAGE_APPLICATION_ID` | Vonage Voice ApplicationのID |
| `VONAGE_PRIVATE_KEY_PATH` | ダウンロードしたPrivate Keyファイルのパス（例: `./private.key`） |
| `VONAGE_LVN` | Vonage仮想番号（E.164形式） |
| `MONGODB_URI` | MongoDB Atlas接続文字列 |
| `PORTAL_PASSWORD` | 管理ポータルのパスワード |
| `SESSION_SECRET` | セッションクッキー署名用シークレット（`.env.sample`の生成コマンドを参照） |

### 3. サーバー起動

```bash
# 開発環境（ts-node使用）
npm run dev

# 本番環境（コンパイル後に起動）
npm run build
npm start
```

サーバーは `PORT`（デフォルト: `3000`）で待ち受けます。

### 4. Vonage Webhookの設定

VonageダッシュボードのVoice Applicationで以下のWebhook URLを設定します：

| Webhook | URL |
|---|---|
| Answer URL | `https://<ドメイン>/call/answer`（GET） |
| Event URL | `https://<ドメイン>/event/recording`（POST） |
| Transcription URL | `https://<ドメイン>/event/transcription`（POST） |

ローカル開発時は [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) を使ってトンネルを作成してください（アカウント不要）：

```bash
# cloudflared のインストール（macOS）
brew install cloudflared

# 一時的な公開トンネルを開始
cloudflared tunnel --url http://localhost:3000
```

`https://*.trycloudflare.com` 形式のURLが表示されるので、VonageダッシュボードのWebhook URLのベースとして使用してください。

## Vonage Cloud Runtime (VCR) への展開

### VCR展開の事前準備

1. **VCR CLIのインストール**:
   ```bash
   # macOS / Linux
   curl -L https://raw.githubusercontent.com/Vonage/cloud-runtime-cli/main/script/install.sh | sh
   
   # Windows (PowerShell)
   pwsh -Command "iwr https://raw.githubusercontent.com/Vonage/cloud-runtime-cli/main/script/install.ps1 -useb | iex"
   ```

2. **VCR CLIの設定**:
   ```bash
   vcr configure
   ```
   Vonage APIキー、シークレット、リージョン（例: `aws.euw1` = EU西部）を入力します。

3. **Vonage Applicationの作成**（未作成の場合）:
   ```bash
  vcr app create --voice --messages --name my-voice-messages-app
   ```
   Vonage Applicationが作成され、Private Keyがダウンロードされます。Application IDを控えておいてください。

### VCR Debugでローカル開発

1. `vcr.yml` のデバッグ用Application IDを更新（本番用と別のものを指定可能）:
   ```yaml
   debug:
     application-id: "your-debug-application-id"
   ```

2. デバッグセッションを開始:
   ```bash
   npm run debug
   # または
   vcr debug
   ```

3. **VSCodeでのデバッグ**: `.vscode/launch.json` を作成:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "command": "npm run debug",
         "name": "Start Debugger",
         "request": "launch",
         "type": "node-terminal"
       }
     ]
   }
   ```
   F5キーでブレークポイント付きデバッグを開始できます。

### VCRへのデプロイ（マニュアルオペレーション手引き）

VCR展開は以下の手順で実行します。すべての CLI コマンドはリポジトリルートで実行してください。

#### ステップ1: VCR CLI の設定（初回のみ）

```bash
vcr configure
```
Vonage APIキー、APIシークレット、リージョン（例: `aws.apse1`）を入力します。認証情報は `~/.vcr-cli` に保存されます。

#### ステップ2: Vonage Application の作成（未作成の場合）

```bash
vcr app create --voice --messages --name <アプリケーション名>
```
例:
```bash
vcr app create --voice --messages --name vonage-call-proxy-dev
```
出力された **Application ID** を控えておきます（`vcr.yml` とシークレットに設定します）。

#### ステップ3: `vcr.yml` の `runtime`、`application-id` と `WEBHOOK_URL` を更新

`vcr.yml` を編集し、以下の3箇所を作成した Application ID とデプロイ先URLに書き換えます。Node.js 24 を使用するため `runtime` は `nodejs24` を指定してください：

```yaml
instance:
  runtime: nodejs24
  application-id: "<作成したApplication ID>"
  ...
  environment:
    - name: WEBHOOK_URL
      value: "https://<インスタンス名>.apse1.runtime.vonage.cloud"
```

#### ステップ4: VCR シークレットを作成

デプロイ前に、VCR にシークレットを登録します。`vcr.yml` の `instance.secrets` で定義されているすべてのシークレットを作成してください。

```bash
vcr secret create --name PORTAL_PASSWORD --value "<管理ポータルパスワード>"
vcr secret create --name SESSION_SECRET --value "<セッションシークレット>"
vcr secret create --name VONAGE_API_KEY --value "<Vonage APIキー>"
vcr secret create --name VONAGE_API_SECRET --value "<Vonage APIシークレット>"
vcr secret create --name VONAGE_APPLICATION_ID --value "<Application ID>"
vcr secret create --name VONAGE_LVN --value "<Vonage仮想番号(E.164)>"
vcr secret create --name MONGODB_URI --value "<MongoDB Atlas接続URI>"
vcr secret create --name VONAGE_PRIVATE_KEY --filename ./private.key
```

**注意:** `--value` はシェル履歴に残るため、機密性の高い値は `--filename` でファイルから読み込むか、対話モード（`--value` を省略）で入力してください。`VONAGE_PRIVATE_KEY` は `--filename ./private.key` で秘密鍵ファイルを指定します。

シークレット一覧の確認:
```bash
vcr secret list
```

#### ステップ5: `.env` の認証情報を更新

`.env` の以下の項目を、VCR CLI の認証情報および作成した Application ID に合わせて更新します：

| 変数 | 設定値の例 |
|------|-----------|
| `VONAGE_API_KEY` | VCR CLI 設定の `api_key` |
| `VONAGE_API_SECRET` | VCR CLI 設定の `api_secret` |
| `VONAGE_APPLICATION_ID` | ステップ2 で作成した Application ID |
| `WEBHOOK_URL` | デプロイ先インスタンスの公開 URL |

例:
```
VONAGE_API_KEY=c30214a9
VONAGE_API_SECRET=AEs)tJ0H
VONAGE_APPLICATION_ID=337ac060-a778-48b0-b07d-2d121ae3d9e5
WEBHOOK_URL=https://neru-c30214a9-vonage-call-proxy-dev.apse1.runtime.vonage.cloud
```

#### ステップ6: デプロイ実行

`package.json` を変更した場合（依存関係の追加・削除、バージョン変更など）、**必ず `package-lock.json` を同期**してからデプロイしてください。同期されていないと VCR ビルド時の `npm ci` でエラーになります：

```bash
npm install
# package-lock.json が更新されたことを確認
```

デプロイを実行します：

```bash
npm run vcr:deploy
# または
vcr deploy
```

以下が自動実行されます:
- プロジェクトの取得/作成
- デプロイパラメータの検証
- ソースコードのアップロードとパッケージ化
- ビルドスクリプト（`build.sh`）の実行（TypeScriptコンパイル含む）
- インスタンスの起動

デプロイ完了後、以下の情報が表示されます:
```
Instance id: <インスタンスID>
Instance service name: neru-<api-key>-vonage-call-proxy-dev
Instance host address: https://neru-<api-key>-vonage-call-proxy-dev.apse1.runtime.vonage.cloud
```

#### ステップ7: Vonage Webhook の再適用（必要に応じて）

`vcr deploy` 実行後、VCR が Vonage Application の voice Webhook を callback-router に書き戻す場合があります。デプロイ先インスタンスを直接指定するには、以下を実行します：

```bash
node scripts/apply-vonage-webhooks.mjs
```

401 エラーが出た場合は、`.env` の `VONAGE_API_KEY` / `VONAGE_API_SECRET` が VCR CLI の認証情報と一致しているか確認し、不一致であれば両方を揃えてから再実行してください。

Webhook 設定の検証のみ行う場合:
```bash
npm run vonage:webhooks:check
```

#### ステップ8: VCR シークレットの整合確認（APIキー変更時）

`.env` や VCR CLI の認証情報を変更した場合、VCR 側のシークレットも更新してデプロイ済みインスタンスの環境変数と整合を取ります：

```bash
vcr secret update --name VONAGE_API_KEY --value "<新しいAPIキー>"
vcr secret update --name VONAGE_API_SECRET --value "<新しいAPIシークレット>"
```

シークレットを更新後は、インスタンスを再デプロイするか、`vcr instance` コマンドで環境変数の反映を確認してください。

#### ステップ9: デプロイ確認とログ

```bash
vcr instance list
```

```bash
vcr instance log --project-name vonage-call-proxy --instance-name dev --follow
```

### 本番用の別設定ファイル

本番環境用に `production.yml` を作成:
```bash
cp vcr.yml production.yml
# production.yml を編集して本番用インスタンス名、リージョン、application-id を設定
```

本番デプロイ:
```bash
npm run vcr:deploy:prod
# または
vcr deploy --filename production.yml
```

### VCR設定ファイル

- `vcr.yml` - メイン設定（開発用インスタンス）
- `production.yml` - 本番用設定（オプション）
- `.vcrignore` - デプロイ除外ファイル（node_modules、テスト等）
- `build.sh` - VCR用ビルドスクリプト（dev依存を含めてインストールし、TypeScriptをコンパイル。secretは `dist/` にコピーされません）

### VCRで自動注入される環境変数

VCRは以下の環境変数を自動的に注入します:
- `VCR_PORT` - バインド必須のポート番号
- `VCR_REGION` - デプロイリージョン
- `VCR_PRIVATE_KEY` - VonageアプリケーションのPrivate Key
- `VCR_API_APPLICATION_ID` - Vonage Application ID
- `VCR_INSTANCE_PUBLIC_URL` - デプロイ済みインスタンスの公開URL
- など

アプリケーションは `VCR_PORT` でリッスンし、`0.0.0.0` にバインドする必要があります。

### シークレット管理（CLI 操作）

シークレットは `vcr.yml` の `instance.secrets` で定義し、`instance.environment` で `secret: SECRET_NAME` として参照します。デプロイ前に VCR CLI で登録してください。

#### シークレットの新規作成

```bash
vcr secret create --name <シークレット名> --value "<シークレット値>"
```

秘密鍵などの多行値はファイルから読み込みます：
```bash
vcr secret create --name VONAGE_PRIVATE_KEY --filename ./private.key
```

#### シークレットの一覧表示

```bash
vcr secret list
```

#### シークレットの更新

既存シークレットの値を変更する場合：
```bash
vcr secret update --name <シークレット名> --value "<新しい値>"
```

#### シークレットの削除

```bash
vcr secret remove --name <シークレット名>
# または
vcr secret rm --name <シークレット名>
```

#### シークレット命名規則

- 英数字とアンダースコアのみ使用可能
- 数字で始めることはできない
- 大文字・小文字は区別される
- アカウント内で一意である必要がある

### パスワード総当たり対策

`POST /login` の失敗試行をクライアントIP単位で集計します。すべて任意項目で、未設定時は以下の既定値が使用されます。

| 環境変数 | 既定値 | 意味 |
| --- | --- | --- |
| `LOGIN_RATE_LIMIT_ENABLED` | `true` | 全体の有効・無効 |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | 失敗をカウントする時間幅（15分） |
| `LOGIN_RATE_LIMIT_MAX_FAILURES` | `5` | 1クライアント・1時間幅あたりの許容失敗回数 |
| `LOGIN_RATE_LIMIT_BASE_LOCKOUT_MS` | `60000` | 初回のロックアウト時間（1分） |
| `LOGIN_RATE_LIMIT_MAX_LOCKOUT_MS` | `900000` | エスカレーション後のロックアウト上限（15分） |
| `LOGIN_RATE_LIMIT_GLOBAL_MAX_FAILURES` | `30` | 全クライアント共通の失敗上限。`0` で無効化 |
| `LOGIN_RATE_LIMIT_GLOBAL_LOCKOUT_MS` | `300000` | 上限到達時のロックアウト（5分） |

動作:
- しきい値を超えた場合は `429` と `Retry-After` を返し、**パスワードが正しくても**ロックアウト中は拒否します。
- ロックアウトは再発するたびに2倍になり、`LOGIN_RATE_LIMIT_MAX_LOCKOUT_MS` で頭打ちになります。
- ログイン成功時にそのクライアントのカウンタをリセットします。
- 全体上限のロックアウト時間は、1クライアント分のロックアウトより意図的に短くしています。目的は分散攻撃や `X-Forwarded-For` 偽装による総当たりを鈍らせることのみで、長い全局ロックアウトでは攻撃者が正規管理者のログインを恒久的に妨害できてしまうためです。
- パスワード比較は定数時間（SHA-256 + `timingSafeEqual`）。bcrypt hashは `bcrypt.compare` で比較します。

制限事項: カウンタはプロセスメモリ内のため、インスタンス単位であり、再起動でリセットされます。複数インスタンスへスケールする場合は、状態を共有ストア（MongoDBは依存に既にあります）へ移すか、再起動でカウントが消えることに注意してください。

## テスト実行

```bash
# 全テスト実行
npm test

# カバレッジレポート付きで実行
npx jest --coverage
```

Jestとts-jestを使用しています。外部サービスへの接続は不要で、すべての依存関係はモック化されています。

## APIエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/_/health` | ヘルスチェック（VCR必須） |
| `GET` | `/call/answer` | Vonage Answerウェブフック — NCCOを返す |
| `POST` | `/event/recording` | Vonage録音ウェブフック |
| `POST` | `/event/transcription` | Vonage文字起こしウェブフック |
| `GET` | `/api/destination` | 現在の転送先番号を取得 |
| `POST` | `/api/destination` | 転送先番号を設定（認証必須） |
| `GET` | `/api/recordings` | 通話履歴をページング取得（認証必須） |
| `GET` | `/api/recordings/:uuid/download` | 録音ファイルをダウンロード（認証必須） |
| `GET` | `/login` | ポータルログインページ |
| `POST` | `/login` | ログイン認証 |
| `POST` | `/logout` | セッション終了 |
| `GET` | `/dashboard` | 管理ダッシュボード（認証必須） |

## 本番環境への展開（従来型）

### セキュリティ設定

1. `.env` に `NODE_ENV=production`、`LOG_LEVEL=warn` を設定
2. 強力なシークレットを生成：
   ```bash
   # PORTAL_PASSWORD
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   # SESSION_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. `.env` と `private.key` はリポジトリルート外に置き、絶対パスで参照することを推奨

### ビルドと起動

```bash
npm run build
NODE_ENV=production node dist/index.js
```

### プロセスマネージャー（推奨）

```bash
npm install -g pm2
pm2 start dist/index.js --name vonage-call-proxy
pm2 save
pm2 startup
```

### リバースプロキシ（nginxの例）

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY private.key ./private.key
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
npm run build
docker build -t vonage-call-proxy .
docker run -d --env-file .env -p 3000:3000 vonage-call-proxy
```

## プロジェクト構成

```
src/
├── domains/
│   ├── call/           # Vonageウェブフック処理・NCCO生成
│   ├── recording/      # 録音ライフサイクル・文字起こし取得
│   ├── destination/    # 転送先番号管理
│   └── portal/         # Webポータル（認証・ダッシュボード）
├── middleware/         # Expressミドルウェア（認証）
├── shared/             # 設定・ロガー・エラーハンドラー・Vonageクライアント
└── views/              # EJSテンプレート
tests/
├── domains/            # ドメイン別ユニットテスト
├── e2e/                # エンドツーエンド通話フローテスト
└── shared/             # 共通テストユーティリティとモック
```

## VCRプロジェクトファイル

```
vcr.yml              # VCR設定（開発用インスタンス）
production.yml       # VCR設定（本番用インスタンス、オプション）
.vcrignore           # VCRデプロイ除外ファイル
build.sh             # VCR用ビルドスクリプト
```

## ライセンス

MIT

### 音声Webhookとデプロイ

VCRはリンクされたVonageアプリケーションのvoice機能を管理しています。`vcr deploy` を実行するたびに、音声WebhookをVCR自身のcallback-routerへ書き戻します:

```
answer_url = https://callback-router.<region>.runtime.vonage.cloud/?provider=vonage-voice&action=vapi-answer-callback&...
```

routerは最終的に同じルートへ転送するため、callback-routerでも本インスタンス直接指定でも通話は成立します。デプロイ後に直接URLを明示的に再適用します:

```bash
npm run vcr:deploy            # vcr deploy の後、WebHookを自動再適用
npm run vonage:webhooks       # 今すぐ再適用（冪等）
npm run vonage:webhooks:check # 検証のみ。不一致なら非0終了
node scripts/apply-vonage-webhooks.mjs --dry-run   # 差分のみ表示
```

公開ベースURLの単一の情報源は `WEBHOOK_URL` です。NCCOの `answerUrl` にも使用されるため、内部URLではなく外部から到達可能なURLを設定してください。

`npm run check:vonage-key` は、インスタンスが実際に保持している鍵と、voice設定が通話を受理できる状態かを検証します（voice機能の存在、WebHookの到達可能性、`http_method` が `POST` であること）。routerはPOSTで送信するため、GETのみ対応のanswerルートでは404となり、着信は鳴って切断されます。
