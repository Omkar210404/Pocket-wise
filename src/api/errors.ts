/**
 * The API reports every failure as
 *   {"error": {"code": "...", "message": "...", "details": [{"field", "message"}]}}
 * (expense-tracker-api/app/errors.py). `details` is present for validation errors only.
 */

export interface ApiErrorDetail {
  /** Where the problem is, for example "body.amount" or "query.date_from". */
  field: string;
  message: string;
}

export class ApiError extends Error {
  /** HTTP status, or 0 when no response arrived (network down, wrong URL, CORS). */
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** "body.category_id" -> "category_id". */
function fieldName(path: string): string {
  return path.split('.').pop() ?? path;
}

/**
 * Validation problems keyed by field name, so a form can show each one under
 * its own control. Empty for errors that are not about a field.
 */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  const byField: Record<string, string> = {};
  for (const detail of error.details) {
    const name = fieldName(detail.field);
    // Keep the first message for a field: it is the most specific one.
    byField[name] ??= detail.message;
  }
  return byField;
}

/** One sentence a person can act on, for places that show a single message. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.details.length > 0) {
      return error.details
        .map((detail) => `${fieldName(detail.field).replace(/_/g, ' ')}: ${detail.message}`)
        .join('. ');
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}
