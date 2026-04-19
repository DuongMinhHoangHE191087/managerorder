import { describe, it, expect, vi } from 'vitest';

// Mock supabase to avoid env var requirement
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ data: [] }) }) },
}));

import { normalizeUsername } from '../shared/index';

// ============================================================
// normalizeUsername — URL extraction & normalization
// ============================================================

describe('normalizeUsername', () => {
  // ── Basic cleanup ──────────────────────────────────────────
  describe('basic input cleanup', () => {
    it('trims whitespace', () => {
      expect(normalizeUsername('  hello  ').value).toBe('hello');
    });

    it('strips @ prefix', () => {
      expect(normalizeUsername('@duolingo_user').value).toBe('duolingo_user');
    });

    it('strips @ with spaces', () => {
      expect(normalizeUsername(' @testuser ').value).toBe('testuser');
    });

    it('returns empty for empty input', () => {
      expect(normalizeUsername('').value).toBe('');
    });

    it('returns empty for whitespace only', () => {
      expect(normalizeUsername('   ').value).toBe('');
    });

    it('returns @ alone as empty', () => {
      expect(normalizeUsername('@').value).toBe('');
    });
  });

  // ── Numeric ID detection ───────────────────────────────────
  describe('numeric ID detection', () => {
    it('detects numeric ID', () => {
      const result = normalizeUsername('123456789');
      expect(result.value).toBe('123456789');
      expect(result.isNumericId).toBe(true);
    });

    it('non-numeric is not numeric ID', () => {
      const result = normalizeUsername('testuser');
      expect(result.isNumericId).toBe(false);
    });

    it('mixed alphanumeric is not numeric ID', () => {
      expect(normalizeUsername('user123').isNumericId).toBe(false);
    });
  });

  // ── Duolingo URL extraction ────────────────────────────────
  describe('Duolingo URL extraction', () => {
    it('extracts from standard URL', () => {
      expect(normalizeUsername('https://www.duolingo.com/profile/john_doe').value).toBe('john_doe');
    });

    it('extracts from URL without www', () => {
      expect(normalizeUsername('https://duolingo.com/profile/jane').value).toBe('jane');
    });

    it('extracts from URL with query params', () => {
      expect(normalizeUsername('https://duolingo.com/profile/user123?ref=share').value).toBe('user123');
    });

    it('extracts from URL with hash', () => {
      expect(normalizeUsername('https://duolingo.com/profile/user123#section').value).toBe('user123');
    });

    it('case-insensitive match', () => {
      expect(normalizeUsername('https://DUOLINGO.COM/profile/TestUser').value).toBe('TestUser');
    });
  });

  // ── Facebook URL extraction ────────────────────────────────
  describe('Facebook URL extraction', () => {
    it('extracts from standard www URL', () => {
      expect(normalizeUsername('https://www.facebook.com/zuck').value).toBe('zuck');
    });

    it('extracts from mobile URL (m.facebook)', () => {
      expect(normalizeUsername('https://m.facebook.com/zuck').value).toBe('zuck');
    });

    it('extracts from mbasic URL', () => {
      expect(normalizeUsername('https://mbasic.facebook.com/zuck').value).toBe('zuck');
    });

    it('extracts from web.facebook URL', () => {
      expect(normalizeUsername('https://web.facebook.com/zuck').value).toBe('zuck');
    });

    it('extracts from URL without subdomain', () => {
      expect(normalizeUsername('https://facebook.com/zuck').value).toBe('zuck');
    });

    it('extracts from URL with query params', () => {
      expect(normalizeUsername('https://www.facebook.com/zuck?locale=vi_VN').value).toBe('zuck');
    });

    it('extracts numeric ID from profile.php?id=xxx', () => {
      const result = normalizeUsername('https://www.facebook.com/profile.php?id=100012345678');
      expect(result.value).toBe('100012345678');
      expect(result.isNumericId).toBe(true);
    });

    it('extracts from m.facebook profile.php?id=xxx', () => {
      const result = normalizeUsername('https://m.facebook.com/profile.php?id=100012345678');
      expect(result.value).toBe('100012345678');
      expect(result.isNumericId).toBe(true);
    });

    it('returns empty for invalid paths like /pages', () => {
      expect(normalizeUsername('https://facebook.com/pages').value).toBe('');
    });

    it('returns empty for /groups path', () => {
      expect(normalizeUsername('https://facebook.com/groups').value).toBe('');
    });

    it('returns empty for /events path', () => {
      expect(normalizeUsername('https://facebook.com/events').value).toBe('');
    });

    it('returns empty for /watch path', () => {
      expect(normalizeUsername('https://facebook.com/watch').value).toBe('');
    });

    it('returns empty for /marketplace path', () => {
      expect(normalizeUsername('https://facebook.com/marketplace').value).toBe('');
    });

    it('case-insensitive match', () => {
      expect(normalizeUsername('https://WWW.FACEBOOK.COM/TestUser').value).toBe('TestUser');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────
  describe('edge cases', () => {
    it('returns plain text as-is', () => {
      expect(normalizeUsername('just_a_username').value).toBe('just_a_username');
    });

    it('handles URL-like but not matching patterns', () => {
      expect(normalizeUsername('https://example.com/user').value).toBe('https://example.com/user');
    });

    it('Duolingo takes priority (not matching FB)', () => {
      expect(normalizeUsername('https://duolingo.com/profile/testuser').value).toBe('testuser');
    });
  });
});
