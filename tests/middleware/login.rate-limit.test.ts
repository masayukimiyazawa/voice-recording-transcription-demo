/**
 * Login brute-force protection tests
 */

import { Request, Response } from 'express';
import {
  LoginRateLimiter,
  loginRateLimitMiddleware,
  clientKey,
} from '../../src/middleware/login.rate-limit.js';

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

function makeReq(ip: string): Request {
  return { ip } as Request;
}

describe('LoginRateLimiter', () => {
  let clock: number;
  let now: () => number;
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    clock = 1_000_000;
    now = () => clock;
    limiter = new LoginRateLimiter(
      { windowMs: 60_000, maxFailures: 3, baseLockoutMs: 1_000, maxLockoutMs: 8_000 },
      now,
    );
  });

  afterEach(() => limiter.dispose());

  it('allows attempts for an unknown client', () => {
    expect(limiter.check('1.1.1.1').allowed).toBe(true);
  });

  it('allows attempts up to the threshold but locks out on the next failure', () => {
    for (let i = 1; i <= 3; i++) {
      const decision = limiter.recordFailure('1.1.1.1');
      // The threshold-crossing failure itself reports the lockout.
      expect(decision.allowed).toBe(i < 3);
    }

    const blocked = limiter.check('1.1.1.1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('reports remaining attempts while under the threshold', () => {
    expect(limiter.recordFailure('1.1.1.1').remaining).toBe(2);
    expect(limiter.recordFailure('1.1.1.1').remaining).toBe(1);
  });

  it('tracks clients independently', () => {
    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('1.1.1.1');

    expect(limiter.check('1.1.1.1').allowed).toBe(false);
    expect(limiter.check('2.2.2.2').allowed).toBe(true);
  });

  it('clears the counter on reset (successful login)', () => {
    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('1.1.1.1');
    limiter.reset('1.1.1.1');

    expect(limiter.check('1.1.1.1').allowed).toBe(true);
    expect(limiter.check('1.1.1.1').remaining).toBe(3);
  });

  it('expires the lockout once the cooldown elapses', () => {
    for (let i = 0; i < 3; i++) limiter.recordFailure('1.1.1.1');
    expect(limiter.check('1.1.1.1').allowed).toBe(false);

    clock += 1_001;
    expect(limiter.check('1.1.1.1').allowed).toBe(true);
  });

  it('escalates the cooldown on repeated lockouts and caps it', () => {
    const cooldowns: number[] = [];
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 3; i++) limiter.recordFailure('1.1.1.1');
      cooldowns.push(limiter.check('1.1.1.1').retryAfterSec);
      clock += 60_001; // let the lockout expire to trigger the next round
    }

    // base 1s, then doubling, capped at 8s
    expect(cooldowns).toEqual([1, 2, 4, 8, 8, 8]);
  });

  it('forgets clients once the window has fully elapsed', () => {
    // The aggregate ceiling is tracked under its own key, so the map holds
    // that entry in addition to the per-client one.
    limiter.recordFailure('1.1.1.1');
    expect(limiter.size).toBe(2);

    clock += 60_001;
    limiter.recordFailure('1.1.1.1'); // rolls both counters over
    limiter.check('1.1.1.1');
    expect(limiter.size).toBe(2);

    limiter.clear();
    expect(limiter.size).toBe(0);
  });

  it('is a no-op when disabled', () => {
    const off = new LoginRateLimiter({ enabled: false }, now);
    for (let i = 0; i < 50; i++) off.recordFailure('1.1.1.1');
    expect(off.check('1.1.1.1').allowed).toBe(true);
    off.dispose();
  });
});

describe('LoginRateLimiter global ceiling', () => {
  let clock: number;
  let now: () => number;
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    clock = 1_000_000;
    now = () => clock;
    // Per-IP budget of 2, but only 4 failures tolerated fleet-wide.
    limiter = new LoginRateLimiter(
      {
        windowMs: 60_000,
        maxFailures: 2,
        baseLockoutMs: 1_000,
        maxLockoutMs: 8_000,
        globalMaxFailures: 4,
        globalLockoutMs: 4_000,
      },
      now,
    );
  });

  afterEach(() => limiter.dispose());

  it('blocks every client once the aggregate ceiling is reached', () => {
    // Two failures each from two different addresses: never more than 2 for
    // any single client, yet the fleet-wide total still trips the limit.
    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('2.2.2.2');
    limiter.recordFailure('2.2.2.2');

    // A brand new address, which would otherwise have a full budget.
    const decision = limiter.check('3.3.3.3');
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSec).toBe(4);
  });

  it('resists address rotation used to dodge the per-IP limit', () => {
    for (let i = 0; i < 4; i++) limiter.recordFailure(`10.0.0.${i}`);
    // A spoofed X-Forwarded-For would present a fresh address every time.
    expect(limiter.check('10.0.0.99').allowed).toBe(false);
  });

  it('is not reset by a successful login from one client', () => {
    for (let i = 0; i < 4; i++) limiter.recordFailure(`10.0.0.${i}`);
    limiter.reset('10.0.0.0');
    expect(limiter.check('10.0.0.0').allowed).toBe(false);
  });

  it('can be disabled with globalMaxFailures set to 0', () => {
    const noGlobal = new LoginRateLimiter(
      {
        windowMs: 60_000,
        maxFailures: 5,
        baseLockoutMs: 1_000,
        maxLockoutMs: 8_000,
        globalMaxFailures: 0,
        globalLockoutMs: 4_000,
      },
      now,
    );
    for (let i = 0; i < 30; i++) noGlobal.recordFailure(`10.1.0.${i}`);
    expect(noGlobal.check('10.1.0.99').allowed).toBe(true);
    noGlobal.dispose();
  });
});

describe('loginRateLimitMiddleware', () => {
  let clock: number;
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    clock = 1_000_000;
    limiter = new LoginRateLimiter(
      { windowMs: 60_000, maxFailures: 2, baseLockoutMs: 1_000, maxLockoutMs: 8_000 },
      () => clock,
    );
  });

  afterEach(() => limiter.dispose());

  it('passes the request through when under the limit', () => {
    const next = jest.fn();
    loginRateLimitMiddleware(limiter)(makeReq('1.1.1.1'), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('responds 429 with Retry-After once locked out', () => {
    const res = makeRes();
    limiter.recordFailure('1.1.1.1');
    limiter.recordFailure('1.1.1.1');

    const next = jest.fn();
    loginRateLimitMiddleware(limiter)(makeReq('1.1.1.1'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Too many') })
    );
  });

  it('does not leak whether a password was correct via message differences', () => {
    const res = makeRes();
    const next = jest.fn();
    loginRateLimitMiddleware(limiter)(makeReq('1.1.1.1'), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('clientKey', () => {
  it('prefers the resolved client ip', () => {
    expect(clientKey({ ip: '203.0.113.5' } as Request)).toBe('203.0.113.5');
  });

  it('falls back to the socket address when ip is absent', () => {
    expect(clientKey({ socket: { remoteAddress: '198.51.100.7' } } as unknown as Request)).toBe(
      '198.51.100.7'
    );
  });

  it('falls back to a constant when neither is available', () => {
    expect(clientKey({} as Request)).toBe('unknown');
  });
});
