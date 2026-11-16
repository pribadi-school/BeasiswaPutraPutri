/**
 * Server API Beasiswa Putra-Putri Daerah (Express + MySQL).
 *
 * Semua aturan keamanan dijaga DI SINI (browser tidak pernah menyentuh database):
 *  - Peserta masuk dengan Google; token Google diperiksa server (tanda tangan,
 *    audience = GOOGLE_CLIENT_ID, email terverifikasi). Sesi = token acak di cookie
 *    HttpOnly; di database hanya hash-nya.
 *  - Setiap query peserta memakai user_id dari sesi, jadi satu akun hanya bisa
 *    melihat/mengubah datanya sendiri. Tidak ada id peserta yang diterima dari browser.
 *  - Jadwal (saklar aktif, penutupan) dan pengumuman (status baru terlihat setelah
 *    announce_at) diperiksa di server.
 *  - Isian diperiksa dengan aturan yang sama dengan formulir (src/lib/validate.ts),
 *    lalu disimpan dengan query berparameter.
 *  - Berkas PDF disimpan di UPLOAD_DIR (di luar public_html) dan hanya dikirim ke
 *    pemiliknya atau admin.
 *  - Permintaan yang mengubah data wajib membawa header X-Requested-With (penangkal CSRF)
 *    dan cookie SameSite=Lax.
 */
