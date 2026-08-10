# Vonage Call Proxy

Vonage LVN（仮想番号）経由で着信を受け付け、自動応答メッセージを再生し、設定済みの転送先番号に通話を接続するNode.js/Expressサービスです。通話は話者分離付きで録音され、Vonageネイティブの文字起こし機能によって非同期にトランスクリプトが生成されます。通話メタデータと文字起こしはMongoDB Atlasに保存され、パスワード保護されたWebポータルから管理できます。

## 主な機能

- Vonage Voice API（NCCO方式）による着信ハンドリング
- 話者分離（2チャンネル）付き通話録音
- Vonageネイティブ機能による非同期文字起こし取得
- 通話メタデータ・文字起こしのMongoDB Atlas永続化
- 転送先番号管理・通話履歴閲覧のためのWebポータル（パスワード認証）
- `.env` ファイルによる環境設定管理

## 事前準備

- Node.js 18 LTS 以降
- MongoDB Atlas クラスター（接続URI）
- Vonage アカウント（以下が必要）
  - プロビジョニング済みのVonage LVN（仮想番号）
  - Answer/Event WebhookのURLが設定されたVonage Voice Application
  - VonageダッシュボードからダウンロードしたPrivate Keyファイル

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
| `GET` | `/health` | ヘルスチェック |
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

## 本番環境への展開

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
FROM node:18-alpine
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

## ライセンス

MIT
