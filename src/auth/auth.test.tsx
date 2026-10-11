import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_EMAIL, DEMO_PASSWORD } from '@/demo/account';
import { currentLocation, renderApp } from '@/test/render';
import { API_URL, server, signIn, TEST_NOW } from '@/test/server';

import { readSession, writeSession } from './tokenStore';

async function fillCredentials(
  user: ReturnType<typeof renderApp>['user'],
  email: string,
  password: string,
) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
}

describe('protected routes', () => {
  it('send a visitor without a session to the login page', async () => {
    renderApp('/expenses');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(currentLocation()).toBe('/login');
  });

  it('start logged out when the stored session has already expired', async () => {
    writeSession({ token: 'stale', expiresAt: Date.now() - 1000 });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('show the app when there is a valid session', async () => {
    signIn();
    renderApp('/expenses');

    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeInTheDocument();
    expect(await screen.findByText(DEMO_EMAIL)).toBeInTheDocument();
  });
});

describe('login', () => {
  it('stores the session and returns to the page the visitor asked for', async () => {
    const { user } = renderApp('/budgets?month=2026-05');
    await screen.findByRole('heading', { name: 'Log in' });

    await fillCredentials(user, DEMO_EMAIL, DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Budgets' })).toBeInTheDocument();
    expect(currentLocation()).toBe('/budgets?month=2026-05');
    // The token lasts as long as the API said: 1800 seconds from now.
    expect(readSession()).toMatchObject({ expiresAt: TEST_NOW.getTime() + 1800 * 1000 });
  });

  it('shows the API message for a wrong password and stays logged out', async () => {
    const { user } = renderApp('/login');

    await fillCredentials(user, DEMO_EMAIL, 'not the password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(readSession()).toBeNull();
    expect(currentLocation()).toBe('/login');
  });

  it('checks the fields before sending anything', async () => {
    const requests = vi.fn();
    server.events.on('request:start', requests);
    const { user } = renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    // The cursor goes to the first field that needs fixing.
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(requests).not.toHaveBeenCalled();
    server.events.removeAllListeners();
  });

  it('reports a server that cannot be reached', async () => {
    server.use(http.post(`${API_URL}/auth/login`, () => HttpResponse.error()));
    const { user } = renderApp('/login');

    await fillCredentials(user, DEMO_EMAIL, DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
  });
});

describe('register', () => {
  it('creates the account, then logs in, because the API returns no token on register', async () => {
    const { user } = renderApp('/register');

    await fillCredentials(user, 'new.person@example.com', 'a long passphrase');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('new.person@example.com')).toBeInTheDocument();
    expect(currentLocation()).toBe('/');
    expect(readSession()).not.toBeNull();
  });

  it('shows "already exists" under the email field', async () => {
    const { user } = renderApp('/register');

    await fillCredentials(user, DEMO_EMAIL, 'a long passphrase');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
        'An account with this email already exists',
      ),
    );
    expect(readSession()).toBeNull();
  });

  it('enforces the password length the API requires', async () => {
    const { user } = renderApp('/register');

    await fillCredentials(user, 'new.person@example.com', 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      /Use at least 8 characters\./,
    );
  });
});

describe('automatic logout', () => {
  it('logs out and explains why when the API rejects the token', async () => {
    signIn();
    const { user } = renderApp('/');
    await screen.findByRole('button', { name: 'Log out' });

    // From now on the API treats the token as expired.
    server.use(
      http.get(`${API_URL}/expenses`, () =>
        HttpResponse.json(
          { error: { code: 'unauthorized', message: 'Invalid or expired token' } },
          { status: 401 },
        ),
      ),
    );
    await user.click(screen.getByRole('link', { name: 'Expenses' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText(/Your session expired\./)).toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('logs out when the token lifetime has passed and the tab gets focus again', async () => {
    signIn();
    renderApp('/');
    await screen.findByRole('button', { name: 'Log out' });

    // 31 minutes later: one minute past the 30-minute token.
    vi.setSystemTime(TEST_NOW.getTime() + 31 * 60_000);
    window.dispatchEvent(new Event('focus'));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText(/Your session expired\./)).toBeInTheDocument();
    expect(readSession()).toBeNull();
  });
});

describe('log out', () => {
  it('clears the session and shows the login page without an "expired" notice', async () => {
    signIn();
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
    expect(readSession()).toBeNull();
  });
});
