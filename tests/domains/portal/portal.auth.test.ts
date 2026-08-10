/**
 * Portal auth and session tests
 */

import '../../setup.js';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../src/middleware/auth.middleware.js';
import { PortalController } from '../../../src/domains/portal/portal.controller.js';
import { PortalService } from '../../../src/domains/portal/portal.service.js';

jest.mock('../../../src/domains/portal/portal.service.js');

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

describe('PortalController', () => {
  let controller: PortalController;
  let mockService: jest.Mocked<PortalService>;
  let mockReq: Partial<Request> & { session?: any };
  let mockRes: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new PortalService() as jest.Mocked<PortalService>;
    controller = new PortalController(mockService);

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
