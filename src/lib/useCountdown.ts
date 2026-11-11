import { useEffect, useState } from 'react';

/** Hitung mundur ke `target` memakai jam server (selisih dihitung dari `serverNow`). */
export function useCountdown(target: string | null, serverNow: string | undefined, onDone?: () => void) {
  const [offset] = useState(() => (serverNow ? Date.parse(serverNow) - Date.now() : 0));
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!target) { setLeft(null); return; }
    const end = Date.parse(target);
    let fired = false;
    const tick = () => {
      const ms = end - (Date.now() + offset);
      setLeft(Math.max(0, ms));
      if (ms <= 0 && !fired) { fired = true; onDone?.(); }
    };
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, offset]);
  return left;
}
