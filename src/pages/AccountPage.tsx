import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { LogOut, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n, type TKey } from '../lib/i18n';
import { formatDateOnly, formatWib } from '../lib/time';
import { AppError, emptyProfile, type AuthUser, type Me } from '../lib/types';
import { useCountdown } from '../lib/useCountdown';
import { Countdown } from '../components/Countdown';
import { ProfileForm } from '../components/ProfileForm';
import { btnSecondary, Card, ErrorBox, STATUS_STYLE, useErrorText } from '../components/ui';

export function AccountPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const errText = useErrorText();
  const { lang: uiLang } = useI18n();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formField, setFormField] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const expire = useCallback(() => {
    void api.signOut();
    navigate('/masuk', { replace: true, state: { expired: true } });
  }, [navigate]);

  const load = useCallback(async () => {
    try { setMe(await api.me()); setError(null); } catch (e) {
      if (e instanceof AppError && e.code === 'UNAUTHORIZED') expire(); else setError(errText(e));
    }
  }, [expire, errText]);

  useEffect(() => {
    api.getUser().then((u) => { setUser(u); if (u) void load(); }).catch(() => setUser(null));
  }, [load]);

  // Saat waktu pengumuman tiba, ambil ulang (hasil baru dikirim server setelah waktunya).
  const left = useCountdown(me && !me.released ? me.announceAt : null, me?.now, () => { setTimeout(() => void load(), 800); });

  if (user === null) return <Navigate to="/masuk" replace />;
  if (error && !me) return <div className="space-y-3"><ErrorBox>{error}</ErrorBox><button className={btnSecondary} onClick={() => void load()}>{t('common.retry')}</button></div>;
  if (!me) return <p className="text-muted-foreground">{t('common.loading')}</p>;

  const signOut = () => { void api.signOut().then(() => navigate('/', { replace: true })); };
  const accountBar = (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{t('acc.signedIn')}</div>
        <div className="truncate font-semibold text-foreground">{user?.email}</div>
      </div>
      <button type="button" onClick={signOut}
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-border-strong px-3 text-sm font-semibold text-foreground">
        <LogOut size={16} aria-hidden /> {t('nav.logout')}
      </button>
    </div>
  );

  // Sudah masuk, belum mengisi data → formulir pendaftaran.
  if (!me.applicant) {
    return (
      <div className="space-y-4">
        {accountBar}
        {!me.canEdit ? <ErrorBox>{t('e.CLOSED')}</ErrorBox> : (
          <>
            <div>
              <h1 className="text-2xl font-extrabold">{t('reg.title')}</h1>
              <p className="mt-1 text-muted-foreground">{t('reg.lead')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('acc.oneAccount')}</p>
            </div>
            <ProfileForm
              initial={emptyProfile()} withConsent submitLabel={t('reg.submit')} busyLabel={t('reg.sending')}
              serverError={formError} serverField={formField}
              onSubmit={async (p) => {
                setFormError(null); setFormField(null);
                try {
                  await api.register(p, uiLang);
                  await load();
                  setNotice(t('reg.done')); window.scrollTo({ top: 0 });
                } catch (e) {
                  if (e instanceof AppError && e.code === 'UNAUTHORIZED') return expire();
                  setFormError(errText(e));
                  if (e instanceof AppError && e.field) setFormField(e.field);
                }
              }}
            />
          </>
        )}
      </div>
    );
  }

  const a = me.applicant;
  const { Icon, cls } = STATUS_STYLE[a.status];
  const rows: [TKey, string][] = [
    ['f.level', t(`level.${a.level}` as TKey)],
    ['f.fullName', a.fullName],
    ['f.gender', t(`gender.${a.gender}` as TKey)],
    ['f.birthPlace', a.birthPlace],
    ['f.birthDate', formatDateOnly(a.birthDate, lang)],
    ['f.nisn', a.nisn || t('common.none')],
    ['f.province', a.province],
    ['f.regency', a.regency],
    ['f.district', a.district],
    ['f.address', a.address],
    ['f.originSchool', a.originSchool],
    ['f.originClass', a.originClass],
    ['f.parentName', a.parentName],
    ['f.parentRelation', t(`rel.${a.parentRelation}` as TKey)],
    ['f.parentPhone', '+' + a.parentPhone],
    ['f.parentEmail', a.parentEmail || t('common.none')],
    ['f.parentJob', a.parentJob],
    ['f.incomeBand', a.incomeBand ? t(`income.${a.incomeBand}` as TKey) : t('common.none')],
    ['f.siblings', a.siblings || t('common.none')],
    ['f.achievements', a.achievements || t('common.none')],
    ['f.motivation', a.motivation],
  ];

  return (
    <div className="space-y-4">
      {accountBar}
      {notice && <div role="status" className="rounded-md border border-success bg-success-tint p-3 text-sm font-medium text-foreground">{notice}</div>}
      <div>
        <h1 className="text-2xl font-extrabold">{t('acc.hello', { name: a.parentName })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{a.fullName}</p>
      </div>

      <Card className="space-y-3" >
        <h2 className="text-lg font-bold">{me.released ? t('acc.result') : t('acc.status')}</h2>
        {!me.released ? (
          <>
            <p className="text-foreground">{t('acc.received')}</p>
            <p className="text-sm text-muted-foreground">{me.announceAt ? t('acc.opensAt', { date: formatWib(me.announceAt, lang) }) : t('acc.opensTbd')}</p>
            {left !== null && <Countdown ms={left} />}
          </>
        ) : (
          <div className="space-y-3" role="status">
            <div className={`flex items-center gap-2 rounded-md border p-3 text-lg font-bold ${cls}`}>
              <Icon size={24} aria-hidden /> {t(`status.${a.status}` as TKey)}
            </div>
            {me.title && <h3 className="text-base font-bold">{me.title[lang]}</h3>}
            {me.body?.[lang] && <p className="whitespace-pre-line text-foreground">{me.body[lang]}</p>}
            {me.resultMessage?.[lang] && <p className="whitespace-pre-line rounded-md bg-surface-page p-3 text-foreground">{me.resultMessage[lang]}</p>}
          </div>
        )}
      </Card>


      {editing ? (
        <ProfileForm
          initial={a} submitLabel={t('acc.save')} busyLabel={t('acc.saving')} serverError={formError} serverField={formField}
          onCancel={() => { setEditing(false); setFormError(null); setFormField(null); }}
          onSubmit={async (p) => {
            setFormError(null); setFormField(null);
            try {
              await api.updateProfile(p);
              await load();
              setEditing(false); setNotice(t('acc.saved')); window.scrollTo({ top: 0 });
            } catch (e) {
              if (e instanceof AppError && e.code === 'UNAUTHORIZED') return expire();
              setFormError(errText(e));
              if (e instanceof AppError && e.field) setFormField(e.field);
            }
          }}
        />
      ) : (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t('acc.profile')}</h2>
            {me.canEdit && (
              <button type="button" onClick={() => { setNotice(null); setEditing(true); }} className={`${btnSecondary} !min-h-11 !px-3 text-sm`}>
                <Pencil size={16} aria-hidden /> {t('acc.edit')}
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {me.canEdit ? (me.regDeadline ? t('acc.canEditUntil', { date: formatWib(me.regDeadline, lang) }) : t('acc.canEdit')) : t('acc.locked')}
          </p>
          <dl className="divide-y divide-border">
            {rows.map(([k, v]) => (
              <div key={k} className="py-2 sm:grid sm:grid-cols-3 sm:gap-3">
                <dt className="text-sm text-muted-foreground">{t(k)}</dt>
                <dd className="whitespace-pre-line break-words text-foreground sm:col-span-2">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">{t('acc.updated', { date: formatWib(a.updatedAt, lang) })}</p>
        </Card>
      )}
    </div>
  );
}
