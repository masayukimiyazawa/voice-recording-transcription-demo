# Vonage Call Proxy

A Node.js/Express service that handles inbound calls via Vonage LVN, plays an automated greeting, transfers the call to a configured destination number, records the conversation with speaker separation, and transcribes the audio asynchronously. A password-protected web portal allows administrators to manage the destination number and access call recordings and transcriptions stored in MongoDB Atlas.

## Features

- Inbound call handling via Vonage Voice API (NCCO-based control)
- 1:1 call recording with split-channel audio
- Asynchronous transcription retrieval via Vonage native service
- Persistent storage of call metadata and transcriptions in MongoDB Atlas
- Password-protected web portal for destination management and call history
- Environment-based configuration with `.env` file
- **Deployable to Vonage Cloud Runtime (VCR)**

## Prerequisites

- Node.js 22 LTS or later (required for VCR SDK >= 2.1.0)
- MongoDB Atlas cluster (connection URI)
- Vonage account with:
  - A provisioned Vonage LVN (virtual number)
  - A Vonage Voice Application with answer and event webhook URLs configured
  - A private key file downloaded from the Vonage Dashboard
- **For VCR deployment**: Vonage Cloud Runtime CLI (`vcr`) installed

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

## Vonage Cloud Runtime (VCR) Deployment

### Prerequisites for VCR

1. **Install VCR CLI**:
   ```bash
   # macOS / Linux
   curl -L https://raw.githubusercontent.com/Vonage/cloud-runtime-cli/main/script/install.sh | sh
   
   # Windows (PowerShell)
   pwsh -Command "iwr https://raw.githubusercontent.com/Vonage/cloud-runtime-cli/main/script/install.ps1 -useb | iex"
   ```

2. **Configure VCR CLI**:
   ```bash
   vcr configure
   ```
   Enter your Vonage API key, secret, and select a region (e.g., `aws.euw1` for EU West).

3. **Create a Vonage Application** (if not already created):
   ```bash
   vcr app create --voice --messages
   ```
   This creates a Vonage Application and downloads the private key. Note the Application ID.

### Local Development with VCR Debug

1. Update `vcr.yml` with your debug Application ID (can be different from production):
   ```yaml
   debug:
     application-id: "your-debug-application-id"
   ```

2. Start the debug session:
   ```bash
   npm run debug
   # or
   vcr debug
   ```

3. **VSCode Debugging**: Create `.vscode/launch.json`:
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
   Then press F5 to start debugging with breakpoints.

### Deploy to VCR

1. Update `vcr.yml` with your production values:
   - `instance.application-id`: Your Vonage Application ID
   - `instance.region`: Your preferred region (e.g., `aws.euw1`, `aws.use1`, `aws.apse1`, `aws.apse2`)

2. Deploy:
   ```bash
   npm run vcr:deploy
   ```
   Prefer this over a bare `vcr deploy`. VCR owns the voice capability of
   the linked application and re-points `answer_url` / `event_url` /
   `fallback_answer_url` at its own callback router on **every** deploy, so
   the wrapper re-applies this instance's routes afterwards and verifies them.
   A bare `vcr deploy` leaves the application on the callback router.

   This will:
   - Configure Vonage Application webhooks automatically
   - Package and upload your application
   - Run the build script
   - Start the instance
   - Re-apply and verify the voice webhooks

3. View deployment:
   ```bash
   vcr instance list
   ```

4. View logs:
   ```bash
   vcr instance log --project-name vonage-call-proxy --instance-name dev --follow
   ```

### Production Deployment with Separate Config

For production, create a `production.yml`:
```bash
cp vcr.yml production.yml
# Edit production.yml with production instance name, region, and application-id
```

Deploy with:
```bash
npm run vcr:deploy:prod
# or
vcr deploy --filename production.yml
```

### VCR Configuration Files

- `vcr.yml` - Main configuration (development instance; git-ignored, holds your real IDs)
- `vcr.yml.example` - Committed template with placeholder IDs
- `production.yml` - Production configuration (optional)
- `.vcrignore` - Files excluded from deployment (node_modules, tests, etc.)
- `build.sh` - Installs dependencies (including dev) and compiles TypeScript. Secrets are never copied into `dist/`

