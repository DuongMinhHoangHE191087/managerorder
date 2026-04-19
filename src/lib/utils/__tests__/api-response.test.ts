import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse } from '../api';

describe('successResponse', () => {
  it('wraps data with success: true and timestamp', () => {
    const result = successResponse({ id: '123' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '123' });
    expect(result.meta?.timestamp).toBeDefined();
  });

  it('handles null data', () => {
    const result = successResponse(null);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('handles array data', () => {
    const result = successResponse([1, 2, 3]);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('timestamp is a valid ISO string', () => {
    const result = successResponse('test');
    const ts = result.meta?.timestamp;
    expect(ts).toBeDefined();
    expect(new Date(ts!).toISOString()).toBe(ts);
  });
});

describe('errorResponse', () => {
  it('returns tuple of [response, statusCode]', () => {
    const [response, status] = errorResponse('NOT_FOUND', 'Not found', 404);
    expect(status).toBe(404);
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('NOT_FOUND');
    expect(response.error?.message).toBe('Not found');
  });

  it('defaults statusCode to 500', () => {
    const [, status] = errorResponse('ERR', 'Error');
    expect(status).toBe(500);
  });

  it('includes details when provided', () => {
    const details = [{ field: 'email', message: 'invalid' }];
    const [response] = errorResponse('VALIDATION', 'Bad input', 400, details);
    expect(response.error?.details).toEqual(details);
  });

  it('omits details when not provided', () => {
    const [response] = errorResponse('ERR', 'Error');
    expect(response.error?.details).toBeUndefined();
  });

  it('includes meta.timestamp', () => {
    const [response] = errorResponse('ERR', 'Error');
    expect(response.meta?.timestamp).toBeDefined();
  });
});
