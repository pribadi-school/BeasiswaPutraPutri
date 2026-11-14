import { useEffect, useRef, useState } from 'react';

/**
 * Tombol resmi "Sign in with Google" (Google Identity Services). Google memberi
 * token (credential) yang lalu diperiksa server. Script dimuat sekali dari
 * accounts.google.com (diizinkan di Content-Security-Policy server).
 */
type Gis = {
  accounts: { id: {
    initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; use_fedcm_for_prompt?: boolean }): void;
    renderButton(el: HTMLElement, o: Record<string, unknown>): void;
  } };
};
declare global { interface Window { google?: Gis } }

let loading: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('gis')));
    s.onerror = () => { loading = null; reject(new Error('gis')); };
    document.head.appendChild(s);
  });
  return loading;
}

export function GoogleSignInButton({ clientId, lang, onCredential, onError }: {
  clientId: string; lang: 'id' | 'en'; onCredential: (credential: string) => void; onError: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // Simpan callback terbaru tanpa memuat ulang tombol.
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    loadGis().then((g) => {
      if (cancelled || !ref.current) return;
      g.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), use_fedcm_for_prompt: true });
      g.accounts.id.renderButton(ref.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with',
        logo_alignment: 'center', locale: lang, width: Math.min(ref.current.clientWidth || 320, 400),
      });
      setReady(true);
    }).catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [clientId, lang, onError]);

  return (
    <div className="flex min-h-12 justify-center">
      <div ref={ref} className="w-full max-w-[400px]" />
      {!ready && <div className="skeleton h-11 w-full max-w-[400px] rounded-full bg-surface-muted" aria-hidden />}
    </div>
  );
}
