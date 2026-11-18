/**
 * Email pemberitahuan ke orang tua/wali.
 *
 * Jenis email (masing-masing hanya SEKALI per pendaftar, dicatat di tabel notifications):
 *   registered – pendaftaran diterima (hanya untuk pendaftar 3 hari terakhir)
 *   admin | test | interview – hasil tahap, setelah waktu umum tahap itu dan hasilnya diisi
 *   final – pengumuman akhir, setelah announce_at dan status diisi
 *
 * Dijalankan oleh Cron Job cPanel (`node server-dist/server/notify-cli.js`) atau tombol
 * "Kirim sekarang" di Admin → Pengaturan. Aman dijalankan bersamaan: setiap email
 * "diklaim" dulu dengan INSERT IGNORE sebelum dikirim, dan klaimnya dilepas bila gagal.
 */
import nodemailer from 'nodemailer';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Config, SmtpConfig } from './config.ts';
import type { Pool } from './db.ts';
import { loadSettings, released, STAGE_COLUMN, stageReleased, type Localized, type Settings } from './settings.ts';
import { STAGES, type StageKey } from '../src/lib/types.ts';

export type Mail = { to: string[]; subject: string; text: string; html: string };
export type Mailer = (m: Mail) => Promise<void>;
export type Kind = 'registered' | StageKey | 'final';

export function smtpMailer(smtp: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  return async (m) => { await transport.sendMail({ from: smtp.from, to: m.to, subject: m.subject, text: m.text, html: m.html }); };
}

const REGISTERED_WINDOW_MS = 3 * 86_400_000;

