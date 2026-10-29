import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../core/errors';

type Source = 'body' | 'params' | 'query';

function validate(source: Source, schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(new ValidationError(`Invalid request ${source}`, result.error.flatten()));
      return;
    }

    // Replace with the parsed value so controllers get coerced, typed input.
    Object.assign(req, { [source]: result.data });
    next();
  };
}

export const validateBody = (schema: ZodTypeAny): RequestHandler => validate('body', schema);
export const validateParams = (schema: ZodTypeAny): RequestHandler => validate('params', schema);
export const validateQuery = (schema: ZodTypeAny): RequestHandler => validate('query', schema);
