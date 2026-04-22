import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../crypto';

describe('hashPassword', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashPassword('test123');
    expect(hash).toMatch(/^\$2[aby]?\$\d+\$/);
  });

  it('produces different hashes for same password (salted)', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).not.toBe(h2);
  });

  it('hash length is ~60 characters', async () => {
    const hash = await hashPassword('password');
    expect(hash.length).toBe(60);
  });
});

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await verifyPassword('correctPassword', hash);
    expect(result).toBe(true);
  });

  it('returns false for incorrect password', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await verifyPassword('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('returns false for empty password against valid hash', async () => {
    const hash = await hashPassword('password');
    const result = await verifyPassword('', hash);
    expect(result).toBe(false);
  });

  it('handles special characters in password', async () => {
    const password = 'p@$$w0rd!#%^&*()';
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it('handles unicode in password', async () => {
    const password = 'mậtkhẩu密码';
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });
});
