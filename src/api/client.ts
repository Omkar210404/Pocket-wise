/**
 * The one place that talks HTTP. It adds the base URL and the bearer token,
 * builds query strings, and turns every failure into an `ApiError`.
 */

import { getToken } from '@/auth/tokenStore';
import { apiUrl } from '@/env';

import { ApiError, type ApiErrorDetail } from './errors';

export type QueryValue = string | number | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  /** Sent as a JSON body. */
  json?: unknown;
  /** Sent as application/x-www-form-urlencoded. Only the login uses this. */
  form?: Record<string, string>;
  /** False for the calls that are made before there is a token. */
  auth?: boolean;
  signal?: AbortSignal;
}

let onUnauthorized: (() => void) | null = null;

/** The auth layer registers here to be told when the API rejects the token. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Empty, null and undefined values are left out, so `?q=&page=1` becomes `?page=1`. */
export function buildQuery(query: Record<string, QueryValue> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: a proxy error page, or an empty body.
  }
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error: Record<string, unknown> }).error;
    if (typeof error === 'object' && error !== null && typeof error.message === 'string') {
      return new ApiError(
        response.status,
        typeof error.code === 'string' ? error.code : 'http_error',
        error.message,
        Array.isArray(error.details) ? (error.details as ApiErrorDetail[]) : [],
      );
    }
  }
  return new ApiError(response.status, 'http_error', `Request failed (HTTP ${response.status}).`);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  if (!apiUrl) {
    throw new ApiError(0, 'config_error', 'VITE_API_URL is not set. See .env.example.');
  }

  const { method = 'GET', query, json, form, auth = true, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    // fetch sets the urlencoded content type for a URLSearchParams body.
    body = new URLSearchParams(form);
  }

  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}${buildQuery(query)}`, {
      method,
      headers,
      body,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'network_error',
      'Could not reach the server. Check that it is running and try again.',
    );
  }

  if (!response.ok) {
    // A 401 on a call that carried a token means the token is no longer good.
    if (response.status === 401 && token) onUnauthorized?.();
    throw await toApiError(response);
  }
  return response;
}

/** A JSON call. Resolves to `undefined` for a 204. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** A call whose answer is a file, such as the CSV export. */
export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await send(path, options);
  return response.blob();
}
