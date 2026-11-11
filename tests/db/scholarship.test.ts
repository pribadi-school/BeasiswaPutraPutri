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

const call = async (fn: string, ...args: unknown[]) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await db.query(`select public.${fn}(${ph}) as r`, args);
  return rows[0].r;
};
const fails = async (fn: string, msg: RegExp, ...args: unknown[]) => {
  await expect(call(fn, ...args)).rejects.toThrow(msg);
};

beforeAll(async () => {
  h = await startDatabase();
  db = await h.connect();
  await call('set_admin_password', 'password-admin-1');
}, 180_000);
afterAll(async () => {
  await db.end();
  await h.stop();
});

describe('pendaftaran → login', () => {
  let user = '', pin = '', token = '';

  it('mendaftar dan mendapat username + PIN 6 digit', async () => {
    const r = await call('register', JSON.stringify(profile()), 'id');
    expect(r.username).toMatch(/^bpd-[a-z2-9]{6}$/);
    expect(r.pin).toMatch(/^\d{6}$/);
    user = r.username; pin = r.pin;
  });

  it('PIN tersimpan sebagai hash, bukan teks', async () => {
    const { rows } = await db.query(`select pin_hash, parent_phone from private.applicants where username = $1`, [user]);
    expect(rows[0].pin_hash).not.toContain(pin);
    expect(rows[0].pin_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].parent_phone).toBe('6281234567890');
  });

  it('anak yang sama tidak bisa mendaftar dua kali', async () => {
    await fails('register', /DUPLICATE/, JSON.stringify(profile({ full_name: '  anak TES satu ' })), 'id');
  });

  it('isian tidak valid ditolak dengan nama kolomnya', async () => {
    await fails('register', /INVALID:parent_phone/, JSON.stringify(profile({ full_name: 'B', parent_phone: '123' })), 'id');
    await fails('register', /INVALID:birth_date/, JSON.stringify(profile({ full_name: 'C', birth_date: '2099-01-01' })), 'id');
    await fails('register', /INVALID:birth_date/, JSON.stringify(profile({ full_name: 'C', birth_date: null })), 'id');
    await fails('register', /INVALID:level/, JSON.stringify(profile({ full_name: 'D', level: 'univ' })), 'id');
    await fails('register', /INVALID:motivation/, JSON.stringify(profile({ full_name: 'E', motivation: ' ' })), 'id');
  });

  it('login salah ditolak; username tidak peduli huruf besar', async () => {
    expect((await call('login', user, '000000')).error).toBe('BAD_LOGIN');
    expect((await call('login', 'tidak-ada', pin)).error).toBe('BAD_LOGIN');
    const ok = await call('login', ` ${user.toUpperCase()} `, pin);
    expect(ok.token).toBeTruthy();
    token = ok.token;
  });

  it('sesi tersimpan sebagai hash', async () => {
    const { rows } = await db.query(`select token_hash from private.sessions where role = 'applicant'`);
    expect(rows.every((r) => r.token_hash !== token)).toBe(true);
  });

  it('peserta bisa melihat dan mengubah profilnya', async () => {
    const me = await call('me', token);
    expect(me.applicant.fullName).toBe('Anak Tes Satu');
    expect(me.canEdit).toBe(true);
    await call('update_profile', token, JSON.stringify(profile({ origin_school: 'SDN Baru' })));
    expect((await call('me', token)).applicant.originSchool).toBe('SDN Baru');
  });

  it('token palsu ditolak', async () => {
    await fails('me', /UNAUTHORIZED/, 'ngawur');
  });

  it('5x salah PIN mengunci HANYA username itu', async () => {
    const r2 = await call('register', JSON.stringify(profile({ full_name: 'Anak Tes Dua' })), 'id');
    for (let i = 0; i < 5; i++) await call('login', r2.username, '111111');
    expect((await call('login', r2.username, r2.pin)).error).toBe('LOCKED');
    expect((await call('login', user, pin)).token).toBeTruthy();
  });
});

