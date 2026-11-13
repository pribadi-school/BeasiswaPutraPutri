import { Award, BookOpen, GraduationCap, MapPin } from 'lucide-react';

/**
 * Ilustrasi banner (pengganti karakter 3D di referensi), dibuat dari ikon +
 * ubin agar ringan dan tidak butuh gambar. Murni dekoratif.
 */
export function HeroArt({ compact = false }: { compact?: boolean }) {
  const s = compact ? 0.62 : 1;
  return (
    <div aria-hidden className="pointer-events-none relative shrink-0" style={{ width: 220 * s, height: 170 * s }}>
      <div className="absolute rounded-full bg-white/15" style={{ inset: `${10 * s}px ${8 * s}px ${0}px ${20 * s}px` }} />
      <div className="absolute rounded-full bg-white/10" style={{ width: 70 * s, height: 70 * s, right: 0, top: 0 }} />
      {/* Topi wisuda */}
      <div className="animate-float absolute flex -rotate-6 items-center justify-center rounded-md bg-surface text-action shadow-e3"
        style={{ width: 96 * s, height: 96 * s, left: 62 * s, top: 34 * s }}>
        <GraduationCap size={60 * s} strokeWidth={1.75} />
      </div>
      {/* Penghargaan */}
      <div className="animate-float-slow absolute flex rotate-12 items-center justify-center rounded-sm bg-surface text-accent shadow-e2"
        style={{ width: 52 * s, height: 52 * s, right: 6 * s, top: 92 * s }}>
        <Award size={30 * s} />
      </div>
      {/* Buku */}
      <div className="animate-float-slow absolute flex -rotate-12 items-center justify-center rounded-sm bg-surface text-gradient-end shadow-e2"
        style={{ width: 48 * s, height: 48 * s, left: 14 * s, top: 104 * s }}>
        <BookOpen size={26 * s} />
      </div>
      {/* Asal daerah */}
      <div className="animate-float absolute flex rotate-6 items-center justify-center rounded-sm bg-surface text-action shadow-e2"
        style={{ width: 40 * s, height: 40 * s, right: 30 * s, top: 14 * s }}>
        <MapPin size={22 * s} />
      </div>
      <span className="absolute rounded-full bg-accent" style={{ width: 12 * s, height: 12 * s, left: 30 * s, top: 40 * s }} />
      <span className="absolute rounded-full bg-primary" style={{ width: 10 * s, height: 10 * s, left: 168 * s, top: 70 * s }} />
      <span className="absolute rounded-full bg-white/80" style={{ width: 8 * s, height: 8 * s, left: 110 * s, top: 150 * s }} />
    </div>
  );
}
