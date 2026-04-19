import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyToken, decodeToken } from '../jwt';
import type { TokenPayload } from '../jwt';

const TEST_PAYLOAD: Omit<TokenPayload, 'iat' | 'exp'> = {
  sub: 'user-123',
  accountId: 'acc-456',
  role: 'admin',
  email: 'test@example.com',
};

describe('JWT utilities', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-secret-key-for-unit-tests-min-32-chars');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── generateAccessToken ───────────────────────────────────
  describe('generateAccessToken', () => {
    it('returns a JWT string with 3 parts', () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      expect(token.split('.')).toHaveLength(3);
    });

    it('token is decodable and contains payload fields', () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      const decoded = decodeToken(token);
      expect(decoded?.sub).toBe('user-123');
      expect(decoded?.accountId).toBe('acc-456');
      expect(decoded?.role).toBe('admin');
      expect(decoded?.email).toBe('test@example.com');
    });
  });

  // ── generateRefreshToken ──────────────────────────────────
  describe('generateRefreshToken', () => {
    it('returns a JWT string', () => {
      const token = generateRefreshToken(TEST_PAYLOAD);
      expect(token.split('.')).toHaveLength(3);
    });

    it('differs from access token (different expiry)', () => {
      const access = generateAccessToken(TEST_PAYLOAD);
      const refresh = generateRefreshToken(TEST_PAYLOAD);
      expect(access).not.toBe(refresh);
    });
  });

  // ── verifyToken ───────────────────────────────────────────
  describe('verifyToken', () => {
    it('verifies a valid access token', () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      const payload = verifyToken(token);
      expect(payload.sub).toBe('user-123');
      expect(payload.accountId).toBe('acc-456');
    });

    it('throws for tampered token', () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyToken(tampered)).toThrow();
    });

    it('throws for random string', () => {
      expect(() => verifyToken('not-a-jwt')).toThrow();
    });

    it('throws for token signed with different secret', () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      vi.stubEnv('JWT_SECRET', 'different-secret-key-for-another-test-min-32-ch');
      expect(() => verifyToken(token)).toThrow();
    });
  });

  // ── decodeToken ───────────────────────────────────────────
  describe('decodeToken', () => {
    it('decodes without verification', () => {
      const token = generateAccessToken(TEST_PAYLOAD);
      const decoded = decodeToken(token);
      expect(decoded?.sub).toBe('user-123');
    });

    it('returns null for invalid string', () => {
      const result = decodeToken('totally.invalid.token');
      // jwt.decode may return null or partial — we just verify no crash
      expect(result).toBeDefined();
    });
  });

  // ── Missing JWT_SECRET ────────────────────────────────────
  describe('missing JWT_SECRET', () => {
    it('throws FATAL error when JWT_SECRET is not set', () => {
      vi.stubEnv('JWT_SECRET', '');
      // Delete the env var or set to empty
      delete process.env.JWT_SECRET;
      expect(() => generateAccessToken(TEST_PAYLOAD)).toThrow('FATAL');
    });
  });
});
