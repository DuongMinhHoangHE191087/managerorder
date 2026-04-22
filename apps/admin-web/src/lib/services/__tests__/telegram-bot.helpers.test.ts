import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import {
  isAuthorized,
  isBlocked,
  recordFailedAttempt,
  getSession,
  setSession,
  clearSession,
  cleanupExpiredSessions,
  levenshtein,
  parseCommand,
  findSimilarCommands,
  getGreeting,
  daysUntil,
  progressBar,
  isValidCallbackData,
  DEFAULT_BLOCK_CONFIG,
  SESSION_TTL,
  KNOWN_COMMANDS,
  type FailedAttemptRecord,
  type WizardSession,
} from '../telegram-bot.helpers';

// ============================================================
// isAuthorized
// ============================================================

describe('isAuthorized', () => {
  it('returns true when chatId matches adminChatId', () => {
    expect(isAuthorized(123456, '123456')).toBe(true);
  });

  it('returns false when chatId does not match', () => {
    expect(isAuthorized(123456, '654321')).toBe(false);
  });

  it('returns false when adminChatId is empty (fail-closed)', () => {
    expect(isAuthorized(123456, '')).toBe(false);
  });

  it('handles numeric string comparison correctly', () => {
    expect(isAuthorized(999999999, '999999999')).toBe(true);
    expect(isAuthorized(0, '0')).toBe(true);
  });
});

// ============================================================
// isBlocked
// ============================================================

describe('isBlocked', () => {
  let failedAttempts: Map<number, FailedAttemptRecord>;

  beforeEach(() => {
    failedAttempts = new Map();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when no failed attempts recorded', () => {
    expect(isBlocked(123, failedAttempts)).toBe(false);
  });

  it('returns false when attempts below threshold', () => {
    failedAttempts.set(123, { count: 3, lastAttempt: Date.now() });
    expect(isBlocked(123, failedAttempts)).toBe(false);
  });

  it('returns true when attempts reach threshold within block window', () => {
    failedAttempts.set(123, { count: 5, lastAttempt: Date.now() });
    expect(isBlocked(123, failedAttempts)).toBe(true);
  });

  it('returns false when block window has expired', () => {
    failedAttempts.set(123, {
      count: 5,
      lastAttempt: Date.now() - DEFAULT_BLOCK_CONFIG.blockDurationMs - 1000,
    });
    expect(isBlocked(123, failedAttempts)).toBe(false);
    // Should also clean up the record
    expect(failedAttempts.has(123)).toBe(false);
  });

  it('uses custom config when provided', () => {
    failedAttempts.set(123, { count: 2, lastAttempt: Date.now() });
    expect(
      isBlocked(123, failedAttempts, {
        maxAttempts: 2,
        blockDurationMs: 5000,
      }),
    ).toBe(true);
  });
});

// ============================================================
// recordFailedAttempt
// ============================================================

describe('recordFailedAttempt', () => {
  it('creates new record for first failure', () => {
    const map = new Map<number, FailedAttemptRecord>();
    const record = recordFailedAttempt(123, map);
    expect(record.count).toBe(1);
    expect(record.lastAttempt).toBeGreaterThan(0);
  });

  it('increments count on subsequent failures', () => {
    const map = new Map<number, FailedAttemptRecord>();
    recordFailedAttempt(123, map);
    recordFailedAttempt(123, map);
    const record = recordFailedAttempt(123, map);
    expect(record.count).toBe(3);
  });

  it('updates lastAttempt timestamp', () => {
    vi.useFakeTimers();
    const map = new Map<number, FailedAttemptRecord>();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    recordFailedAttempt(123, map);

    vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));
    const record = recordFailedAttempt(123, map);
    expect(record.lastAttempt).toBe(new Date('2026-01-01T01:00:00Z').getTime());
    vi.useRealTimers();
  });

  it('tracks different chatIds independently', () => {
    const map = new Map<number, FailedAttemptRecord>();
    recordFailedAttempt(100, map);
    recordFailedAttempt(100, map);
    recordFailedAttempt(200, map);
    expect(map.get(100)!.count).toBe(2);
    expect(map.get(200)!.count).toBe(1);
  });
});

// ============================================================
// Session Management
// ============================================================

