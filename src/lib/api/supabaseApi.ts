/** Backend asli: memanggil fungsi Postgres di supabase/migrations/0001_schema.sql. */
import { createClient } from '@supabase/supabase-js';
import { AppError, type AdminSettings, type Applicant, type AuthUser, type Me, type Profile, type PublicSettings } from '../types';
import { toPayload } from '../validate';
import type { Api } from './api';

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));

const toApplicant = (r: Row): Applicant => ({
  id: str(r.id), email: str(r.email), lang: r.lang === 'en' ? 'en' : 'id',
  status: r.status as Applicant['status'], createdAt: str(r.createdAt), updatedAt: str(r.updatedAt),
  level: r.level as Profile['level'], fullName: str(r.fullName), gender: r.gender as Profile['gender'],
  birthPlace: str(r.birthPlace), birthDate: str(r.birthDate), nisn: str(r.nisn),
  province: str(r.province), regency: str(r.regency), district: str(r.district), address: str(r.address),
  originSchool: str(r.originSchool), originClass: str(r.originClass),
  parentName: str(r.parentName), parentRelation: r.parentRelation as Profile['parentRelation'],
  parentPhone: str(r.parentPhone), parentEmail: str(r.parentEmail), parentJob: str(r.parentJob),
  incomeBand: (r.incomeBand ?? '') as Profile['incomeBand'], siblings: str(r.siblings),
  achievements: str(r.achievements), motivation: str(r.motivation),
  userId: r.userId ? str(r.userId) : undefined,
  document: (r.document as Applicant['document']) ?? null,
});

function fail(message: string): never {
  if (/fetch|network|Failed to|timeout|Load failed/i.test(message)) throw new AppError('NETWORK');
  const inv = /INVALID:(\w+)/.exec(message);
  if (inv) throw new AppError('INVALID', inv[1]);
  const code = /\b(CLOSED|DUPLICATE|ALREADY_REGISTERED|BUSY|UNAUTHORIZED|NOT_FOUND)\b/.exec(message);
  throw new AppError(code ? code[1] : 'UNKNOWN');
}

export function createSupabaseApi(url: string, key: string): Api {
  // Sesi Google disimpan di sessionStorage: hilang saat tab ditutup (aman di HP bersama).
  const sb = createClient(url, key, {
    auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });

  async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    let res;
    try {
      res = await sb.rpc(fn, args);
    } catch (e) {
      fail((e as Error).message || 'network');
    }
    if (res.error) {
      // Belum masuk: fungsi peserta hanya boleh dipanggil role authenticated.
      if (/permission denied/i.test(res.error.message)) throw new AppError('UNAUTHORIZED');
      fail(res.error.message);
    }
    const data = res.data as T & { error?: string };
    return data;
  }

  const BUCKET = 'berkas';
  const docPath = (userId: string) => `${userId}/kelengkapan.pdf`;
  async function signedUrl(path: string): Promise<string> {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data) throw new AppError(/not found/i.test(error?.message ?? '') ? 'NOT_FOUND' : 'UNKNOWN');
    return data.signedUrl;
  }
  async function currentUserId(): Promise<string> {
    const id = (await sb.auth.getSession()).data.session?.user.id;
    if (!id) throw new AppError('UNAUTHORIZED');
    return id;
  }

  return {
    mode: 'supabase',
    getSettings: () => rpc<PublicSettings>('get_public_settings'),

    async getUser(): Promise<AuthUser | null> {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      if (!u?.email) return null;
      const meta = u.user_metadata as { full_name?: string; name?: string };
      return { email: u.email, name: meta.full_name ?? meta.name ?? null };
    },
    async signInWithGoogle() {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/akun`, queryParams: { prompt: 'select_account' } },
      });
      if (error) fail(error.message);
    },
    async signOut() {
      await sb.auth.signOut().catch(() => {});
    },

    register: async (p, lang) => { await rpc('register', { p_profile: toPayload(p), p_lang: lang }); },
    me: async () => {
      if (!(await sb.auth.getSession()).data.session) throw new AppError('UNAUTHORIZED');
      const r = await rpc<Me>('me');
      return { ...r, applicant: r.applicant ? toApplicant(r.applicant as unknown as Row) : null };
    },
    updateProfile: async (p) => { await rpc('update_profile', { p_profile: toPayload(p) }); },

    async uploadDocument(file) {
      const path = docPath(await currentUserId());
      const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: 'application/pdf', cacheControl: '0' });
      if (error) {
        const m = error.message;
        if (/size|too large|payload/i.test(m)) throw new AppError('TOO_LARGE');
        if (/mime|type/i.test(m)) throw new AppError('NOT_PDF');
        if (/row-level security|unauthorized|policy/i.test(m)) throw new AppError('CLOSED');
        fail(m);
      }
    },
    documentUrl: async () => signedUrl(docPath(await currentUserId())),

    async adminSignIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new AppError(/fetch|network/i.test(error.message) ? 'NETWORK' : 'BAD_LOGIN');
      if (!(await rpc<boolean>('am_i_admin'))) {
        await sb.auth.signOut().catch(() => {});
        throw new AppError('NOT_ADMIN');
      }
    },
    async isAdmin() {
      if (!(await sb.auth.getSession()).data.session) return false;
      try { return await rpc<boolean>('am_i_admin'); } catch { return false; }
    },
    adminList: async () => (await rpc<Row[]>('admin_list')).map(toApplicant),
    adminGetSettings: () => rpc<AdminSettings>('admin_get_settings'),
    adminSaveSettings: (s) => rpc('admin_save_settings', {
      p_reg_open: s.regOpen, p_reg_deadline: s.regDeadline, p_announce_at: s.announceAt,
      p_title: s.title, p_body: s.body, p_result_messages: s.resultMessages,
    }),
    adminSetStatus: (ids, status) => rpc('admin_set_status', { p_ids: ids, p_status: status }),
    async adminDocumentUrl(a) {
      if (!a.userId) throw new AppError('NOT_FOUND');
      return signedUrl(docPath(a.userId));
    },
    async adminDelete(a) {
      if (a.userId && a.document) {
        const { error } = await sb.storage.from(BUCKET).remove([docPath(a.userId)]);
        if (error) fail(error.message);
      }
      await rpc('admin_delete', { p_id: a.id });
    },
  };
}