### Environment Variables in VCR

VCR injects these environment variables automatically:
- `VCR_PORT` - Port to bind to (required)
- `VCR_REGION` - Deployment region
- `VCR_PRIVATE_KEY` - Vonage application private key
- `VCR_API_APPLICATION_ID` - Vonage Application ID
- `VCR_INSTANCE_PUBLIC_URL` - Public URL of the deployed instance
- And more...

Your application must listen on `VCR_PORT` and bind to `0.0.0.0`.

### Secrets Management

Secrets are defined in `vcr.yml` under `instance.secrets` and referenced in `instance.environment` with `secret: SECRET_NAME`. Set them via the VCR Dashboard or CLI before deployment.

### Login Brute-Force Protection

Failed `POST /login` attempts are counted per client IP. All settings are optional and fall back to these defaults:

| Variable | Default | Meaning |
| --- | --- | --- |
| `LOGIN_RATE_LIMIT_ENABLED` | `true` | Master switch |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | Window in which failures are counted (15 min) |
| `LOGIN_RATE_LIMIT_MAX_FAILURES` | `5` | Failures tolerated per client per window |
| `LOGIN_RATE_LIMIT_BASE_LOCKOUT_MS` | `60000` | First lockout duration (1 min) |
| `LOGIN_RATE_LIMIT_MAX_LOCKOUT_MS` | `900000` | Cap for the escalating lockout (15 min) |
| `LOGIN_RATE_LIMIT_GLOBAL_MAX_FAILURES` | `30` | Fleet-wide failure ceiling; `0` disables |
| `LOGIN_RATE_LIMIT_GLOBAL_LOCKOUT_MS` | `300000` | Lockout when the ceiling trips (5 min) |

Behaviour:
- Exceeding the per-client threshold returns `429` with a `Retry-After` header, and further attempts are rejected **even if the password is correct**.
- The lockout doubles on each subsequent lockout, up to `LOGIN_RATE_LIMIT_MAX_LOCKOUT_MS`.
- A successful login clears that client's counter.
- The fleet-wide ceiling is deliberately **shorter** than the per-client lockout. Its only job is to slow a distributed or `X-Forwarded-For`-spoofing attack; a long fleet-wide lockout would let an attacker deny the real administrator access indefinitely.
- Password comparison is constant-time (SHA-256 + `timingSafeEqual`); bcrypt hashes are compared with `bcrypt.compare`.

Limitation: counters live in process memory, so they are per-instance and reset on restart. If you scale the app to multiple instances, move this state to a shared store (MongoDB is already a dependency) or a restart will clear the counters.

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
| `GET` | `/_/health` | Health check (VCR required) |
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

## Production Deployment (Traditional)

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

## VCR Project Files

```
vcr.yml              # VCR configuration (dev instance)
production.yml       # VCR configuration (prod instance, optional)
.vcrignore           # Files excluded from VCR deployment
build.sh             # Build script for VCR
```

## License

MIT

### Voice webhooks and deployments

VCR manages the voice capability of the linked Vonage application. On every
`vcr deploy` it re-points the voice webhooks at its own callback router:

```
answer_url = https://callback-router.<region>.runtime.vonage.cloud/?provider=vonage-voice&action=vapi-answer-callback&...
```

The app serves the same routes the router forwards to, so both that and a
direct pointer at this instance can serve calls. The direct pointer is made
explicit after each deploy:

```bash
npm run vcr:deploy            # vcr deploy, then re-apply the webhooks
npm run vonage:webhooks       # re-apply now (idempotent)
npm run vonage:webhooks:check # verify only, non-zero exit on drift
node scripts/apply-vonage-webhooks.mjs --dry-run   # show the diff
```

`WEBHOOK_URL` is the single source of truth for the public base URL. It is
also used for the NCCO `answerUrl`, so it must be the externally reachable
URL, not an internal one.

`npm run check:vonage-key` verifies the deployed instance reports the key it
actually holds and that the voice configuration can serve calls: the voice
capability exists, the webhooks are routable, and `http_method` is `POST`.
The router POSTs, so a GET-only answer route returns 404 and inbound calls
ring once and then drop.
