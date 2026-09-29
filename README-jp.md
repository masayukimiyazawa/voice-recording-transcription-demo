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

- Node.js 22 LTS 以降（VCR SDK >= 2.1.0 では必須）
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
   vcr app create --voice --messages
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

### VCRへのデプロイ

1. `vcr.yml` に本番用の値を設定:
   - `instance.application-id`: Vonage Application ID
   - `instance.region`: リージョン（`aws.euw1`, `aws.use1`, `aws.apse1`, `aws.apse2` など）

2. デプロイ実行:
   ```bash
   npm run vcr:deploy
   # または
   vcr deploy
   ```

   以下が自動実行されます:
   - Vonage ApplicationのWebhook自動設定
   - アプリケーションのパッケージ化とアップロード
   - ビルドスクリプトの実行
   - インスタンスの起動

3. デプロイ確認:
   ```bash
   vcr instance list
   ```

4. ログの確認:
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

### シークレット管理

シークレットは `vcr.yml` の `instance.secrets` で定義し、`instance.environment` で `secret: SECRET_NAME` として参照します。デプロイ前にVCRダッシュボードまたはCLIで設定してください。

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