describe('Session Management', () => {
  let sessions: Map<number, WizardSession>;

  beforeEach(() => {
    sessions = new Map();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setSession', () => {
    it('creates a new session with createdAt', () => {
      setSession(123, sessions, 'neworder', 1, { foo: 'bar' });
      const s = sessions.get(123)!;
      expect(s.command).toBe('neworder');
      expect(s.step).toBe(1);
      expect(s.data).toEqual({ foo: 'bar' });
      expect(s.createdAt).toBe(Date.now());
    });

    it('overwrites existing session', () => {
      setSession(123, sessions, 'neworder', 1, {});
      setSession(123, sessions, 'newtask', 3, { id: 'abc' });
      const s = sessions.get(123)!;
      expect(s.command).toBe('newtask');
      expect(s.step).toBe(3);
    });
  });

  describe('getSession', () => {
    it('returns null when no session exists', () => {
      expect(getSession(999, sessions)).toBeNull();
    });

    it('returns session when within TTL', () => {
      setSession(123, sessions, 'neworder', 1, {});
      const s = getSession(123, sessions);
      expect(s).not.toBeNull();
      expect(s!.command).toBe('neworder');
    });

    it('returns null and cleans up expired session', () => {
      setSession(123, sessions, 'neworder', 1, {});
      vi.advanceTimersByTime(SESSION_TTL + 1000);
      const s = getSession(123, sessions);
      expect(s).toBeNull();
      expect(sessions.has(123)).toBe(false);
    });

    it('uses custom TTL', () => {
      setSession(123, sessions, 'neworder', 1, {});
      vi.advanceTimersByTime(3000);
      expect(getSession(123, sessions, 2000)).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes existing session', () => {
      setSession(123, sessions, 'neworder', 1, {});
      clearSession(123, sessions);
      expect(sessions.has(123)).toBe(false);
    });

    it('does nothing for non-existent session', () => {
      clearSession(999, sessions); // Should not throw
      expect(sessions.size).toBe(0);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('removes expired sessions and keeps active ones', () => {
      setSession(1, sessions, 'a', 1, {});
      vi.advanceTimersByTime(SESSION_TTL + 1);
      setSession(2, sessions, 'b', 1, {}); // Fresh
      const cleaned = cleanupExpiredSessions(sessions);
      expect(cleaned).toBe(1);
      expect(sessions.has(1)).toBe(false);
      expect(sessions.has(2)).toBe(true);
    });

    it('returns 0 when no expired sessions', () => {
      setSession(1, sessions, 'a', 1, {});
      expect(cleanupExpiredSessions(sessions)).toBe(0);
    });
  });
});

// ============================================================
// levenshtein
// ============================================================

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('returns correct distance for single edit', () => {
    expect(levenshtein('cat', 'car')).toBe(1); // Substitution
    expect(levenshtein('cat', 'cats')).toBe(1); // Insertion
    expect(levenshtein('cats', 'cat')).toBe(1); // Deletion
  });

  it('returns full length for completely different strings', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });

  it('handles empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', 'xyz')).toBe(3);
  });

  it('handles unicode characters', () => {
    expect(levenshtein('café', 'cafe')).toBe(1);
  });

  it('is symmetric', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(levenshtein('sitting', 'kitten'));
  });
});

// ============================================================
// parseCommand
// ============================================================

describe('parseCommand', () => {
  it('parses command with argument', () => {
    const { cmd, arg } = parseCommand('/find hello world');
    expect(cmd).toBe('/find');
    expect(arg).toBe('hello world');
  });

  it('parses command without argument', () => {
    const { cmd, arg } = parseCommand('/start');
    expect(cmd).toBe('/start');
    expect(arg).toBe('');
  });

  it('handles extra whitespace', () => {
    const { cmd, arg } = parseCommand('  /find   hello   world  ');
    expect(cmd).toBe('/find');
    expect(arg).toBe('hello world');
  });

  it('lowercases the command', () => {
    const { cmd } = parseCommand('/START');
    expect(cmd).toBe('/start');
  });

  it('handles empty string', () => {
    const { cmd, arg } = parseCommand('');
    expect(cmd).toBe('');
    expect(arg).toBe('');
  });
});

// ============================================================
// findSimilarCommands
// ============================================================

describe('findSimilarCommands', () => {
  it('returns exact match with distance 0', () => {
    const results = findSimilarCommands('/start');
    expect(results[0]).toEqual({ cmd: '/start', distance: 0 });
  });

  it('returns similar commands within threshold', () => {
    const results = findSimilarCommands('/stat'); // Close to /stats
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.cmd === '/stats')).toBe(true);
  });

  it('returns empty array for completely different input', () => {
    const results = findSimilarCommands('/xyzzyspoon');
    expect(results).toHaveLength(0);
  });

  it('limits results to maxResults', () => {
    const results = findSimilarCommands('/s', KNOWN_COMMANDS, 10, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('sorts by distance ascending', () => {
    const results = findSimilarCommands('/stat');
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
    }
  });
});

// ============================================================
// getGreeting
// ============================================================

