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
--   * Admin masuk dengan password (hash bcrypt) dan token sesi acak yang
--     disimpan sebagai hash; 10x salah = terkunci 15 menit.
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

  level         text not null check (level in ('sd', 'smp', 'sma')),
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
-- Satu anak = satu pendaftaran.
create unique index if not exists applicants_child_key
  on private.applicants (lower(btrim(full_name)), birth_date);

create table if not exists private.sessions (
  token_hash   text primary key,
  role         text not null check (role in ('admin')),
  expires_at   timestamptz not null
);

create table if not exists private.secrets (
  key  text primary key,
  hash text not null
);

create table if not exists private.login_failures (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists login_failures_key_at on private.login_failures (key, at);

-- RLS aktif di semua tabel, tanpa policy = browser tidak punya akses sama sekali.
alter table private.settings       enable row level security;
alter table private.applicants     enable row level security;
alter table private.sessions       enable row level security;
alter table private.secrets        enable row level security;
alter table private.login_failures enable row level security;
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

create or replace function private.hash_secret(p text) returns text
language sql volatile set search_path = '' as $$
  select extensions.crypt(p, extensions.gen_salt('bf', 8))
$$;

create or replace function private.check_secret(p text, p_hash text) returns boolean
language sql immutable set search_path = '' as $$
  select p_hash is not null and extensions.crypt(coalesce(p, ''), p_hash) = p_hash
$$;

create or replace function private.token_hash(p text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p, ''), 'sha256'), 'hex')
$$;

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
    ('parent_name','120'), ('parent_job','80'), ('motivation','1500')
  ) t(a, b) loop
    if btrim(coalesce(p->>k, '')) = '' or length(btrim(p->>k)) > v::int then
      perform private.invalid(k);
    end if;
    r := r || jsonb_build_object(k, regexp_replace(btrim(p->>k), '[[:cntrl:]]', ' ', 'g'));
  end loop;

  if (p->>'level') is null or (p->>'level') not in ('sd', 'smp', 'sma') then perform private.invalid('level'); end if;
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

  -- Opsional
  v := btrim(coalesce(p->>'nisn', ''));
  if v <> '' and v !~ '^[0-9]{10}$' then perform private.invalid('nisn'); end if;
  r := r || jsonb_build_object('nisn', nullif(v, ''));

  v := btrim(coalesce(p->>'parent_email', ''));
  if v <> '' and (v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v) > 120) then perform private.invalid('parent_email'); end if;
  r := r || jsonb_build_object('parent_email', nullif(v, ''));

  v := btrim(coalesce(p->>'income_band', ''));
  if v <> '' and v not in ('lt1', '1to3', '3to5', 'gt5') then perform private.invalid('income_band'); end if;
  r := r || jsonb_build_object('income_band', nullif(v, ''));

  v := btrim(coalesce(p->>'siblings', ''));
  if v <> '' and (v !~ '^[0-9]{1,2}$' or v::int > 20) then perform private.invalid('siblings'); end if;
  r := r || jsonb_build_object('siblings', nullif(v, '')::int);

  v := btrim(coalesce(p->>'achievements', ''));
  if length(v) > 1000 then perform private.invalid('achievements'); end if;
  r := r || jsonb_build_object('achievements', nullif(v, ''));

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

create or replace function private.require_admin(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.sessions
                  where token_hash = private.token_hash(p_token) and role = 'admin' and expires_at > now()) then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;
end $$;

-- Boleh mendaftar/mengubah data sekarang?
create or replace function private.registration_open() returns boolean
language sql stable set search_path = '' as $$
  select reg_open and (reg_deadline is null or now() < reg_deadline) and not private.released()
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

-- Versi admin: status asli selalu terlihat.
create or replace function private.applicant_admin_json(a private.applicants) returns json
language sql stable set search_path = '' as $$
  select (private.applicant_json(a)::jsonb || jsonb_build_object('status', a.status))::json
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

create or replace function public.logout(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from private.sessions where token_hash = private.token_hash(p_token)
$$;

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
    'resultMessage', case when private.released() and a.id is not null then s.result_messages -> a.status end);
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
-- Fungsi publik — admin
-- -----------------------------------------------------------------------------

