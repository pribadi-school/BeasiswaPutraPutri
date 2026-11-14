export function loadConfig(env = process.env) {
    const production = env.NODE_ENV === 'production';
    const devLogin = env.ALLOW_DEV_LOGIN === '1';
    if (production && devLogin) {
        throw new Error('ALLOW_DEV_LOGIN tidak boleh aktif di produksi (NODE_ENV=production).');
    }
    const need = (k) => {
        const v = env[k]?.trim();
        if (!v)
            throw new Error(`Environment variable ${k} belum diisi.`);
        return v;
    };
    return {
        port: Number(env.PORT ?? 8787),
        production,
        db: {
            host: env.DB_HOST?.trim() || 'localhost',
            port: Number(env.DB_PORT ?? 3306),
            user: need('DB_USER'),
            password: env.DB_PASSWORD ?? '',
            database: need('DB_NAME'),
        },
        googleClientId: env.GOOGLE_CLIENT_ID?.trim() || null,
        devLogin,
        uploadDir: need('UPLOAD_DIR'),
        staticDir: env.STATIC_DIR?.trim() || null,
    };
}
