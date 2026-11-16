-- =============================================================================
-- Beasiswa Putra-Putri Daerah — skema MySQL / MariaDB
-- SMP–SMA Pribadi Depok
--
-- Dijalankan otomatis oleh server setiap kali mulai (aman diulang; tidak
-- menghapus data). Cocok untuk MySQL 8 dan MariaDB 10.4+ (cPanel): tidak memakai
-- tipe JSON (disimpan sebagai TEXT), tidak memakai CREATE INDEX IF NOT EXISTS.
--
-- Model keamanan: browser TIDAK pernah terhubung ke database. Semua akses lewat
-- server Node.js (server/), yang memeriksa sesi, kepemilikan data, jadwal, dan
-- isian. Buat user database khusus aplikasi ini dengan hak hanya pada database ini.
-- Semua waktu disimpan dalam UTC.
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings (
  id               TINYINT      NOT NULL PRIMARY KEY,
  reg_open         TINYINT(1)   NOT NULL DEFAULT 1,
  reg_deadline     DATETIME(3)  NULL,      -- sesudah ini tidak bisa daftar/mengubah data
  announce_at      DATETIME(3)  NULL,      -- sebelum ini hasil tidak terlihat peserta
  announce_title   TEXT         NOT NULL,  -- JSON {"id": "...", "en": "..."}
  announce_body    TEXT         NOT NULL,  -- JSON {"id": "...", "en": "..."}
  result_messages  TEXT         NOT NULL,  -- JSON {"lulus": {"id","en"}, "cadangan": …, "tidak_lulus": …}
  schedule_seeded  TINYINT(1)   NOT NULL DEFAULT 0,
  CONSTRAINT settings_single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO settings (id, announce_title, announce_body, result_messages)
VALUES (1, '{"id":"Pengumuman Beasiswa Putra-Putri Daerah","en":"Beasiswa Putra-Putri Daerah Announcement"}', '{"id":"","en":""}', '{}');

-- Nama merek "Beasiswa Putra-Putri Daerah" dipakai juga di versi Inggris. Judul bawaan
-- lama diganti hanya bila belum diubah panitia.
UPDATE settings SET announce_title = '{"id":"Pengumuman Beasiswa Putra-Putri Daerah","en":"Beasiswa Putra-Putri Daerah Announcement"}'
 WHERE id = 1 AND announce_title = '{"id":"Pengumuman Beasiswa Putra-Putri Daerah","en":"Regional Scholarship Announcement"}';

-- Penutupan awal (sekali saja; sesudahnya diatur panitia di Admin → Pengaturan):
-- 26 Des 2026 23.59 WIB = 16.59 UTC.
UPDATE settings SET reg_deadline = '2026-12-26 16:59:00.000', schedule_seeded = 1 WHERE id = 1 AND schedule_seeded = 0;

-- Akun Google peserta (orang tua/wali). Hanya id Google, email, dan nama.
CREATE TABLE IF NOT EXISTS users (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  google_sub  VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  name        VARCHAR(255) NULL,
  created_at  DATETIME(3)  NOT NULL,
  UNIQUE KEY users_google_sub (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pendaftar: satu per akun Google, satu per anak (nama + tanggal lahir).
CREATE TABLE IF NOT EXISTS applicants (
  id              CHAR(36)      NOT NULL PRIMARY KEY,
  user_id         CHAR(36)      NOT NULL,
  email           VARCHAR(255)  NOT NULL,
  status          ENUM('pending','lulus','cadangan','tidak_lulus') NOT NULL DEFAULT 'pending',
  lang            ENUM('id','en') NOT NULL DEFAULT 'id',
  created_at      DATETIME(3)   NOT NULL,
  updated_at      DATETIME(3)   NOT NULL,
  consent_at      DATETIME(3)   NOT NULL,

  level           ENUM('smp','sma') NOT NULL,
  full_name       VARCHAR(120)  NOT NULL,
  full_name_key   VARCHAR(120)  AS (LOWER(TRIM(full_name))) STORED,
  gender          ENUM('L','P') NOT NULL,
  birth_place     VARCHAR(80)   NOT NULL,
  birth_date      DATE          NOT NULL,
  nisn            CHAR(10)      NOT NULL,
  province        VARCHAR(60)   NOT NULL,
  regency         VARCHAR(80)   NOT NULL,
  district        VARCHAR(80)   NOT NULL,
  address         VARCHAR(300)  NOT NULL,
  origin_school   VARCHAR(120)  NOT NULL,
  origin_class    ENUM('6','9') NOT NULL,
  parent_name     VARCHAR(120)  NOT NULL,
  parent_relation ENUM('ayah','ibu','wali') NOT NULL,
  parent_phone    VARCHAR(20)   NOT NULL,
  parent_email    VARCHAR(120)  NOT NULL,
  parent_job      VARCHAR(80)   NOT NULL,
  income_band     ENUM('lt1','1to3','3to5','gt5') NULL,
  siblings        TINYINT UNSIGNED NULL,
  achievements    VARCHAR(1000) NOT NULL,
  motivation      TEXT          NOT NULL,

  -- Berkas PDF kelengkapan (file di UPLOAD_DIR/<id>.pdf, di luar public_html)
  doc_size        INT UNSIGNED  NULL,
  doc_uploaded_at DATETIME(3)   NULL,

  UNIQUE KEY applicants_user (user_id),
  UNIQUE KEY applicants_child (full_name_key, birth_date),
  KEY applicants_created (created_at),
  CONSTRAINT applicants_user_fk FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT applicants_scope CHECK (
    province = 'Jawa Barat'
    AND ((level = 'smp' AND origin_class = '6') OR (level = 'sma' AND origin_class = '9'))
    AND (siblings IS NULL OR siblings <= 20))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Panitia (admin): email + password (bcrypt). Dibuat dengan `npm run admin:set`.
CREATE TABLE IF NOT EXISTS admins (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  UNIQUE KEY admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sesi login (token acak di cookie HttpOnly; yang disimpan hanya hash SHA-256-nya).
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  CHAR(64)              NOT NULL PRIMARY KEY,
  kind        ENUM('user','admin')  NOT NULL,
  subject_id  CHAR(36)              NOT NULL,
  expires_at  DATETIME(3)           NOT NULL,
  KEY sessions_expires (expires_at),
  KEY sessions_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Percobaan login admin yang gagal (pembatasan tebak password).
CREATE TABLE IF NOT EXISTS login_failures (
  k   VARCHAR(255) NOT NULL,
  at  DATETIME(3)  NOT NULL,
  KEY login_failures_k_at (k, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
