import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppError } from './app-error';
import { toErrorResponse } from './error-response';

describe('toErrorResponse', () => {
  it('keeps code, status and details of business errors', () => {
    const error = new AppError('SUBSCRIPTION_FROZEN', 'Subscription is frozen', 409, { id: 's1' });

    expect(toErrorResponse(error)).toEqual({
      status: 409,
      body: {
        error: {
          code: 'SUBSCRIPTION_FROZEN',
          message: 'Subscription is frozen',
          details: { id: 's1' },
        },
      },
    });
  });

  it('maps HTTP exceptions to stable codes', () => {
    expect(toErrorResponse(new NotFoundException()).body.error.code).toBe('NOT_FOUND');
    expect(toErrorResponse(new ForbiddenException()).status).toBe(403);
  });

  it('hides unexpected errors behind INTERNAL_ERROR with the request id', () => {
    const { status, body } = toErrorResponse(new Error('db password leaked'), 'req-1');

    expect(status).toBe(500);
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: { requestId: 'req-1' },
    });
  });
});