describe('getGreeting', () => {
  it('returns khuya greeting for 0-5 UTC+7', () => {
    // UTC+7 hour 3 → UTC hour 20 (previous day)
    const utc20 = new Date('2026-01-01T20:00:00Z').getTime();
    expect(getGreeting(utc20)).toBe('🌙 Chào buổi khuya');
  });

  it('returns sáng greeting for 6-11 UTC+7', () => {
    // UTC+7 hour 8 → UTC hour 1
    const utc1 = new Date('2026-01-01T01:00:00Z').getTime();
    expect(getGreeting(utc1)).toBe('☀️ Chào buổi sáng');
  });

  it('returns chiều greeting for 12-17 UTC+7', () => {
    // UTC+7 hour 14 → UTC hour 7
    const utc7 = new Date('2026-01-01T07:00:00Z').getTime();
    expect(getGreeting(utc7)).toBe('🌤 Chào buổi chiều');
  });

  it('returns tối greeting for 18-23 UTC+7', () => {
    // UTC+7 hour 20 → UTC hour 13
    const utc13 = new Date('2026-01-01T13:00:00Z').getTime();
    expect(getGreeting(utc13)).toBe('🌆 Chào buổi tối');
  });
});

// ============================================================
// daysUntil
// ============================================================

describe('daysUntil', () => {
  it('returns 0 for null', () => {
    expect(daysUntil(null)).toBe(0);
  });

  it('returns 0 for past dates', () => {
    const past = new Date('2020-01-01').toISOString();
    expect(daysUntil(past)).toBe(0);
  });

  it('returns positive days for future dates', () => {
    const now = Date.now();
    const future = new Date(now + 5 * 86_400_000).toISOString();
    const days = daysUntil(future, now);
    expect(days).toBe(5);
  });

  it('returns 1 for tomorrow', () => {
    const now = Date.now();
    const tomorrow = new Date(now + 86_400_000).toISOString();
    expect(daysUntil(tomorrow, now)).toBe(1);
  });

  it('rounds up partial days', () => {
    const now = Date.now();
    const halfDay = new Date(now + 43_200_000).toISOString(); // 12 hours
    expect(daysUntil(halfDay, now)).toBe(1); // ceil
  });
});

// ============================================================
// progressBar
// ============================================================

describe('progressBar', () => {
  it('shows empty bar at 0%', () => {
    expect(progressBar(0, 5)).toBe('░░░░░ 0/5');
  });

  it('shows half-filled bar at ~50%', () => {
    const result = progressBar(3, 5);
    expect(result).toBe('▓▓▓░░ 3/5');
  });

  it('shows full bar at 100%', () => {
    expect(progressBar(5, 5)).toBe('▓▓▓▓▓ 5/5');
  });

  it('handles total of 0 gracefully', () => {
    expect(progressBar(0, 0)).toBe('░░░░░ 0/0');
  });

  it('always has 5 characters of bar', () => {
    for (let step = 0; step <= 10; step++) {
      const result = progressBar(step, 10);
      const barPart = result.split(' ')[0];
      expect(barPart.length).toBe(5);
    }
  });
});

// ============================================================
// isValidCallbackData
// ============================================================

describe('isValidCallbackData', () => {
  it('returns true for valid callback_data', () => {
    expect(isValidCallbackData('cmd:start')).toBe(true);
    expect(isValidCallbackData('orders:today:page:2')).toBe(true);
    expect(isValidCallbackData('detail:abc-123')).toBe(true);
  });

  it('returns false for undefined/empty', () => {
    expect(isValidCallbackData(undefined)).toBe(false);
    expect(isValidCallbackData('')).toBe(false);
  });

  it('returns false for data exceeding 64 bytes', () => {
    const long = 'a'.repeat(65);
    expect(isValidCallbackData(long)).toBe(false);
  });

  it('returns false for data with dangerous characters', () => {
    expect(isValidCallbackData('cmd:<script>')).toBe(false);
    expect(isValidCallbackData('cmd:start\n')).toBe(false);
  });

  it('returns true for data at exactly 64 characters', () => {
    const exact = 'a'.repeat(64);
    expect(isValidCallbackData(exact)).toBe(true);
  });
});

// ============================================================
// KNOWN_COMMANDS
// ============================================================

describe('KNOWN_COMMANDS', () => {
  it('contains expected commands', () => {
    expect(KNOWN_COMMANDS).toContain('/start');
    expect(KNOWN_COMMANDS).toContain('/help');
    expect(KNOWN_COMMANDS).toContain('/stats');
    expect(KNOWN_COMMANDS).toContain('/orders');
    expect(KNOWN_COMMANDS).toContain('/find');
    expect(KNOWN_COMMANDS).toContain('/duolingo');
    expect(KNOWN_COMMANDS).toContain('/security');
  });

  it('all commands start with /', () => {
    for (const cmd of KNOWN_COMMANDS) {
      expect(cmd.startsWith('/')).toBe(true);
    }
  });
});
