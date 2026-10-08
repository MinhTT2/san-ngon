'use client';

import Image from 'next/image';
import { useState } from 'react';
import { tournamentCoverSrc } from '@/lib/image-upload';
import { Trophy } from 'lucide-react';

export function TournamentCover({ path, title, className = '', fallback = false }: { path: string | null; title: string; className?: string; fallback?: boolean }) {
  const src = tournamentCoverSrc(path);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return fallback ? <div aria-hidden="true" className={`relative grid place-items-center overflow-hidden bg-pitch ${className}`}><svg viewBox="0 0 320 180" fill="none" className="absolute inset-0 size-full text-free-line/25"><path d="M24 20H296V160H24ZM160 20V160" stroke="currentColor" /><circle cx="160" cy="90" r="38" stroke="currentColor" /></svg><span className="relative grid size-14 place-items-center rounded-full border border-free-line/35 bg-pitch text-pitch-ink"><Trophy className="size-6" strokeWidth={1.5} /></span></div> : null;
  return <div className={`relative overflow-hidden bg-sunk ${className}`}><Image src={src} alt={`Ảnh bìa giải ${title}`} fill unoptimized className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]" onError={() => setFailed(src)} /></div>;
}
