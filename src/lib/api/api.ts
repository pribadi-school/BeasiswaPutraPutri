import type { AdminSettings, Applicant, AuthUser, Lang, Me, Profile, PublicSettings, Status } from '../types';

/** Antarmuka backend. Dipenuhi oleh supabaseApi.ts dan demoApi.ts — keduanya harus selalu sama. */
export interface Api {
  mode: 'supabase' | 'demo';
  getSettings(): Promise<PublicSettings>;

  /** Akun yang sedang masuk di tab ini, atau null. */
  getUser(): Promise<AuthUser | null>;
  /** Membuka halaman masuk Google lalu kembali ke /akun. Mode demo: masuk sebagai `demoEmail`. */
  signInWithGoogle(demoEmail?: string): Promise<void>;
  signOut(): Promise<void>;

  /** Melempar AppError('UNAUTHORIZED') bila belum masuk. */
  me(): Promise<Me>;
  register(profile: Profile, lang: Lang): Promise<void>;
  updateProfile(profile: Profile): Promise<void>;

  /** Berkas kelengkapan (PDF maks 10 MB). Mengganti berkas lama bila sudah ada. */
  uploadDocument(file: File): Promise<void>;
  /** Tautan sementara (60 detik) untuk membuka berkas sendiri. */
  documentUrl(): Promise<string>;

  /** Admin = akun Supabase (email + password) yang terdaftar sebagai panitia. Melempar BAD_LOGIN / NOT_ADMIN. */
  adminSignIn(email: string, password: string): Promise<void>;
  isAdmin(): Promise<boolean>;
  adminList(): Promise<Applicant[]>;
  adminGetSettings(): Promise<AdminSettings>;
  adminSaveSettings(s: AdminSettings): Promise<void>;
  adminSetStatus(ids: string[], status: Status): Promise<number>;
  /** Tautan sementara (60 detik) ke berkas seorang pendaftar. */
  adminDocumentUrl(a: Applicant): Promise<string>;
  /** Menghapus pendaftar beserta berkasnya. */
  adminDelete(a: Applicant): Promise<void>;
}
