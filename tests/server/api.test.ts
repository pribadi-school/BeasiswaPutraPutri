import { existsSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, startServer, type Harness } from './harness.ts';

let h: Harness;
const ADMIN = { email: 'panitia@pribadidepok.sch.id', password: 'password-panitia-1' };

const profile = (over: Record<string, string> = {}) => ({
  level: 'smp', fullName: 'Anak Tes Satu', gender: 'L', birthPlace: 'Garut', birthDate: '2014-05-04',
  nisn: '0012345678', province: 'Jawa Barat', regency: 'Kabupaten Garut', district: 'Tarogong', address: 'Jl. Contoh 1',
  originSchool: 'SDN Tes', originClass: '6', parentName: 'Orang Tua Tes', parentRelation: 'ibu',
  parentPhone: '0812-3456-7890', parentEmail: 'ortu@example.com', parentJob: 'Petani', incomeBand: '1to3', siblings: '2',
  achievements: 'Juara 1 lomba tes', motivation: 'Ingin belajar.', ...over,
});
const PDF = new Uint8Array(Buffer.from('%PDF-1.4\n% berkas tes\n%%EOF\n'));

let n = 0;
/** Orang tua yang sudah masuk dengan Google (palsu). */
async function parent(email = `ortu${++n}@gmail.com`) {
  const c = new Client(h.base);
  const r = await c.post('/api/auth/google', { credential: `fake:sub-${email}:${email}` });
  expect(r.status).toBe(200);
  return c;
}
async function admin() {
  const c = new Client(h.base);
  const r = await c.post('/api/admin/login', ADMIN);
  expect(r.status).toBe(200);
  return c;
}
async function settings(patch: Record<string, unknown> = {}) {
  const a = await admin();
  const r = await a.put('/api/admin/settings', {
    regOpen: true, regDeadline: null, announceAt: null,
    title: { id: 'Judul', en: 'Title' }, body: { id: 'Isi', en: 'Body' },
    resultMessages: { lulus: { id: 'Selamat', en: 'Congrats' } }, ...patch,
  });
  expect(r.status).toBe(200);
}

beforeAll(async () => {
  h = await startServer();
  await h.pool.execute('INSERT INTO admins (id, email, password_hash, created_at) VALUES (UUID(), ?, ?, NOW())',
    [ADMIN.email, await bcrypt.hash(ADMIN.password, 4)]);
}, 120_000);
afterAll(async () => { await h?.stop(); });

describe('skema', () => {
  it('jadwal awal: tanpa tanggal pembukaan, ditutup 26 Des 2026 23.59 WIB', async () => {
    const r = await new Client(h.base).get('/api/settings');
    expect(r.data.regDeadline).toBe('2026-12-26T16:59:00.000Z');
    expect(r.data.regOpen).toBe(true);
    await settings(); // tes berikut tanpa batas penutupan
  });
});

