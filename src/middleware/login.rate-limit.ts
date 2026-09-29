/**
 * Login brute-force protection.
 *
 * Tracks failed login attempts per client and locks the client out with an
 * escalating cooldown once the failure threshold is exceeded.
 *
 * State is held in process memory. This is sufficient for a single instance;
 * when the app scales to multiple instances each instance keeps its own
 * counters, so a shared store (e.g. MongoDB) would be required to make the
 * limit global across the fleet.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger.js';

export interface LoginRateLimitOptions {
  /** Length of the sliding window in which failures are counted. */
  windowMs: number;
  /** Failures tolerated inside one window before locking out. */
  maxFailures: number;
  /** Cooldown applied on the first lockout; doubles on each subsequent one. */
  baseLockoutMs: number;
  /** Upper bound for the escalating cooldown. */
  maxLockoutMs: number;
  /**
   * Aggregate failure ceiling across all clients in one window.
   * Guards against a distributed or X-Forwarded-For-spoofing attack that
   * would otherwise get a fresh per-IP budget on every request.
   * Set to 0 to disable.
   */
  globalMaxFailures: number;
  /**
   * Cooldown applied when the aggregate ceiling trips. Deliberately kept much
   * shorter than the per-client lockout: the global cap only needs to slow a
   * distributed attack down, and a long fleet-wide lockout would let an
   * attacker deny the legitimate administrator access indefinitely.
   */
  globalLockoutMs: number;
  /** Set false to disable the protection entirely. */
  enabled: boolean;
}

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  maxFailures: 5,
  baseLockoutMs: 60 * 1000,
  maxLockoutMs: 15 * 60 * 1000,
  globalMaxFailures: 30,
  globalLockoutMs: 5 * 60 * 1000,
  enabled: true,
};

const GLOBAL_KEY = '__global__';

interface AttemptState {
  failures: number;
  windowStartedAt: number;
  lockouts: number;
  lockedUntil: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly options: LoginRateLimitOptions;
  private readonly now: () => number;
  private readonly sweeper: ReturnType<typeof setInterval> | null;

  constructor(options: Partial<LoginRateLimitOptions> = {}, now: () => number = Date.now) {
    this.options = { ...DEFAULT_LOGIN_RATE_LIMIT, ...options };
    this.now = now;

    this.sweeper = this.options.enabled
      ? setInterval(() => this.sweep(), this.options.windowMs)
      : null;
    // Never keep the event loop alive just for cleanup.
    this.sweeper?.unref?.();
  }

  /** Whether a request from `key` may proceed to password validation. */
  check(key: string): RateLimitDecision {
    if (!this.options.enabled) {
      return { allowed: true, retryAfterSec: 0, remaining: this.options.maxFailures };
    }

    const now = this.now();

    // The global ceiling takes precedence and cannot be evaded by rotating
    // the client address.
    if (this.options.globalMaxFailures > 0) {
      const global = this.attempts.get(GLOBAL_KEY);
      if (global && global.lockedUntil > now) {
        return {
          allowed: false,
          retryAfterSec: Math.ceil((global.lockedUntil - now) / 1000),
          remaining: 0,
        };
      }
    }

    const state = this.attempts.get(key);
    if (!state) {
      return { allowed: true, retryAfterSec: 0, remaining: this.options.maxFailures };
    }

    if (state.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((state.lockedUntil - now) / 1000),
        remaining: 0,
      };
    }

    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, this.options.maxFailures - state.failures),
    };
  }

  /** Record a failed attempt, locking the client out once over threshold. */
  recordFailure(key: string): RateLimitDecision {
    if (!this.options.enabled) {
      return { allowed: false, retryAfterSec: 0, remaining: this.options.maxFailures };
    }

    // Count towards the global ceiling first.
    if (this.options.globalMaxFailures > 0 && !this.bumpGlobal()) {
      return { allowed: false, retryAfterSec: 0, remaining: 0 };
    }

    const now = this.now();
    let state = this.attempts.get(key);

    if (!state) {
      state = { failures: 0, windowStartedAt: now, lockouts: 0, lockedUntil: 0 };
      this.attempts.set(key, state);
    }

    // Roll the failure counter over once the window has elapsed.
    // `lockouts` and `lockedUntil` are deliberately preserved: clearing them
    // would let an attacker reset the escalating cooldown simply by waiting
    // out one window between attempts.
    if (now - state.windowStartedAt >= this.options.windowMs) {
      state.failures = 0;
      state.windowStartedAt = now;
    }

    state.failures += 1;

    if (state.failures >= this.options.maxFailures) {
      const lockout = Math.min(
        this.options.baseLockoutMs * Math.pow(2, state.lockouts),
        this.options.maxLockoutMs,
      );
      state.lockouts += 1;
      state.lockedUntil = now + lockout;

      logger.warn('Login rate limit lockout', {
        windowFailures: state.failures,
        lockoutMs: lockout,
        lockoutRound: state.lockouts,
      });

      return {
        allowed: false,
        retryAfterSec: Math.ceil(lockout / 1000),
        remaining: 0,
      };
    }

    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, this.options.maxFailures - state.failures),
    };
  }

  /** Clear counters for a client after a successful login. */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** Drop all state. Intended for tests. */
  clear(): void {
    this.attempts.clear();
  }

  /** Number of tracked clients. Intended for tests and diagnostics. */
  get size(): number {
    return this.attempts.size;
  }

  /**
   * Count one failure against the shared ceiling. Returns false once the
   * aggregate limit trips, at which point every client is held back.
   */
  private bumpGlobal(): boolean {
    const now = this.now();
    let state = this.attempts.get(GLOBAL_KEY);

    if (!state) {
      state = { failures: 0, windowStartedAt: now, lockouts: 0, lockedUntil: 0 };
      this.attempts.set(GLOBAL_KEY, state);
    }

    if (now - state.windowStartedAt >= this.options.windowMs) {
      state.failures = 0;
      state.windowStartedAt = now;
      state.lockedUntil = 0;
    }

    if (state.lockedUntil > now) {
      return false;
    }

    state.failures += 1;

    if (state.failures >= this.options.globalMaxFailures) {
      state.lockedUntil = now + this.options.globalLockoutMs;
      logger.warn('Login global rate limit tripped', {
        globalFailures: state.failures,
        lockoutMs: this.options.globalLockoutMs,
      });
      return false;
    }

    return true;
  }

  private sweep(): void {
    const now = this.now();
    for (const [key, state] of this.attempts) {
      const idleFor = now - state.windowStartedAt;
      if (state.lockedUntil <= now && idleFor >= this.options.windowMs) {
        this.attempts.delete(key);
      }
    }
  }

  dispose(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
    }
  }
}

export const loginRateLimiter = new LoginRateLimiter();

/**
 * Rejects login attempts from a client that is currently locked out.
 * Successful logins should call `loginRateLimiter.reset()` to clear the counter.
 */
export function loginRateLimitMiddleware(
  limiter: LoginRateLimiter = loginRateLimiter,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = clientKey(req);
    const decision = limiter.check(key);

    if (decision.allowed) {
      next();
      return;
    }

    logger.warn('Login blocked by rate limit', { retryAfterSec: decision.retryAfterSec });
    res.setHeader('Retry-After', String(decision.retryAfterSec));
    res.status(429).json({
      error: 'Too many failed login attempts. Please try again later.',
      retryAfterSec: decision.retryAfterSec,
    });
  };
}

/** Stable per-client key. Prefers the forwarded client IP. */
export function clientKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
