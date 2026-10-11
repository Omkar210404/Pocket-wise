import { fieldErrors, errorMessage, isApiError } from '@/api/errors';

export type AuthMode = 'login' | 'register';

export interface CredentialErrors {
  email?: string;
  password?: string;
  /** A problem that is not about one field, such as a wrong password. */
  form?: string;
}

/** The API's password rules (app/schemas/auth.py): at least 8 characters, at most 72 bytes. */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

/** Checked before anything is sent, so the common mistakes get an instant, plain answer. */
export function validateCredentials(
  email: string,
  password: string,
  mode: AuthMode,
): CredentialErrors {
  const errors: CredentialErrors = {};

  if (!email.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter an email address like name@example.com.';
  }

  if (!password) {
    errors.password = 'Enter your password.';
  } else if (mode === 'register') {
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
      errors.password = `Use a shorter password (at most ${MAX_PASSWORD_BYTES} bytes).`;
    }
  }
  return errors;
}

/** Puts an API failure where the person will look for it: under a field, or above the form. */
export function credentialErrorsFrom(error: unknown): CredentialErrors {
  const byField = fieldErrors(error);
  // The login form posts the email as `username`.
  const email = byField.email ?? byField.username;
  if (email || byField.password) return { email, password: byField.password };
  if (isApiError(error) && error.status === 409) return { email: error.message };
  return { form: errorMessage(error) };
}
