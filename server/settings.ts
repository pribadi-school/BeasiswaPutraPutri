/** Pengaturan pendaftaran/tahapan/pengumuman dari tabel settings (dipakai API dan email). */
import type { RowDataPacket } from 'mysql2';
import type { Pool } from './db.ts';
import { STAGES, type StageKey } from '../src/lib/types.ts';

export type Localized = { id: string; en: string };
export type StageCfg = { publishAt: Date | null; info: Localized; pass: Localized; fail: Localized };
export type Settings = {
  regOpen: boolean;
  regDeadline: Date | null;
  announceAt: Date | null;
  title: Localized;
  body: Localized;
  resultMessages: Record<string, Localized>;
  stages: Record<StageKey, StageCfg>;
};

/** Kolom hasil per tahap (nama kolom tetap — tidak pernah dari input). */
export const STAGE_COLUMN: Record<StageKey, string> = { admin: 'res_admin', test: 'res_test', interview: 'res_interview' };

export const iso = (d: Date | null) => (d ? d.toISOString() : null);
export const parseJson = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string') return (s as T) ?? fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
const loc = (v: unknown): Localized => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { id: typeof o.id === 'string' ? o.id : '', en: typeof o.en === 'string' ? o.en : '' };
};

export function parseStages(raw: unknown): Record<StageKey, StageCfg> {
  const src = parseJson<Record<string, Record<string, unknown>>>(raw, {});
  const out = {} as Record<StageKey, StageCfg>;
  for (const k of STAGES) {
    const s = src[k] ?? {};
    const d = typeof s.publishAt === 'string' ? new Date(s.publishAt) : null;
    out[k] = { publishAt: d && !Number.isNaN(d.getTime()) ? d : null, info: loc(s.info), pass: loc(s.pass), fail: loc(s.fail) };
  }
  return out;
}

export async function loadSettings(pool: Pool): Promise<Settings> {
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM settings WHERE id = 1');
  const r = rows[0];
  return {
    regOpen: !!r.reg_open,
    regDeadline: r.reg_deadline ?? null,
    announceAt: r.announce_at ?? null,
    title: parseJson(r.announce_title, { id: '', en: '' }),
    body: parseJson(r.announce_body, { id: '', en: '' }),
    resultMessages: parseJson(r.result_messages, {}),
    stages: parseStages(r.stages),
  };
}

/** Pengumuman akhir sudah dibuka. */
export const released = (s: Settings, now = new Date()) => !!s.announceAt && s.announceAt <= now;
/** Hasil satu tahap sudah boleh dilihat peserta. */
export const stageReleased = (s: Settings, k: StageKey, now = new Date()) => {
  const at = s.stages[k].publishAt;
  return !!at && at <= now;
};
export const registrationOpen = (s: Settings, now = new Date()) =>
  s.regOpen && (!s.regDeadline || now < s.regDeadline) && !released(s, now);