create or replace function public.admin_login(p_password text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_hash  text;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if (select count(*) from private.login_failures where key = 'admin' and at > now() - interval '15 minutes') >= 10 then
    return json_build_object('error', 'LOCKED');
  end if;
  select hash into v_hash from private.secrets where key = 'admin_password';
  if v_hash is null then return json_build_object('error', 'ADMIN_NOT_SET'); end if;
  if not private.check_secret(p_password, v_hash) then
    insert into private.login_failures (key) values ('admin');
    return json_build_object('error', 'BAD_LOGIN');
  end if;
  delete from private.sessions where expires_at < now();
  insert into private.sessions (token_hash, role, expires_at)
    values (private.token_hash(v_token), 'admin', now() + interval '8 hours');
  return json_build_object('token', v_token);
end $$;

create or replace function public.admin_list(p_token text) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  return coalesce((select json_agg(private.applicant_admin_json(a) order by a.created_at) from private.applicants a), '[]'::json);
end $$;

create or replace function public.admin_get_settings(p_token text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare s private.settings;
begin
  perform private.require_admin(p_token);
  select * into s from private.settings where id = 1;
  return json_build_object('regOpen', s.reg_open, 'regDeadline', s.reg_deadline, 'announceAt', s.announce_at,
    'title', s.announce_title, 'body', s.announce_body, 'resultMessages', s.result_messages, 'now', now());
end $$;

create or replace function public.admin_save_settings(
  p_token text, p_reg_open boolean, p_reg_deadline timestamptz, p_announce_at timestamptz,
  p_title jsonb, p_body jsonb, p_result_messages jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  if jsonb_typeof(p_title) <> 'object' or jsonb_typeof(p_body) <> 'object' or jsonb_typeof(p_result_messages) <> 'object' then
    perform private.invalid('settings');
  end if;
  if length(p_title::text) > 1000 or length(p_body::text) > 20000 or length(p_result_messages::text) > 20000 then
    perform private.invalid('settings');
  end if;
  update private.settings set reg_open = p_reg_open, reg_deadline = p_reg_deadline, announce_at = p_announce_at,
    announce_title = p_title, announce_body = p_body, result_messages = p_result_messages
  where id = 1;
end $$;

create or replace function public.admin_set_status(p_token text, p_ids uuid[], p_status text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.require_admin(p_token);
  if p_status not in ('pending', 'lulus', 'cadangan', 'tidak_lulus') then perform private.invalid('status'); end if;
  update private.applicants set status = p_status where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_delete(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_token);
  delete from private.applicants where id = p_id;
end $$;

create or replace function public.set_admin_password(p_password text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if length(coalesce(p_password, '')) < 8 then perform private.invalid('password'); end if;
  insert into private.secrets (key, hash) values ('admin_password', private.hash_secret(p_password))
    on conflict (key) do update set hash = excluded.hash;
  delete from private.sessions where role = 'admin';
end $$;

-- -----------------------------------------------------------------------------
-- Hak akses: browser hanya boleh memanggil fungsi publik yang disengaja.
-- Fungsi peserta hanya untuk pengguna yang sudah masuk (role authenticated).
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
revoke all on function public.set_admin_password(text) from public;
revoke all on function public.register(jsonb, text), public.me(), public.update_profile(jsonb) from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all functions in schema private from %I', r);
      execute format('revoke all on function public.set_admin_password(text) from %I', r);
      execute format('revoke all on function public.register(jsonb, text), public.me(), public.update_profile(jsonb) from %I', r);
      execute format('grant execute on function
        public.get_public_settings(), public.logout(text),
        public.admin_login(text), public.admin_list(text), public.admin_get_settings(text),
        public.admin_save_settings(text, boolean, timestamptz, timestamptz, jsonb, jsonb, jsonb),
        public.admin_set_status(text, uuid[], text), public.admin_delete(text, uuid)
        to %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.register(jsonb, text), public.me(), public.update_profile(jsonb) to authenticated;
  end if;
end $$;
