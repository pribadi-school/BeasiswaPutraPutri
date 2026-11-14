-- =============================================================================
-- Beasiswa Putra-Putri Daerah — skema database
-- SD–SMP–SMA Pribadi Depok
--
-- Cara menjalankan: `npm run db:setup` (lihat README), atau tempel seluruh file
-- ini di Supabase SQL editor. Aman dijalankan berulang kali (tidak menghapus data).
--
-- Model keamanan:
--   * SEMUA data pendaftar (anak di bawah umur) ada di schema `private`, yang
--     tidak pernah dibuka ke browser. Tidak ada tabel publik sama sekali.
--   * Browser hanya memanggil fungsi Postgres di bawah. Fungsi itu memeriksa
--     input, lalu menulis/membaca tabel private (SECURITY DEFINER).
--   * Peserta masuk dengan akun Google (Supabase Auth). Fungsi peserta
--     mengenali pemiliknya dari JWT Supabase (claim `sub` = id pengguna),
--     jadi satu akun Google hanya bisa melihat/mengubah datanya sendiri.
--   * Admin (panitia) masuk dengan akun Supabase (email + password) yang
--     dibuat di dashboard. Hanya akun yang terdaftar di private.admins (per
--     id pengguna, bukan per email) yang dianggap admin.
--   * Berkas kelengkapan (PDF gabungan KTP, KK, rapor, sertifikat; maks 10 MB)
--     ada di bucket Storage PRIVAT `berkas`, satu file per peserta di
--     `<user_id>/kelengkapan.pdf`. Policy Storage: peserta hanya bisa
--     menulis/membaca file miliknya (selama pendaftaran dibuka), admin bisa
--     membaca dan menghapus. Browser hanya mendapat signed URL berumur pendek.
--   * Hasil seleksi TIDAK dikirim ke peserta sebelum waktu pengumuman
--     (announce_at); aturan ini dijaga di database, bukan di tampilan.
-- =============================================================================

create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table if not exists private.settings (
  id               int primary key check (id = 1),
  reg_open         boolean not null default true,
  reg_deadline     timestamptz,            -- sesudah ini data tidak bisa diubah/daftar baru
  announce_at      timestamptz,            -- sebelum ini hasil tidak terlihat peserta
  announce_title   jsonb not null default '{"id":"Pengumuman Beasiswa Putra-Putri Daerah","en":"Regional Scholarship Announcement"}',
  announce_body    jsonb not null default '{"id":"","en":""}',
  -- pesan tambahan per status: {"lulus":{"id":"…","en":"…"}, "cadangan":{…}, "tidak_lulus":{…}}
  result_messages  jsonb not null default '{}'
);
insert into private.settings (id) values (1) on conflict do nothing;
-- Tidak ada tanggal pembukaan: pendaftaran dibuka sejak aplikasi aktif.
alter table private.settings drop column if exists reg_start;
-- Penutupan awal (sekali saja; sesudahnya diatur panitia di Admin → Pengaturan):
-- 26 Des 2026 23.59 WIB.
alter table private.settings add column if not exists schedule_seeded boolean not null default false;
update private.settings
   set reg_deadline = timestamptz '2026-12-26 23:59:00+07',
       schedule_seeded = true
 where id = 1 and not schedule_seeded;

create table if not exists private.applicants (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique,     -- auth.users.id (akun Google)
  email         text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'lulus', 'cadangan', 'tidak_lulus')),
  lang          text not null default 'id' check (lang in ('id', 'en')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  consent_at    timestamptz not null default now(),

  level         text not null check (level in ('smp', 'sma')),  -- SD tidak dibuka
  full_name     text not null,
  gender        text not null check (gender in ('L', 'P')),
  birth_place   text not null,
  birth_date    date not null,
  nisn          text,
  province      text not null,
  regency       text not null,
  district      text not null,
  address       text not null,
  origin_school text not null,
  origin_class  text not null,
  parent_name   text not null,
  parent_relation text not null check (parent_relation in ('ayah', 'ibu', 'wali')),
  parent_phone  text not null,
  parent_email  text,
  parent_job    text not null,
  income_band   text check (income_band in ('lt1', '1to3', '3to5', 'gt5')),
  siblings      int check (siblings between 0 and 20),
  achievements  text,
  motivation    text not null
);
-- Database yang dibuat sebelum SD dihapus: perbarui aturan jenjangnya.
alter table private.applicants drop constraint if exists applicants_level_check;
alter table private.applicants add constraint applicants_level_check check (level in ('smp', 'sma'));
alter table private.applicants drop constraint if exists applicants_scope_check;
alter table private.applicants add constraint applicants_scope_check check (
  province = 'Jawa Barat'
  and ((level = 'smp' and origin_class = '6') or (level = 'sma' and origin_class = '9'))
  and nisn is not null and parent_email is not null and achievements is not null);

