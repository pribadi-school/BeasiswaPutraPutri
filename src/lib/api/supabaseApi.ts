/** Backend asli: memanggil fungsi Postgres di supabase/migrations/0001_schema.sql. */
import { createClient } from '@supabase/supabase-js';
import { AppError, type AdminSettings, type Applicant, type Me, type Profile, type PublicSettings } from '../types';
import { toPayload } from '../validate';
import type { Api } from './api';

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));

const toApplicant = (r: Row): Applicant => ({
  id: str(r.id), username: str(r.username), lang: r.lang === 'en' ? 'en' : 'id',
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
  const code = /\b(CLOSED|DUPLICATE|BUSY|UNAUTHORIZED|NOT_FOUND)\b/.exec(message);
  throw new AppError(code ? code[1] : 'UNKNOWN');
}

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: false } });

  async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    let res;
    try {
      res = await sb.rpc(fn, args);
    } catch (e) {
      fail((e as Error).message || 'network');
    }
    if (res.error) fail(res.error.message);
    const data = res.data as T & { error?: string };
    // login / admin_login melaporkan kegagalan sebagai {error} (agar catatan gagal-login tersimpan).
    if (data && typeof data === 'object' && 'error' in data && data.error) throw new AppError(String(data.error));
    return data;
  }

  return {
    mode: 'supabase',
    getSettings: () => rpc<PublicSettings>('get_public_settings'),
    register: (p, lang) => rpc('register', { p_profile: toPayload(p), p_lang: lang }),
    login: async (u, pin) => (await rpc<{ token: string }>('login', { p_username: u, p_pin: pin })).token,
    logout: async (t) => { try { await rpc('logout', { p_token: t }); } catch { /* abaikan */ } },
    me: async (t) => {
      const r = await rpc<Me>('me', { p_token: t });
      return { ...r, applicant: toApplicant(r.applicant as unknown as Row) };
    },
    updateProfile: (t, p) => rpc('update_profile', { p_token: t, p_profile: toPayload(p) }),

    adminLogin: async (pw) => (await rpc<{ token: string }>('admin_login', { p_password: pw })).token,
    adminList: async (t) => (await rpc<Row[]>('admin_list', { p_token: t })).map(toApplicant),
    adminGetSettings: (t) => rpc<AdminSettings>('admin_get_settings', { p_token: t }),
    adminSaveSettings: (t, s) => rpc('admin_save_settings', {
      p_token: t, p_reg_open: s.regOpen, p_reg_deadline: s.regDeadline, p_announce_at: s.announceAt,
      p_title: s.title, p_body: s.body, p_result_messages: s.resultMessages,
    }),
    adminSetStatus: (t, ids, status) => rpc('admin_set_status', { p_token: t, p_ids: ids, p_status: status }),
    adminResetPin: (t, id) => rpc('admin_reset_pin', { p_token: t, p_id: id }),
    adminDelete: (t, id) => rpc('admin_delete', { p_token: t, p_id: id }),
  };
}
