import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { applicantToken } from '../lib/session';
import { btnPrimary, Card, ErrorBox, Field, inputCls, useErrorText } from '../components/ui';

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const errText = useErrorText();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(location.state?.expired ? t('sess.expired') : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      applicantToken.set(await api.login(username, pin.trim()));
      navigate('/akun', { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">{t('login.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('login.lead')}</p>
      </div>
      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="username" label={t('login.username')}>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} className={`${inputCls} font-mono`}
              autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="bpd-abc234" />
          </Field>
          <Field id="pin" label={t('login.pin')}>
            <input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className={`${inputCls} font-mono tracking-widest`}
              inputMode="numeric" type="password" autoComplete="current-password" placeholder="••••••" />
          </Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button type="submit" disabled={busy || !username.trim() || pin.length !== 6} className={`${btnPrimary} w-full`}>
            {busy ? t('login.entering') : t('login.submit')}
          </button>
        </form>
      </Card>
      <p className="text-sm text-muted-foreground">{t('login.help')}</p>
      <p className="text-sm">{t('login.noAccount')} <Link to="/daftar" className="font-semibold text-action underline">{t('nav.register')}</Link></p>
    </div>
  );
}
