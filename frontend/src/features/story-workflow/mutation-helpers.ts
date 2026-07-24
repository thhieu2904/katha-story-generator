import { ApiError } from '@/lib/api';

/**
 * Returns true for HTTP status codes where the backend contract guarantees
 * the mutation was NOT committed:
 *   400 — bad request / validation
 *   401 — unauthenticated
 *   403 — forbidden
 *   404 — resource not found
 *   422 — unprocessable entity / semantic validation
 */
export function isDefiniteError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return [400, 401, 403, 404, 422].includes(error.status);
}

/**
 * Returns true for HTTP status codes / network conditions where the mutation
 * outcome is uncertain (may or may not have committed):
 *   0   — network error, timeout, connection lost
 *   409 — conflict (concurrent mutation)
 *   5xx — server error (may have partially committed)
 */
export function isUncertainError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status === 409 || error.status >= 500;
}
