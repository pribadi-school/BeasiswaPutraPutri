import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startDatabase, type Harness } from './harness.ts';

let h: Harness;
let db: pg.Client;

const profile = (over: Record<string, unknown> = {}) => ({
  level: 'smp', full_name: 'Anak Tes Satu', gender: 'L', birth_place: 'Kupang', birth_date: '2012-05-04',
  nisn: '', province: 'Nusa Tenggara Timur', regency: 'Kota Kupang', district: 'Oebobo', address: 'Jl. Contoh 1',
  origin_school: 'SDN Tes', origin_class: '6', parent_name: 'Orang Tua Tes', parent_relation: 'ibu',
  parent_phone: '0812-3456-7890', parent_email: '', parent_job: 'Petani', income_band: '1to3', siblings: 2,
  achievements: '', motivation: 'Ingin belajar.', ...over,
});

type User = { sub: string; email: string } | null;
const newUser = (email = `tes-${Math.random().toString(36).slice(2, 8)}@example.com`): User => ({ sub: randomUUID(), email });

/** Memanggil fungsi seperti browser: role authenticated (atau anon) + JWT claims Supabase. */
async function call(user: User | 'admin', fn: string, ...args: unknown[]) {
  const ph = args.map((_, i) => `$${i + 1}`).join(',');
  const claims = user && user !== 'admin' ? JSON.stringify({ sub: user.sub, email: user.email, role: 'authenticated' }) : '';
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.query(user && user !== 'admin' ? 'set role authenticated' : 'set role anon');
  try {
    const { rows } = await db.query(`select public.${fn}(${ph}) as r`, args);
    return rows[0].r;
  } finally {
    await db.query('reset role');
  }
}
const fails = (user: User | 'admin', fn: string, msg: RegExp, ...args: unknown[]) =>
  expect(call(user, fn, ...args)).rejects.toThrow(msg);

let adminToken = '';
const saveSettings = (announceAt: string | null, regOpen = true) =>
  call('admin', 'admin_save_settings', adminToken, regOpen, null, announceAt,
    JSON.stringify({ id: 'Judul', en: 'Title' }), JSON.stringify({ id: 'Isi', en: 'Body' }),
    JSON.stringify({ lulus: { id: 'Selamat', en: 'Congrats' } }));

beforeAll(async () => {
  h = await startDatabase();
  db = await h.connect();
  await db.query(`select public.set_admin_password('password-admin-1')`);
  adminToken = (await call('admin', 'admin_login', 'password-admin-1')).token;
}, 180_000);
afterAll(async () => {
  await db.end();
  await h.stop();
});

describe('masuk Google → isi data', () => {
  const u = newUser('ortu.satu@gmail.com');

  it('sebelum mendaftar, me() mengembalikan applicant null', async () => {
    const me = await call(u, 'me');
    expect(me.applicant).toBeNull();
    expect(me.canEdit).toBe(true);
  });

  it('mendaftar memakai akun yang sedang masuk; email diambil dari JWT', async () => {
    await call(u, 'register', JSON.stringify(profile()), 'id');
    const me = await call(u, 'me');
    expect(me.applicant.fullName).toBe('Anak Tes Satu');
    expect(me.applicant.email).toBe('ortu.satu@gmail.com');
    expect(me.applicant.parentPhone).toBe('6281234567890');
  });

  it('satu akun hanya satu pendaftaran', async () => {
    await fails(u, 'register', /ALREADY_REGISTERED/, JSON.stringify(profile({ full_name: 'Anak Lain' })), 'id');
  });

  it('anak yang sama tidak bisa didaftarkan akun lain', async () => {
    await fails(newUser(), 'register', /DUPLICATE/, JSON.stringify(profile({ full_name: '  anak TES satu ' })), 'id');
  });

  it('isian tidak valid ditolak dengan nama kolomnya', async () => {
    const v = newUser();
    await fails(v, 'register', /INVALID:parent_phone/, JSON.stringify(profile({ full_name: 'B', parent_phone: '123' })), 'id');
    await fails(v, 'register', /INVALID:birth_date/, JSON.stringify(profile({ full_name: 'C', birth_date: '2099-01-01' })), 'id');
    await fails(v, 'register', /INVALID:birth_date/, JSON.stringify(profile({ full_name: 'C', birth_date: null })), 'id');
    await fails(v, 'register', /INVALID:level/, JSON.stringify(profile({ full_name: 'D', level: 'univ' })), 'id');
    await fails(v, 'register', /INVALID:motivation/, JSON.stringify(profile({ full_name: 'E', motivation: ' ' })), 'id');
  });

  it('peserta bisa mengubah datanya sendiri, dan hanya miliknya', async () => {
    await call(u, 'update_profile', JSON.stringify(profile({ origin_school: 'SDN Baru' })));
    expect((await call(u, 'me')).applicant.originSchool).toBe('SDN Baru');
    await fails(newUser(), 'update_profile', /NOT_FOUND/, JSON.stringify(profile({ full_name: 'Penyusup' })));
    expect((await call(u, 'me')).applicant.fullName).toBe('Anak Tes Satu');
  });

  it('tanpa masuk (anon) fungsi peserta tidak bisa dipanggil', async () => {
    await fails(null, 'me', /permission denied/);
    await fails(null, 'register', /permission denied/, JSON.stringify(profile({ full_name: 'Anon' })), 'id');
  });

  it('JWT tanpa email ditolak saat mendaftar', async () => {
    await fails({ sub: randomUUID(), email: '' }, 'register', /UNAUTHORIZED/, JSON.stringify(profile({ full_name: 'Tanpa Email' })), 'id');
  });
});