describe('masuk Google → isi data', () => {
  let c: Client;

  it('token Google palsu ditolak; cookie sesi HttpOnly', async () => {
    const x = new Client(h.base);
    expect((await x.post('/api/auth/google', { credential: 'ngawur' })).status).toBe(401);
    const ok = await x.post('/api/auth/google', { credential: 'fake:sub-a:ortu.satu@gmail.com' });
    expect(ok.headers.get('set-cookie')).toMatch(/HttpOnly/);
    expect(ok.headers.get('set-cookie')).toMatch(/SameSite=Lax/);
    c = x;
  });

  it('sebelum mendaftar: applicant null', async () => {
    const me = await c.get('/api/me');
    expect(me.data.applicant).toBeNull();
    expect(me.data.canEdit).toBe(true);
  });

  it('mendaftar; email diambil dari akun Google, telepon dirapikan', async () => {
    expect((await c.post('/api/me/register', { profile: profile(), lang: 'id' })).status).toBe(200);
    const me = await c.get('/api/me');
    expect(me.data.applicant.fullName).toBe('Anak Tes Satu');
    expect(me.data.applicant.email).toBe('ortu.satu@gmail.com');
    expect(me.data.applicant.parentPhone).toBe('6281234567890');
    expect(me.data.applicant.birthDate).toBe('2014-05-04');
    expect(me.data.applicant.status).toBe('pending');
  });

  it('satu akun satu pendaftaran; anak yang sama tidak bisa didaftarkan akun lain', async () => {
    expect((await c.post('/api/me/register', { profile: profile({ fullName: 'Anak Lain' }) })).data.error).toBe('ALREADY_REGISTERED');
    const other = await parent();
    expect((await other.post('/api/me/register', { profile: profile({ fullName: '  anak TES satu ' }) })).data.error).toBe('DUPLICATE');
  });

  it('isian tidak valid ditolak dengan nama kolomnya', async () => {
    const v = await parent();
    const cases: [Record<string, string>, string][] = [
      [{ parentPhone: '123' }, 'parentPhone'], [{ birthDate: '2099-01-01' }, 'birthDate'], [{ birthDate: '2014-02-31' }, 'birthDate'],
      [{ level: 'sd' }, 'level'], [{ province: 'Banten' }, 'province'], [{ originClass: '7' }, 'originClass'],
      [{ level: 'sma', originClass: '6' }, 'originClass'], [{ nisn: '' }, 'nisn'], [{ parentEmail: 'bukan-email' }, 'parentEmail'],
      [{ achievements: ' ' }, 'achievements'], [{ gender: 'X' }, 'gender'], [{ incomeBand: 'banyak' }, 'incomeBand'],
      [{ siblings: '99' }, 'siblings'], [{ fullName: 'x'.repeat(121) }, 'fullName'],
    ];
    for (const [over, field] of cases) {
      const r = await v.post('/api/me/register', { profile: profile({ fullName: 'Anak Valid', ...over }) });
      expect([r.status, r.data.error, r.data.field]).toEqual([400, 'INVALID', field]);
    }
  });

  it('penghasilan dan saudara kandung boleh kosong; teks disimpan apa adanya (bukan SQL)', async () => {
    const w = await parent();
    const name = `Anak'); DROP TABLE applicants;--`;
    expect((await w.post('/api/me/register', { profile: profile({ fullName: name, level: 'sma', originClass: '9', incomeBand: '', siblings: '' }) })).status).toBe(200);
    const a = (await w.get('/api/me')).data.applicant;
    expect([a.fullName, a.incomeBand, a.siblings, a.originClass]).toEqual([name, '', '', '9']);
  });

  it('mengubah data sendiri; belum terdaftar → NOT_FOUND', async () => {
    expect((await c.put('/api/me/profile', { profile: profile({ originSchool: 'SDN Baru' }) })).status).toBe(200);
    expect((await c.get('/api/me')).data.applicant.originSchool).toBe('SDN Baru');
    expect((await (await parent()).put('/api/me/profile', { profile: profile({ fullName: 'Penyusup' }) })).data.error).toBe('NOT_FOUND');
  });

  it('tanpa masuk: 401; tanpa header CSRF: 403', async () => {
    expect((await new Client(h.base).get('/api/me')).status).toBe(401);
    const noCsrf = new Client(h.base, false);
    noCsrf.cookies = new Map(c.cookies);
    expect((await noCsrf.put('/api/me/profile', { profile: profile() })).data.error).toBe('CSRF');
  });

  it('keluar: sesi tidak berlaku lagi meski cookie lama dipakai', async () => {
    const x = await parent();
    const stolen = new Map(x.cookies);
    await x.post('/api/auth/logout');
    const y = new Client(h.base);
    y.cookies = stolen;
    expect((await y.get('/api/me')).status).toBe(401);
  });
});

