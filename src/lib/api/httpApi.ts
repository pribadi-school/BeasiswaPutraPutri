/**
 * Backend sungguhan: server Node.js + MySQL (server/) di alamat yang sama, /api/...
 * Sesi disimpan server di cookie HttpOnly; browser tidak pernah memegang token.
 */
import { AppError, type AdminSettings, type Applicant, type AuthUser, type Me, type PublicSettings } from '../types';
import type { Api, AuthConfig } from './api';

const CSRF = { 'X-Requested-With': 'beasiswa' };

async function call<T>(method: string, path: string, body?: unknown, raw?: { data: Blob; type: string }): Promise<T> {
  const headers: Record<string, string> = method === 'GET' ? {} : { ...CSRF };
  let payload: BodyInit | undefined;
  if (raw) { headers['Content-Type'] = raw.type; payload = raw.data; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new AppError('NETWORK');
  }
  const data = (res.headers.get('content-type') ?? '').includes('json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 413) throw new AppError('TOO_LARGE');
    throw new AppError(typeof data?.error === 'string' ? data.error : 'UNKNOWN', data?.field ?? undefined);
  }
  return data as T;
}

export function createHttpApi(): Api {
  return {
    mode: 'server',
    getSettings: () => call<PublicSettings>('GET', '/settings'),

    authConfig: () => call<AuthConfig>('GET', '/auth/config'),
    getUser: () => call<AuthUser | null>('GET', '/auth/me'),
    async signIn(input) {
      if ('credential' in input) await call('POST', '/auth/google', { credential: input.credential });
      else await call('POST', '/auth/dev', { email: input.devEmail });
    },
    async signOut() {
      try { await call('POST', '/auth/logout'); } catch { /* tetap dianggap keluar */ }
    },

    me: () => call<Me>('GET', '/me'),
    async register(profile, lang) { await call('POST', '/me/register', { profile, lang }); },
    async updateProfile(profile) { await call('PUT', '/me/profile', { profile }); },

    async uploadDocument(file) {
      await call('PUT', '/me/document', undefined, { data: file, type: 'application/pdf' });
    },
    documentUrl: async () => '/api/me/document',

    async adminSignIn(email, password) { await call('POST', '/admin/login', { email, password }); },
    isAdmin: async () => {
      try { return (await call<{ admin: boolean }>('GET', '/admin/session')).admin; } catch { return false; }
    },
    adminList: () => call<Applicant[]>('GET', '/admin/applicants'),
    adminGetSettings: () => call<AdminSettings>('GET', '/admin/settings'),
    async adminSaveSettings(s) { await call('PUT', '/admin/settings', s); },
    adminSetStatus: async (ids, status, stage) => (await call<{ updated: number }>('POST', '/admin/status', { ids, status, stage })).updated,
    adminDocumentUrl: async (a) => `/api/admin/applicants/${encodeURIComponent(a.id)}/document`,
    async adminDelete(a) { await call('DELETE', `/admin/applicants/${encodeURIComponent(a.id)}`); },
  };
}
