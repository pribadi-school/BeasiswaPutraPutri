import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { applicantsCsv, downloadCsv } from '../../lib/csv';
import { useI18n, type TKey } from '../../lib/i18n';
import { formatDateOnly, formatWib } from '../../lib/time';
import { AppError, STATUSES, type Applicant, type Level, type Status } from '../../lib/types';
import { btnPrimary, btnSecondary, Card, ErrorBox, inputCls, StatCard, STATUS_STYLE, StatusBadge, useErrorText } from '../../components/ui';
import { WelcomeBanner } from '../../components/WelcomeBanner';
import { useAdmin } from './AdminPage';
import { classLabel } from '../../lib/profileView';

export function ApplicantsTab() {
  const { token, onExpired } = useAdmin();
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const [list, setList] = useState<Applicant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [status, setStatus] = useState<Status | ''>('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [bulk, setBulk] = useState<Status | ''>('');
  const [notice, setNotice] = useState<string | null>(null);

  const fail = useCallback((e: unknown) => {
    if (e instanceof AppError && e.code === 'UNAUTHORIZED') onExpired(); else setError(errText(e));
  }, [onExpired, errText]);

  const load = useCallback(async () => {
    try { setList(await api.adminList(token)); setError(null); } catch (e) { fail(e); }
  }, [token, fail]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list ?? []).filter((a) =>
      (!level || a.level === level) && (!status || a.status === status) &&
      (!needle || [a.fullName, a.email, a.originSchool, a.province, a.regency, a.parentName].join(' ').toLowerCase().includes(needle)));
  }, [list, q, level, status]);

  const banner = <WelcomeBanner eyebrow={formatWib(new Date().toISOString(), lang, false)} title={t('adm.welcome')} subtitle={t('adm.sub')} />;
  if (error && !list) return <div className="space-y-5">{banner}<ErrorBox>{error}</ErrorBox></div>;
  if (!list) return <div className="space-y-5">{banner}<p className="text-muted-foreground">{t('common.loading')}</p></div>;

  const allSelected = shown.length > 0 && shown.every((a) => sel.has(a.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(shown.map((a) => a.id)));

  async function applyBulk() {
    if (!bulk || !sel.size) return;
    try {
      const n = await api.adminSetStatus(token, [...sel], bulk);
      setNotice(t('adm.applied', { n })); setSel(new Set()); setBulk(''); await load();
    } catch (e) { fail(e); }
  }

  return (
    <div className="space-y-4">
      {banner}
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-5">
        <StatCard Icon={Users} value={list.length} label={t('adm.stat.total')} highlight />
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(status === s ? '' : s)} aria-pressed={status === s} className="rounded-lg text-left sm:text-center">
            <StatCard Icon={STATUS_STYLE[s].Icon} value={list.filter((a) => a.status === s).length} label={t(`status.short.${s}` as TKey)} highlight={status === s} />
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('adm.search')} aria-label={t('adm.search')} className={`${inputCls} sm:col-span-2`} />
        <select value={level} onChange={(e) => setLevel(e.target.value as Level | '')} aria-label={t('adm.level')} className={inputCls}>
          <option value="">{t('adm.level')}: {t('adm.all')}</option>
          {(['smp', 'sma'] as const).map((l) => <option key={l} value={l}>{t(`level.${l}` as TKey)}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status | '')} aria-label={t('adm.status')} className={inputCls}>
          <option value="">{t('adm.status')}: {t('adm.all')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.short.${s}` as TKey)}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={bulk} onChange={(e) => setBulk(e.target.value as Status | '')} aria-label={t('adm.setStatus')} className={`${inputCls} !w-auto`}>
          <option value="">{t('adm.setStatus')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.short.${s}` as TKey)}</option>)}
        </select>
        <button disabled={!bulk || !sel.size} onClick={() => void applyBulk()} className={btnPrimary}>{t('adm.apply')} ({t('adm.selected', { n: sel.size })})</button>
        <button onClick={() => downloadCsv(`pendaftar-beasiswa-${new Date().toISOString().slice(0, 10)}.csv`, applicantsCsv(shown))} className={`${btnSecondary} ml-auto`}>
          <Download size={18} aria-hidden /> {t('adm.export')} ({t('adm.shown', { n: shown.length })})
        </button>
      </div>
      <p className="text-sm text-muted-foreground">{t('adm.hiddenNote')} {t('adm.exportNote')}</p>

      {notice && <div role="status" className="rounded-md border border-success bg-success-tint p-3 text-sm font-medium">{notice}</div>}
      {error && <ErrorBox>{error}</ErrorBox>}

      {list.length === 0 ? <Card><p className="text-muted-foreground">{t('adm.none')}</p></Card> : (
        <div className="overflow-x-auto rounded-lg bg-surface shadow-e2">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-action-tint text-foreground">
              <tr>
                <th className="w-10 p-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="size-5 accent-action" /></th>
                {(['name', 'level', 'origin', 'school', 'created', 'status'] as const).map((c) => <th key={c} className="p-2 font-semibold">{t(`adm.col.${c}` as TKey)}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <ApplicantRow key={a.id} a={a} checked={sel.has(a.id)} expanded={open === a.id}
                  onCheck={() => setSel((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}
                  onToggle={() => setOpen(open === a.id ? null : a.id)}
                  onDelete={async () => {
                    if (!window.confirm(t('adm.deleteConfirm', { name: a.fullName }))) return;
                    try { await api.adminDelete(token, a.id); setOpen(null); await load(); } catch (e) { fail(e); }
                  }} lang={lang} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ApplicantRow(p: {
  a: Applicant; checked: boolean; expanded: boolean; lang: 'id' | 'en';
  onCheck: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const { t } = useI18n();
  const { a, lang } = p;
  const det: [TKey, string][] = [
    ['f.gender', t(`gender.${a.gender}` as TKey)], ['f.birthPlace', `${a.birthPlace}, ${formatDateOnly(a.birthDate, lang)}`], ['f.nisn', a.nisn || '—'],
    ['f.address', `${a.address}, ${a.district}, ${a.regency}, ${a.province}`], ['f.originClass', classLabel(a.originClass, t)],
    ['f.parentName', `${a.parentName} (${t(`rel.${a.parentRelation}` as TKey)})`], ['f.parentPhone', '+' + a.parentPhone],
    ['f.parentEmail', a.parentEmail || '—'], ['f.parentJob', a.parentJob],
    ['f.incomeBand', a.incomeBand ? t(`income.${a.incomeBand}` as TKey) : '—'], ['f.siblings', a.siblings || '—'],
    ['f.achievements', a.achievements || '—'], ['f.motivation', a.motivation],
  ];
  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="p-2"><input type="checkbox" checked={p.checked} onChange={p.onCheck} aria-label={a.fullName} className="size-5 accent-action" /></td>
        <td className="p-2">
          <button onClick={p.onToggle} aria-expanded={p.expanded} className="text-left font-semibold text-action underline">{a.fullName}</button>
          <div className="break-all text-xs text-muted-foreground">{a.email}</div>
        </td>
        <td className="p-2">{t(`level.${a.level}` as TKey)}</td>
        <td className="p-2">{a.regency}, {a.province}</td>
        <td className="p-2">{a.originSchool}</td>
        <td className="p-2 whitespace-nowrap">{formatWib(a.createdAt, lang, false)}</td>
        <td className="p-2"><StatusBadge status={a.status} /></td>
      </tr>
      {p.expanded && (
        <tr className="bg-surface-page">
          <td colSpan={7} className="p-3">
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {det.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{t(k)}</dt><dd className="whitespace-pre-line break-words">{v}</dd></div>)}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={p.onDelete} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-destructive px-4 text-sm font-semibold text-destructive">
                <Trash2 size={16} aria-hidden /> {t('adm.delete')}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
