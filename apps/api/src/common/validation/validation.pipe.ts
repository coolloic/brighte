import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { AppError, type ErrorDetails } from '../errors/app.error.js';

function flatten(errors: ValidationError[], parent = ''): ErrorDetails {
  return errors.reduce<ErrorDetails>((acc, err) => {
    const path = parent ? `${parent}.${err.property}` : err.property;
    if (err.constraints) acc[path] = Object.values(err.constraints);
    if (err.children?.length) Object.assign(acc, flatten(err.children, path));
    return acc;
  }, {});
}

/** Global input validation. Unknown fields are rejected, not silently stripped. */
export const appValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors) => new AppError('VALIDATION_FAILED', flatten(errors)),
});
