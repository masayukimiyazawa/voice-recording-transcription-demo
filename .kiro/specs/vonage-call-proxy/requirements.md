# Requirements Document

## Introduction
This document defines the requirements for the Vonage Call Proxy system. The system handles incoming calls via Vonage LVN, plays an automated response, transfers the call using Voice Proxy, records the 1:1 conversation, and performs transcription. It also provides a password-protected web interface for managing destination numbers and accessing call recordings and transcriptions.

## Boundary Context
- **In scope**: Vonage call flow management (auto-response, proxy transfer, recording), transcription processing, web frontend (authentication, number input, data display), MongoDB Atlas integration, and environment configuration management.
- **Out of scope**: Real-time audio editing, telephony hardware management, advanced call analytics (e.g., sentiment analysis), or third-party CRM integrations.
- **Adjacent expectations**: Requires reliable Vonage API connectivity and a functional MongoDB Atlas instance.

## Requirements

### 1. Call Handling and Proxying
**Objective:** As a system, I want to manage incoming calls and transfer them to a destination number to facilitate recording.

#### Acceptance Criteria
1. When an incoming call is received on the Vonage LVN, the Call Proxy Service shall play the configured automated response message.
2. When the automated response finishes, the Call Proxy Service shall transfer the call to the specified destination number using Voice Proxy.
3. While the call is active between the two parties, the Call Proxy Service shall record the 1:1 conversation.
4. If the call transfer fails, the Call Proxy Service shall log the error and notify the administrator.

### 2. Transcription Service
**Objective:** As a user, I want the recorded calls to be transcribed so that I can read the conversation.

#### Acceptance Criteria
1. When a call ends, the Transcription Service shall initiate the transcription process for the recorded audio.
2. The Transcription Service shall generate a text representation of the spoken content.
3. When transcription is complete, the Transcription Service shall store the text alongside the caller and destination phone numbers in MongoDB Atlas.

### 3. Web Interface and Authentication
**Objective:** As an authorized user, I want to manage call destinations and view call data via a secure web portal.

#### Acceptance Criteria
1. The Web Portal shall require password authentication for all access.
2. When a user is authenticated, the Web Portal shall allow the input and saving of a destination phone number.
3. When a call record is retrieved, the Web Portal shall display the transcribed text.
4. When a user requests a recording, the Web Portal shall provide a download button for the audio file.

### 4. Data Management and Configuration
**Objective:** As a system administrator, I want to manage sensitive credentials and persist call data securely.

#### Acceptance Criteria
1. The system shall store transcribed text, caller ID, and destination ID in MongoDB Atlas.
2. The system shall load all sensitive credentials (Vonage API keys, MongoDB URI, Web credentials) from an `.env` file.
3. The system shall provide an `.env.sample` file as a template for environment configuration.
