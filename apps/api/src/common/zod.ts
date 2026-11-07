import {
  applyDecorators,
  Body,
  createParamDecorator,
  ExecutionContext,
  ParseUUIDPipe,
  Param,
  PipeTransform,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';

/** Validates and transforms input with a zod schema from @cdms/contracts. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new UnprocessableEntityException({
        title: 'Validation failed',
        errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

function jsonSchema(schema: z.ZodType) {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
}

/** Validated request body; also documents the schema in OpenAPI. */
export const ZBody = (schema: z.ZodType): ParameterDecorator => {
  const doc = ApiBody({ schema: jsonSchema(schema) as never });
  return (target, key, index) => {
    Body(new ZodPipe(schema))(target, key, index);
    if (key) doc(target, key, Object.getOwnPropertyDescriptor(target, key)!);
  };
};

/** Validated query string. */
export const ZQuery = (schema: z.ZodType): ParameterDecorator => (target, key, index) => {
  Query(new ZodPipe(schema))(target, key, index);
  if (key && schema instanceof z.ZodObject) {
    const desc = Object.getOwnPropertyDescriptor(target, key)!;
    for (const name of Object.keys(schema.shape)) {
      applyDecorators(ApiQuery({ name, required: false }))(target, key, desc);
    }
  }
};

/** UUID route parameter (rejects malformed ids with 400 before reaching the service). */
export const IdParam = (name = 'id') => Param(name, new ParseUUIDPipe({ version: '4' }));

export const RawBody = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().body;
});
