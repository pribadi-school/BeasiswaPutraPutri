import { Check, CircleAlert, Clock, Minus, X, type LucideIcon } from 'lucide-react';
import { useI18n, type TKey } from '../lib/i18n';
import { formatWib } from '../lib/time';
import type { Lang, Localized, Me } from '../lib/types';

/**
 * Alur seleksi: Pendaftaran → Seleksi Administrasi → Tes Akademik & Tes IQ →
 * Interview → Pengumuman. Status tiap tahap = ikon + teks + warna (tidak warna saja).
 */
export type FlowState = 'done' | 'pass' | 'fail' | 'reserve' | 'current' | 'upcoming' | 'stopped' | 'warn';
export type FlowStep = {
  key: 'reg' | 'admin' | 'test' | 'interview' | 'final';
  label: string;
  state: FlowState;
  sub: string;
  info?: Localized | null;
  message?: Localized | null;
};

export function buildFlow(me: Me, t: (k: TKey, v?: Record<string, string | number>) => string, lang: Lang): FlowStep[] {
  const steps: FlowStep[] = [{
    key: 'reg', label: t('stage.reg'),
    state: me.document ? 'done' : 'warn', sub: me.document ? t('flow.done') : t('flow.docMissing'),
  }];
  let stopped = false;
  for (const s of me.stages) {
    const label = t(`stage.${s.key}` as TKey);
    if (stopped) { steps.push({ key: s.key, label, state: 'stopped', sub: t('flow.stopped'), info: s.info }); continue; }
    if (s.released && s.result === 'lulus') {
      steps.push({ key: s.key, label, state: 'pass', sub: t('flow.pass'), info: s.info, message: s.message });
    } else if (s.released && s.result === 'tidak_lulus') {
      steps.push({ key: s.key, label, state: 'fail', sub: t('flow.fail'), info: s.info, message: s.message });
      stopped = true;
    } else {
      const sub = s.released ? t('flow.grading') : s.publishAt ? t('flow.on', { date: formatWib(s.publishAt, lang, false) }) : t('flow.waiting');
      steps.push({ key: s.key, label, state: 'upcoming', sub, info: s.info });
    }
  }
  const status = me.applicant?.status ?? 'pending';
  if (stopped) {
    steps.push({ key: 'final', label: t('stage.final'), state: 'stopped', sub: t('flow.stopped') });
  } else if (me.released && status !== 'pending') {
    const map = { lulus: ['pass', 'flow.accepted'], cadangan: ['reserve', 'flow.reserve'], tidak_lulus: ['fail', 'flow.rejected'] } as const;
    const [state, key] = map[status];
    steps.push({ key: 'final', label: t('stage.final'), state, sub: t(key), message: me.resultMessage });
  } else {
    steps.push({
      key: 'final', label: t('stage.final'), state: 'upcoming',
      sub: me.announceAt ? t('flow.on', { date: formatWib(me.announceAt, lang, false) }) : t('flow.waiting'),
    });
  }
  // Tahap pertama yang belum selesai = tahap saat ini.
  const cur = steps.findIndex((s) => s.state === 'upcoming');
  if (cur >= 0) steps[cur].state = 'current';
  return steps;
}

const LOOK: Record<FlowState, { Icon: LucideIcon | null; dot: string; text: string }> = {
  done: { Icon: Check, dot: 'bg-success text-white', text: 'text-foreground' },
  pass: { Icon: Check, dot: 'bg-success text-white', text: 'text-foreground' },
  fail: { Icon: X, dot: 'bg-destructive text-white', text: 'text-destructive' },
  reserve: { Icon: Clock, dot: 'bg-accent text-white', text: 'text-accent-text' },
  warn: { Icon: CircleAlert, dot: 'bg-accent text-white', text: 'text-accent-text' },
  current: { Icon: null, dot: 'bg-action text-white ring-4 ring-action-tint', text: 'text-action' },
  upcoming: { Icon: null, dot: 'bg-surface-muted text-muted-foreground', text: 'text-muted-foreground' },
  stopped: { Icon: Minus, dot: 'bg-surface-muted text-muted-foreground', text: 'text-muted-foreground' },
};

function Dot({ step, n }: { step: FlowStep; n: number }) {
  const { Icon, dot } = LOOK[step.state];
  return (
    <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${dot}`}>
      {Icon ? <Icon size={18} strokeWidth={3} /> : n}
    </span>
  );
}

/** Ringkas (Beranda): mendatar di layar lebar, menurun di HP. */
export function SelectionFlow({ steps }: { steps: FlowStep[] }) {
  const { t } = useI18n();
  return (
    <ol className="grid gap-0 rounded-lg bg-surface p-4 shadow-e2 sm:grid-cols-5 sm:gap-2 sm:p-5">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const doneLine = ['done', 'pass', 'warn'].includes(s.state);
        return (
          <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined}
            className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
            {/* garis penghubung */}
            {!last && (
              <span aria-hidden className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 sm:left-[calc(50%+1.25rem)] sm:top-[17px] sm:h-0.5 sm:w-[calc(100%-1.5rem)] ${doneLine ? 'bg-success' : 'bg-surface-muted'}`} />
            )}
            <Dot step={s} n={i + 1} />
            <div className="min-w-0 pt-1 sm:pt-0">
              <div className={`text-sm font-bold leading-tight ${s.state === 'current' ? 'text-action' : 'text-foreground'}`}>{s.label}</div>
              <div className={`text-xs font-semibold ${LOOK[s.state].text}`}>
                {s.state === 'current' && <span className="sr-only">{t('flow.now')}: </span>}{s.sub}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Rinci (halaman Pengumuman): tiap tahap dengan pesan dan info/jadwal. */
export function SelectionFlowDetail({ steps, lang }: { steps: FlowStep[]; lang: Lang }) {
  const { t } = useI18n();
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.key} className={`flex gap-3 rounded-lg bg-surface p-4 shadow-e2 ${s.state === 'current' ? 'ring-2 ring-action' : ''}`}>
          <Dot step={s} n={i + 1} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="font-bold text-foreground">{s.label}</h3>
              <span className={`text-sm font-semibold ${LOOK[s.state].text}`}>{s.sub}</span>
            </div>
            {s.message?.[lang] && <p className="whitespace-pre-line rounded-sm bg-surface-portal p-3 text-sm text-foreground">{s.message[lang]}</p>}
            {s.info?.[lang] && s.state !== 'stopped' && (
              <p className="whitespace-pre-line text-sm text-muted-foreground"><span className="font-semibold">{t('flow.info')}:</span> {s.info[lang]}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
