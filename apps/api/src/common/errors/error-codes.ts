import { HttpStatus } from '@nestjs/common';

/**
 * Single source of truth for error codes returned to clients.
 * `message` is user-facing: friendly, actionable, and never leaks internals.
 */
export const ERRORS = {
  BAD_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    message: 'The request could not be understood.',
  },
  VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Some of the information provided is invalid.',
  },
  UNAUTHENTICATED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Please sign in to continue.',
  },
  INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Email or password is incorrect.',
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: 'You do not have permission to perform this action.',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'The requested resource was not found.',
  },
  CONFLICT: {
    status: HttpStatus.CONFLICT,
    message: 'This conflicts with an existing record.',
  },
  EMAIL_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'An account with this email already exists.',
  },
  NOT_IMPLEMENTED: {
    status: HttpStatus.NOT_IMPLEMENTED,
    message: 'This feature is not available yet.',
  },
  INTERNAL_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Something went wrong. Please try again later.',
  },
} as const satisfies Record<string, { status: HttpStatus; message: string }>;

export type ErrorCode = keyof typeof ERRORS;
