import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate, useOutletContext } from 'react-router';
import { ClipboardList, LayoutDashboard, Megaphone } from 'lucide-react';
import { api } from '../../lib/api';
import { useI18n, type TKey } from '../../lib/i18n';
import { AppError, type AuthUser, type Me } from '../../lib/types';
import { useCountdown } from '../../lib/useCountdown';
import { clearAllDrafts } from '../../lib/draft';
import { AppShell } from '../../components/AppShell';
import { btnSecondary, ErrorBox, useErrorText } from '../../components/ui';

export type AccountCtx = {
  user: AuthUser;
  me: Me;
  /** ms sampai pengumuman (null = tidak ada hitung mundur). */
  left: number | null;
  reload: () => Promise<void>;
  expire: () => void;
  notice: string | null;
  setNotice: (s: string | null) => void;
};
export const useAccount = () => useOutletContext<AccountCtx>();

/** Memuat akun Google + data pendaftaran sekali, lalu membagikannya ke halaman portal. */
export function AccountLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const errText = useErrorText();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sesi habis: draf TIDAK dihapus, supaya isian bisa dilanjutkan setelah masuk lagi.
  const expire = useCallback(() => {
    void api.signOut();
    navigate('/masuk', { replace: true, state: { expired: true } });
  }, [navigate]);

  const reload = useCallback(async () => {
    try { setMe(await api.me()); setError(null); } catch (e) {
      if (e instanceof AppError && e.code === 'UNAUTHORIZED') expire(); else setError(errText(e));
    }
  }, [expire, errText]);

  useEffect(() => {
    api.getUser().then((u) => { setUser(u); if (u) void reload(); }).catch(() => setUser(null));
  }, [reload]);

  // Saat waktu pengumuman tiba, ambil ulang (hasil baru dikirim server setelah waktunya).
  const left = useCountdown(me && !me.released ? me.announceAt : null, me?.now, () => { setTimeout(() => void reload(), 800); });

  if (user === null) return <Navigate to="/masuk" replace />;

  const registered = !!me?.applicant;
  const nav = [
    { to: '/akun', label: t('nav.dashboard'), Icon: LayoutDashboard, end: true },
    { to: '/akun/data', label: t('nav.data'), Icon: ClipboardList, disabled: !registered },
    { to: '/akun/pengumuman', label: t('nav.result'), Icon: Megaphone, disabled: !registered },
  ];
  const a = me?.applicant;
  const name = a?.parentName ?? user?.name ?? user?.email ?? '';
  const sub = a ? `${a.fullName} · ${t(`level.${a.level}` as TKey)}` : user?.email;

  return (
    <AppShell nav={nav} userName={name} userSub={sub} onLogout={() => { clearAllDrafts(); void api.signOut().then(() => navigate('/', { replace: true })); }}>
      {error && !me ? (
        <div className="space-y-3"><ErrorBox>{error}</ErrorBox><button className={btnSecondary} onClick={() => void reload()}>{t('common.retry')}</button></div>
      ) : !me || !user ? (
        <div className="space-y-4" aria-busy="true">
          <div className="h-40 animate-pulse rounded-lg bg-action-tint" />
          <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-lg bg-surface" />)}</div>
          <p className="sr-only">{t('common.loading')}</p>
        </div>
      ) : (
        <Outlet context={{ user, me, left, reload, expire, notice, setNotice } satisfies AccountCtx} />
      )}
    </AppShell>
  );
}
