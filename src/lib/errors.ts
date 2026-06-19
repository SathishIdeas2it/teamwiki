export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly details: unknown,
  ) {
    super(message, 'VALIDATION_ERROR', 422);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT', 409);
  }
}

export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred') {
    super(message, 'INTERNAL_ERROR', 500);
  }
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof AppError) {
    const body: { error: { code: string; message: string; details?: unknown } } = {
      error: { code: error.code, message: error.message },
    };
    if (error instanceof ValidationError) {
      body.error.details = error.details;
    }
    return Response.json(body, { status: error.statusCode });
  }
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 },
  );
}
