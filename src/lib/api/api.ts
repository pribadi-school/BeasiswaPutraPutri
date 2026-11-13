import type { AdminSettings, Applicant, AuthUser, Lang, Me, Profile, PublicSettings, Status } from '../types';

/** Antarmuka backend. Dipenuhi oleh supabaseApi.ts dan demoApi.ts — keduanya harus selalu sama. */
export interface Api {
  mode: 'supabase' | 'demo';
  getSettings(): Promise<PublicSettings>;

  /** Akun Google yang sedang masuk di tab ini, atau null. */
  getUser(): Promise<AuthUser | null>;
  /** Membuka halaman masuk Google lalu kembali ke /akun. Mode demo: masuk sebagai `demoEmail`. */
  signInWithGoogle(demoEmail?: string): Promise<void>;
  signOut(): Promise<void>;

  /** Melempar AppError('UNAUTHORIZED') bila belum masuk. */
  me(): Promise<Me>;
  register(profile: Profile, lang: Lang): Promise<void>;
  updateProfile(profile: Profile): Promise<void>;

  adminLogin(password: string): Promise<string>;
  adminList(token: string): Promise<Applicant[]>;
  adminGetSettings(token: string): Promise<AdminSettings>;
  adminSaveSettings(token: string, s: AdminSettings): Promise<void>;
  adminSetStatus(token: string, ids: string[], status: Status): Promise<number>;
  adminDelete(token: string, id: string): Promise<void>;
}
