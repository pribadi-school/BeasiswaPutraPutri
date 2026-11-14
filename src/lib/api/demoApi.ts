/**
 * Mode demo: semua data tersimpan di localStorage browser ini (tanpa server).
 * "Masuk dengan Google" disimulasikan: cukup ketik alamat email apa saja.
 * Admin: email apa saja + password "demo". Berkas PDF hanya disimpan di memori
 * tab ini (hilang saat halaman dimuat ulang); yang tersimpan hanya ukuran dan waktunya.
 * Hanya untuk mencoba tampilan, bukan untuk data sungguhan.
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
  adminFailures: number[];
};

const KEY = 'beasiswa-demo-v2';
const USER_KEY = 'beasiswa-demo-user';
const ADMIN_KEY = 'beasiswa-demo-admin';
/** Isi PDF (blob URL) per email, hanya selama tab terbuka. */
const files = new Map<string, string>();
const ADMIN_PASSWORD = 'demo';

/** Penutupan awal (sama dengan migrasi): 26 Des 2026 23.59 WIB. Tanpa tanggal pembukaan. */
const SCHEDULE = { regDeadline: '2026-12-26T16:59:00.000Z' };

const fresh = (): DB => ({
  settings: {
    regOpen: true, ...SCHEDULE, announceAt: null,
    title: { id: 'Pengumuman Beasiswa Putra-Putri Daerah', en: 'Regional Scholarship Announcement' },
    body: { id: '', en: '' }, resultMessages: {},
  },
  applicants: [], adminFailures: [],
});

const load = (): DB => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      // Data demo lama yang masih punya tanggal pembukaan: buang (fitur itu dihapus).
      if ('regStart' in db.settings) delete (db.settings as { regStart?: unknown }).regStart;
      return db;
    }
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
const open = (s: AdminSettings) => s.regOpen
  && (!s.regDeadline || Date.now() < Date.parse(s.regDeadline)) && !released(s);
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
  const requireAdmin = () => {
    let ok = false;
    try { ok = sessionStorage.getItem(ADMIN_KEY) === '1'; } catch { /* abaikan */ }
    if (!ok) throw new AppError('UNAUTHORIZED');
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
    async authConfig() { return { googleClientId: null, devLogin: true }; },
    async signIn(input) {
      const email = ('devEmail' in input ? input.devEmail : '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError('INVALID', 'email');
      sessionStorage.setItem(USER_KEY, JSON.stringify({ email, name: null } satisfies AuthUser));
    },
    async signOut() { sessionStorage.removeItem(USER_KEY); sessionStorage.removeItem(ADMIN_KEY); },

    async me(): Promise<Me> {
      const u = requireUser();
      const db = load();
      const a = db.applicants.find((x) => x.email === u.email) ?? null;
      const rel = released(db.settings);
      return {
        applicant: a && { ...a, status: rel ? a.status : 'pending', document: undefined },
        canEdit: open(db.settings), released: rel,
        announceAt: db.settings.announceAt, regDeadline: db.settings.regDeadline, now: new Date().toISOString(),
        title: rel ? db.settings.title : null, body: rel ? db.settings.body : null,
        resultMessage: rel && a && a.status !== 'pending' ? db.settings.resultMessages[a.status] ?? null : null,
        document: a?.document ?? null,
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

    async uploadDocument(file) {
      const u = requireUser();
      const db = load();
      const a = db.applicants.find((x) => x.email === u.email);
      if (!a || !open(db.settings)) throw new AppError('CLOSED');
      if (file.size > 10 * 1024 * 1024) throw new AppError('TOO_LARGE');
      const old = files.get(u.email);
      if (old) URL.revokeObjectURL(old);
      files.set(u.email, URL.createObjectURL(file));
      a.document = { size: file.size, uploadedAt: new Date().toISOString() };
      save(db);
    },
    async documentUrl() {
      const u = requireUser();
      const url = files.get(u.email);
      if (!url) throw new AppError('DEMO_FILE_GONE');
      return url;
    },

    async adminSignIn(_email, password) {
      const db = load();
      db.adminFailures = db.adminFailures.filter((t) => t > Date.now() - 15 * 60_000);
      if (db.adminFailures.length >= 10) throw new AppError('LOCKED');
      if (password !== ADMIN_PASSWORD) {
        db.adminFailures.push(Date.now());
        save(db);
        throw new AppError('BAD_LOGIN');
      }
      sessionStorage.setItem(ADMIN_KEY, '1');
    },
    async isAdmin() {
      try { return sessionStorage.getItem(ADMIN_KEY) === '1'; } catch { return false; }
    },
    async adminList() {
      requireAdmin();
      return load().applicants.map((a) => ({ ...a, userId: a.email }));
    },
    async adminGetSettings() {
      requireAdmin();
      return load().settings;
    },
    async adminSaveSettings(s) {
      requireAdmin();
      if (s.announceAt && s.regDeadline && Date.parse(s.announceAt) < Date.parse(s.regDeadline)) throw new AppError('INVALID', 'announce_at');
      const db = load();
      db.settings = s;
      save(db);
    },
    async adminSetStatus(ids, status: Status) {
      requireAdmin();
      const db = load();
      let n = 0;
      for (const a of db.applicants) if (ids.includes(a.id)) { a.status = status; n++; }
      save(db);
      return n;
    },
    async adminDocumentUrl(a) {
      requireAdmin();
      const url = files.get(a.email);
      if (!url) throw new AppError('DEMO_FILE_GONE');
      return url;
    },
    async adminDelete(a) {
      requireAdmin();
      const db = load();
      db.applicants = db.applicants.filter((x) => x.id !== a.id);
      files.delete(a.email);
      save(db);
    },
  };
}
