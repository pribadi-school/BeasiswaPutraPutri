import { AlertCircle, CheckCircle2, Clock, Hourglass, XCircle, type LucideIcon } from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { AppError, type Status } from '../lib/types';

export const inputCls =
  'w-full min-h-12 rounded-md border border-border-strong bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive-tint disabled:bg-surface-muted';

export const btnPrimary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-action px-5 text-base font-semibold text-white hover:bg-action-hover disabled:opacity-60';
export const btnSecondary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-base font-semibold text-action hover:bg-action-tint disabled:opacity-60';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-border bg-surface p-4 sm:p-6 ${className}`}>{children}</section>;
}

export function Field({
  id, label, hint, optional, error, children,
}: { id: string; label: string; hint?: string; optional?: boolean; error?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-foreground">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">({t('common.optional')})</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 flex items-start gap-1 text-sm font-medium text-destructive">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive bg-destructive-tint p-3 text-sm font-medium text-foreground">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-destructive" aria-hidden /> <div>{children}</div>
    </div>
  );
}

export function useErrorText() {
  const { t } = useI18n();
  return useCallback((e: unknown): string => {
    const code = e instanceof AppError ? e.code : 'UNKNOWN';
    return t(`e.${code}` as Parameters<typeof t>[0]) ?? t('e.UNKNOWN');
  }, [t]);
}

const STATUS_STYLE: Record<Status, { Icon: LucideIcon; cls: string }> = {
  pending: { Icon: Hourglass, cls: 'bg-surface-muted text-foreground border-border-strong' },
  lulus: { Icon: CheckCircle2, cls: 'bg-success-tint text-foreground border-success' },
  cadangan: { Icon: Clock, cls: 'bg-accent-tint text-foreground border-accent' },
  tidak_lulus: { Icon: XCircle, cls: 'bg-surface-muted text-foreground border-border-strong' },
};

/** Status = ikon + teks + warna (tidak pernah warna saja). */
export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  const { Icon, cls } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-semibold ${cls}`}>
      <Icon size={16} aria-hidden /> {t(`status.short.${status}` as 'status.short.pending')}
    </span>
  );
}

export { STATUS_STYLE };
