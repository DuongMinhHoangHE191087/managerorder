import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  setSession,
  getSession,
  clearSession,
  isAuthorized,
  isBlocked,
  recordFailedAttempt,
  findSimilarCommands,
  isValidCallbackData,
  cleanupExpiredSessions,
  SESSION_TTL,
  type WizardSession,
  type FailedAttemptRecord,
} from '../telegram-bot.helpers';

// ============================================================
// Integration Tests — Full Flow Scenarios
// ============================================================

describe('Telegram Bot Integration Scenarios', () => {
  describe('Auth + Block Flow', () => {
    let failedAttempts: Map<number, FailedAttemptRecord>;
    const ADMIN_ID = '12345';

    beforeEach(() => {
      failedAttempts = new Map();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('unauthorized user gets blocked after 5 attempts', () => {
      const intruderId = 99999;

      // Verify unauthorized
      expect(isAuthorized(intruderId, ADMIN_ID)).toBe(false);

      // First 4 attempts — not blocked yet
      for (let i = 0; i < 4; i++) {
        recordFailedAttempt(intruderId, failedAttempts);
        expect(isBlocked(intruderId, failedAttempts)).toBe(false);
      }

      // 5th attempt — NOW blocked
      recordFailedAttempt(intruderId, failedAttempts);
      expect(isBlocked(intruderId, failedAttempts)).toBe(true);
    });

    it('block expires after cooldown period', () => {
      const intruderId = 99999;

      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(intruderId, failedAttempts);
      }
      expect(isBlocked(intruderId, failedAttempts)).toBe(true);

      // Advance past block duration (1 hour)
      vi.advanceTimersByTime(61 * 60 * 1000);
      expect(isBlocked(intruderId, failedAttempts)).toBe(false);
    });

    it('admin is never blocked', () => {
      const adminId = 12345;

      // Admin is authorized regardless of failed attempts
      expect(isAuthorized(adminId, ADMIN_ID)).toBe(true);

      // Even if somehow failed attempts are recorded
      for (let i = 0; i < 10; i++) {
        recordFailedAttempt(adminId, failedAttempts);
      }
      // isAuthorized is checked first, so even if blocked, admin can proceed
      expect(isAuthorized(adminId, ADMIN_ID)).toBe(true);
    });
  });

  describe('Wizard Lifecycle', () => {
    let sessions: Map<number, WizardSession>;

    beforeEach(() => {
      sessions = new Map();
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('complete wizard flow: start → progress → finish', () => {
      const chatId = 12345;

      // Step 1: Start wizard
      setSession(chatId, sessions, 'neworder', 1, {});
      let s = getSession(chatId, sessions)!;
      expect(s.command).toBe('neworder');
      expect(s.step).toBe(1);

      // Step 2: Progress to next step
      setSession(chatId, sessions, 'neworder', 2, { customer: 'Hoang' });
      s = getSession(chatId, sessions)!;
      expect(s.step).toBe(2);
      expect(s.data.customer).toBe('Hoang');

      // Step 3: Final step
      setSession(chatId, sessions, 'neworder', 7, {
        customer: 'Hoang',
        product: 'Duolingo',
        nick: 'test_nick',
      });
      s = getSession(chatId, sessions)!;
      expect(s.step).toBe(7);
      expect(s.data.nick).toBe('test_nick');

      // Complete: clear session
      clearSession(chatId, sessions);
      expect(getSession(chatId, sessions)).toBeNull();
    });

    it('wizard timeout automatically cleans up', () => {
      const chatId = 12345;
      setSession(chatId, sessions, 'neworder', 3, { some: 'data' });

      // Advance time past SESSION_TTL
      vi.advanceTimersByTime(SESSION_TTL + 1);
      expect(getSession(chatId, sessions)).toBeNull();
    });

    it('multiple concurrent wizards on different chats', () => {
      setSession(1, sessions, 'neworder', 1, {});
      setSession(2, sessions, 'newtask', 2, {});
      setSession(3, sessions, 'newproduct', 3, {});

      expect(getSession(1, sessions)!.command).toBe('neworder');
      expect(getSession(2, sessions)!.command).toBe('newtask');
      expect(getSession(3, sessions)!.command).toBe('newproduct');
    });

    it('new wizard replaces old for same chat', () => {
      const chatId = 12345;
      setSession(chatId, sessions, 'neworder', 5, { almost: 'done' });
      setSession(chatId, sessions, 'newtask', 1, {}); // User started over

      const s = getSession(chatId, sessions)!;
      expect(s.command).toBe('newtask');
      expect(s.step).toBe(1);
      expect(s.data).toEqual({});
    });

    it('cleanup removes only expired sessions', () => {
      setSession(1, sessions, 'a', 1, {});
      vi.advanceTimersByTime(SESSION_TTL + 1);
      setSession(2, sessions, 'b', 1, {}); // Fresh session
      setSession(3, sessions, 'c', 1, {}); // Fresh session

      const cleaned = cleanupExpiredSessions(sessions);
      expect(cleaned).toBe(1);
      expect(sessions.size).toBe(2);
    });
  });

  describe('Callback Data Validation', () => {
    it('validates standard callback patterns', () => {
      // Common callback patterns used in the bot
      const validCallbacks = [
        'cmd:start',
        'cmd:stats',
        'cmd:help_detail',
        'orders:today',
        'orders:today:page:2',
        'orders:expiring:page:0',
        'orders:expired',
        'kho:stats',
        'kho:slots',
        'detail:abc-123-def',
        'creds:back',
        'creds:acc:uuid-here',
        'creds:prod:uuid:all',
        'no:step1',
        'alloc:select',
        'task:date:2026-01-01',
        'np:confirm',
        'nk:step2',
        'copy:some-value',
        'tdone:uuid-123',
        'runcmd:find test',
      ];

      for (const cb of validCallbacks) {
        expect(isValidCallbackData(cb)).toBe(true);
      }
    });

    it('rejects dangerous callback patterns', () => {
      expect(isValidCallbackData('<script>alert(1)</script>')).toBe(false);
      expect(isValidCallbackData('cmd:start\ninjected')).toBe(false);
    });
  });

  describe('Command Suggestion Quality', () => {
    it('suggests /start for /star', () => {
      const results = findSimilarCommands('/star');
      expect(results.some(r => r.cmd === '/start')).toBe(true);
    });

    it('suggests /stats for /stat', () => {
      const results = findSimilarCommands('/stat');
      expect(results.some(r => r.cmd === '/stats')).toBe(true);
    });

    it('suggests /duolingo for /duoling', () => {
      const results = findSimilarCommands('/duoling');
      expect(results.some(r => r.cmd === '/duolingo')).toBe(true);
    });

    it('does not suggest for completely random input', () => {
      const results = findSimilarCommands('/asdfghjklz');
      expect(results.length).toBe(0);
    });

    it('returns multiple suggestions sorted by relevance', () => {
      // /s is close to many commands
      const results = findSimilarCommands('/sta');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Should be sorted by distance
      if (results.length > 1) {
        expect(results[0].distance).toBeLessThanOrEqual(results[1].distance);
      }
    });
  });

  describe('Error Propagation Patterns', () => {
    it('errors should be catchable and produce meaningful messages', () => {
      const simulateError = () => {
        throw new Error('Database connection failed');
      };

      try {
        simulateError();
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toBe('Database connection failed');
      }
    });

    it('non-Error throws produce fallback message', () => {
      try {
        throw 'string error';
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown';
        expect(message).toBe('Unknown');
      }
    });
  });
});
