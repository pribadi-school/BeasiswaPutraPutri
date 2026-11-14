/** Tipe data bersama. */

export type Lang = 'id' | 'en';
/** Jenjang yang dituju. SD tidak dibuka untuk beasiswa ini. */
export type Level = 'smp' | 'sma';
export type Status = 'pending' | 'lulus' | 'cadangan' | 'tidak_lulus';
export const STATUSES: Status[] = ['pending', 'lulus', 'cadangan', 'tidak_lulus'];

/** Isian formulir (semua string agar mudah dipakai di <input>). */
export type Profile = {
  level: Level | '';
  fullName: string;
  gender: 'L' | 'P' | '';
  birthPlace: string;
  birthDate: string; // yyyy-mm-dd
  nisn: string;
  province: string;
  regency: string;
  district: string;
  address: string;
  originSchool: string;
  originClass: string;
  parentName: string;
  parentRelation: 'ayah' | 'ibu' | 'wali' | '';
  parentPhone: string;
  parentEmail: string;
  parentJob: string;
  incomeBand: 'lt1' | '1to3' | '3to5' | 'gt5' | '';
  siblings: string;
  achievements: string;
  motivation: string;
};

/** Berkas kelengkapan (PDF) di Storage. */
export type DocumentInfo = { size: number; uploadedAt: string };

export type Applicant = Profile & {
  /** Hanya untuk admin: id akun (lokasi berkas), info berkas. */
  userId?: string;
  document?: DocumentInfo | null;
  id: string;
  /** Email akun Google yang dipakai mendaftar. */
  email: string;
  lang: Lang;
  status: Status;
  createdAt: string;
  updatedAt: string;
};

export type Localized = { id: string; en: string };

export type PublicSettings = {
  now: string;
  regOpen: boolean;
  regDeadline: string | null;
  announceAt: string | null;
  released: boolean;
  title: Localized | null;
  body: Localized | null;
};

/** Akun Google yang sedang masuk. */
export type AuthUser = { email: string; name: string | null };

export type Me = {
  /** null = sudah masuk tapi belum mengisi data. */
  applicant: Applicant | null;
  canEdit: boolean;
  released: boolean;
  announceAt: string | null;
  regDeadline: string | null;
  now: string;
  title: Localized | null;
  body: Localized | null;
  resultMessage: Localized | null;
  /** Berkas kelengkapan milik sendiri (null = belum diunggah). */
  document: DocumentInfo | null;
};

export type AdminSettings = {
  regOpen: boolean;
  regDeadline: string | null;
  announceAt: string | null;
  title: Localized;
  body: Localized;
  resultMessages: Partial<Record<Exclude<Status, 'pending'>, Localized>>;
};

/** Kesalahan yang bisa ditampilkan ke pengguna. `code` dipetakan ke teks di i18n. */
export class AppError extends Error {
  code: string;
  field?: string;
  constructor(code: string, field?: string) {
    super(code);
    this.code = code;
    this.field = field;
  }
}

export const emptyProfile = (): Profile => ({
  level: '', fullName: '', gender: '', birthPlace: '', birthDate: '', nisn: '',
  province: 'Jawa Barat', regency: '', district: '', address: '', originSchool: '', originClass: '',
  parentName: '', parentRelation: '', parentPhone: '', parentEmail: '', parentJob: '',
  incomeBand: '', siblings: '', achievements: '', motivation: '',
});