-- Satu anak = satu pendaftaran.
create unique index if not exists applicants_child_key
  on private.applicants (lower(btrim(full_name)), birth_date);

-- Admin = pengguna Supabase Auth yang terdaftar di sini (dibuat lewat dashboard,
-- lalu didaftarkan dengan `npm run db:admins`).
create table if not exists private.admins (
  user_id uuid primary key,
  email   text not null
);

-- Sisa sistem login admin lama (password + token). Tidak dipakai lagi.
drop table if exists private.sessions;
drop table if exists private.secrets;
drop table if exists private.login_failures;

-- RLS aktif di semua tabel, tanpa policy = browser tidak punya akses sama sekali.
alter table private.settings   enable row level security;
alter table private.applicants enable row level security;
alter table private.admins     enable row level security;
revoke all on all tables in schema private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema private from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema private from authenticated;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Fungsi bantu (private)
-- -----------------------------------------------------------------------------

-- Sisa login admin lama.
drop function if exists public.admin_login(text);
drop function if exists public.logout(text);
drop function if exists public.set_admin_password(text);
drop function if exists public.admin_list(text);
drop function if exists public.admin_get_settings(text);
drop function if exists public.admin_save_settings(text, boolean, timestamptz, timestamptz, jsonb, jsonb, jsonb);
drop function if exists public.admin_save_settings(boolean, timestamptz, timestamptz, timestamptz, jsonb, jsonb, jsonb);
drop function if exists public.admin_set_status(text, uuid[], text);
drop function if exists public.admin_delete(text, uuid);
drop function if exists private.require_admin(text);
drop function if exists private.hash_secret(text);
drop function if exists private.check_secret(text, text);
drop function if exists private.token_hash(text);

create or replace function private.invalid(p_field text) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception 'INVALID:%', p_field using errcode = 'P0001';
end $$;

