import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { DEMO_EMAIL, DEMO_PASSWORD } from '@/demo/account';
import { isDemo } from '@/env';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { ErrorNote } from '@/ui/States';

import { useAuth } from './authContext';
import styles from './AuthPages.module.css';
import {
  credentialErrorsFrom,
  validateCredentials,
  type AuthMode,
  type CredentialErrors,
} from './credentials';

const COPY = {
  login: {
    title: 'Log in',
    submit: 'Log in',
    other: { text: 'New here?', link: 'Create an account', to: '/register' },
  },
  register: {
    title: 'Create an account',
    submit: 'Create account',
    other: { text: 'Already have an account?', link: 'Log in', to: '/login' },
  },
} as const;

function CredentialsForm({ mode }: { mode: AuthMode }) {
  const { login, register, sessionExpired } = useAuth();
  const location = useLocation();
  const copy = COPY[mode];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // After a failed attempt, put the cursor in the first field that needs fixing.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  async function run(action: () => Promise<void>, kind: 'form' | 'demo') {
    setBusy(kind);
    setErrors({});
    try {
      // On success the layout sees the new session and moves on into the app.
      await action();
    } catch (error) {
      setErrors(credentialErrorsFrom(error));
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const problems = validateCredentials(email, password, mode);
    if (problems.email || problems.password) {
      setErrors(problems);
      return;
    }
    void run(() => (mode === 'login' ? login : register)(email.trim(), password), 'form');
  }

  return (
    <div className={styles.page}>
      <h1>{copy.title}</h1>

      {mode === 'login' && sessionExpired && (
        <p className={styles.notice} role="status">
          Your session expired. Log in again to continue.
        </p>
      )}

      {isDemo && (
        <div className={styles.demo}>
          <p>
            <strong>This is a demo.</strong> It runs on fictional data in your browser, with no
            server behind it.
          </p>
          <Button
            variant="primary"
            busy={busy === 'demo'}
            disabled={busy !== null}
            onClick={() => void run(() => login(DEMO_EMAIL, DEMO_PASSWORD), 'demo')}
          >
            Open the demo
          </Button>
        </div>
      )}

      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        {errors.form && <ErrorNote>{errors.form}</ErrorNote>}

        <Field label="Email" error={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Password"
          error={errors.password}
          hint={mode === 'register' ? 'At least 8 characters.' : undefined}
        >
          {(control) => (
            <input
              {...control}
              type="password"
              name="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>

        <Button
          type="submit"
          variant={isDemo ? 'secondary' : 'primary'}
          busy={busy === 'form'}
          disabled={busy !== null}
        >
          {copy.submit}
        </Button>
      </form>

      <p className={styles.other}>
        {copy.other.text}{' '}
        {/* The state carries where the person was heading before they had to log in. */}
        <Link to={copy.other.to} state={location.state}>
          {copy.other.link}
        </Link>
      </p>
    </div>
  );
}

export function LoginPage() {
  return <CredentialsForm key="login" mode="login" />;
}

export function RegisterPage() {
  return <CredentialsForm key="register" mode="register" />;
}
