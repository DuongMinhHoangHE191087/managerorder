import { describe, it, expect } from 'vitest';

import {
  isValidVietnamesePhone,
  normalizeVietnamesePhone,
  extractFacebookIdentity,
  validateContactInput,
  appendUniqueContact,
} from '../telegram-bot.helpers';

describe('Telegram Contact Validation', () => {
  describe('Vietnamese phone', () => {
    it('accepts valid VN mobile numbers', () => {
      expect(isValidVietnamesePhone('0987654321')).toBe(true);
      expect(isValidVietnamesePhone('84987654321')).toBe(true);
      expect(isValidVietnamesePhone('+84987654321')).toBe(true);
    });

    it('rejects invalid VN phone numbers', () => {
      expect(isValidVietnamesePhone('12345')).toBe(false);
      expect(isValidVietnamesePhone('0281234567')).toBe(false);
      expect(isValidVietnamesePhone('+84123456789')).toBe(false);
    });

    it('normalizes to 0xxxxxxxxx format', () => {
      expect(normalizeVietnamesePhone('+84987654321')).toBe('0987654321');
      expect(normalizeVietnamesePhone('84987654321')).toBe('0987654321');
      expect(normalizeVietnamesePhone('0987654321')).toBe('0987654321');
    });
  });

  describe('Facebook extraction', () => {
    it('extracts id from profile.php link', () => {
      const r = extractFacebookIdentity('https://www.facebook.com/profile.php?id=1000123456789');
      expect(r).not.toBeNull();
      expect(r?.idOrUsername).toBe('1000123456789');
      expect(r?.normalizedUrl).toContain('profile.php?id=1000123456789');
    });

    it('extracts username from direct profile path', () => {
      const r = extractFacebookIdentity('https://facebook.com/john.doe.1990');
      expect(r).not.toBeNull();
      expect(r?.idOrUsername).toBe('john.doe.1990');
    });

    it('rejects non-link or non-facebook input', () => {
      expect(extractFacebookIdentity('john.doe')).toBeNull();
      expect(extractFacebookIdentity('https://example.com/john')).toBeNull();
    });
  });

  describe('Channel validation', () => {
    it('validates and normalizes facebook contact with extracted id', () => {
      const result = validateContactInput('facebook', 'https://www.facebook.com/profile.php?id=1000123456789');
      expect(result.ok).toBe(true);
      expect(result.extractedId).toBe('1000123456789');
      expect(result.normalizedValue).toContain('id:1000123456789');
    });

    it('rejects facebook value when not a valid link', () => {
      const result = validateContactInput('facebook', 'facebook_username_only');
      expect(result.ok).toBe(false);
    });

    it('validates VN phone strictly', () => {
      const good = validateContactInput('phone', '+84987654321');
      const bad = validateContactInput('phone', '02101234567');
      expect(good.ok).toBe(true);
      expect(good.normalizedValue).toBe('0987654321');
      expect(bad.ok).toBe(false);
    });

    it('accepts zalo as vn phone, @handle, or zalo link', () => {
      expect(validateContactInput('zalo', '0987654321').ok).toBe(true);
      expect(validateContactInput('zalo', '@khachhang_01').ok).toBe(true);
      expect(validateContactInput('zalo', 'https://zalo.me/abcxyz').ok).toBe(true);
      expect(validateContactInput('zalo', 'invalid-zalo').ok).toBe(false);
    });
  });

  describe('Neworder multi-contact flow helper', () => {
    it('appends unique contacts and removes duplicate channel/value pairs', () => {
      const c1 = appendUniqueContact([], { channel: 'zalo', value: '0987654321' });
      const c2 = appendUniqueContact(c1, { channel: 'facebook', value: 'https://facebook.com/profile.php?id=1000 | id:1000' });
      const c3 = appendUniqueContact(c2, { channel: 'facebook', value: 'https://facebook.com/profile.php?id=1000 | id:1000' });

      expect(c1).toHaveLength(1);
      expect(c2).toHaveLength(2);
      expect(c3).toHaveLength(2);
    });
  });
});
