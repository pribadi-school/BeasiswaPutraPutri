/**
 * Mode demo: semua data tersimpan di localStorage browser ini (tanpa server).
 * "Masuk dengan Google" disimulasikan: cukup ketik alamat email apa saja.
 * Password admin: "demo". Hanya untuk mencoba tampilan, bukan untuk data sungguhan.
 * Aturan (validasi, satu akun satu pendaftaran, kunci pengumuman) dibuat sama dengan database.
 */
import {
  AppError, type AdminSettings, type Applicant, type AuthUser, type Lang, type Me, type Profile,
  type PublicSettings, type Status,
} from '../types';
import { normalizePhone, validateProfile } from '../validate';
import type { Api } from './api';

type DB = {
  settings: AdminSettings;
  applicants: Applicant[];
  adminSessions: Record<string, number>; // token → kedaluwarsa
  adminFailures: number[];
};

const KEY = 'beasiswa-demo-v2';
const USER_KEY = 'beasiswa-demo-user';
const ADMIN_PASSWORD = 'demo';

const fresh = (): DB => ({
  settings: {
    regOpen: true, regDeadline: null, announceAt: null,
    title: { id: 'Pengumuman Beasiswa Putra-Putri Daerah', en: 'Regional Scholarship Announcement' },
    body: { id: '', en: '' }, resultMessages: {},
  },
  applicants: [], adminSessions: {}, adminFailures: [],
});

const load = (): DB => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch { /* abaikan */ }
  return fresh();
};
const save = (db: DB) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* abaikan */ } };

const currentUser = (): AuthUser | null => {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch { return null; }
};
const requireUser = (): AuthUser => {
  const u = currentUser();
  if (!u) throw new AppError('UNAUTHORIZED');
  return u;
};

const released = (s: AdminSettings) => !!s.announceAt && Date.parse(s.announceAt) <= Date.now();
const open = (s: AdminSettings) => s.regOpen && (!s.regDeadline || Date.now() < Date.parse(s.regDeadline)) && !released(s);
const dupKey = (p: Profile) => p.fullName.trim().toLowerCase() + '|' + p.birthDate;

function clean(p: Profile): Profile {
  const bad = validateProfile(p);
  if (bad.length) throw new AppError('INVALID', bad[0]);
  const t = (s: string) => s.trim();
  return {
    level: p.level, gender: p.gender, parentRelation: p.parentRelation, incomeBand: p.incomeBand, birthDate: p.birthDate,
    fullName: t(p.fullName), parentPhone: normalizePhone(p.parentPhone)!, nisn: t(p.nisn), parentEmail: t(p.parentEmail),
    birthPlace: t(p.birthPlace), province: t(p.province), regency: t(p.regency), district: t(p.district), address: t(p.address),
    originSchool: t(p.originSchool), originClass: t(p.originClass), parentName: t(p.parentName), parentJob: t(p.parentJob),
    siblings: t(p.siblings), achievements: t(p.achievements), motivation: t(p.motivation),
  };
}

export function createDemoApi(): Api {
  const requireAdmin = (db: DB, token: string) => {
    if (!(db.adminSessions[token] > Date.now())) throw new AppError('UNAUTHORIZED');
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

    async getUser() { return currentUser(); },
    async signInWithGoogle(demoEmail) {
      const email = demoEmail?.trim().toLowerCase() ?? '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError('INVALID', 'email');
      sessionStorage.setItem(USER_KEY, JSON.stringify({ email, name: null } satisfies AuthUser));
    },
    async signOut() { sessionStorage.removeItem(USER_KEY); },

    async me(): Promise<Me> {
      const u = requireUser();
      const db = load();
      const a = db.applicants.find((x) => x.email === u.email) ?? null;
      const rel = released(db.settings);
      return {
        applicant: a && { ...a, status: rel ? a.status : 'pending' },
        canEdit: open(db.settings), released: rel,
        announceAt: db.settings.announceAt, regDeadline: db.settings.regDeadline, now: new Date().toISOString(),
        title: rel ? db.settings.title : null, body: rel ? db.settings.body : null,
        resultMessage: rel && a && a.status !== 'pending' ? db.settings.resultMessages[a.status] ?? null : null,
      };
    },
    async register(p: Profile, lang: Lang) {
      const u = requireUser();
      const db = load();
      if (!open(db.settings)) throw new AppError('CLOSED');
      if (db.applicants.some((a) => a.email === u.email)) throw new AppError('ALREADY_REGISTERED');
      const c = clean(p);
      if (db.applicants.some((a) => dupKey(a) === dupKey(c))) throw new AppError('DUPLICATE');
      const now = new Date().toISOString();
      db.applicants.push({ ...c, id: crypto.randomUUID(), email: u.email, lang, status: 'pending', createdAt: now, updatedAt: now });
      save(db);
    },
    async updateProfile(p) {
      const u = requireUser();
      const db = load();
      const i = db.applicants.findIndex((x) => x.email === u.email);
      if (i < 0) throw new AppError('NOT_FOUND');
      if (!open(db.settings)) throw new AppError('CLOSED');
      const c = clean(p);
      if (db.applicants.some((a, j) => j !== i && dupKey(a) === dupKey(c))) throw new AppError('DUPLICATE');
      db.applicants[i] = { ...db.applicants[i], ...c, updatedAt: new Date().toISOString() };
      save(db);
    },

    async adminLogin(password) {
      const db = load();
      db.adminFailures = db.adminFailures.filter((t) => t > Date.now() - 15 * 60_000);
      if (db.adminFailures.length >= 10) throw new AppError('LOCKED');
      if (password !== ADMIN_PASSWORD) {
        db.adminFailures.push(Date.now());
        save(db);
        throw new AppError('BAD_LOGIN');
      }
      const token = crypto.randomUUID();
      db.adminSessions[token] = Date.now() + 8 * 3600_000;
      save(db);
      return token;
    },
    async adminList(token) {
      const db = load();
      requireAdmin(db, token);
      return db.applicants;
    },
    async adminGetSettings(token) {
      const db = load();
      requireAdmin(db, token);
      return db.settings;
    },
    async adminSaveSettings(token, s) {
      const db = load();
      requireAdmin(db, token);
      db.settings = s;
      save(db);
    },
    async adminSetStatus(token, ids, status: Status) {
      const db = load();
      requireAdmin(db, token);
      let n = 0;
      for (const a of db.applicants) if (ids.includes(a.id)) { a.status = status; n++; }
      save(db);
      return n;
    },
    async adminDelete(token, id) {
      const db = load();
      requireAdmin(db, token);
      db.applicants = db.applicants.filter((a) => a.id !== id);
      save(db);
    },
  };
}
