import { describe, it, expect } from 'vitest';
import { escapeHtml, formatVnd, formatDateVn } from '../telegram';

// ============================================================
// escapeHtml
// ============================================================

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes less-than signs', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
    );
  });

  it('escapes greater-than signs', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('handles multiple special characters', () => {
    expect(escapeHtml('<b>Hello & World</b>')).toBe(
      '&lt;b&gt;Hello &amp; World&lt;/b&gt;',
    );
  });

  it('returns unchanged string when no special chars', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles unicode safely', () => {
    expect(escapeHtml('Xin chào 🌍')).toBe('Xin chào 🌍');
  });

  it('escapes all occurrences, not just first', () => {
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
  });
});

// ============================================================
// formatVnd
// ============================================================

describe('formatVnd', () => {
  it('formats zero', () => {
    expect(formatVnd(0)).toBe('0đ');
  });

  it('formats small amounts', () => {
    expect(formatVnd(1000)).toBe('1.000đ');
  });

  it('formats large amounts with separators', () => {
    expect(formatVnd(1500000)).toBe('1.500.000đ');
  });

  it('rounds decimal amounts', () => {
    const result = formatVnd(1234.5);
    expect(result).toContain('đ');
    // Should round to nearest integer
    expect(result).toBe('1.235đ');
  });

  it('handles negative amounts', () => {
    const result = formatVnd(-50000);
    expect(result).toContain('-');
    expect(result).toContain('đ');
  });
});

// ============================================================
// formatDateVn
// ============================================================

describe('formatDateVn', () => {
  it('formats ISO date to dd/MM/yyyy', () => {
    expect(formatDateVn('2026-03-17T12:00:00Z')).toMatch(/\d{2}\/\d{2}\/2026/);
  });

  it('pads single-digit day and month', () => {
    const result = formatDateVn('2026-01-05T00:00:00Z');
    expect(result).toMatch(/05\/01\/2026/);
  });

  it('handles different date formats', () => {
    const result = formatDateVn('2026-12-25');
    expect(result).toMatch(/25\/12\/2026/);
  });
});
