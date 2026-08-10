# Research & Design Decisions

## Summary
- **Feature**: `vonage-call-proxy`
- **Discovery Scope**: New Feature (greenfield)
- **Key Findings**:
  - Vonage Voice API provides comprehensive recording and transcription via NCCO (Nexmo Call Control Objects) with webhook-based event delivery
  - Call recording files are retained by Vonage for 30 days; recordings must be downloaded and persisted to MongoDB for long-term storage
  - Transcription service returns webhook payloads with transcription_url; authenticated JWT downloads are required for file access
  - Split recording enables stereo capture separating caller/callee audio, essential for transcription systems to identify speakers

## Research Log

### Vonage Voice API Call Recording and Transfer Mechanics
- **Context**: Requirements specify call handling via Voice Proxy, recording, and transcription. Must understand Vonage's native capabilities.
- **Sources Consulted**: 
  - [Vonage Voice API Recording Documentation](https://developer.vonage.com/en/voice/voice-api/concepts/recording)
  - [Vonage Call Transfer Code Snippet](https://developer.vonage.com/voice/voice-api/code-snippets/controlling-conversations/transfer-a-call-inline-ncco)
  - GitHub issues (#915) on Vonage Node SDK for transfer patterns
- **Findings**:
  - NCCO (Nexmo Call Control Objects) is the standard format for call control instructions
  - `record` action with `transcription` property enables built-in transcription with language/sentiment options
  - Asynchronous recording (no `endOnSilence`, `endOnKey`, `timeout`) continues recording until call ends
  - Recording webhook payload includes `recording_uuid`, `transcription_url`, and status field
  - Transcription is a chargeable feature; 2-hour maximum limit for call duration
  - Call transfers via `transferCallWithNCCO()` method or PUT API with inline NCCO definitions
  - Vonage retains recordings for 30 days; persistent storage must be external (MongoDB Atlas)
- **Implications**:
  - Application must handle webhook callbacks for recording/transcription completion events
  - JWT authentication required to download recordings and transcription payloads
  - Recording lifecycle is tied to call termination; asynchronous mode keeps call active during transfer
  - Split recording (`"split": "conversation"`) recommended to separate caller/callee audio for better transcription accuracy

### Node.js Call Transcription Service Architecture
- **Context**: Requirements specify transcription processing after call ends. Evaluated patterns for reliable, scalable transcription pipelines.
- **Sources Consulted**:
  - Twilio Real-Time Transcription with WebSocket integration
  - AssemblyAI Node.js SDK and polling patterns
  - RabbitMQ + Node.js architecture for parallel transcription processing (hashnode.dev, 2025)
  - Picovoice on-device transcription vs cloud-based approaches
- **Findings**:
  - Cloud-based transcription (Vonage's native, AssemblyAI, Deepgram) introduces network latency but simplifies architecture
  - Webhook-driven model: recording completes → webhook triggers transcription retrieval → store result asynchronously
  - Message queue patterns (RabbitMQ, Bull) decouple transcription jobs from API response path, enabling horizontal scaling
  - Confidence scores and speaker labels improve transcription quality; Vonage's built-in sentiment analysis reduces downstream processing
  - Error handling patterns: retry logic for failed downloads, graceful degradation if transcription unavailable, circuit breakers for external APIs
  - Polling strategies (exponential backoff) reliable for 30-second to 5-minute jobs; webhooks preferred for real-time status
- **Implications**:
  - Use Vonage's native transcription service to simplify architecture and reduce external dependencies
  - Implement webhook handler for asynchronous result storage to MongoDB
  - No message queue needed for MVP; simple async/await patterns sufficient for initial load
  - Vonage transcription_url payload retrieval must occur server-side with JWT authentication

### MongoDB Atlas Data Modeling for Call Recording Metadata
- **Context**: Requirements specify storage of transcribed text, caller/destination IDs, and recordings in MongoDB Atlas.
- **Sources Consulted**:
  - MongoDB Atlas Best Practices (github.com/lakshmantgld/mongoDB-Atlas)
  - MongoDB Atlas Architecture Center (official docs)
  - AI memory systems with MongoDB Atlas + semantic search (blog.mongodb.com, 2025)
  - Schema design principles: query-driven design, embedding vs referencing
- **Findings**:
  - Document-oriented design: embed transcription metadata (confidence, sentiments) within recording document
  - Collection structure: single `recordings` collection with fields for conversation_uuid, recording_uuid, transcription_url, transcribed_text, caller_id, destination_id, created_at, updated_at
  - Indexes on `caller_id`, `destination_id`, `created_at` for efficient querying and filtering
  - TTL (Time-To-Live) indexes can auto-expire records after 30 days if syncing Vonage's retention policy
  - Working set analysis: call metadata typically small (<10KB per document), indexes fit easily in RAM
  - Data consistency: atomic writes ensure recording + metadata + transcription stored together; no distributed transactions needed
  - Scaling: sharding by `caller_id` or `created_at` for future high-volume scenarios
- **Implications**:
  - Use flat embedding model (no nested referencing) for recording documents; simplifies queries and reduces joins
  - Index strategy: primary index on `created_at` for recent calls; secondary on `caller_id`/`destination_id` for search
  - Single collection suffices for MVP; no need for separate metadata or indexing collections
  - Store recording file URL and transcription_url in MongoDB for later retrieval; do not embed audio in documents

### Web Portal Authentication and Data Access Pattern
- **Context**: Requirements specify password-protected web interface for destination management and call data retrieval.
- **Sources Consulted**:
  - Twilio/Vonage developer security patterns
  - Node.js Express + JWT/session-based auth comparisons
  - Password hashing best practices (bcrypt, argon2)
- **Findings**:
  - Session-based authentication (Express middleware, HTTPOnly cookies) preferred over JWT for server-rendered portals
  - Password must be hashed server-side using bcrypt (slowdown factor 10-12 iterations) or argon2
  - Authorization layer: middleware checks session/role before allowing destination updates or recording downloads
  - Stateless design: store session in-memory (development) or Redis (production)
  - File download security: validate URL, set Content-Disposition header, limit download rate to prevent abuse
  - CORS and CSRF protections for web forms and APIs
- **Implications**:
  - Use Express + bcrypt for simple password auth; session stored in memory for MVP
  - All recording/transcription downloads must be authenticated; do not expose direct MongoDB queries to client
  - Implement rate limiting on download endpoints (e.g., 10 requests/minute per user)

### Architecture Pattern Selection
- **Context**: Feature involves multiple domains: call signaling (Vonage), transcription (Vonage callback), data persistence (MongoDB), web UI (Node.js/Express).
- **Options Evaluated**:
  1. **Monolithic Express app** (single server, all logic in-process) — Pros: simple, low ops overhead; Cons: coupling, scaling limits
  2. **Microservices** (separate Call Handler, Transcription Worker, Web Service) — Pros: independent scaling, clear boundaries; Cons: complexity, overhead for MVP
  3. **Layered hexagonal** (Controller/Service/Repository) — Pros: testable, decoupled from framework; Cons: boilerplate
  4. **Event-driven with message queue** — Pros: async resilience, replay capability; Cons: operational overhead
- **Selected Approach**: Layered hexagonal within a monolithic Express application
  - Call Handler Service (webhook endpoints for incoming calls, recording events)
  - Transcription Service (async retrieval and storage of transcription results)
  - Recording Repository (MongoDB persistence layer)
  - Web Portal Controller (session auth, destination management, call data queries)
  - Separation of concerns via dependency injection; TypeScript for type safety
  - No message queue initially; async/await and job queue library (Bull) added in Phase 2 if load requires
- **Rationale**: Balances simplicity (single deployment) with modularity (testable, extensible); aligns with Node.js Express ecosystem best practices
- **Trade-offs**: Monolithic deployment limits horizontal scaling of individual services; message queue deferred to Phase 2

### Technology Stack Alignment
- **Backend Framework**: Express.js (Node.js 18+) for HTTP server and webhook handling
- **Voice API**: Vonage Node.js SDK (@vonage/server-sdk) for call operations (transfer, record, transcription initiation)
- **Data Persistence**: MongoDB Atlas (cloud-managed) with Mongoose (ODM) for document modeling and queries
- **Authentication**: bcrypt for password hashing, Express session middleware + HTTPOnly cookies
- **Environment**: Node 18+ LTS for stability; environment variables via dotenv
- **Testing**: Jest for unit/integration tests; direct MongoDB for integration tests; mocked Vonage SDK for unit tests
- **Rationale**: Vonage provides Node.js SDK; MongoDB Atlas is cloud-native, scales automatically, supports document queries; Express proven for webhook handling; bcrypt is industry standard

## Design Decisions

### Decision: Asynchronous Recording Strategy with Webhook-Driven Transcription Retrieval
- **Context**: Vonage records calls asynchronously while control flows to next NCCO action. Transcription service sends webhook callback on completion.
- **Alternatives Considered**:
  1. Synchronous polling: Periodically check transcription_url for results — slow, wasteful
  2. Real-time streaming transcription (WebSocket) — higher complexity, not offered by Vonage's built-in service
  3. Third-party transcription service (AssemblyAI, Deepgram) — additional vendor lock-in, cost, latency
- **Selected Approach**: Vonage native transcription with webhook callbacks → Transcription Service retrieves via JWT-authenticated GET → MongoDB async storage
- **Rationale**: Vonage's built-in transcription is chargeable but eliminates vendor switching; webhook eliminates polling latency; JWT auth is built into Vonage SDK
- **Trade-offs**: Locked into Vonage transcription language/quality; 2-hour call duration limit; chargeable feature
- **Follow-up**: Monitor transcription costs; evaluate AssemblyAI fallback in Phase 2 if Vonage is insufficient

### Decision: Split Recording for Caller/Callee Separation
- **Context**: Default recording mixes both parties; split recording provides stereo file with separate channels.
- **Alternatives Considered**:
  1. Mono recording (default) — simpler, but caller/callee speaker identification requires inference
  2. Multi-channel recording — overkill for two-party calls; complex setup
- **Selected Approach**: Enable `"split": "conversation"` on `record` action to produce stereo file
- **Rationale**: Transcription systems can identify speaker turns via channel separation; improves transcription accuracy without post-processing
- **Trade-offs**: Slightly larger file size (stereo vs mono); Vonage still returns single MP3/WAV file
- **Follow-up**: If speaker labeling required, evaluate Vonage sentiment analysis or downstream NLP models

### Decision: Session-Based Authentication Over JWT for Web Portal
- **Context**: Web portal serves server-rendered HTML + API endpoints for destination management and file downloads.
- **Alternatives Considered**:
  1. JWT tokens (stateless, scalable) — overkill for simple portal; complicates client-side storage
  2. OAuth/SAML (enterprise auth) — premature; single admin user for MVP
  3. API Key (system-to-system) — not applicable for human users
- **Selected Approach**: Express session middleware with HTTPOnly, Secure cookies; password hashed with bcrypt
- **Rationale**: Session simplifies server-side authorization checks; HTTPOnly prevents XSS token theft; familiar pattern for Node.js apps
- **Trade-offs**: Session state requires memory or Redis; doesn't scale to microservices without shared session store
- **Follow-up**: Migrate to JWT if web portal becomes multi-instance or federated; add Redis session store if load exceeds single server

### Decision: Embed Transcription Metadata in Recording Document (No Separate Collections)
- **Context**: Recording, transcription, and metadata all related to single call; must decide on MongoDB schema structure.
- **Alternatives Considered**:
  1. Separate `recordings` and `transcriptions` collections with foreign key references — normalized, but JOIN-like queries required
  2. Single collection with nested subdocuments — simpler queries, denormalized
- **Selected Approach**: Single `recordings` collection with embedded transcription object: `{ ..., transcription: { text, confidence, sentiments, ... } }`
- **Rationale**: MongoDB is document-oriented; embedding eliminates query complexity; transcription lifecycle always tied to recording
- **Trade-offs**: Storage duplication if transcriptions indexed separately; denormalization slightly increases document size
- **Follow-up**: If analytics or transcription search becomes separate concern, consider materialized view or separate collection with lookup stage

## Risks & Mitigations

- **Risk**: Vonage recording retained only 30 days; if download fails, data lost
  - **Mitigation**: Download immediately upon recording webhook; retry logic with exponential backoff; alert on download failure

- **Risk**: Transcription service costs; unbounded usage could spike bill
  - **Mitigation**: Set Vonage account spending limits; monitor transcription volume; evaluate fallback services

- **Risk**: Transcription 2-hour limit excludes long calls
  - **Mitigation**: Document as limitation; monitor call durations; consider splitting long calls into segments in Phase 2

- **Risk**: MongoDB Atlas credentials exposed in .env file
  - **Mitigation**: Rotate credentials regularly; use VPC peering in production; enable IP allowlist; audit access logs

- **Risk**: Single admin password insufficient for multi-user deployment
  - **Mitigation**: Migrate to OAuth/SAML in Phase 2; implement role-based access control

- **Risk**: Recording files consume unbounded MongoDB storage
  - **Mitigation**: Set TTL indexes (30 days or user-configured); implement archival to S3 in Phase 2

## References
- [Vonage Voice API Recording Documentation](https://developer.vonage.com/en/voice/voice-api/concepts/recording)
- [Vonage Call Transfer Code Snippet](https://developer.vonage.com/voice/voice-api/code-snippets/controlling-conversations/transfer-a-call-inline-ncco)
- [Vonage Node.js SDK GitHub](https://github.com/Vonage/vonage-node-sdk)
- [MongoDB Atlas Best Practices](https://github.com/lakshmantgld/mongoDB-Atlas)
- [MongoDB Atlas Architecture Center](https://www.mongodb.com/docs/atlas/architecture/current)
- [Express.js Session Middleware](https://expressjs.com/en/resources/middleware/session.html)
