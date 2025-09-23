import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../api/middleware/errorHandler';

// Validation schemas
export const registerClientSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Client name cannot be empty',
      'string.min': 'Client name must be at least 1 character long',
      'string.max': 'Client name cannot exceed 100 characters',
      'any.required': 'Client name is required'
    }),

  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),

  rateLimit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100)
    .messages({
      'number.base': 'Rate limit must be a number',
      'number.integer': 'Rate limit must be an integer',
      'number.min': 'Rate limit must be at least 1',
      'number.max': 'Rate limit cannot exceed 1000'
    })
});

export const generateTokenSchema = Joi.object({
  clientId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Client ID must be a valid UUID',
      'any.required': 'Client ID is required'
    })
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Refresh token cannot be empty',
      'any.required': 'Refresh token is required'
    })
});

export const revokeApiKeySchema = Joi.object({
  keyId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Key ID must be a valid UUID',
      'any.required': 'Key ID is required'
    })
});

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      throw new ValidationError('Validation failed', validationErrors);
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Validation middleware for URL parameters
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      throw new ValidationError('Parameter validation failed', validationErrors);
    }

    req.params = value;
    next();
  };
};