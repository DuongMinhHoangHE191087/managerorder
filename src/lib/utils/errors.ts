/**
 * Custom error classes for API responses
 */

export class ApplicationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string = "Invalid credentials") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}
