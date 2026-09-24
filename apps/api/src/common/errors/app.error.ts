import { ERRORS, type ErrorCode } from './error-codes.js';

/** Field-level validation messages, keyed by input path (e.g. `input.email`). */
export type ErrorDetails = Record<string, string[]>;

/**
 * Throw this for every expected failure. The global filter turns it into a
 * client response; anything else is treated as an unexpected INTERNAL_ERROR.
 */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    readonly details?: ErrorDetails,
    /** Internal context for logs only; never sent to the client. */
    readonly internal?: string,
  ) {
    super(internal ?? ERRORS[code].message);
    this.name = 'AppError';
    this.status = ERRORS[code].status;
  }

  get userMessage(): string {
    return ERRORS[this.code].message;
  }
}
