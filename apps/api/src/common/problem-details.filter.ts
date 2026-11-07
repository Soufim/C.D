import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ProblemDetails } from '@cdms/contracts';

const PG_ERRORS: Record<string, { status: number; title: string; detail: string }> = {
  '23505': {
    status: 409,
    title: 'Duplicate',
    detail: 'A record with the same code already exists.',
  },
  '23503': {
    status: 409,
    title: 'Record in use',
    detail:
      'This record is referenced by other records and cannot be removed or the referenced record does not exist.',
  },
  '23514': { status: 422, title: 'Invalid data', detail: 'The data violates a database rule.' },
  '22P02': { status: 400, title: 'Invalid input', detail: 'Malformed value.' },
};

/**
 * Converts every error into RFC 9457 problem details. Internal errors never leak stack traces,
 * SQL, or driver messages to the client; they are logged with the request id instead.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const traceId = String(req.id ?? '');
    let body: ProblemDetails;

    const pgCode =
      (exception as { code?: string; cause?: { code?: string } })?.cause?.code ??
      (exception as { code?: string })?.code;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      const obj = typeof r === 'string' ? { detail: r } : (r as Record<string, unknown>);
      body = {
        type: (obj.type as string) ?? 'about:blank',
        title: (obj.title as string) ?? HttpStatus[status] ?? 'Error',
        status,
        detail:
          (obj.detail as string) ?? (typeof obj.message === 'string' ? obj.message : undefined),
        errors: obj.errors as ProblemDetails['errors'],
      };
    } else if (pgCode && PG_ERRORS[pgCode]) {
      const m = PG_ERRORS[pgCode];
      body = { type: `urn:cdms:db:${pgCode}`, ...m };
    } else {
      this.logger.error({ err: exception, traceId }, 'Unhandled error');
      body = {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred.',
      };
    }
    body.instance = req.originalUrl?.split('?')[0];
    body.traceId = traceId || undefined;
    res.status(body.status).type('application/problem+json').json(body);
  }
}