describe('pengumuman', () => {
  let user = '', pin = '', token = '', id = '';

  it('hasil tidak terlihat sebelum waktunya, walau admin sudah menetapkan', async () => {
    const r = await call('register', JSON.stringify(profile({ full_name: 'Anak Tes Tiga' })), 'id');
    user = r.username; pin = r.pin;
    token = (await call('login', user, pin)).token;
    const a = await call('admin_login', 'password-admin-1');
    expect(a.token).toBeTruthy();
    const list = await call('admin_list', a.token);
    id = list.find((x: { username: string }) => x.username === user).id;
    await call('admin_save_settings', a.token, true, null, new Date(Date.now() + 86_400_000).toISOString(),
      JSON.stringify({ id: 'Judul', en: 'Title' }), JSON.stringify({ id: 'Isi rahasia', en: 'Secret body' }),
      JSON.stringify({ lulus: { id: 'Selamat', en: 'Congrats' } }));
    expect(await call('admin_set_status', a.token, `{${id}}`, 'lulus')).toBe(1);

    const me = await call('me', token);
    expect(me.released).toBe(false);
    expect(me.applicant.status).toBe('pending');
    expect(me.body).toBeNull();
    expect(me.resultMessage).toBeNull();
    const pub = await call('get_public_settings');
    expect(pub.body).toBeNull();
    // admin tetap melihat status asli
    expect((await call('admin_list', a.token)).find((x: { id: string }) => x.id === id).status).toBe('lulus');
  });

  it('setelah waktunya tiba, hasil terlihat dan data terkunci', async () => {
    const a = await call('admin_login', 'password-admin-1');
    await call('admin_save_settings', a.token, true, null, new Date(Date.now() - 1000).toISOString(),
      JSON.stringify({ id: 'Judul', en: 'Title' }), JSON.stringify({ id: 'Isi', en: 'Body' }),
      JSON.stringify({ lulus: { id: 'Selamat', en: 'Congrats' } }));
    const me = await call('me', token);
    expect(me.released).toBe(true);
    expect(me.applicant.status).toBe('lulus');
    expect(me.resultMessage.id).toBe('Selamat');
    expect(me.canEdit).toBe(false);
    await fails('update_profile', /CLOSED/, token, JSON.stringify(profile({ full_name: 'Anak Tes Tiga' })));
    await fails('register', /CLOSED/, JSON.stringify(profile({ full_name: 'Terlambat' })), 'id');
  });

  it('reset PIN: PIN lama mati, PIN baru bekerja', async () => {
    const a = await call('admin_login', 'password-admin-1');
    const r = await call('admin_reset_pin', a.token, id);
    expect(r.pin).not.toBe(pin);
    await fails('me', /UNAUTHORIZED/, token);
    expect((await call('login', user, pin)).error).toBe('BAD_LOGIN');
    expect((await call('login', user, r.pin)).token).toBeTruthy();
  });
});

describe('keamanan', () => {
  it('fungsi admin menolak tanpa token admin (termasuk token peserta)', async () => {
    const a = await call('admin_login', 'password-admin-1');
    await call('admin_save_settings', a.token, true, null, null, '{"id":"","en":""}', '{"id":"","en":""}', '{}');
    const r = await call('register', JSON.stringify(profile({ full_name: 'Anak Tes Empat' })), 'id');
    const t = (await call('login', r.username, r.pin)).token;
    await fails('admin_list', /UNAUTHORIZED/, t);
    await fails('admin_set_status', /UNAUTHORIZED/, t, '{}', 'lulus');
    expect((await call('admin_login', 'salah')).error).toBe('BAD_LOGIN');
  });

  it('role anon tidak bisa membaca tabel private maupun fungsi internal', async () => {
    await db.query('set role anon');
    try {
      await expect(db.query('select * from private.applicants')).rejects.toThrow(/permission denied/);
      await expect(db.query(`select public.set_admin_password('hackhackhack')`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select private.new_pin()`)).rejects.toThrow(/permission denied/);
      const { rows } = await db.query('select public.get_public_settings() as r');
      expect(rows[0].r.released).toBeDefined();
    } finally {
      await db.query('reset role');
    }
  });
});
