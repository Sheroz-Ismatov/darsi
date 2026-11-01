import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toErrorResponse } from './error-response';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();

    const { status, body } = toErrorResponse(exception, request.id);
    if (status >= 500) {
      this.logger.error(exception);
    }
    response.status(status).json(body);
  }
}