/** Email yang sudah waktunya dikirim (belum tercatat di notifications), urut per pendaftar. */
async function findDue(pool: Pool, s: Settings, now: Date): Promise<{ a: RowDataPacket; kind: Kind }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, (SELECT GROUP_CONCAT(n.kind) FROM notifications n WHERE n.applicant_id = a.id) AS sent
       FROM applicants a ORDER BY a.created_at`);
  const due: { a: RowDataPacket; kind: Kind }[] = [];
  for (const a of rows) {
    const sent = new Set(String(a.sent ?? '').split(',').filter(Boolean));
    if (!sent.has('registered') && now.getTime() - new Date(a.created_at).getTime() < REGISTERED_WINDOW_MS) {
      due.push({ a, kind: 'registered' });
    }
    let failed = false;
    for (const k of STAGES) {
      const r = a[STAGE_COLUMN[k]];
      if (failed) break;
      if (r === 'tidak_lulus') failed = true;
      if (!sent.has(k) && stageReleased(s, k, now) && (r === 'lulus' || r === 'tidak_lulus')) due.push({ a, kind: k });
    }
    if (!failed && !sent.has('final') && released(s, now) && a.status !== 'pending') due.push({ a, kind: 'final' });
  }
  return due;
}

/** Untuk Admin → Pengaturan: apakah SMTP sudah diatur, dan berapa email menunggu dikirim. */
export async function notificationStatus(pool: Pool, configured: boolean) {
  const due = await findDue(pool, await loadSettings(pool), new Date());
  return { configured, pending: due.length };
}

export async function runNotifications(pool: Pool, cfg: Config, mailer: Mailer, now = new Date()) {
  const s = await loadSettings(pool);
  const due = await findDue(pool, s, now);
  let sent = 0;
  let failed = 0;
  for (const { a, kind } of due.slice(0, cfg.notifyMaxPerRun)) {
    // Klaim dulu: bila proses lain sudah mengirim, lewati.
    const [claim] = await pool.execute<ResultSetHeader>(
      'INSERT IGNORE INTO notifications (applicant_id, kind, sent_at) VALUES (?, ?, ?)', [a.id, kind, new Date()]);
    if (claim.affectedRows === 0) continue;
    try {
      await mailer(buildMail(a, kind, s, cfg.appUrl));
      sent++;
    } catch (e) {
      failed++;
      console.error(`Email ${kind} untuk ${a.id} gagal:`, (e as Error).message);
      await pool.execute('DELETE FROM notifications WHERE applicant_id = ? AND kind = ?', [a.id, kind]);
    }
  }
  return { sent, failed, remaining: Math.max(0, due.length - sent) };
}

// ---------------------------------------------------------------------------
// Isi email (Indonesia / Inggris sesuai bahasa saat mendaftar)
// ---------------------------------------------------------------------------
const T = {
  id: {
    brand: 'Beasiswa Putra-Putri Daerah', school: 'SMP–SMA Pribadi Depok',
    stage: { admin: 'Seleksi Administrasi', test: 'Tes Akademik & Tes IQ', interview: 'Interview' } as Record<StageKey, string>,
    final: { lulus: 'DITERIMA', cadangan: 'DAFTAR CADANGAN', tidak_lulus: 'BELUM DITERIMA' } as Record<string, string>,
    hello: (n: string) => `Yth. ${n},`,
    regSubject: 'Pendaftaran diterima',
    reg: (c: string, d: string) => `Terima kasih, pendaftaran ananda ${c} untuk Beasiswa Putra-Putri Daerah sudah kami terima. Data dan berkas masih bisa dilengkapi sampai ${d}.`,
    noDoc: 'Berkas kelengkapan (satu PDF: rapor semester terakhir, KTP orang tua/wali, pas foto 3×4, sertifikat Puspresnas) belum diunggah. Mohon unggah sebelum batas waktu.',
    passSubject: (st: string) => `Hasil ${st}: LOLOS`,
    failSubject: (st: string) => `Hasil ${st}`,
    pass: (c: string, st: string) => `Selamat, ananda ${c} LOLOS tahap ${st}.`,
    fail: (c: string, st: string) => `Dengan berat hati kami sampaikan bahwa ananda ${c} belum lolos tahap ${st}.`,
    next: (st: string) => `Tahap berikutnya: ${st}`,
    nextFinal: (d: string) => `Pengumuman akhir: ${d}`,
    finalSubject: 'Pengumuman akhir',
    finalLine: (c: string, r: string) => `Hasil akhir seleksi untuk ananda ${c}: ${r}.`,
    child: 'Ananda', see: 'Lihat rincian', login: (e: string) => `Masuk dengan akun Google ${e}.`,
    sign: 'Salam,\nPanitia Beasiswa Putra-Putri Daerah', auto: 'Email ini dikirim otomatis. Pertanyaan dapat dibalas ke email ini.',
  },
  en: {
    brand: 'Beasiswa Putra-Putri Daerah', school: 'SMP–SMA Pribadi Depok',
    stage: { admin: 'Administrative selection', test: 'Academic & IQ test', interview: 'Interview' } as Record<StageKey, string>,
    final: { lulus: 'ACCEPTED', cadangan: 'WAITING LIST', tidak_lulus: 'NOT ACCEPTED' } as Record<string, string>,
    hello: (n: string) => `Dear ${n},`,
    regSubject: 'Registration received',
    reg: (c: string, d: string) => `Thank you, we have received the Beasiswa Putra-Putri Daerah registration for ${c}. You can complete the data and documents until ${d}.`,
    noDoc: 'The supporting documents (one PDF: latest report card, parent ID card, 3×4 photo, Puspresnas certificates) have not been uploaded yet. Please upload them before the deadline.',
    passSubject: (st: string) => `${st} result: PASSED`,
    failSubject: (st: string) => `${st} result`,
    pass: (c: string, st: string) => `Congratulations, ${c} has PASSED the ${st} stage.`,
    fail: (c: string, st: string) => `We regret to inform you that ${c} did not pass the ${st} stage.`,
    next: (st: string) => `Next stage: ${st}`,
    nextFinal: (d: string) => `Final announcement: ${d}`,
    finalSubject: 'Final announcement',
    finalLine: (c: string, r: string) => `Final selection result for ${c}: ${r}.`,
    child: 'Child', see: 'See details', login: (e: string) => `Log in with the Google account ${e}.`,
    sign: 'Best regards,\nBeasiswa Putra-Putri Daerah committee', auto: 'This email was sent automatically. You can reply with questions.',
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function wib(d: Date | null, lang: 'id' | 'en'): string {
  if (!d) return '—';
  const date = new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(':', '.');
  return `${date}, ${time} WIB`;
}

/** Penerima: email akun Google + email orang tua di formulir (bila berbeda). */
export function recipients(a: RowDataPacket): string[] {
  const list = [a.email, a.parent_email].filter((x): x is string => typeof x === 'string' && x.includes('@'));
  return [...new Map(list.map((e) => [e.trim().toLowerCase(), e.trim()])).values()];
}

export function buildMail(a: RowDataPacket, kind: Kind, s: Settings, appUrl: string): Mail {
  const lang: 'id' | 'en' = a.lang === 'en' ? 'en' : 'id';
  const t = T[lang];
  const pick = (l: Localized | null | undefined) => (l?.[lang] || l?.id || '').trim();
  const child = String(a.full_name);
  let subject: string;
  const lines: string[] = [];

  if (kind === 'registered') {
    subject = t.regSubject;
    lines.push(t.reg(child, wib(s.regDeadline, lang)));
    if (a.doc_size == null) lines.push(t.noDoc);
  } else if (kind === 'final') {
    subject = t.finalSubject;
    lines.push(t.finalLine(child, t.final[a.status] ?? a.status));
    for (const x of [pick(s.title), pick(s.body), pick(s.resultMessages[a.status])]) if (x) lines.push(x);
  } else {
    const st = t.stage[kind];
    const pass = a[STAGE_COLUMN[kind]] === 'lulus';
    subject = pass ? t.passSubject(st) : t.failSubject(st);
    lines.push(pass ? t.pass(child, st) : t.fail(child, st));
    const msg = pick(pass ? s.stages[kind].pass : s.stages[kind].fail);
    if (msg) lines.push(msg);
    if (pass) {
      const nextKey = STAGES[STAGES.indexOf(kind) + 1];
      if (nextKey) {
        const info = pick(s.stages[nextKey].info);
        lines.push(info ? `${t.next(t.stage[nextKey])} — ${info}` : t.next(t.stage[nextKey]));
      } else if (s.announceAt) {
        lines.push(t.nextFinal(wib(s.announceAt, lang)));
      }
    }
  }

  const url = `${appUrl}/akun/pengumuman`;
  const levelLabel = String(a.level).toUpperCase();
  const fullSubject = `${subject} — ${t.brand}`;
  const text = [
    t.hello(a.parent_name), '', ...lines.flatMap((l) => [l, '']),
    `${t.child}: ${child} (${levelLabel})`, '',
    `${t.see}: ${url}`, t.login(a.email), '', t.sign, `${t.brand} — ${t.school}`, '', t.auto,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#f2f5f9;font-family:Arial,Helvetica,sans-serif;color:#1c2733">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#0172bb;color:#fff;border-radius:16px 16px 0 0;padding:20px 24px">
<div style="font-size:13px;opacity:.85">${esc(t.school)}</div>
<div style="font-size:20px;font-weight:bold">${esc(t.brand)}</div></div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px">
<p style="margin:0 0 16px">${esc(t.hello(a.parent_name))}</p>
${lines.map((l, i) => `<p style="margin:0 0 14px;${i === 0 ? 'font-size:17px;font-weight:bold;color:#12233c' : ''}white-space:pre-line">${esc(l)}</p>`).join('\n')}
<p style="margin:0 0 20px;color:#5a6472;font-size:14px">${esc(t.child)}: ${esc(child)} (${esc(levelLabel)})</p>
<p style="margin:0 0 8px"><a href="${esc(url)}" style="display:inline-block;background:#0172bb;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(t.see)}</a></p>
<p style="margin:0 0 20px;color:#5a6472;font-size:13px">${esc(t.login(a.email))}</p>
<p style="margin:0;white-space:pre-line">${esc(t.sign)}</p></div>
<p style="color:#5a6472;font-size:12px;text-align:center;margin:16px 0 0">${esc(t.auto)}</p></div></body></html>`;
  return { to: recipients(a), subject: fullSubject, text, html };
}
