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
    // login / admin_login melaporkan kegagalan sebagai {error} (agar catatan gagal-login tersimpan).
    if (data && typeof data === 'object' && 'error' in data && data.error) throw new AppError(String(data.error));
    return data;
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

    adminLogin: async (pw) => (await rpc<{ token: string }>('admin_login', { p_password: pw })).token,
    adminList: async (t) => (await rpc<Row[]>('admin_list', { p_token: t })).map(toApplicant),
    adminGetSettings: (t) => rpc<AdminSettings>('admin_get_settings', { p_token: t }),
    adminSaveSettings: (t, s) => rpc('admin_save_settings', {
      p_token: t, p_reg_open: s.regOpen, p_reg_deadline: s.regDeadline, p_announce_at: s.announceAt,
      p_title: s.title, p_body: s.body, p_result_messages: s.resultMessages,
    }),
    adminSetStatus: (t, ids, status) => rpc('admin_set_status', { p_token: t, p_ids: ids, p_status: status }),
    adminDelete: (t, id) => rpc('admin_delete', { p_token: t, p_id: id }),
  };
}
