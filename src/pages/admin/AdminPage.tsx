import { useCallback, useState, type FormEvent } from 'react';
import { Outlet, useNavigate, useOutletContext } from 'react-router';
import { Settings, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { adminToken } from '../../lib/session';
import { AppShell } from '../../components/AppShell';
import { btnPrimary, ErrorBox, Field, inputCls, useErrorText } from '../../components/ui';

export type AdminCtx = { token: string; onExpired: () => void };
export const useAdmin = () => useOutletContext<AdminCtx>();

export function AdminPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const errText = useErrorText();
  const [token, setToken] = useState<string | null>(adminToken.get());
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const logout = useCallback(() => { adminToken.set(null); setToken(null); setPw(''); }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const tk = await api.adminLogin(pw);
      adminToken.set(tk); setToken(tk); setPw('');
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }

  if (!token) {
    return (
      <main id="main" className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <span className="mx-auto flex size-20 items-center justify-center rounded-lg bg-surface shadow-e2">
              <img src="/pribadi-red.png" alt={t('app.school')} className="size-14 object-contain" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">{t('adm.title')}</h1>
            {api.mode === 'demo' && <p className="mt-1 text-sm text-muted-foreground">{t('demo.banner')}</p>}
          </div>
          <form onSubmit={login} className="space-y-4 rounded-lg bg-surface p-6 shadow-e2">
            <Field id="adminpw" label={t('adm.password')}>
              <input id="adminpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} autoComplete="current-password" />
            </Field>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="submit" disabled={busy || !pw} className={`${btnPrimary} w-full`}>{t('adm.login')}</button>
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
      <Outlet context={{ token, onExpired: logout } satisfies AdminCtx} />
    </AppShell>
  );
}
