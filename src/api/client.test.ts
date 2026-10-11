import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_EMAIL, DEMO_PASSWORD } from '@/demo/seed';
import { API_URL, server, signIn } from '@/test/server';

import { buildQuery, request, setUnauthorizedHandler } from './client';
import { api } from './endpoints';
import { ApiError } from './errors';

describe('buildQuery', () => {
  it('leaves out empty, null and undefined values', () => {
    expect(buildQuery({ q: '', page: 1, category_id: undefined, date_from: null })).toBe('?page=1');
    expect(buildQuery({})).toBe('');
  });

  it('encodes values', () => {
    expect(buildQuery({ q: 'tea & toast' })).toBe('?q=tea+%26+toast');
  });
});

describe('request', () => {
  it('turns the API error body into an ApiError with its details', async () => {
    signIn();
    const error = await api.expenses
      .create({ amount: '0', category_id: 1, date: '2026-06-10', payment_method: 'upi' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'validation_error',
      message: 'Request validation failed',
      details: [{ field: 'body.amount', message: 'Input should be greater than 0' }],
    });
  });

  it('gives a plain message when the error body is not the API format', async () => {
    server.use(
      http.get(
        `${API_URL}/broken`,
        () => new HttpResponse('<h1>Bad gateway</h1>', { status: 502 }),
      ),
    );

    await expect(request('/broken')).rejects.toMatchObject({
      status: 502,
      code: 'http_error',
      message: 'Request failed (HTTP 502).',
    });
  });

  it('reports a network failure as status 0 with a message a person can act on', async () => {
    server.use(http.get(`${API_URL}/down`, () => HttpResponse.error()));

    await expect(request('/down')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
      message: 'Could not reach the server. Check that it is running and try again.',
    });
  });

  it('resolves a 204 to undefined', async () => {
    server.use(http.delete(`${API_URL}/thing`, () => new HttpResponse(null, { status: 204 })));

    await expect(request('/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('sends the stored token as a bearer header', async () => {
    const token = signIn();
    let header: string | null = null;
    server.use(
      http.get(`${API_URL}/echo`, ({ request: incoming }) => {
        header = incoming.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );

    await request('/echo');
    expect(header).toBe(`Bearer ${token}`);
  });

  it('sends no token on calls marked auth: false', async () => {
    signIn();
    let header: string | null = 'unset';
    server.use(
      http.get(`${API_URL}/echo`, ({ request: incoming }) => {
        header = incoming.headers.get('Authorization');
        return HttpResponse.json({});
      }),
    );

    await request('/echo', { auth: false });
    expect(header).toBeNull();
  });
});

describe('login', () => {
  it('posts a urlencoded form with the email in the username field', async () => {
    let contentType: string | null = null;
    let body = '';
    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request: incoming }) => {
        contentType = incoming.headers.get('Content-Type');
        body = await incoming.text();
        return HttpResponse.json({ access_token: 't', token_type: 'bearer', expires_in: 1800 });
      }),
    );

    await api.auth.login('me@example.com', 'a long passphrase');

    expect(contentType).toContain('application/x-www-form-urlencoded');
    expect(new URLSearchParams(body).get('username')).toBe('me@example.com');
    expect(new URLSearchParams(body).get('password')).toBe('a long passphrase');
  });

  it('returns the token and its lifetime', async () => {
    const token = await api.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(token).toMatchObject({ token_type: 'bearer', expires_in: 1800 });
    expect(token.access_token).toEqual(expect.any(String));
  });
});

describe('unauthorized handling', () => {
  it('tells the auth layer when a call that carried a token gets a 401', async () => {
    signIn();
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json(
          { error: { code: 'unauthorized', message: 'Invalid or expired token' } },
          { status: 401 },
        ),
      ),
    );

    await expect(api.auth.me()).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not treat a wrong password as an expired session', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await expect(api.auth.login(DEMO_EMAIL, 'wrong password')).rejects.toMatchObject({
      status: 401,
      message: 'Incorrect email or password',
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
