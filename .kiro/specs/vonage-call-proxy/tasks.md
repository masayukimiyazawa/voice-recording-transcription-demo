# Implementation Plan

## 1. Foundation: environment and infrastructure setup
- [x] 1.1 Project scaffolding and shared utilities
  - Initialize Node.js project with TypeScript and essential dependencies (Express, Mongoose, dotenv, bcrypt, etc.)
  - Configure TypeScript, ESLint, and Prettier
  - Implement shared logger, error handler, and configuration loaders
  - Observable: `npm run build` succeeds and `src/` directory contains core shared files
  - _Requirements: 4.2, 4.3_
- [x] 1.2 Database and Vonage client initialization
  - Implement MongoDB connection logic using Mongoose
  - Implement Vonage SDK client singleton with JWT generation
  - Configure environment variable validation
  - Observable: Application starts without errors and connects to MongoDB Atlas
  - _Requirements: 4.2, 4.4_
- [x] 1.3 Test infrastructure setup
  - Configure Jest for unit and integration testing
  - Create mock utilities for Vonage API and MongoDB
  - Observable: `npm test` runs successfully with zero tests

## 2. Core: Call Handling and Recording
- [x] 2.1 (P) Call handling and NCCO generation
  - Implement Call Controller for `/call/answer` endpoint
  - Implement Call Service to build NCCO with `record` (split), `talk`, and `connect` actions
  - Implement Destination Repository to fetch current destination number
  - Observable: Calling the `/call/answer` endpoint returns a valid NCCO JSON array
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: Call, Destination_
- [x] 2.2 (P) Recording event processing
  - Implement Call Controller for `/event/recording` webhook
  - Implement Recording Repository for idempotent metadata upserts
  - Implement Recording Model with Mongoose schema and indexes
  - Observable: POSTing a recording webhook updates the MongoDB collection with correct metadata
  - _Requirements: 1.3, 2.3, 4.1_
  - _Boundary: Call, Recording_
- [x] 2.3 (P) Transcription retrieval and storage
  - Implement Transcription Service to fetch transcription via JWT
  - Implement Transcription Controller for `/event/transcription` webhook
  - Integrate Transcription Service with Recording Repository for async updates
  - Observable: POSTing a transcription webhook triggers retrieval and updates the recording document in MongoDB
  - _Requirements: 2.1, 2.2, 2.3_
  - _Boundary: Recording, Transcription_

## 3. Core: Destination and Portal Management
- [x] 3.1 (P) Destination management service
  - Implement Destination Service for CRUD operations
  - Implement Destination Repository and Mongoose model
  - Implement Destination Controller for `/api/destination` endpoints
  - Observable: API endpoints allow creating and retrieving the single destination number
  - _Requirements: 1.2, 3.2_
  - _Boundary: Destination_
- [x] 3.2 (P) Web portal authentication and session management
  - Implement Auth Middleware for session validation
  - Implement Portal Controller for login/logout routes
  - Implement password hashing using bcrypt
  - Observable: Successful login creates a session cookie and allows access to protected routes
  - _Requirements: 3.1_
  - _Boundary: Portal_
- [x] 3.3 (P) Web portal dashboard and call history
  - Implement Portal Controller for dashboard and call history queries
  - Implement Dashboard view with EJS templates
  - Implement paginated call history retrieval in Recording Repository
  - Observable: Authenticated user can view a list of recent calls on the dashboard
  - _Requirements: 3.3_
  - _Boundary: Portal, Recording_
- [x] 3.4 (P) Web portal destination and recording access
  - Implement Destination management UI in dashboard
  - Implement Recording Controller for file download endpoints
  - Implement secure download logic with authentication and rate limiting
  - Observable: User can update destination number and download call recordings via the portal
  - _Requirements: 3.2, 3.4_
  - _Boundary: Portal, Destination, Recording_

## 4. Integration and Validation
- [x] 4.1 End-to-end call flow validation
  - Implement E2E test simulating inbound call → recording webhook → transcription webhook
  - Verify final state in MongoDB (metadata + transcription)
  - Observable: E2E test suite passes for a full call lifecycle
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1_
- [x] 4.2 Error handling and edge case validation
  - Test invalid NCCO generation
  - Test transcription retrieval retries and failure handling
  - Test unauthorized access to portal and downloads
  - Observable: System handles errors gracefully and logs appropriately
  - _Requirements: 1.4, 3.1, 3.4_
- [x] 4.3* Baseline test coverage
  - Implement unit tests for core service logic (Call, Transcription, Destination)
  - Implement integration tests for webhook and repository layers
  - Observable: Test coverage report shows significant coverage of core logic
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1_
