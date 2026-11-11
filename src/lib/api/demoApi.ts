/**
 * Mode demo: semua data tersimpan di localStorage browser ini (tanpa server).
 * Password admin: "demo". Hanya untuk mencoba tampilan — bukan untuk data sungguhan.
 * Aturan (validasi, kunci pengumuman, pembatasan login) dibuat sama dengan database.
 */
import {
  AppError, type AdminSettings, type Applicant, type Credentials, type Lang, type Me, type Profile,
  type PublicSettings, type Status,
} from '../types';
import { normalizePhone, validateProfile } from '../validate';
import type { Api } from './api';

type Stored = Applicant & { pinHash: string };
type DB = {
  settings: AdminSettings;
  applicants: Stored[];
  sessions: Record<string, { role: 'applicant' | 'admin'; id?: string; exp: number }>;
  failures: { key: string; at: number }[];
};

const KEY = 'beasiswa-demo-v1';
const ADMIN_PASSWORD = 'demo';

const fresh = (): DB => ({
  settings: {
    regOpen: true, regDeadline: null, announceAt: null,
    title: { id: 'Pengumuman Beasiswa Putra-Putri Daerah', en: 'Regional Scholarship Announcement' },
    body: { id: '', en: '' }, resultMessages: {},
  },
  applicants: [], sessions: {}, failures: [],
});

const load = (): DB => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch { /* abaikan */ }
  return fresh();
};
const save = (db: DB) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* abaikan */ } };

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
async function sha(s: string) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))); }
const newPin = () => String(new Uint32Array(rand(4).buffer)[0] % 1_000_000).padStart(6, '0');
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const newUsername = () => 'bpd-' + [...rand(6)].map((b) => ALPHA[b % ALPHA.length]).join('');

const released = (s: AdminSettings) => !!s.announceAt && Date.parse(s.announceAt) <= Date.now();
const open = (s: AdminSettings) => s.regOpen && (!s.regDeadline || Date.now() < Date.parse(s.regDeadline)) && !released(s);
const dupKey = (p: Profile) => p.fullName.trim().toLowerCase() + '|' + p.birthDate;

function clean(p: Profile): Profile {
  const bad = validateProfile(p);
  if (bad.length) throw new AppError('INVALID', bad[0]);
  const t = (s: string) => s.trim();
  return { ...p, fullName: t(p.fullName), parentPhone: normalizePhone(p.parentPhone)!, nisn: t(p.nisn), parentEmail: t(p.parentEmail),
    birthPlace: t(p.birthPlace), province: t(p.province), regency: t(p.regency), district: t(p.district), address: t(p.address),
    originSchool: t(p.originSchool), originClass: t(p.originClass), parentName: t(p.parentName), parentJob: t(p.parentJob),
    siblings: t(p.siblings), achievements: t(p.achievements), motivation: t(p.motivation) };
}

const view = (a: Stored, db: DB, asAdmin: boolean): Applicant => {
  const { pinHash: _ignored, ...rest } = a;
  void _ignored;
  return { ...rest, status: asAdmin || released(db.settings) ? a.status : 'pending' };
};

