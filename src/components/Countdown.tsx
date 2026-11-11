import { useI18n } from '../lib/i18n';
import { splitRemaining } from '../lib/time';

export function Countdown({ ms }: { ms: number }) {
  const { t } = useI18n();
  const r = splitRemaining(ms);
  const items: [number, string][] = [[r.d, t('acc.cd.d')], [r.h, t('acc.cd.h')], [r.m, t('acc.cd.m')], [r.s, t('acc.cd.s')]];
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {items.map(([n, l]) => (
        <div key={l} className="rounded-md border border-border bg-surface-page py-2">
          <div className="text-2xl font-extrabold tabular-nums text-foreground">{String(n).padStart(2, '0')}</div>
          <div className="text-xs text-muted-foreground">{l}</div>
        </div>
      ))}
    </div>
  );
}