-- Membersihkan dan memeriksa isian profil. Melempar 'INVALID:<kolom>'.
create or replace function private.clean_profile(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  r jsonb := '{}';
  k text;
  v text;
  phone text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform private.invalid('profile');
  end if;

  -- Teks wajib: (kolom, panjang maksimum)
  for k, v in select * from (values
    ('full_name','120'), ('birth_place','80'), ('province','60'), ('regency','80'),
    ('district','80'), ('address','300'), ('origin_school','120'), ('origin_class','30'),
    ('parent_name','120'), ('parent_job','80'), ('achievements','1000'), ('motivation','1500')
  ) t(a, b) loop
    if btrim(coalesce(p->>k, '')) = '' or length(btrim(p->>k)) > v::int then
      perform private.invalid(k);
    end if;
    r := r || jsonb_build_object(k, regexp_replace(btrim(p->>k), '[[:cntrl:]]', ' ', 'g'));
  end loop;

  if (p->>'level') is null or (p->>'level') not in ('smp', 'sma') then perform private.invalid('level'); end if;
  -- Program ini hanya untuk Jawa Barat.
  if r->>'province' <> 'Jawa Barat' then perform private.invalid('province'); end if;
  -- Kelas saat ini: 6 (mendaftar ke SMP) atau 9 (mendaftar ke SMA).
  if r->>'origin_class' not in ('6', '9')
     or (p->>'level' = 'smp' and r->>'origin_class' <> '6')
     or (p->>'level' = 'sma' and r->>'origin_class' <> '9') then
    perform private.invalid('origin_class');
  end if;
  if (p->>'gender') is null or (p->>'gender') not in ('L', 'P') then perform private.invalid('gender'); end if;
  if (p->>'parent_relation') is null or (p->>'parent_relation') not in ('ayah', 'ibu', 'wali') then
    perform private.invalid('parent_relation');
  end if;
  r := r || jsonb_build_object('level', p->>'level', 'gender', p->>'gender', 'parent_relation', p->>'parent_relation');

  begin
    if not coalesce((p->>'birth_date')::date between date '1995-01-01' and (now() at time zone 'Asia/Jakarta')::date - 3 * 365, false) then
      perform private.invalid('birth_date');
    end if;
    r := r || jsonb_build_object('birth_date', (p->>'birth_date')::date);
  exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
    perform private.invalid('birth_date');
  end;

  -- Telepon: 08…, 62… atau +62…; disimpan sebagai angka berawalan 62.
  phone := regexp_replace(coalesce(p->>'parent_phone', ''), '[\s\-().]', '', 'g');
  if phone !~ '^(\+?62|0)[0-9]{8,13}$' then perform private.invalid('parent_phone'); end if;
  phone := '62' || regexp_replace(phone, '^(\+?62|0)', '');
  r := r || jsonb_build_object('parent_phone', phone);

  -- NISN dan email orang tua: wajib.
  v := btrim(coalesce(p->>'nisn', ''));
  if v !~ '^[0-9]{10}$' then perform private.invalid('nisn'); end if;
  r := r || jsonb_build_object('nisn', v);

  v := btrim(coalesce(p->>'parent_email', ''));
  if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v) > 120 then perform private.invalid('parent_email'); end if;
  r := r || jsonb_build_object('parent_email', v);

  -- Opsional: penghasilan dan jumlah saudara kandung.
  v := btrim(coalesce(p->>'income_band', ''));
  if v <> '' and v not in ('lt1', '1to3', '3to5', 'gt5') then perform private.invalid('income_band'); end if;
  r := r || jsonb_build_object('income_band', nullif(v, ''));

  v := btrim(coalesce(p->>'siblings', ''));
  if v <> '' and (v !~ '^[0-9]{1,2}$' or v::int > 20) then perform private.invalid('siblings'); end if;
  r := r || jsonb_build_object('siblings', nullif(v, '')::int);

  return r;
end $$;

create or replace function private.released() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(announce_at <= now(), false) from private.settings where id = 1
$$;

-- Pengguna yang sedang masuk (dari JWT Supabase). Melempar 'UNAUTHORIZED'.
create or replace function private.uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
  exception when others then v := null;
  end;
  if v is null then raise exception 'UNAUTHORIZED' using errcode = 'P0001'; end if;
  return v;
end $$;

create or replace function private.jwt_email() returns text
language sql stable set search_path = '' as $$
  select lower(nullif(btrim(current_setting('request.jwt.claims', true)::jsonb ->> 'email'), ''))
$$;

create or replace function private.is_admin() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
  exception when others then v := null;
  end;
  return v is not null and exists (select 1 from private.admins where user_id = v);
end $$;

create or replace function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'UNAUTHORIZED' using errcode = 'P0001'; end if;
end $$;

-- Lokasi berkas kelengkapan seorang peserta di bucket `berkas`.
create or replace function private.document_path(p_user uuid) returns text
language sql immutable set search_path = '' as $$
  select p_user::text || '/kelengkapan.pdf'
$$;

-- {size, uploadedAt} berkas di Storage, atau null bila belum diunggah.
create or replace function private.document_info(p_user uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  select json_build_object('size', (o.metadata ->> 'size')::bigint, 'uploadedAt', coalesce(o.updated_at, o.created_at))
    into r
    from storage.objects o
   where o.bucket_id = 'berkas' and o.name = private.document_path(p_user);
  return r;
exception when undefined_table or invalid_schema_name then
  return null;
end $$;

-- Boleh mendaftar/mengubah data sekarang?
create or replace function private.registration_open() returns boolean
language sql stable set search_path = '' as $$
  select reg_open
     and (reg_deadline is null or now() < reg_deadline) and not private.released()
    from private.settings where id = 1
$$;

create or replace function private.applicant_json(a private.applicants) returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'id', a.id, 'email', a.email, 'lang', a.lang,
    'createdAt', a.created_at, 'updatedAt', a.updated_at,
    'status', case when private.released() then a.status else 'pending' end,
    'level', a.level, 'fullName', a.full_name, 'gender', a.gender,
    'birthPlace', a.birth_place, 'birthDate', a.birth_date, 'nisn', a.nisn,
    'province', a.province, 'regency', a.regency, 'district', a.district, 'address', a.address,
    'originSchool', a.origin_school, 'originClass', a.origin_class,
    'parentName', a.parent_name, 'parentRelation', a.parent_relation, 'parentPhone', a.parent_phone,
    'parentEmail', a.parent_email, 'parentJob', a.parent_job,
    'incomeBand', a.income_band, 'siblings', a.siblings,
    'achievements', a.achievements, 'motivation', a.motivation)