export function createDemoApi(): Api {
  const session = (db: DB, token: string, role: 'applicant' | 'admin') => {
    const s = db.sessions[token];
    if (!s || s.role !== role || s.exp < Date.now()) throw new AppError('UNAUTHORIZED');
    return s;
  };
  const issue = (db: DB, role: 'applicant' | 'admin', id?: string) => {
    const token = hex(rand(32));
    db.sessions[token] = { role, id, exp: Date.now() + (role === 'admin' ? 8 : 12) * 3600_000 };
    return token;
  };
  const locked = (db: DB, key: string, max: number) => {
    db.failures = db.failures.filter((f) => f.at > Date.now() - 15 * 60_000);
    return db.failures.filter((f) => f.key === key).length >= max;
  };

  return {
    mode: 'demo',
    async getSettings(): Promise<PublicSettings> {
      const { settings: s } = load();
      const rel = released(s);
      return {
        now: new Date().toISOString(), regOpen: open(s), regDeadline: s.regDeadline, announceAt: s.announceAt,
        released: rel, title: rel ? s.title : null, body: rel ? s.body : null,
      };
    },
    async register(p: Profile, lang: Lang): Promise<Credentials> {
      const db = load();
      if (!open(db.settings)) throw new AppError('CLOSED');
      const c = clean(p);
      if (db.applicants.some((a) => dupKey(a) === dupKey(c))) throw new AppError('DUPLICATE');
      let username = newUsername();
      while (db.applicants.some((a) => a.username === username)) username = newUsername();
      const pin = newPin();
      const now = new Date().toISOString();
      db.applicants.push({ ...c, id: crypto.randomUUID(), username, lang, status: 'pending', createdAt: now, updatedAt: now,
        pinHash: await sha(username + ':' + pin) });
      save(db);
      return { username, pin };
    },
    async login(username, pin) {
      const db = load();
      const u = username.trim().toLowerCase();
      const key = 'u:' + u.slice(0, 40);
      if (locked(db, key, 5)) throw new AppError('LOCKED');
      const a = db.applicants.find((x) => x.username === u);
      if (!a || a.pinHash !== (await sha(u + ':' + pin))) {
        db.failures.push({ key, at: Date.now() });
        save(db);
        throw new AppError('BAD_LOGIN');
      }
      db.failures = db.failures.filter((f) => f.key !== key);
      const token = issue(db, 'applicant', a.id);
      save(db);
      return token;
    },
    async logout(token) {
      const db = load();
      delete db.sessions[token];
      save(db);
    },
    async me(token): Promise<Me> {
      const db = load();
      const s = session(db, token, 'applicant');
      const a = db.applicants.find((x) => x.id === s.id);
      if (!a) throw new AppError('UNAUTHORIZED');
      const rel = released(db.settings);
      return {
        applicant: view(a, db, false), canEdit: open(db.settings), released: rel,
        announceAt: db.settings.announceAt, regDeadline: db.settings.regDeadline, now: new Date().toISOString(),
        title: rel ? db.settings.title : null, body: rel ? db.settings.body : null,
        resultMessage: rel && a.status !== 'pending' ? db.settings.resultMessages[a.status] ?? null : null,
      };
    },
    async updateProfile(token, p) {
      const db = load();
      const s = session(db, token, 'applicant');
      if (!open(db.settings)) throw new AppError('CLOSED');
      const c = clean(p);
      if (db.applicants.some((a) => a.id !== s.id && dupKey(a) === dupKey(c))) throw new AppError('DUPLICATE');
      const i = db.applicants.findIndex((x) => x.id === s.id);
      db.applicants[i] = { ...db.applicants[i], ...c, updatedAt: new Date().toISOString() };
      save(db);
    },

    async adminLogin(password) {
      const db = load();
      if (locked(db, 'admin', 10)) throw new AppError('LOCKED');
      if (password !== ADMIN_PASSWORD) {
        db.failures.push({ key: 'admin', at: Date.now() });
        save(db);
        throw new AppError('BAD_LOGIN');
      }
      const token = issue(db, 'admin');
      save(db);
      return token;
    },
    async adminList(token) {
      const db = load();
      session(db, token, 'admin');
      return db.applicants.map((a) => view(a, db, true));
    },
    async adminGetSettings(token) {
      const db = load();
      session(db, token, 'admin');
      return db.settings;
    },
    async adminSaveSettings(token, s) {
      const db = load();
      session(db, token, 'admin');
      db.settings = s;
      save(db);
    },
    async adminSetStatus(token, ids, status: Status) {
      const db = load();
      session(db, token, 'admin');
      let n = 0;
      for (const a of db.applicants) if (ids.includes(a.id)) { a.status = status; n++; }
      save(db);
      return n;
    },
    async adminResetPin(token, id) {
      const db = load();
      session(db, token, 'admin');
      const a = db.applicants.find((x) => x.id === id);
      if (!a) throw new AppError('NOT_FOUND');
      const pin = newPin();
      a.pinHash = await sha(a.username + ':' + pin);
      for (const [t, s] of Object.entries(db.sessions)) if (s.id === id) delete db.sessions[t];
      db.failures = db.failures.filter((f) => f.key !== 'u:' + a.username);
      save(db);
      return { username: a.username, pin };
    },
    async adminDelete(token, id) {
      const db = load();
      session(db, token, 'admin');
      db.applicants = db.applicants.filter((a) => a.id !== id);
      save(db);
    },
  };
}
