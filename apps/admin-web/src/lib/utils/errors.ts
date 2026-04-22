/**
 * Custom error classes for API responses
 */

export class ApplicationError extends Error {
  statusCode: number;
  code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends ApplicationError {
  details?: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
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

export class UnprocessableEntityError extends ApplicationError {
  constructor(message: string = "Unprocessable entity") {
    super(message, 422, "UNPROCESSABLE_ENTITY");
  }
}

export class SchemaNotInitializedError extends ApplicationError {
  details?: Record<string, unknown>;

  constructor(
    message: string = "Tính năng này chưa được khởi tạo trong cơ sở dữ liệu",
    details?: Record<string, unknown>,
  ) {
    super(message, 503, "SCHEMA_NOT_INITIALIZED");
    this.details = details;
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}
