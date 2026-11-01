/**
 * Expected business error. `code` is a stable key the clients translate via i18n
 * (ARCHITECTURE.md §3.7), e.g. `SUBSCRIPTION_FROZEN`.
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 422,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
