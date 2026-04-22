import { describe, it, expect } from 'vitest';
import {
  ApplicationError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  isApplicationError,
} from '../errors';

describe('ApplicationError', () => {
  it('sets message, default statusCode 500, code INTERNAL_ERROR', () => {
    const err = new ApplicationError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.name).toBe('ApplicationError');
  });

  it('accepts custom statusCode and code', () => {
    const err = new ApplicationError('Custom', 422, 'CUSTOM_CODE');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('CUSTOM_CODE');
  });

  it('is an instance of Error', () => {
    const err = new ApplicationError('test');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  it('has statusCode 400 and code VALIDATION_ERROR', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.name).toBe('ValidationError');
  });

  it('stores field-level details', () => {
    const details = [{ field: 'email', message: 'required' }];
    const err = new ValidationError('Invalid', details);
    expect(err.details).toEqual(details);
  });

  it('is an ApplicationError subclass', () => {
    expect(new ValidationError('x')).toBeInstanceOf(ApplicationError);
  });
});

describe('AuthenticationError', () => {
  it('defaults to 401, AUTHENTICATION_ERROR, and default message', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.message).toBe('Invalid credentials');
  });

  it('accepts custom message', () => {
    const err = new AuthenticationError('Token expired');
    expect(err.message).toBe('Token expired');
  });
});

describe('AuthorizationError', () => {
  it('defaults to 403, AUTHORIZATION_ERROR', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTHORIZATION_ERROR');
    expect(err.message).toBe('Insufficient permissions');
  });
});

describe('NotFoundError', () => {
  it('defaults to 404, NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
  });

  it('accepts custom message', () => {
    const err = new NotFoundError('Order #123 not found');
    expect(err.message).toBe('Order #123 not found');
  });
});

describe('ConflictError', () => {
  it('defaults to 409, CONFLICT', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Resource already exists');
  });
});

describe('isApplicationError', () => {
  it('returns true for ApplicationError', () => {
    expect(isApplicationError(new ApplicationError('test'))).toBe(true);
  });

  it('returns true for all subclasses', () => {
    expect(isApplicationError(new ValidationError('x'))).toBe(true);
    expect(isApplicationError(new AuthenticationError())).toBe(true);
    expect(isApplicationError(new AuthorizationError())).toBe(true);
    expect(isApplicationError(new NotFoundError())).toBe(true);
    expect(isApplicationError(new ConflictError())).toBe(true);
  });

  it('returns false for generic Error', () => {
    expect(isApplicationError(new Error('test'))).toBe(false);
  });

  it('returns false for string', () => {
    expect(isApplicationError('error')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isApplicationError(null)).toBe(false);
    expect(isApplicationError(undefined)).toBe(false);
  });

  it('returns false for plain object', () => {
    expect(isApplicationError({ message: 'fake' })).toBe(false);
  });
});
