/** Token sesi disimpan di sessionStorage: hilang saat tab ditutup (aman di HP bersama). */
const get = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => {
  try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* abaikan */ }
};
export const applicantToken = { get: () => get('bpd-token'), set: (v: string | null) => set('bpd-token', v) };
export const adminToken = { get: () => get('bpd-admin'), set: (v: string | null) => set('bpd-admin', v) };
