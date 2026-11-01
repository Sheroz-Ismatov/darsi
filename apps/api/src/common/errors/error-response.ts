import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

/** Maps any thrown value to the single API error format. Unknown errors never leak details. */
export function toErrorResponse(
  exception: unknown,
  requestId?: string,
): { status: number; body: ErrorBody } {
  if (exception instanceof AppError) {
    return {
      status: exception.status,
      body: {
        error: { code: exception.code, message: exception.message, details: exception.details },
      },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      status,
      body: { error: { code: CODE_BY_STATUS[status] ?? 'HTTP_ERROR', message: exception.message } },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: requestId ? { requestId } : undefined,
      },
    },
  };
}
