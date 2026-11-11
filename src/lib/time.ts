/** Waktu selalu ditampilkan dan dimasukkan dalam WIB (Asia/Jakarta). */
import type { Lang } from './types';

const TZ = 'Asia/Jakarta';

export function formatWib(iso: string | null, lang: Lang, withTime = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
  if (!withTime) return date;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(d).replace(':', '.');
  return `${date}, ${time} WIB`;
}

export function formatDateOnly(ymd: string, lang: Lang): string {
  if (!ymd) return '—';
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(ymd + 'T00:00:00Z'));
}

/** ISO → nilai <input type="datetime-local"> dalam WIB ("2026-12-01T09:00"). */
export function toInputWib(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso) + 7 * 3600_000;
  return new Date(ms).toISOString().slice(0, 16);
}

/** Nilai <input type="datetime-local"> (dianggap WIB) → ISO; '' → null. */
export function fromInputWib(v: string): string | null {
  if (!v) return null;
  const ms = Date.parse(v + ':00Z') - 7 * 3600_000;
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function splitRemaining(ms: number): { d: number; h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
