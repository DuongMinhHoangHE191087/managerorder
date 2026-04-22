import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatMoney, formatDate, formatDateLabel, formatRelativeTime, formatDateKey } from '../formatters';

describe('formatMoney', () => {
  it('formats positive VND amount', () => {
    const result = formatMoney(1500000);
    // Vietnamese locale format includes ₫ symbol
    expect(result).toContain('1.500.000');
  });

  it('formats zero', () => {
    const result = formatMoney(0);
    expect(result).toContain('0');
  });

  it('formats negative amount', () => {
    const result = formatMoney(-500000);
    expect(result).toContain('500.000');
  });

  it('formats small amount', () => {
    const result = formatMoney(100);
    expect(result).toContain('100');
  });

  it('formats large amount', () => {
    const result = formatMoney(999999999);
    expect(result).toContain('999.999.999');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-06-15T10:30:00Z');
    // Should produce something like "15/06/2026 xx:xx"
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date(2026, 5, 15, 10, 30));
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('returns N/A for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('returns N/A for empty string', () => {
    expect(formatDate('')).toBe('N/A');
  });
});

describe('formatDateLabel', () => {
  it('is an alias for formatDate', () => {
    const isoDate = '2026-06-15T10:30:00Z';
    expect(formatDateLabel(isoDate)).toBe(formatDate(isoDate));
  });

  it('returns N/A for null', () => {
    expect(formatDateLabel(null)).toBe('N/A');
  });
});

describe('formatDateKey', () => {
  it('formats a stable yyyy-mm-dd key', () => {
    expect(formatDateKey('2026-06-15T10:30:00Z')).toBe('2026-06-15');
  });

  it('returns N/A for null', () => {
    expect(formatDateKey(null)).toBe('N/A');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "vừa xong" for date < 60 seconds ago', () => {
    const date = new Date('2026-06-15T11:59:30Z');
    expect(formatRelativeTime(date)).toBe('vừa xong');
  });

  it('returns "X phút trước" for minutes ago', () => {
    const date = new Date('2026-06-15T11:55:00Z');
    expect(formatRelativeTime(date)).toBe('5 phút trước');
  });

  it('returns "X giờ trước" for hours ago', () => {
    const date = new Date('2026-06-15T09:00:00Z');
    expect(formatRelativeTime(date)).toBe('3 giờ trước');
  });

  it('returns "X ngày trước" for days ago', () => {
    const date = new Date('2026-06-13T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('2 ngày trước');
  });

  it('falls back to formatDate for > 30 days', () => {
    const date = new Date('2026-04-01T12:00:00Z');
    const result = formatRelativeTime(date);
    // Should be formatted date, not relative
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('returns N/A for null', () => {
    expect(formatRelativeTime(null)).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('N/A');
  });
});
