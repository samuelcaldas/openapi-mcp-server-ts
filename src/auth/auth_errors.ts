export enum AuthErrorType {
  MISSING_CREDENTIALS = "missing_credentials",
  INVALID_CREDENTIALS = "invalid_credentials",
  EXPIRED_TOKEN = "expired_token",
  INSUFFICIENT_PERMISSIONS = "insufficient_permissions",
  CONFIGURATION_ERROR = "configuration_error",
  NETWORK_ERROR = "network_error",
  UNKNOWN_ERROR = "unknown_error",
}

export class AuthError extends Error {
  readonly errorType: AuthErrorType;
  readonly details: Record<string, unknown>;

  constructor(message: string, errorType = AuthErrorType.UNKNOWN_ERROR, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "AuthError";
    this.errorType = errorType;
    this.details = details;
  }

  override toString(): string {
    return `${this.errorType}: ${this.message}`;
  }
}

export class MissingCredentialsError extends AuthError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, AuthErrorType.MISSING_CREDENTIALS, details);
    this.name = "MissingCredentialsError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, AuthErrorType.INVALID_CREDENTIALS, details);
    this.name = "InvalidCredentialsError";
  }
}

export class ExpiredTokenError extends AuthError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, AuthErrorType.EXPIRED_TOKEN, details);
    this.name = "ExpiredTokenError";
  }
}

export class InsufficientPermissionsError extends AuthError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, AuthErrorType.INSUFFICIENT_PERMISSIONS, details);
    this.name = "InsufficientPermissionsError";
  }
}

export class ConfigurationError extends AuthError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, AuthErrorType.CONFIGURATION_ERROR, details);
    this.name = "ConfigurationError";
  }
}

export class NetworkError extends AuthError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, AuthErrorType.NETWORK_ERROR, details);
    this.name = "NetworkError";
  }
}

export function createAuthError(type: AuthErrorType, message: string, details?: Record<string, unknown>): AuthError {
  const constructors: Record<AuthErrorType, (message: string, details?: Record<string, unknown>) => AuthError> = {
    [AuthErrorType.MISSING_CREDENTIALS]: (value, metadata) => new MissingCredentialsError(value, metadata),
    [AuthErrorType.INVALID_CREDENTIALS]: (value, metadata) => new InvalidCredentialsError(value, metadata),
    [AuthErrorType.EXPIRED_TOKEN]: (value, metadata) => new ExpiredTokenError(value, metadata),
    [AuthErrorType.INSUFFICIENT_PERMISSIONS]: (value, metadata) => new InsufficientPermissionsError(value, metadata),
    [AuthErrorType.CONFIGURATION_ERROR]: (value, metadata) => new ConfigurationError(value, metadata),
    [AuthErrorType.NETWORK_ERROR]: (value, metadata) => new NetworkError(value, metadata),
    [AuthErrorType.UNKNOWN_ERROR]: (value, metadata) => new AuthError(value, AuthErrorType.UNKNOWN_ERROR, metadata),
  };
  return constructors[type](message, details);
}

export function formatErrorMessage(providerName: string, errorType: AuthErrorType, message: string): string {
  return `[${providerName.toUpperCase()}] ${errorType}: ${message}`;
}
