export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "Sign in to continue.", code = "UNAUTHORIZED") =>
  new ApiError(401, code, message);

export const forbidden = (message = "You do not have permission to do that.", code = "FORBIDDEN") =>
  new ApiError(403, code, message);

export const notFound = (message = "The requested resource was not found.") =>
  new ApiError(404, "NOT_FOUND", message);

export const conflict = (message: string, code = "CONFLICT") => new ApiError(409, code, message);

export const tooManyRequests = (message = "Too many attempts. Please try again shortly.") =>
  new ApiError(429, "TOO_MANY_REQUESTS", message);

export const serverError = (message = "Something went wrong on our side.") =>
  new ApiError(500, "SERVER_ERROR", message);