$$;

-- Versi admin: status asli selalu terlihat, plus id akun dan info berkas.
create or replace function private.applicant_admin_json(a private.applicants) returns json
language sql stable set search_path = '' as $$
  select (private.applicant_json(a)::jsonb || jsonb_build_object(
    'status', a.status, 'userId', a.user_id, 'document', private.document_info(a.user_id)))::json
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik — peserta
-- -----------------------------------------------------------------------------

-- Pengaturan yang boleh dilihat siapa saja. Isi pengumuman baru keluar setelah waktunya.
create or replace function public.get_public_settings() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'now', now(),
    'regOpen', private.registration_open(),
    'regDeadline', s.reg_deadline,
    'announceAt', s.announce_at,
    'released', private.released(),
    'title', case when private.released() then s.announce_title end,
    'body', case when private.released() then s.announce_body end)
  from private.settings s where id = 1
$$;

create or replace function public.register(p_profile jsonb, p_lang text default 'id') returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.uid();
  v_email text := private.jwt_email();
  c jsonb;
begin
  if v_email is null then raise exception 'UNAUTHORIZED' using errcode = 'P0001'; end if;
  if not private.registration_open() then raise exception 'CLOSED' using errcode = 'P0001'; end if;
  if exists (select 1 from private.applicants where user_id = v_uid) then
    raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
  end if;
  -- Pengaman sederhana terhadap pendaftaran massal otomatis.
  if (select count(*) from private.applicants where created_at > now() - interval '1 minute') >= 40 then
    raise exception 'BUSY' using errcode = 'P0001';
  end if;
  c := private.clean_profile(p_profile);
  begin
    insert into private.applicants (
      user_id, email, lang, level, full_name, gender, birth_place, birth_date, nisn,
      province, regency, district, address, origin_school, origin_class,
      parent_name, parent_relation, parent_phone, parent_email, parent_job,
      income_band, siblings, achievements, motivation)
    values (
      v_uid, v_email, case when p_lang = 'en' then 'en' else 'id' end,
      c->>'level', c->>'full_name', c->>'gender', c->>'birth_place', (c->>'birth_date')::date, c->>'nisn',
      c->>'province', c->>'regency', c->>'district', c->>'address', c->>'origin_school', c->>'origin_class',
      c->>'parent_name', c->>'parent_relation', c->>'parent_phone', c->>'parent_email', c->>'parent_job',
      c->>'income_band', (c->>'siblings')::int, c->>'achievements', c->>'motivation');
  exception when unique_violation then
    -- user_id sudah ada (balapan dua tab) atau anak yang sama sudah didaftarkan akun lain
    if exists (select 1 from private.applicants where user_id = v_uid) then
      raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
    end if;
    raise exception 'DUPLICATE' using errcode = 'P0001';
  end;
  return json_build_object('ok', true);
end $$;

-- Profil + status. Hasil (status) hanya setelah pengumuman dibuka; begitu juga
-- pesan per status.
create or replace function public.me() returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  a private.applicants;
  s private.settings;
begin
  select * into a from private.applicants where user_id = private.uid();
  select * into s from private.settings where id = 1;
  return json_build_object(
    'applicant', case when a.id is null then null else private.applicant_json(a) end,
    'canEdit', private.registration_open(),
    'released', private.released(),
    'announceAt', s.announce_at,
    'regDeadline', s.reg_deadline,
    'now', now(),
    'title', case when private.released() then s.announce_title end,
    'body', case when private.released() then s.announce_body end,
    'resultMessage', case when private.released() and a.id is not null then s.result_messages -> a.status end,
    'document', case when a.id is null then null else private.document_info(a.user_id) end);