describe('berkas kelengkapan (PDF)', () => {
  let u: Client;

  it('belum mendaftar: tidak bisa mengunggah', async () => {
    u = await parent();
    expect((await u.req('PUT', '/api/me/document', PDF, 'application/pdf')).data.error).toBe('CLOSED');
  });

  it('hanya PDF asli, maks 10 MB', async () => {
    await u.post('/api/me/register', { profile: profile({ fullName: 'Anak Berkas' }) });
    const jpg = new Uint8Array(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    expect((await u.req('PUT', '/api/me/document', jpg, 'application/pdf')).data.error).toBe('NOT_PDF');
    const big = new Uint8Array(10 * 1024 * 1024 + 1); big.set(PDF);
    expect((await u.req('PUT', '/api/me/document', big, 'application/pdf')).data.error).toBe('TOO_LARGE');
    expect((await u.req('PUT', '/api/me/document', PDF, 'application/pdf')).status).toBe(200);
    expect((await u.get('/api/me')).data.document.size).toBe(PDF.length);
  });

  it('pemilik dan admin bisa membuka; peserta lain dan tamu tidak', async () => {
    const mine = await u.get('/api/me/document');
    expect(mine.status).toBe(200);
    expect(mine.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.compare(mine.data as Buffer, Buffer.from(PDF))).toBe(0);

    expect((await (await parent()).get('/api/me/document')).status).toBe(404);
    expect((await new Client(h.base).get('/api/me/document')).status).toBe(401);

    const a = await admin();
    const row = (await a.get('/api/admin/applicants')).data.find((x: { fullName: string }) => x.fullName === 'Anak Berkas');
    expect(row.document.size).toBe(PDF.length);
    expect((await a.get(`/api/admin/applicants/${row.id}/document`)).status).toBe(200);
    expect((await u.get(`/api/admin/applicants/${row.id}/document`)).status).toBe(401);
    expect(existsSync(join(h.uploadDir, `${row.id}.pdf`))).toBe(true);
  });

  it('setelah pendaftaran ditutup: tidak bisa mengganti berkas', async () => {
    await settings({ regOpen: false });
    expect((await u.req('PUT', '/api/me/document', PDF, 'application/pdf')).data.error).toBe('CLOSED');
    await settings();
  });
});

describe('jadwal dan pengumuman', () => {
  it('setelah penutupan: tidak bisa mendaftar', async () => {
    await settings({ regDeadline: new Date(Date.now() - 1000).toISOString() });
    const x = await parent();
    expect((await x.post('/api/me/register', { profile: profile({ fullName: 'Terlambat' }) })).data.error).toBe('CLOSED');
    await settings();
  });

  it('pengumuman tidak boleh sebelum penutupan', async () => {
    const a = await admin();
    const r = await a.put('/api/admin/settings', {
      regOpen: true, regDeadline: '2026-12-26T16:59:00Z', announceAt: '2026-12-01T00:00:00Z', title: {}, body: {}, resultMessages: {},
    });
    expect([r.status, r.data.field]).toEqual([400, 'announce_at']);
  });

  it('hasil tersembunyi sebelum waktunya; terlihat sesudahnya dan data terkunci', async () => {
    const p = await parent();
    await p.post('/api/me/register', { profile: profile({ fullName: 'Anak Pengumuman' }) });
    const a = await admin();
    const row = (await a.get('/api/admin/applicants')).data.find((x: { fullName: string }) => x.fullName === 'Anak Pengumuman');
    await settings({ announceAt: new Date(Date.now() + 86_400_000).toISOString() });
    expect((await a.post('/api/admin/status', { ids: [row.id], status: 'lulus' })).data.updated).toBe(1);

    let me = (await p.get('/api/me')).data;
    expect([me.released, me.applicant.status, me.body, me.resultMessage]).toEqual([false, 'pending', null, null]);
    expect((await new Client(h.base).get('/api/settings')).data.body).toBeNull();

    await settings({ announceAt: new Date(Date.now() - 1000).toISOString() });
    me = (await p.get('/api/me')).data;
    expect([me.released, me.applicant.status, me.resultMessage.id, me.canEdit]).toEqual([true, 'lulus', 'Selamat', false]);
    expect((await p.put('/api/me/profile', { profile: profile({ fullName: 'Anak Pengumuman' }) })).data.error).toBe('CLOSED');
    await settings();
  });
});

describe('admin', () => {
  it('peserta biasa dan tamu tidak bisa memakai fungsi admin', async () => {
    const p = await parent();
    expect((await p.get('/api/admin/applicants')).status).toBe(401);
    expect((await p.post('/api/admin/status', { ids: [], status: 'lulus' })).status).toBe(401);
    expect((await new Client(h.base).get('/api/admin/settings')).status).toBe(401);
  });

  it('password salah ditolak; 10x salah mengunci email itu', async () => {
    const x = new Client(h.base);
    expect((await x.post('/api/admin/login', { email: ADMIN.email, password: 'salah' })).data.error).toBe('BAD_LOGIN');
    expect((await x.post('/api/admin/login', { email: 'tidak.ada@x.id', password: 'salah' })).data.error).toBe('BAD_LOGIN');
    for (let i = 0; i < 10; i++) await x.post('/api/admin/login', { email: 'kunci@x.id', password: 'salah' });
    expect((await x.post('/api/admin/login', { email: 'kunci@x.id', password: 'salah' })).data.error).toBe('LOCKED');
  });

  it('hapus pendaftar sekaligus berkasnya', async () => {
    const p = await parent();
    await p.post('/api/me/register', { profile: profile({ fullName: 'Anak Dihapus' }) });
    await p.req('PUT', '/api/me/document', PDF, 'application/pdf');
    const a = await admin();
    const row = (await a.get('/api/admin/applicants')).data.find((x: { fullName: string }) => x.fullName === 'Anak Dihapus');
    expect((await a.del(`/api/admin/applicants/${row.id}`)).status).toBe(200);
    expect(existsSync(join(h.uploadDir, `${row.id}.pdf`))).toBe(false);
    expect((await p.get('/api/me')).data.applicant).toBeNull();
  });

  it('header keamanan terpasang', async () => {
    const r = await new Client(h.base).get('/api/settings');
    expect(r.headers.get('content-security-policy')).toMatch(/frame-ancestors 'none'/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });
});
