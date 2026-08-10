# Vonage Call Proxy

A Node.js/Express service that handles inbound calls via Vonage LVN, plays an automated greeting, transfers the call to a configured destination number, records the conversation with speaker separation, and transcribes the audio asynchronously. A password-protected web portal allows administrators to manage the destination number and access call recordings and transcriptions stored in MongoDB Atlas.

## Features

- Inbound call handling via Vonage Voice API (NCCO-based control)
- 1:1 call recording with split-channel audio
- Asynchronous transcription retrieval via Vonage native service
- Persistent storage of call metadata and transcriptions in MongoDB Atlas
- Password-protected web portal for destination management and call history
- Environment-based configuration with `.env` file

## Prerequisites

- Node.js 18 LTS or later
- MongoDB Atlas cluster (connection URI)
- Vonage account with:
  - A provisioned Vonage LVN (virtual number)
  - A Vonage Voice Application with answer and event webhook URLs configured
  - A private key file downloaded from the Vonage Dashboard

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url>
cd vonage-call-proxy
npm install
```

### 2. Configure environment

```bash
cp .env.sample .env
```

Edit `.env` and fill in your credentials:

| Variable | Description |
|---|---|
| `VONAGE_API_KEY` | Vonage API key |
| `VONAGE_API_SECRET` | Vonage API secret |
| `VONAGE_APPLICATION_ID` | Vonage Voice Application ID |
| `VONAGE_PRIVATE_KEY_PATH` | Path to the downloaded private key file (e.g. `./private.key`) |
| `VONAGE_LVN` | Your Vonage virtual number in E.164 format |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `PORTAL_PASSWORD` | Admin portal password |
| `SESSION_SECRET` | Secret for signing session cookies (see generation command in `.env.sample`) |

### 3. Start the server

```bash
# Development (with ts-node)
npm run dev

# Production (compile first)
npm run build
npm start
```

The server listens on `PORT` (default `3000`).

### 4. Configure Vonage webhooks

In the Vonage Dashboard, set your Voice Application webhooks to:

| Webhook | URL |
|---|---|
| Answer URL | `https://<your-domain>/call/answer` (GET) |
| Event URL | `https://<your-domain>/event/recording` (POST) |
| Transcription URL | `https://<your-domain>/event/transcription` (POST) |

Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) for local development (no account required):

```bash
# Install cloudflared (macOS)
brew install cloudflared

# Start a temporary public tunnel
cloudflared tunnel --url http://localhost:3000
```

Cloudflare will print a temporary `https://*.trycloudflare.com` URL — use that as your Vonage webhook base URL.

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npx jest --coverage
```

Tests use Jest with ts-jest. No external services are required — all dependencies are mocked.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/call/answer` | Vonage answer webhook — returns NCCO |
| `POST` | `/event/recording` | Vonage recording webhook |
| `POST` | `/event/transcription` | Vonage transcription webhook |
| `GET` | `/api/destination` | Get current destination number |
| `POST` | `/api/destination` | Set destination number (auth required) |
| `GET` | `/api/recordings` | Paginated call history (auth required) |
| `GET` | `/api/recordings/:uuid/download` | Download recording audio (auth required) |
| `GET` | `/login` | Portal login page |
| `POST` | `/login` | Submit login credentials |
| `POST` | `/logout` | End session |
| `GET` | `/dashboard` | Admin dashboard (auth required) |

## Production Deployment

### Environment hardening

1. Set `NODE_ENV=production` and `LOG_LEVEL=warn` in `.env`
2. Generate strong secrets:
   ```bash
   # PORTAL_PASSWORD
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   # SESSION_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Store `.env` and `private.key` outside the repository root and reference them via absolute paths

### Build and run

```bash
npm run build
NODE_ENV=production node dist/index.js
```

### Process manager (recommended)

```bash
npm install -g pm2
pm2 start dist/index.js --name vonage-call-proxy
pm2 save
pm2 startup
```

### Reverse proxy (nginx example)

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

## Project Structure

```
src/
├── domains/
│   ├── call/           # Vonage webhook handling and NCCO generation
│   ├── recording/      # Recording lifecycle, transcription retrieval
│   ├── destination/    # Destination number management
│   └── portal/         # Web portal (auth, dashboard)
├── middleware/         # Express middleware (auth)
├── shared/             # Config, logger, error handler, Vonage client
└── views/              # EJS templates
tests/
├── domains/            # Unit tests per domain
├── e2e/                # End-to-end call flow tests
└── shared/             # Shared test utilities and mocks
```

## License

MIT
