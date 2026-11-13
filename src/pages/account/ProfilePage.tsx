import { useState } from 'react';
import { Navigate } from 'react-router';
import { Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { profileGroups } from '../../lib/profileView';
import { formatWib } from '../../lib/time';
import { AppError } from '../../lib/types';
import { ProfileForm } from '../../components/ProfileForm';
import { btnPill, useErrorText } from '../../components/ui';
import { useAccount } from './AccountLayout';

export function ProfilePage() {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const { me, reload, expire } = useAccount();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formField, setFormField] = useState<string | null>(null);
  const a = me.applicant;
  if (!a) return <Navigate to="/akun" replace />;

  const head = (
    <div>
      <h1 className="text-2xl font-extrabold">{t('acc.profile')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {me.canEdit ? (me.regDeadline ? t('acc.canEditUntil', { date: formatWib(me.regDeadline, lang) }) : t('acc.canEdit')) : t('acc.locked')}
      </p>
    </div>
  );

  if (editing) {
    return (
      <div className="space-y-4">
        {head}
        <ProfileForm
          initial={a} submitLabel={t('acc.save')} busyLabel={t('acc.saving')} serverError={formError} serverField={formField}
          onCancel={() => { setEditing(false); setFormError(null); setFormField(null); }}
          onSubmit={async (p) => {
            setFormError(null); setFormField(null);
            try {
              await api.updateProfile(p);
              await reload();
              setEditing(false); setSaved(true); window.scrollTo({ top: 0 });
            } catch (e) {
              if (e instanceof AppError && e.code === 'UNAUTHORIZED') return expire();
              setFormError(errText(e));
              if (e instanceof AppError && e.field) setFormField(e.field);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {head}
        {me.canEdit && <button type="button" onClick={() => { setSaved(false); setEditing(true); }} className={btnPill}><Pencil size={16} aria-hidden /> {t('acc.edit')}</button>}
      </div>
      {saved && <div role="status" className="rounded-sm border border-success bg-success-tint p-3 text-sm font-medium text-foreground">{t('acc.saved')}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {profileGroups(a, t, lang).map((g) => (
          <section key={g.title} className={`rounded-lg bg-surface p-5 shadow-e2 ${g.title === 'sec.extra' ? 'md:col-span-2' : ''}`}>
            <h2 className="mb-2 font-bold text-action">{t(g.title)}</h2>
            <dl className="divide-y divide-border">
              {g.rows.map(([k, v]) => (
                <div key={k} className="py-2">
                  <dt className="text-xs text-muted-foreground">{t(k)}</dt>
                  <dd className="whitespace-pre-line break-words text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t('acc.updated', { date: formatWib(a.updatedAt, lang) })}</p>
    </div>
  );
}