end $$;

create or replace function public.update_profile(p_profile jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.uid();
  c jsonb;
begin
  if not exists (select 1 from private.applicants where user_id = v_uid) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.registration_open() then raise exception 'CLOSED' using errcode = 'P0001'; end if;
  c := private.clean_profile(p_profile);
  begin
    update private.applicants set
      level = c->>'level', full_name = c->>'full_name', gender = c->>'gender',
      birth_place = c->>'birth_place', birth_date = (c->>'birth_date')::date, nisn = c->>'nisn',
      province = c->>'province', regency = c->>'regency', district = c->>'district', address = c->>'address',
      origin_school = c->>'origin_school', origin_class = c->>'origin_class',
      parent_name = c->>'parent_name', parent_relation = c->>'parent_relation',
      parent_phone = c->>'parent_phone', parent_email = c->>'parent_email', parent_job = c->>'parent_job',
      income_band = c->>'income_band', siblings = (c->>'siblings')::int,
      achievements = c->>'achievements', motivation = c->>'motivation', updated_at = now()
    where user_id = v_uid;
  exception when unique_violation then
    raise exception 'DUPLICATE' using errcode = 'P0001';
  end;
end $$;

-- -----------------------------------------------------------------------------
-- Fungsi untuk policy Storage (dipanggil sebagai pengguna yang masuk)
-- -----------------------------------------------------------------------------

-- Path berkas milik pengguna yang sedang masuk (null bila belum masuk).
create or replace function public.my_document_path() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
  exception when others then v := null;
  end;
  return case when v is null then null else private.document_path(v) end;
end $$;

-- Boleh mengunggah/mengganti berkas sekarang? (sudah mendaftar + pendaftaran dibuka)
create or replace function public.document_upload_allowed() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  begin
    v := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
  exception when others then v := null;
  end;
  return v is not null and private.registration_open()
     and exists (select 1 from private.applicants where user_id = v);
end $$;

create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik — admin (akun Supabase yang terdaftar di private.admins)
-- -----------------------------------------------------------------------------

create or replace function public.admin_list() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return coalesce((select json_agg(private.applicant_admin_json(a) order by a.created_at) from private.applicants a), '[]'::json);
end $$;

create or replace function public.admin_get_settings() returns json
language plpgsql stable security definer set search_path = '' as $$
declare s private.settings;
begin
  perform private.require_admin();
  select * into s from private.settings where id = 1;
  return json_build_object('regOpen', s.reg_open, 'regDeadline', s.reg_deadline, 'announceAt', s.announce_at,
    'title', s.announce_title, 'body', s.announce_body, 'resultMessages', s.result_messages, 'now', now());
end $$;

create or replace function public.admin_save_settings(
  p_reg_open boolean, p_reg_deadline timestamptz, p_announce_at timestamptz,
  p_title jsonb, p_body jsonb, p_result_messages jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if jsonb_typeof(p_title) <> 'object' or jsonb_typeof(p_body) <> 'object' or jsonb_typeof(p_result_messages) <> 'object' then
    perform private.invalid('settings');
  end if;
  if length(p_title::text) > 1000 or length(p_body::text) > 20000 or length(p_result_messages::text) > 20000 then
    perform private.invalid('settings');
  end if;
  if p_announce_at is not null and p_reg_deadline is not null and p_announce_at < p_reg_deadline then
    perform private.invalid('announce_at');
  end if;
  update private.settings set reg_open = p_reg_open, reg_deadline = p_reg_deadline, announce_at = p_announce_at,
    announce_title = p_title, announce_body = p_body, result_messages = p_result_messages
  where id = 1;
end $$;

create or replace function public.admin_set_status(p_ids uuid[], p_status text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.require_admin();
  if p_status not in ('pending', 'lulus', 'cadangan', 'tidak_lulus') then perform private.invalid('status'); end if;
  update private.applicants set status = p_status where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

-- Berkas di Storage dihapus oleh aplikasi admin lewat Storage API sebelum ini dipanggil.
create or replace function public.admin_delete(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  delete from private.applicants where id = p_id;
end $$;

-- Menetapkan daftar admin dari email akun Supabase yang SUDAH ada dan sudah
-- terkonfirmasi. Hanya untuk `npm run db:admins` (tidak bisa dipanggil browser).
-- Mengembalikan email yang tidak ditemukan.
create or replace function public.set_admins(p_emails text[]) returns text[]
language plpgsql security definer set search_path = '' as $$
declare missing text[];
begin
  select coalesce(array_agg(e), '{}') into missing
    from unnest(p_emails) e
   where not exists (select 1 from auth.users u where lower(u.email) = lower(btrim(e)) and u.email_confirmed_at is not null);
  delete from private.admins;
  insert into private.admins (user_id, email)
    select u.id, lower(u.email) from auth.users u
     where u.email_confirmed_at is not null and lower(u.email) in (select lower(btrim(e)) from unnest(p_emails) e);
  return missing;
end $$;

-- -----------------------------------------------------------------------------
-- Storage: bucket privat `berkas` (PDF, maks 10 MB) + policy
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Schema storage tidak ada (bukan Supabase): bucket dilewati.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('berkas', 'berkas', false, 10485760, array['application/pdf'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "berkas: peserta unggah miliknya" on storage.objects;
  create policy "berkas: peserta unggah miliknya" on storage.objects for insert to authenticated
    with check (bucket_id = 'berkas' and name = public.my_document_path() and public.document_upload_allowed());

  drop policy if exists "berkas: peserta ganti miliknya" on storage.objects;
  create policy "berkas: peserta ganti miliknya" on storage.objects for update to authenticated
    using (bucket_id = 'berkas' and name = public.my_document_path() and public.document_upload_allowed())
    with check (bucket_id = 'berkas' and name = public.my_document_path() and public.document_upload_allowed());

  drop policy if exists "berkas: baca milik sendiri atau admin" on storage.objects;
  create policy "berkas: baca milik sendiri atau admin" on storage.objects for select to authenticated
    using (bucket_id = 'berkas' and (name = public.my_document_path() or public.am_i_admin()));

  drop policy if exists "berkas: hapus oleh pemilik atau admin" on storage.objects;
  create policy "berkas: hapus oleh pemilik atau admin" on storage.objects for delete to authenticated
    using (bucket_id = 'berkas' and ((name = public.my_document_path() and public.document_upload_allowed()) or public.am_i_admin()));
end $$;

-- -----------------------------------------------------------------------------
-- Hak akses: browser hanya boleh memanggil fungsi publik yang disengaja.
-- Fungsi peserta dan admin hanya untuk pengguna yang sudah masuk (authenticated).
-- -----------------------------------------------------------------------------
-- Versi lama (username + PIN) dibuang.
drop function if exists public.login(text, text);
drop function if exists public.me(text);
drop function if exists public.update_profile(text, jsonb);
drop function if exists public.admin_reset_pin(text, uuid);
drop function if exists private.require_applicant(text);
drop function if exists private.new_username();
drop function if exists private.new_pin();

revoke all on all functions in schema private from public;
revoke all on function public.set_admins(text[]) from public;
revoke all on function
  public.register(jsonb, text), public.me(), public.update_profile(jsonb),
  public.my_document_path(), public.document_upload_allowed(), public.am_i_admin(),
  public.admin_list(), public.admin_get_settings(),
  public.admin_save_settings(boolean, timestamptz, timestamptz, jsonb, jsonb, jsonb),
  public.admin_set_status(uuid[], text), public.admin_delete(uuid)
from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all functions in schema private from %I', r);
      execute format('revoke all on function public.set_admins(text[]) from %I', r);
      execute format('grant execute on function public.get_public_settings() to %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function
      public.register(jsonb, text), public.me(), public.update_profile(jsonb),
      public.my_document_path(), public.document_upload_allowed(), public.am_i_admin(),
      public.admin_list(), public.admin_get_settings(),
      public.admin_save_settings(boolean, timestamptz, timestamptz, jsonb, jsonb, jsonb),
      public.admin_set_status(uuid[], text), public.admin_delete(uuid)
    to authenticated;
  end if;
end $$;