import express from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { cleanProfile, coerceProfile, validateProfile } from '../src/lib/validate.js';
import { STAGE_RESULTS, STAGES } from '../src/lib/types.js';
const MAX_PDF = 10 * 1024 * 1024;
const STATUSES = ['pending', 'lulus', 'cadangan', 'tidak_lulus'];
const COOKIE = { user: 'bpd_user', admin: 'bpd_admin' };
const SESSION_HOURS = { user: 12, admin: 8 };
const CSRF_HEADER = 'beasiswa';
class HttpError extends Error {
    status;
    code;
    field;
    constructor(status, code, field) {
        super(code);
        this.status = status;
        this.code = code;
        this.field = field;
    }
}
/** Kolom hasil per tahap (nama kolom tetap — tidak pernah dari input). */
const STAGE_COLUMN = { admin: 'res_admin', test: 'res_test', interview: 'res_interview' };
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const iso = (d) => (d ? d.toISOString() : null);
const parseJson = (s, fallback) => {
    if (typeof s !== 'string')
        return s ?? fallback;
    try {
        return JSON.parse(s);
    }
    catch {
        return fallback;
    }
};
function readCookies(req) {
    const out = {};
    for (const part of (req.headers.cookie ?? '').split(';')) {
        const i = part.indexOf('=');
        if (i > 0)
            out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
}
export function createApp({ pool, cfg, verifyGoogle }) {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 'loopback'); // di cPanel, Passenger meneruskan dari localhost
    const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
    const verify = verifyGoogle ?? (async (credential) => {
        if (!cfg.googleClientId)
            throw new HttpError(503, 'GOOGLE_NOT_CONFIGURED');
        const { payload } = await jwtVerify(credential, jwks, {
            issuer: ['https://accounts.google.com', 'accounts.google.com'],
            audience: cfg.googleClientId,
        });
        if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) {
            throw new HttpError(401, 'BAD_LOGIN');
        }
        return { sub: payload.sub, email: payload.email.toLowerCase(), name: typeof payload.name === 'string' ? payload.name : null };
    });
    // ---- Header keamanan -------------------------------------------------------
    app.use((_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        if (cfg.production)
            res.setHeader('Strict-Transport-Security', 'max-age=15552000');
        res.setHeader('Content-Security-Policy', [
            "default-src 'self'",
            "script-src 'self' https://accounts.google.com/gsi/client",
            "frame-src https://accounts.google.com/gsi/",
            "connect-src 'self' https://accounts.google.com/gsi/",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "object-src 'none'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
        ].join('; '));
        next();
    });
    // ---- Penangkal CSRF: perubahan data wajib membawa header khusus ------------
    app.use('/api', (req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-requested-with') !== CSRF_HEADER) {
            return next(new HttpError(403, 'CSRF'));
        }
        res_noStore(_res);
        next();
    });
    function res_noStore(res) { res.setHeader('Cache-Control', 'no-store'); }
    const json = express.json({ limit: '100kb' });
    const h = (fn) => (req, res, next) => { fn(req, res).catch(next); };
    // ---- Sesi -----------------------------------------------------------------
    function setCookie(res, name, value, clear = false) {
        const parts = [`${name}=${clear ? '' : encodeURIComponent(value)}`, 'Path=/api', 'HttpOnly', 'SameSite=Lax'];
        if (cfg.production)
            parts.push('Secure');
        if (clear)
            parts.push('Max-Age=0');
        res.append('Set-Cookie', parts.join('; '));
    }
    async function startSession(res, kind, subjectId) {
        const token = randomBytes(32).toString('hex');
        await pool.execute('DELETE FROM sessions WHERE expires_at < ?', [new Date()]);
        await pool.execute('INSERT INTO sessions (token_hash, kind, subject_id, expires_at) VALUES (?, ?, ?, ?)', [sha256(token), kind, subjectId, new Date(Date.now() + SESSION_HOURS[kind] * 3600_000)]);
        setCookie(res, COOKIE[kind], token);
    }
    async function sessionSubject(req, kind) {
        const token = readCookies(req)[COOKIE[kind]];
        if (!token || !/^[0-9a-f]{64}$/.test(token))
            return null;
        const [rows] = await pool.execute('SELECT subject_id FROM sessions WHERE token_hash = ? AND kind = ? AND expires_at > ?', [sha256(token), kind, new Date()]);
        return rows[0]?.subject_id ?? null;
    }
    async function requireUser(req) {
        const id = await sessionSubject(req, 'user');
        if (!id)
            throw new HttpError(401, 'UNAUTHORIZED');
        return id;
    }
    async function requireAdmin(req) {
        const id = await sessionSubject(req, 'admin');
        if (!id)
            throw new HttpError(401, 'UNAUTHORIZED');
        const [rows] = await pool.execute('SELECT id FROM admins WHERE id = ?', [id]);
        if (!rows[0])
            throw new HttpError(401, 'UNAUTHORIZED'); // admin sudah dihapus
        return id;
    }
    // ---- Pengaturan & jadwal ----------------------------------------------------
    async function loadSettings() {
        const [rows] = await pool.execute('SELECT * FROM settings WHERE id = 1');
        const r = rows[0];
        return {
            regOpen: !!r.reg_open,
            regDeadline: r.reg_deadline ?? null,
            announceAt: r.announce_at ?? null,
            title: parseJson(r.announce_title, { id: '', en: '' }),
            body: parseJson(r.announce_body, { id: '', en: '' }),
            resultMessages: parseJson(r.result_messages, {}),
            stages: parseStages(r.stages),
        };
    }
    function parseStages(raw) {
        const src = parseJson(raw, {});
        const loc = (v) => {
            const o = (v && typeof v === 'object' ? v : {});
            return { id: typeof o.id === 'string' ? o.id : '', en: typeof o.en === 'string' ? o.en : '' };
        };
        const out = {};
        for (const k of STAGES) {
            const s = src[k] ?? {};
            const d = typeof s.publishAt === 'string' ? new Date(s.publishAt) : null;
            out[k] = { publishAt: d && !Number.isNaN(d.getTime()) ? d : null, info: loc(s.info), pass: loc(s.pass), fail: loc(s.fail) };
        }
        return out;
    }
    const stagesJson = (st) => Object.fromEntries(STAGES.map((k) => [k, { ...st[k], publishAt: iso(st[k].publishAt) }]));
    const released = (s, now = new Date()) => !!s.announceAt && s.announceAt <= now;
    /** Hasil tahap terlihat peserta hanya setelah waktu umumnya. */
    function stageViews(s, a, now = new Date()) {
        return STAGES.map((key) => {
            const cfg = s.stages[key];
            const rel = !!cfg.publishAt && cfg.publishAt <= now;
            const result = rel && a ? a[STAGE_COLUMN[key]] : null;
            return {
                key, publishAt: iso(cfg.publishAt), released: rel, result, info: cfg.info,
                message: result === 'lulus' ? cfg.pass : result === 'tidak_lulus' ? cfg.fail : null,
            };
        });
    }
    const registrationOpen = (s, now = new Date()) => s.regOpen && (!s.regDeadline || now < s.regDeadline) && !released(s, now);
    // ---- Data pendaftar ---------------------------------------------------------
    function applicantJson(r, showStatus, admin = false) {
        return {
            id: r.id, email: r.email, lang: r.lang,
            createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
            status: showStatus ? r.status : 'pending',
            level: r.level, fullName: r.full_name, gender: r.gender, birthPlace: r.birth_place,
            birthDate: r.birth_date, nisn: r.nisn, province: r.province, regency: r.regency,
            district: r.district, address: r.address, originSchool: r.origin_school, originClass: r.origin_class,
            parentName: r.parent_name, parentRelation: r.parent_relation, parentPhone: r.parent_phone,
            parentEmail: r.parent_email, parentJob: r.parent_job, incomeBand: r.income_band ?? '',
            siblings: r.siblings == null ? '' : String(r.siblings), achievements: r.achievements, motivation: r.motivation,
            ...(admin ? { userId: r.user_id, stages: { admin: r.res_admin, test: r.res_test, interview: r.res_interview } } : {}),
            document: r.doc_size == null ? null : { size: r.doc_size, uploadedAt: iso(r.doc_uploaded_at) },
        };
    }
    const profileValues = (p) => [
        p.level, p.fullName, p.gender, p.birthPlace, p.birthDate, p.nisn, p.province, p.regency, p.district,
        p.address, p.originSchool, p.originClass, p.parentName, p.parentRelation, p.parentPhone, p.parentEmail,
        p.parentJob, p.incomeBand || null, p.siblings === '' ? null : Number(p.siblings), p.achievements, p.motivation,
    ];
    const PROFILE_COLS = ['level', 'full_name', 'gender', 'birth_place', 'birth_date', 'nisn', 'province', 'regency',
        'district', 'address', 'origin_school', 'origin_class', 'parent_name', 'parent_relation', 'parent_phone',
        'parent_email', 'parent_job', 'income_band', 'siblings', 'achievements', 'motivation'];
    function checkedProfile(raw) {
        const p = coerceProfile(raw);
        const bad = validateProfile(p);
        if (bad.length)
            throw new HttpError(400, 'INVALID', bad[0]);
        return cleanProfile(p);
    }
    function duplicate(e) {
        const err = e;
        if (err.code !== 'ER_DUP_ENTRY')
            return null;
        return /applicants_user/.test(err.message ?? '') ? new HttpError(409, 'ALREADY_REGISTERED') : new HttpError(409, 'DUPLICATE');
    }
    async function applicantOf(userId) {
        const [rows] = await pool.execute('SELECT * FROM applicants WHERE user_id = ?', [userId]);
        return rows[0] ?? null;
    }
    const pdfPath = (applicantId) => join(cfg.uploadDir, `${applicantId}.pdf`);
    async function sendPdf(res, applicantId, filename) {
        const path = pdfPath(applicantId);
        try {
            await stat(path);
        }
        catch {
            throw new HttpError(404, 'NOT_FOUND');
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/[^\w.-]+/g, '_')}"`);
        res.setHeader('Cache-Control', 'private, no-store');
        await new Promise((resolve, reject) => {
            createReadStream(path).on('error', reject).on('end', resolve).pipe(res);
        });
    }
    // =============================================================================
    // Publik
    // =============================================================================
    app.get('/api/settings', h(async (_req, res) => {
        const s = await loadSettings();
        const rel = released(s);
        res.json({
            now: new Date().toISOString(), regOpen: registrationOpen(s), regDeadline: iso(s.regDeadline),
            announceAt: iso(s.announceAt), released: rel, title: rel ? s.title : null, body: rel ? s.body : null,
        });
    }));
    app.get('/api/auth/config', (_req, res) => {
        res.json({ googleClientId: cfg.googleClientId, devLogin: cfg.devLogin });
    });
    // =============================================================================
    // Masuk / keluar peserta (Google)
    // =============================================================================
    async function loginUser(res, g) {
        const [rows] = await pool.execute('SELECT id FROM users WHERE google_sub = ?', [g.sub]);
        let id = rows[0]?.id;
        if (id) {
            await pool.execute('UPDATE users SET email = ?, name = ? WHERE id = ?', [g.email, g.name, id]);
        }
        else {
            id = randomUUID();
            await pool.execute('INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)', [id, g.sub, g.email, g.name, new Date()]);
        }
        await startSession(res, 'user', id);
        res.json({ email: g.email, name: g.name });
    }
    app.post('/api/auth/google', json, h(async (req, res) => {
        const credential = req.body?.credential;
        if (typeof credential !== 'string' || credential.length > 5000)
            throw new HttpError(400, 'BAD_LOGIN');
        let g;
        try {
            g = await verify(credential);
        }
        catch (e) {
            if (e instanceof HttpError)
                throw e;
            throw new HttpError(401, 'BAD_LOGIN');
        }
        await loginUser(res, g);
    }));
    // Hanya untuk uji di komputer (ALLOW_DEV_LOGIN=1, bukan produksi).
    app.post('/api/auth/dev', json, h(async (req, res) => {
        if (!cfg.devLogin)
            throw new HttpError(404, 'NOT_FOUND');
        const email = String(req.body?.email ?? '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
            throw new HttpError(400, 'INVALID', 'email');
        await loginUser(res, { sub: `dev:${email}`, email, name: null });
    }));
    app.get('/api/auth/me', h(async (req, res) => {
        const id = await sessionSubject(req, 'user');
        if (!id)
            return res.json(null);
        const [rows] = await pool.execute('SELECT email, name FROM users WHERE id = ?', [id]);
        res.json(rows[0] ? { email: rows[0].email, name: rows[0].name } : null);
    }));
    app.post('/api/auth/logout', h(async (req, res) => {
        const c = readCookies(req);
        for (const kind of ['user', 'admin']) {
            const token = c[COOKIE[kind]];
            if (token)
                await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
            setCookie(res, COOKIE[kind], '', true);
        }
        res.json({ ok: true });
    }));
    // =============================================================================
    // Peserta
    // =============================================================================
    app.get('/api/me', h(async (req, res) => {
        const userId = await requireUser(req);
        const [a, s] = await Promise.all([applicantOf(userId), loadSettings()]);
        const rel = released(s);
        res.json({
            applicant: a ? applicantJson(a, rel) : null,
            canEdit: registrationOpen(s), released: rel,
            announceAt: iso(s.announceAt), regDeadline: iso(s.regDeadline), now: new Date().toISOString(),
            title: rel ? s.title : null, body: rel ? s.body : null,
            resultMessage: rel && a ? s.resultMessages[a.status] ?? null : null,
            document: a && a.doc_size != null ? { size: a.doc_size, uploadedAt: iso(a.doc_uploaded_at) } : null,
            stages: stageViews(s, a),
        });
    }));
    app.post('/api/me/register', json, h(async (req, res) => {
        const userId = await requireUser(req);
        if (!registrationOpen(await loadSettings()))
            throw new HttpError(403, 'CLOSED');
        if (await applicantOf(userId))
            throw new HttpError(409, 'ALREADY_REGISTERED');
        // Pengaman sederhana terhadap pendaftaran massal otomatis.
        const [cnt] = await pool.execute('SELECT COUNT(*) AS n FROM applicants WHERE created_at > ?', [new Date(Date.now() - 60_000)]);
        if (Number(cnt[0].n) >= 40)
            throw new HttpError(429, 'BUSY');
        const p = checkedProfile(req.body?.profile);
        const lang = req.body?.lang === 'en' ? 'en' : 'id';
        const [u] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
        const now = new Date();
        try {
            await pool.execute(`INSERT INTO applicants (id, user_id, email, lang, created_at, updated_at, consent_at, ${PROFILE_COLS.join(', ')})
         VALUES (?, ?, ?, ?, ?, ?, ?, ${PROFILE_COLS.map(() => '?').join(', ')})`, [randomUUID(), userId, u[0].email, lang, now, now, now, ...profileValues(p)]);
        }
        catch (e) {
            throw duplicate(e) ?? e;
        }
        res.json({ ok: true });
    }));
    app.put('/api/me/profile', json, h(async (req, res) => {
        const userId = await requireUser(req);
        if (!(await applicantOf(userId)))
            throw new HttpError(404, 'NOT_FOUND');
        if (!registrationOpen(await loadSettings()))
            throw new HttpError(403, 'CLOSED');
        const p = checkedProfile(req.body?.profile);
        try {
            await pool.execute(`UPDATE applicants SET ${PROFILE_COLS.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE user_id = ?`, [...profileValues(p), new Date(), userId]);
        }
        catch (e) {
            throw duplicate(e) ?? e;
        }
        res.json({ ok: true });
    }));
    app.put('/api/me/document', express.raw({ type: () => true, limit: MAX_PDF }), h(async (req, res) => {
        const userId = await requireUser(req);
        const a = await applicantOf(userId);
        if (!a || !registrationOpen(await loadSettings()))
            throw new HttpError(403, 'CLOSED');
        const buf = req.body;
        if (!Buffer.isBuffer(buf) || buf.length === 0)
            throw new HttpError(400, 'NOT_PDF');
        if (buf.length > MAX_PDF)
            throw new HttpError(413, 'TOO_LARGE');
        // Isi harus benar-benar PDF (diawali "%PDF-"), bukan sekadar nama/jenis file.
        if (buf.subarray(0, 5).toString('latin1') !== '%PDF-')
            throw new HttpError(400, 'NOT_PDF');
        await mkdir(cfg.uploadDir, { recursive: true, mode: 0o700 });
        const tmp = join(cfg.uploadDir, `.${a.id}.${randomBytes(6).toString('hex')}.tmp`);
        await writeFile(tmp, buf, { mode: 0o600 });
        await rename(tmp, pdfPath(a.id)); // ganti berkas lama sekaligus (atomik)
        await pool.execute('UPDATE applicants SET doc_size = ?, doc_uploaded_at = ? WHERE id = ?', [buf.length, new Date(), a.id]);
        res.json({ ok: true });
    }));
    app.get('/api/me/document', h(async (req, res) => {
        const a = await applicantOf(await requireUser(req));
        if (!a || a.doc_size == null)
            throw new HttpError(404, 'NOT_FOUND');
        await sendPdf(res, a.id, 'berkas-kelengkapan.pdf');
    }));
    // =============================================================================
    // Admin (panitia)
    // =============================================================================
    async function failures(k) {
        const [rows] = await pool.execute('SELECT COUNT(*) AS n FROM login_failures WHERE k = ? AND at > ?', [k, new Date(Date.now() - 15 * 60_000)]);
        return Number(rows[0].n);
    }
    // Hash palsu agar waktu respons sama untuk email yang tidak terdaftar.
    const DUMMY_HASH = bcrypt.hashSync('tidak-dipakai', 10);
    app.post('/api/admin/login', json, h(async (req, res) => {
        const email = String(req.body?.email ?? '').trim().toLowerCase().slice(0, 255);
        const password = String(req.body?.password ?? '').slice(0, 200);
        const kEmail = `a:${email}`;
        const kIp = `ip:${req.ip}`;
        await pool.execute('DELETE FROM login_failures WHERE at < ?', [new Date(Date.now() - 86_400_000)]);
        if ((await failures(kEmail)) >= 10 || (await failures(kIp)) >= 50)
            throw new HttpError(429, 'LOCKED');
        const [rows] = await pool.execute('SELECT id, password_hash FROM admins WHERE email = ?', [email]);
        const ok = await bcrypt.compare(password, rows[0]?.password_hash ?? DUMMY_HASH);
        if (!rows[0] || !ok) {
            await pool.execute('INSERT INTO login_failures (k, at) VALUES (?, ?), (?, ?)', [kEmail, new Date(), kIp, new Date()]);
            throw new HttpError(401, 'BAD_LOGIN');
        }
        await pool.execute('DELETE FROM login_failures WHERE k = ?', [kEmail]);
        await startSession(res, 'admin', rows[0].id);
        res.json({ ok: true });
    }));
    app.get('/api/admin/session', h(async (req, res) => {
        res.json({ admin: !!(await sessionSubject(req, 'admin')) });
    }));
    app.get('/api/admin/applicants', h(async (req, res) => {
        await requireAdmin(req);
        const [rows] = await pool.execute('SELECT * FROM applicants ORDER BY created_at');
        res.json(rows.map((r) => applicantJson(r, true, true)));
    }));
    app.get('/api/admin/settings', h(async (req, res) => {
        await requireAdmin(req);
        const s = await loadSettings();
        res.json({
            regOpen: s.regOpen, regDeadline: iso(s.regDeadline), announceAt: iso(s.announceAt),
            title: s.title, body: s.body, resultMessages: s.resultMessages, stages: stagesJson(s.stages),
            now: new Date().toISOString(),
        });
    }));
    app.put('/api/admin/settings', json, h(async (req, res) => {
        await requireAdmin(req);
        const b = req.body ?? {};
        const date = (v, field) => {
            if (v == null || v === '')
                return null;
            const d = typeof v === 'string' ? new Date(v) : null;
            if (!d || Number.isNaN(d.getTime()))
                throw new HttpError(400, 'INVALID', field);
            return d;
        };
        const loc = (v, max) => {
            const o = (v && typeof v === 'object' ? v : {});
            const id = typeof o.id === 'string' ? o.id : '';
            const en = typeof o.en === 'string' ? o.en : '';
            if (id.length > max || en.length > max)
                throw new HttpError(400, 'INVALID', 'settings');
            return { id, en };
        };
        const regDeadline = date(b.regDeadline, 'reg_deadline');
        const announceAt = date(b.announceAt, 'announce_at');
        if (announceAt && regDeadline && announceAt < regDeadline)
            throw new HttpError(400, 'INVALID', 'announce_at');
        const messages = {};
        for (const st of ['lulus', 'cadangan', 'tidak_lulus']) {
            if (b.resultMessages?.[st])
                messages[st] = loc(b.resultMessages[st], 5000);
        }
        // Tahap: waktu umum harus urut (Administrasi ≤ Tes ≤ Interview ≤ Pengumuman).
        const stages = {};
        const order = [];
        for (const k of STAGES) {
            const s = (b.stages?.[k] ?? {});
            const publishAt = date(s.publishAt, `stage_${k}`);
            if (publishAt) {
                if (order.some((d) => d > publishAt))
                    throw new HttpError(400, 'INVALID', 'stage_order');
                order.push(publishAt);
            }
            stages[k] = { publishAt: iso(publishAt), info: loc(s.info, 2000), pass: loc(s.pass, 5000), fail: loc(s.fail, 5000) };
        }
        if (announceAt && order.some((d) => d > announceAt))
            throw new HttpError(400, 'INVALID', 'stage_order');
        await pool.execute(`UPDATE settings SET reg_open = ?, reg_deadline = ?, announce_at = ?, announce_title = ?, announce_body = ?,
       result_messages = ?, stages = ? WHERE id = 1`, [b.regOpen ? 1 : 0, regDeadline, announceAt, JSON.stringify(loc(b.title, 300)),
            JSON.stringify(loc(b.body, 10000)), JSON.stringify(messages), JSON.stringify(stages)]);
        res.json({ ok: true });
    }));
    /** Menetapkan hasil: tahap tertentu (stage = admin|test|interview) atau hasil akhir (tanpa stage). */
    app.post('/api/admin/status', json, h(async (req, res) => {
        await requireAdmin(req);
        const ids = req.body?.ids;
        const status = req.body?.status;
        const stage = req.body?.stage;
        if (stage !== undefined && !STAGES.includes(stage))
            throw new HttpError(400, 'INVALID', 'stage');
        const allowed = stage ? STAGE_RESULTS : STATUSES;
        if (!allowed.includes(status))
            throw new HttpError(400, 'INVALID', 'status');
        if (!Array.isArray(ids) || ids.length > 2000 || !ids.every((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x))) {
            throw new HttpError(400, 'INVALID', 'ids');
        }
        if (ids.length === 0)
            return res.json({ updated: 0 });
        const column = stage ? STAGE_COLUMN[stage] : 'status';
        const [r] = await pool.query(`UPDATE applicants SET ${column} = ? WHERE id IN (?)`, [status, ids]);
        res.json({ updated: r.affectedRows });
    }));
    app.get('/api/admin/applicants/:id/document', h(async (req, res) => {
        await requireAdmin(req);
        const [rows] = await pool.execute('SELECT id, full_name, doc_size FROM applicants WHERE id = ?', [String(req.params.id)]);
        if (!rows[0] || rows[0].doc_size == null)
            throw new HttpError(404, 'NOT_FOUND');
        await sendPdf(res, rows[0].id, `berkas-${rows[0].full_name}.pdf`);
    }));
    app.delete('/api/admin/applicants/:id', h(async (req, res) => {
        await requireAdmin(req);
        const id = String(req.params.id);
        const [rows] = await pool.execute('SELECT id FROM applicants WHERE id = ?', [id]);
        if (!rows[0])
            throw new HttpError(404, 'NOT_FOUND');
        await rm(pdfPath(id), { force: true });
        await pool.execute('DELETE FROM applicants WHERE id = ?', [id]);
        res.json({ ok: true });
    }));
    app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND')));
    // ---- Tampilan (hasil build dist/), untuk semua alamat selain /api ----------
    if (cfg.staticDir) {
        const dir = cfg.staticDir;
        app.use(express.static(dir, {
            index: false,
            setHeaders: (res, path) => {
                res.setHeader('Cache-Control', /\/assets\//.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache');
            },
        }));
        app.get(/^(?!\/api\/).*/, (_req, res) => {
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(join(dir, 'index.html'));
        });
    }
    // ---- Kesalahan --------------------------------------------------------------
    app.use((err, _req, res, _next) => {
        void _next;
        if (err instanceof HttpError)
            return res.status(err.status).json({ error: err.code, field: err.field });
        const e = err;
        if (e.type === 'entity.too.large')
            return res.status(413).json({ error: 'TOO_LARGE' });
        if (e.type === 'entity.parse.failed')
            return res.status(400).json({ error: 'INVALID' });
        console.error(err);
        res.status(500).json({ error: 'UNKNOWN' });
    });
    return app;
}
