import { useCallback, useState, type FormEvent } from 'react';
import { LogOut } from 'lucide-react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { adminToken } from '../../lib/session';
import { btnPrimary, Card, ErrorBox, Field, inputCls, useErrorText } from '../../components/ui';
import { ApplicantsTab } from './ApplicantsTab';
import { SettingsTab } from './SettingsTab';

export function AdminPage() {
  const { t } = useI18n();
  const errText = useErrorText();
  const [token, setToken] = useState<string | null>(adminToken.get());
  const [tab, setTab] = useState<'list' | 'settings'>('list');
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
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-extrabold">{t('adm.title')}</h1>
        <Card>
          <form onSubmit={login} className="space-y-4">
            <Field id="adminpw" label={t('adm.password')}>
              <input id="adminpw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} autoComplete="current-password" />
            </Field>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="submit" disabled={busy || !pw} className={`${btnPrimary} w-full`}>{t('adm.login')}</button>
          </form>
        </Card>
      </div>
    );
  }

  const tabs = [['list', t('adm.tab.applicants')], ['settings', t('adm.tab.settings')]] as const;
  return (
    <div className="space-y-4 sm:-mx-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('adm.title')}</h1>
        <button onClick={logout} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border-strong px-3 text-sm font-semibold">
          <LogOut size={16} aria-hidden /> {t('adm.logout')}
        </button>
      </div>
      <div role="tablist" className="flex gap-2 border-b border-border">
        {tabs.map(([k, l]) => (
          <button
            key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-11 border-b-2 px-3 font-semibold ${tab === k ? 'border-action text-action' : 'border-transparent text-muted-foreground'}`}
          >{l}</button>
        ))}
      </div>
      {tab === 'list' ? <ApplicantsTab token={token} onExpired={logout} /> : <SettingsTab token={token} onExpired={logout} />}
    </div>
  );
}
