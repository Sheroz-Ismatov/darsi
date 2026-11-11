import i18n from '../app/i18n';
import { ApiError } from './api';

/**
 * User-facing text for a failed request: translated by the API error code when we know it.
 * `details` fill the placeholders, e.g. `{{max}}` of PLAN_LIMIT_REACHED.
 */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    if (i18n.exists(key)) return i18n.t(key as 'errors.unknown', error.details ?? {});
  }
  return i18n.t('errors.unknown');
}
