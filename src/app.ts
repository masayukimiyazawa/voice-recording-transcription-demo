/**
 * Express application setup and middleware configuration
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import { errorHandler } from './shared/error.handler.js';
import { logger } from './shared/logger.js';
import { config } from './shared/config.js';
import { CallController } from './domains/call/call.controller.js';
import { CallService } from './domains/call/call.service.js';
import { DestinationRepository } from './domains/destination/destination.repository.js';
import { DestinationController } from './domains/destination/destination.controller.js';
import { DestinationService } from './domains/destination/destination.service.js';
import { RecordingService } from './domains/recording/recording.service.js';
import { RecordingRepository } from './domains/recording/recording.repository.js';
import { RecordingController } from './domains/recording/recording.controller.js';
import { TranscriptionService } from './domains/recording/transcription.service.js';
import { TranscriptionController } from './domains/recording/transcription.controller.js';
import { PortalController } from './domains/portal/portal.controller.js';
import { PortalService } from './domains/portal/portal.service.js';
import { DashboardController } from './domains/portal/dashboard.controller.js';
import { DiagnosticsController } from './domains/diagnostics/diagnostics.controller.js';
import { SettingsRepository } from './domains/settings/settings.repository.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { LoginRateLimiter, loginRateLimitMiddleware } from './middleware/login.rate-limit.js';

// Get the base directory path
const baseDir = path.resolve(process.cwd(), 'src');
// config.validateConfig() already rejects a missing SESSION_SECRET, so an
// insecure hardcoded fallback would only ever mask a misconfigured deploy.
const sessionSecret = config.sessionSecret;

export function createApp(): Express {
  const app = express();

  // VCR routes inbound traffic through an internal proxy, so the socket address
  // is the proxy's. Trusting X-Forwarded-For is required for req.ip to identify
  // the real client, which login rate limiting keys on.
  app.set('trust proxy', true);

  // Brute-force protection for the portal password
  const loginLimiter = new LoginRateLimiter(config.loginRateLimit);

  // Initialize domain services and controllers
  const destinationRepository = new DestinationRepository();
  const recordingRepository = new RecordingRepository();
  const settingsRepository = new SettingsRepository();
  const callService = new CallService(destinationRepository, settingsRepository);
  const recordingService = new RecordingService(recordingRepository);
  const transcriptionService = new TranscriptionService(recordingRepository);
  const callController = new CallController(callService, recordingService);
  const destinationService = new DestinationService(destinationRepository);
  const destinationController = new DestinationController(destinationService);
  const recordingController = new RecordingController(recordingRepository);
  const transcriptionController = new TranscriptionController(transcriptionService);
  const portalService = new PortalService();
  const portalController = new PortalController(portalService, settingsRepository, loginLimiter);
  const dashboardController = new DashboardController(recordingRepository);
  const diagnosticsController = new DiagnosticsController();

  // View engine setup
  app.set('view engine', 'ejs');
  app.set('views', path.join(baseDir, 'views'));

  // Middleware: Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Middleware: Session
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
    })
  );

  // Middleware: Static files
  app.use(express.static(path.join(baseDir, 'public')));

  // Middleware: Request logging
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    logger.info(`${_req.method} ${_req.path}`);
    next();
  });

  // Health check endpoint (VCR requires /_/health)
  app.get('/_/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Root: send visitors to the login form, or to the dashboard when a valid
  // session cookie is already present.
  app.get('/', (req: Request, res: Response) => {
    res.redirect((req as any).session?.authenticated ? '/dashboard' : '/login');
  });

  // Portal routes (public)
  app.get('/login', (req: Request, res: Response, _next: NextFunction) => {
    portalController.renderLogin(req, res);
  });

  app.post('/login', loginRateLimitMiddleware(loginLimiter), (req: Request, res: Response, next: NextFunction) => {
    portalController.login(req, res).catch(next);
  });

  app.post('/logout', (req: Request, res: Response, next: NextFunction) => {
    portalController.logout(req, res).catch(next);
  });

  // Vonage 通話イベント受信エンドポイント（通話状態変化の通知）
  app.get('/event', (req: Request, res: Response) => {
    logger.info('Vonage call event (GET)', { query: req.query });
    res.status(200).end();
  });
  app.post('/event', (req: Request, res: Response) => {
    logger.info('Vonage call event (POST)', { body: req.body });
    res.status(200).end();
  });

  // Vonage may invoke the answer URL as GET or POST depending on the
  // application's webhook configuration; both must serve an NCCO or the call
  // is dropped immediately.
  const answerCall = (req: Request, res: Response, next: NextFunction) => {
    callController.answerCall(req, res).catch(next);
  };
  app.get('/call/answer', answerCall);
  app.post('/call/answer', answerCall);

  app.post('/event/recording', (req: Request, res: Response, next: NextFunction) => {
    callController.handleRecordingWebhook(req, res).catch(next);
  });

  app.post('/event/transcription', (req: Request, res: Response, next: NextFunction) => {
    transcriptionController.handleTranscriptionWebhook(req, res).catch(next);
  });

  // Operational diagnostics (authenticated).
  // A 503 here means the runtime private key no longer matches the key
  // registered on the Vonage application, which silently breaks recording and
  // transcription downloads. Monitored by .github/workflows/vonage-key-check.yml
  app.get('/_/diagnostics/vonage-key', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    diagnosticsController.checkVonageKey(req, res).catch(next);
  });

  // Detects silent rewrites of the application's answer/event webhooks, which
  // make inbound calls ring without ever reaching this app.
  app.get('/_/diagnostics/vonage-webhooks', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    diagnosticsController.checkVonageWebhooks(req, res).catch(next);
  });

  // Destination routes (authenticated)
  app.get('/api/destination', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    destinationController.getDestination(req, res).catch(next);
  });

  app.post('/api/destination', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    destinationController.setDestination(req, res).catch(next);
  });

  // Recording routes (authenticated)
  app.get('/api/recordings', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    dashboardController.getCallHistory(req, res).catch(next);
  });

  app.get('/api/recordings/:uuid/download', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    recordingController.downloadRecording(req, res).catch(next);
  });

  // 既存レコードの文字起こしを再取得して utterances を保存
  app.post('/api/recordings/:uuid/retranscribe', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    const uuid = req.params['uuid'];
    recordingRepository.findByConversationUuid(uuid).then(async (recording) => {
      if (!recording?.transcription?.transcriptionUrl) {
        res.status(404).json({ error: 'Transcription URL not found' });
        return;
      }
      const result = await transcriptionService.fetchTranscriptionData(recording.transcription.transcriptionUrl);
      if (result?.utterances?.length) {
        await recordingRepository.updateTranscription(uuid, {
          transcriptionUrl: recording.transcription.transcriptionUrl,
          text: result.text,
          utterances: result.utterances,
        });
        res.json({ ok: true, utterances: result.utterances.length });
      } else {
        res.json({ ok: false, message: 'No utterances found' });
      }
    }).catch(next);
  });

  // Dashboard route (authenticated)
  app.get('/dashboard', authMiddleware, (req: Request, res: Response, _next: NextFunction) => {
    dashboardController.renderDashboard(req, res);
  });

  // Language update route (authenticated)
  app.put('/api/language', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    portalController.updateLanguage(req, res).catch(next);
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
