import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

type RequestSchemas = {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
};

const formatValidationError = (error: Joi.ValidationError) => error.details.map((detail) => ({
  field: detail.path.join('.'),
  message: detail.message,
}));

export const validateRequest = (schemas: RequestSchemas) => (req: Request, res: Response, next: NextFunction): void => {
  const targets = [
    ['body', schemas.body],
    ['query', schemas.query],
    ['params', schemas.params],
  ] as const;

  for (const [target, schema] of targets) {
    if (!schema) continue;

    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      allowUnknown: false,
      convert: true,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(error),
      });
      return;
    }

    (req as any)[target] = value;
  }

  next();
};