import type { AuthResponse, ProblemDetails } from '@cdms/contracts';

/**
 * The ONLY way the frontend talks to the backend. Do not call fetch() directly elsewhere.
 * - Access token lives in memory only (never localStorage) to limit XSS impact.
 * - The refresh token is an httpOnly SameSite=Strict cookie handled by the browser.
 * - On 401 the client refreshes once (single-flight) and retries.
 */
export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
  }
  get status() {
    return this.problem.status;
  }
  /** Field errors keyed by path, for react-hook-form. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.problem.errors ?? []).map((e) => [e.path, e.message]));
  }
}

let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let onSessionChange: ((auth: AuthResponse | null) => void) | null = null;

export const tokenStore = {
  set(token: string | null) {
    accessToken = token;
  },
  onChange(cb: typeof onSessionChange) {
    onSessionChange = cb;
  },
};

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ProblemDetails> = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  return new ApiError({ type: body.type ?? 'about:blank', title: body.title ?? res.statusText, status: res.status, ...body } as ProblemDetails);
}

export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
      .then(async (r) => (r.ok ? ((await r.json()) as AuthResponse) : null))
      .catch(() => null)
      .then((auth) => {
        accessToken = auth?.accessToken ?? null;
        onSessionChange?.(auth);
        return auth;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const auth = await refreshSession();
    if (auth) return request<T>(method, path, body, false);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

/** Downloads a protected file and triggers the browser save dialog. */
async function download(path: string, fallbackName = 'download') {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'same-origin' });
  let res = await doFetch();
  if (res.status === 401 && (await refreshSession())) res = await doFetch();
  if (!res.ok) throw await parseError(res);
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(cd);
  const name = m ? decodeURIComponent(m[1] ?? m[2] ?? fallbackName) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
  download,
};
