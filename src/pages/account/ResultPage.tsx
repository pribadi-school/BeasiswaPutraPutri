import { Navigate } from 'react-router';
import { Hourglass } from 'lucide-react';
import { useI18n, type TKey } from '../../lib/i18n';
import { formatWib } from '../../lib/time';
import { Countdown } from '../../components/Countdown';
import { buildFlow, SelectionFlowDetail } from '../../components/SelectionFlow';
import { SectionHeader, STATUS_STYLE } from '../../components/ui';
import { useAccount } from './AccountLayout';

/** Hasil setiap tahap seleksi + pengumuman akhir. */
export function ResultPage() {
  const { t, lang } = useI18n();
  const { me, left } = useAccount();
  const a = me.applicant;
  if (!a) return <Navigate to="/akun" replace />;

  const flow = buildFlow(me, t, lang);
  const stopped = flow.some((s) => s.state === 'fail' && s.key !== 'final');
  const { Icon, cls } = STATUS_STYLE[a.status];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{me.released ? t('res.title') : t('nav.result')}</h1>

      {me.released && a.status !== 'pending' && (
        <section role="status" className="space-y-4 rounded-lg bg-surface p-6 shadow-e2">
          <div className={`flex items-center gap-3 rounded-md border-2 p-4 text-xl font-extrabold ${cls}`}>
            <Icon size={32} aria-hidden /> {t(`status.${a.status}` as TKey)}
          </div>
          <p className="text-sm text-muted-foreground">{a.fullName} · {t(`level.${a.level}` as TKey)}</p>
          {me.title?.[lang] && <h2 className="text-lg font-bold">{me.title[lang]}</h2>}
          {me.body?.[lang] && <p className="whitespace-pre-line text-foreground">{me.body[lang]}</p>}
          {me.resultMessage?.[lang] && <p className="whitespace-pre-line rounded-md bg-surface-portal p-4 text-foreground">{me.resultMessage[lang]}</p>}
        </section>
      )}

      <section>
        <SectionHeader title={t('flow.title')} />
        <SelectionFlowDetail steps={flow} lang={lang} />
      </section>

      {!me.released && !stopped && (
        <section className="space-y-3 rounded-lg bg-surface p-6 text-center shadow-e2">
          <span className="mx-auto flex size-14 items-center justify-center rounded-md bg-action-tint text-action"><Hourglass size={28} aria-hidden /></span>
          <h2 className="text-lg font-bold">{t('res.waitTitle')}</h2>
          <p className="text-sm text-muted-foreground">{me.announceAt ? t('acc.opensAt', { date: formatWib(me.announceAt, lang) }) : t('acc.opensTbd')}</p>
          {left !== null && <div className="mx-auto max-w-sm"><Countdown ms={left} /></div>}
        </section>
      )}
    </div>
  );
}
