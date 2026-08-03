// Cliente HTTP del remoto. Consume `apiBase` (prop del shell) en vez de hardcodear el
// prefijo. La cookie de sesión viaja sola (credentials:'include') tras el gateway;
// en POST/PUT/DELETE se envía X-CSRFToken.

let API_BASE = '/incitrack/';

/** Configura la base pública de la app (= prop `apiBase` del shell). Llamar una vez al montar. */
export function configureApiBase(base: string): void {
  if (base) API_BASE = base.endsWith('/') ? base : base + '/';
}

function v1(path: string): string {
  return `${API_BASE}api/v1/${path.replace(/^\//, '')}`;
}

function getCsrf(): string {
  return document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? '';
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('grancrm:sessionExpired'));
    throw new Error('Sesión expirada');
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = (body && (body.detail || body.message)) || detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** GET/POST/PUT/DELETE JSON. `path` es relativo a `{apiBase}api/v1/`. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(v1(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrf(),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  return handle<T>(res);
}

/** POST multipart (subida de archivos). No fija Content-Type (el navegador pone el boundary). */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(v1(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRFToken': getCsrf() },
    body: form,
  });
  return handle<T>(res);
}
