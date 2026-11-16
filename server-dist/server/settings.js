import { STAGES } from '../src/lib/types.js';
/** Kolom hasil per tahap (nama kolom tetap — tidak pernah dari input). */
export const STAGE_COLUMN = { admin: 'res_admin', test: 'res_test', interview: 'res_interview' };
export const iso = (d) => (d ? d.toISOString() : null);
export const parseJson = (s, fallback) => {
    if (typeof s !== 'string')
        return s ?? fallback;
    try {
        return JSON.parse(s);
    }
    catch {
        return fallback;
    }
};
const loc = (v) => {
    const o = (v && typeof v === 'object' ? v : {});
    return { id: typeof o.id === 'string' ? o.id : '', en: typeof o.en === 'string' ? o.en : '' };
};
export function parseStages(raw) {
    const src = parseJson(raw, {});
    const out = {};
    for (const k of STAGES) {
        const s = src[k] ?? {};
        const d = typeof s.publishAt === 'string' ? new Date(s.publishAt) : null;
        out[k] = { publishAt: d && !Number.isNaN(d.getTime()) ? d : null, info: loc(s.info), pass: loc(s.pass), fail: loc(s.fail) };
    }
    return out;
}
export async function loadSettings(pool) {
    const [rows] = await pool.execute('SELECT * FROM settings WHERE id = 1');
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
export const released = (s, now = new Date()) => !!s.announceAt && s.announceAt <= now;
/** Hasil satu tahap sudah boleh dilihat peserta. */
export const stageReleased = (s, k, now = new Date()) => {
    const at = s.stages[k].publishAt;
    return !!at && at <= now;
};
export const registrationOpen = (s, now = new Date()) => s.regOpen && (!s.regDeadline || now < s.regDeadline) && !released(s, now);
