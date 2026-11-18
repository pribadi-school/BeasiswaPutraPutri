import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, FileText, FileWarning, HelpCircle, Lock, Megaphone, ShieldCheck, Users, School, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useI18n, type TKey } from '../../lib/i18n';
import { formatWib } from '../../lib/time';
import { AppError, emptyProfile } from '../../lib/types';
import { ProfileForm } from '../../components/ProfileForm';
import { clearDraft, draftKeyFor } from '../../lib/draft';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { btnPill, ErrorBox, SectionHeader, useErrorText } from '../../components/ui';
import { buildFlow, SelectionFlow } from '../../components/SelectionFlow';
import { ScholarshipInfo } from '../../components/ScholarshipInfo';
import { useAccount } from './AccountLayout';

function today(lang: 'id' | 'en') {
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

export function DashboardPage() {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const { user, me, reload, expire, notice, setNotice } = useAccount();
  const [formError, setFormError] = useState<string | null>(null);
  const [formField, setFormField] = useState<string | null>(null);
  const a = me.applicant;

  // Sudah masuk, belum mengisi data → sambutan + formulir pendaftaran.
  if (!a) {
    return (
      <div className="space-y-5">
        <WelcomeBanner eyebrow={today(lang)} title={t('dash.welcomeNew')} subtitle={me.canEdit ? t('dash.subNew') : undefined} />
        <ScholarshipInfo openFirst={false} />
        {!me.canEdit ? <ErrorBox>{t('e.CLOSED')}</ErrorBox> : (
          <>
            <div>
              <h2 className="text-xl font-bold">{t('reg.title')}</h2>
              <p className="mt-1 text-muted-foreground">{t('reg.lead')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('acc.oneAccount')}</p>
            </div>
            <ProfileForm
              initial={emptyProfile()} withConsent withDocument stepped draftKey={draftKeyFor(user.email)} submitLabel={t('reg.submit')} busyLabel={t('reg.sending')}
              serverError={formError} serverField={formField}
              onSubmit={async (p, file) => {
                setFormError(null); setFormField(null);
                try {
                  await api.register(p, lang);
                  clearDraft(draftKeyFor(user.email));
                  // Data sudah tersimpan; berkas menyusul. Gagal unggah ≠ gagal daftar.
                  let msg = t('reg.done');
                  if (file) {
                    try { await api.uploadDocument(file); } catch (e) { msg = t('doc.uploadFailed', { reason: errText(e) }); }
                  }
                  await reload();
                  setNotice(msg); window.scrollTo({ top: 0 });
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

  const flow = buildFlow(me, t, lang);
  // Pemberitahuan: hasil tahap terakhir yang sudah diumumkan (atau pengumuman akhir).
  const finalOut = me.released && a.status !== 'pending';
  const lastIdx = me.stages.map((s) => s.released && (s.result === 'lulus' || s.result === 'tidak_lulus')).lastIndexOf(true);
  const last = lastIdx >= 0 ? me.stages[lastIdx] : null;
  const next = last?.result === 'lulus' ? me.stages[lastIdx + 1] ?? null : null;

  const notices: { Icon: typeof Lock; title: string; body: string }[] = [
    me.canEdit
      ? { Icon: CalendarClock, title: t('notice.deadline.t'), body: me.regDeadline ? formatWib(me.regDeadline, lang) : t('notice.deadline.none') }
      : { Icon: Lock, title: t('notice.locked.t'), body: t('notice.locked.d') },
    { Icon: AlertTriangle, title: t('notice.announce.t'), body: me.announceAt ? formatWib(me.announceAt, lang) : t('acc.opensTbd') },
    { Icon: HelpCircle, title: t('notice.help.t'), body: t('notice.help.d') },
    { Icon: ShieldCheck, title: t('notice.privacy.t'), body: t('footer.privacy') },
  ];

  const editLabel = me.canEdit ? t('dash.edit') : t('dash.view');
  const dataCards = [
    { Icon: School, title: t('dash.cardChild'), lines: [a.fullName, `${t(`level.${a.level}` as TKey)} · ${a.originSchool}`], cta: editLabel },
    { Icon: Users, title: t('dash.cardParent'), lines: [a.parentName, '+' + a.parentPhone], cta: editLabel },
    {
      Icon: me.document ? FileText : FileWarning, title: t('doc.title'),
      lines: [me.document ? t('adm.docYes') : t('doc.none'), t('doc.short')],
      cta: !me.canEdit ? t('dash.view') : me.document ? t('doc.cta.replace') : t('doc.cta.upload'),
    },
  ];

  return (
    <div className="space-y-6">
      {notice && <div role="status" className="rounded-sm border border-success bg-success-tint p-3 text-sm font-medium text-foreground">{notice}</div>}
      {!me.document && me.canEdit && (
        <Link to="/akun/data" className="flex items-center gap-3 rounded-sm border border-accent bg-accent-tint p-3 text-sm font-semibold text-foreground">
          <FileWarning size={20} className="shrink-0" aria-hidden /> <span className="flex-1">{t('doc.missing')}</span> <ChevronRight size={18} aria-hidden />
        </Link>
      )}
      <WelcomeBanner eyebrow={today(lang)} title={t('dash.welcome', { name: a.parentName })} subtitle={t('dash.sub', { child: a.fullName })}>
        {me.released && <Link to="/akun/pengumuman" className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface px-5 text-sm font-semibold text-action shadow-e2">{t('res.title')} <ChevronRight size={16} aria-hidden /></Link>}
      </WelcomeBanner>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {(finalOut || last) && (
            <section role="status" className={`flex gap-3 rounded-lg p-4 shadow-e2 ring-2 ${!finalOut && last?.result === 'tidak_lulus' ? 'bg-surface ring-border-strong' : 'bg-success-tint ring-success'}`}>
              {finalOut ? <Megaphone size={24} className="mt-0.5 shrink-0 text-action" aria-hidden />
                : last?.result === 'lulus' ? <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-success" aria-hidden />
                : <XCircle size={24} className="mt-0.5 shrink-0 text-destructive" aria-hidden />}
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="font-bold text-foreground">
                  {finalOut ? t('notif.final')
                    : t(last!.result === 'lulus' ? 'notif.pass' : 'notif.fail', { stage: t(`stage.${last!.key}` as TKey) })}
                </h2>
                {!finalOut && last?.message?.[lang] && <p className="whitespace-pre-line text-sm text-foreground">{last.message[lang]}</p>}
                {!finalOut && next && (
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{t('notif.next', { stage: t(`stage.${next.key}` as TKey) })}</span>
                    {next.info[lang] ? <> — <span className="whitespace-pre-line">{next.info[lang]}</span></> : null}
                  </p>
                )}
                <Link to="/akun/pengumuman" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-action hover:underline">
                  {t('notif.seeAll')} <ChevronRight size={16} aria-hidden />
                </Link>
              </div>
            </section>
          )}

          <section>
            <SectionHeader title={t('flow.title')}
              action={<Link to="/akun/pengumuman" className="inline-flex min-h-11 items-center font-semibold text-action hover:underline">{t('dash.seeAll')}</Link>} />
            <SelectionFlow steps={flow} />
          </section>

          <section>
            <SectionHeader title={t('dash.myData')}
              action={<Link to="/akun/data" className="inline-flex min-h-11 items-center font-semibold text-action hover:underline">{t('dash.seeAll')}</Link>} />
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {dataCards.map(({ Icon, title, lines, cta }, i) => (
                <div key={title} className={`lift flex items-start gap-3 rounded-lg p-4 shadow-e2 ${i === 0 ? 'bg-surface ring-2 ring-action' : 'bg-action-tint'}`}>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-action">{title}</h3>
                    {lines.map((l) => <p key={l} className="truncate text-sm text-foreground">{l}</p>)}
                    <Link to={i === 2 ? '/akun/data#berkas' : '/akun/data'} className={`${btnPill} mt-3`}>{cta}</Link>
                  </div>
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-surface text-action shadow-e1"><Icon size={28} aria-hidden /></span>
                </div>
              ))}
            </div>
          </section>

          <ScholarshipInfo openFirst={false} />
        </div>

        <aside>
          <SectionHeader title={t('dash.notices')} />
          <ul className="space-y-4 rounded-lg bg-surface p-5 shadow-e2">
            {notices.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <Icon size={20} className="mt-0.5 shrink-0 text-action" aria-hidden />
                <div>
                  <h3 className="text-sm font-bold text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
