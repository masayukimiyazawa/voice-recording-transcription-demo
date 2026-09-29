/**
 * Portal auth and session tests
 */

import '../../setup.js';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../src/middleware/auth.middleware.js';
import { PortalController } from '../../../src/domains/portal/portal.controller.js';
import { PortalService } from '../../../src/domains/portal/portal.service.js';
import { SettingsRepository } from '../../../src/domains/settings/settings.repository.js';
import { LoginRateLimiter } from '../../../src/middleware/login.rate-limit.js';

jest.mock('../../../src/domains/portal/portal.service.js');
jest.mock('../../../src/domains/settings/settings.repository.js');

// Shared across the rate-limiting suite; reset between cases.
const limiter = new LoginRateLimiter({
  windowMs: 60_000,
  maxFailures: 2,
  baseLockoutMs: 60_000,
  maxLockoutMs: 60_000,
  globalMaxFailures: 0,
  globalLockoutMs: 60_000,
});

afterAll(() => limiter.dispose());

describe('authMiddleware', () => {
  let mockReq: Partial<Request> & { session?: any };
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockNext = jest.fn();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
  });

  test('should call next() when session is authenticated', () => {
    mockReq = { session: { authenticated: true } as any };

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test('should redirect to /login when not authenticated (HTML request)', () => {
    mockReq = {
      session: { authenticated: false } as any,
      headers: { accept: 'text/html' },
    };

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.redirect).toHaveBeenCalledWith('/login');
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should return 401 when not authenticated (API request)', () => {
    mockReq = {
      session: {} as any,
      headers: { accept: 'application/json' },
    };

    authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('PortalController login rate limiting', () => {
  let controller: PortalController;
  let mockService: jest.Mocked<PortalService>;
  let mockReq: Partial<Request> & { session?: any; ip?: string };
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    limiter.clear();
    mockService = new PortalService() as jest.Mocked<PortalService>;
    controller = new PortalController(mockService, new SettingsRepository(), limiter);

    mockReq = { body: {}, session: {} as any, ip: '203.0.113.9' };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
    };
  });

  test('counts a failed attempt against the client', async () => {
    mockReq.body = { password: 'wrong' };
    mockService.validatePassword.mockResolvedValue(false);

    await controller.login(mockReq as Request, mockRes as Response);

    expect(limiter.check('203.0.113.9').remaining).toBe(1);
  });

  test('clears the counter after a successful login', async () => {
    mockReq.body = { password: 'correct' };
    mockService.validatePassword.mockResolvedValue(false);
    await controller.login(mockReq as Request, mockRes as Response);

    mockService.validatePassword.mockResolvedValue(true);
    await controller.login(mockReq as Request, mockRes as Response);

    expect(limiter.check('203.0.113.9').remaining).toBe(2);
  });

  test('locks the client out after repeated failures', async () => {
    mockReq.body = { password: 'wrong' };
    mockService.validatePassword.mockResolvedValue(false);

    for (let i = 0; i < 2; i++) {
      await controller.login(mockReq as Request, mockRes as Response);
    }

    expect(limiter.check('203.0.113.9').allowed).toBe(false);
  });

  test('does not count attempts that were never validated (missing password)', async () => {
    mockReq.body = {};
    await expect(controller.login(mockReq as Request, mockRes as Response)).rejects.toThrow();

    expect(limiter.check('203.0.113.9').remaining).toBe(2);
  });
});

describe('PortalController', () => {
  let controller: PortalController;
  let mockService: jest.Mocked<PortalService>;
  let mockReq: Partial<Request> & { session?: any };
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new PortalService() as jest.Mocked<PortalService>;
    controller = new PortalController(mockService, new SettingsRepository());

    mockReq = { body: {}, session: {} as any };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      render: jest.fn().mockReturnThis(),
    };
  });

  describe('login', () => {
    test('should set session authenticated and redirect on valid password', async () => {
      mockReq.body = { password: 'correct-password' };
      mockService.validatePassword.mockResolvedValue(true);

      await controller.login(mockReq as Request, mockRes as Response);

      expect(mockReq.session!.authenticated).toBe(true);
      expect(mockRes.redirect).toHaveBeenCalledWith('/dashboard');
    });

    test('should return 401 on invalid password', async () => {
      mockReq.body = { password: 'wrong-password' };
      mockService.validatePassword.mockResolvedValue(false);

      await controller.login(mockReq as Request, mockRes as Response);

      expect(mockReq.session!.authenticated).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should throw when password is missing', async () => {
      mockReq.body = {};

      await expect(controller.login(mockReq as Request, mockRes as Response)).rejects.toThrow();
    });
  });

  describe('logout', () => {
    test('should destroy session and redirect to login', async () => {
      mockReq.session = {
        authenticated: true,
        destroy: jest.fn((cb: (err: any) => void) => cb(null)),
      };

      await controller.logout(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith('/login');
    });
  });
});
