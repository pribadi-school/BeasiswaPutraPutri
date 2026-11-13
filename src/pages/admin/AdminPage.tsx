import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Outlet, useNavigate, useOutletContext } from 'react-router';
import { Settings, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { AppShell } from '../../components/AppShell';
import { btnPrimary, ErrorBox, Field, inputCls, useErrorText } from '../../components/ui';

export type AdminCtx = { onExpired: () => void };
export const useAdmin = () => useOutletContext<AdminCtx>();

export function AdminPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const errText = useErrorText();
  // undefined = sedang memeriksa sesi; false = belum masuk sebagai panitia.
  const [ok, setOk] = useState<boolean | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.isAdmin().then(setOk).catch(() => setOk(false)); }, []);

  const logout = useCallback(() => { void api.signOut(); setOk(false); setPw(''); }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.adminSignIn(email, pw);
      setOk(true); setPw('');
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }

  if (ok === undefined) return <main id="main" className="flex min-h-dvh items-center justify-center p-4 text-muted-foreground">{t('common.loading')}</main>;

  if (!ok) {
    return (
      <main id="main" className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <span className="mx-auto flex size-20 items-center justify-center rounded-lg bg-surface shadow-e2">
              <img src="/pribadi-logo.png" width={288} height={80} decoding="sync" alt={t('app.school')} className="size-14 object-contain" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">{t('adm.title')}</h1>
            {api.mode === 'demo' && <p className="mt-1 text-sm text-muted-foreground">{t('demo.banner')}</p>}
          </div>
          <form onSubmit={login} className="space-y-4 rounded-lg bg-surface p-6 shadow-e2">
            <Field id="adminemail" label={t('adm.email')}>
              <input id="adminemail" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="username" />
            </Field>
            <Field id="adminpw" label={t('adm.password')}>
              <input id="adminpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} autoComplete="current-password" />
            </Field>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="submit" disabled={busy || !pw || !email.trim()} className={`${btnPrimary} w-full`}>{t('adm.login')}</button>
          </form>
        </div>
      </main>
    );
  }

  const nav = [
    { to: '/admin', label: t('nav.applicants'), Icon: Users, end: true },
    { to: '/admin/pengaturan', label: t('nav.settings'), Icon: Settings },
  ];
  return (
    <AppShell nav={nav} userName={t('adm.user')} userSub={t('adm.userSub')} onLogout={() => { logout(); navigate('/admin', { replace: true }); }}>
      <Outlet context={{ onExpired: logout } satisfies AdminCtx} />
    </AppShell>
  );
}