describe('pengumuman', () => {
  const u = newUser();
  let id = '';

  it('hasil tidak terlihat sebelum waktunya, walau admin sudah menetapkan', async () => {
    await call(u, 'register', JSON.stringify(profile({ full_name: 'Anak Tes Tiga' })), 'id');
    const list = await call('admin', 'admin_list', adminToken);
    id = list.find((x: { email: string }) => x.email === u!.email).id;
    await saveSettings(new Date(Date.now() + 86_400_000).toISOString());
    expect(await call('admin', 'admin_set_status', adminToken, `{${id}}`, 'lulus')).toBe(1);

    const me = await call(u, 'me');
    expect(me.released).toBe(false);
    expect(me.applicant.status).toBe('pending');
    expect(me.body).toBeNull();
    expect(me.resultMessage).toBeNull();
    expect((await call(null, 'get_public_settings')).body).toBeNull();
    expect((await call('admin', 'admin_list', adminToken)).find((x: { id: string }) => x.id === id).status).toBe('lulus');
  });

  it('setelah waktunya tiba, hasil terlihat dan data terkunci', async () => {
    await saveSettings(new Date(Date.now() - 1000).toISOString());
    const me = await call(u, 'me');
    expect(me.released).toBe(true);
    expect(me.applicant.status).toBe('lulus');
    expect(me.resultMessage.id).toBe('Selamat');
    expect(me.canEdit).toBe(false);
    await fails(u, 'update_profile', /CLOSED/, JSON.stringify(profile({ full_name: 'Anak Tes Tiga' })));
    await fails(newUser(), 'register', /CLOSED/, JSON.stringify(profile({ full_name: 'Terlambat' })), 'id');
    await saveSettings(null);
  });
});

describe('keamanan', () => {
  it('fungsi admin menolak tanpa token admin; salah password ditolak', async () => {
    await fails('admin', 'admin_list', /UNAUTHORIZED/, 'ngawur');
    await fails('admin', 'admin_set_status', /UNAUTHORIZED/, 'ngawur', '{}', 'lulus');
    expect((await call('admin', 'admin_login', 'salah')).error).toBe('BAD_LOGIN');
  });

  it('password admin tersimpan sebagai hash bcrypt', async () => {
    const { rows } = await db.query(`select hash from private.secrets where key = 'admin_password'`);
    expect(rows[0].hash).toMatch(/^\$2[aby]\$/);
  });

  it('browser (anon/authenticated) tidak bisa membaca tabel private maupun fungsi internal', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.query(`set role ${role}`);
      try {
        await expect(db.query('select * from private.applicants')).rejects.toThrow(/permission denied/);
        await expect(db.query(`select public.set_admin_password('hackhackhack')`)).rejects.toThrow(/permission denied/);
        await expect(db.query(`select private.uid()`)).rejects.toThrow(/permission denied/);
      } finally {
        await db.query('reset role');
      }
    }
  });
});
