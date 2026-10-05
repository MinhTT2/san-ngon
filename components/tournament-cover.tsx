'use client';

import Image from 'next/image';
import { useState } from 'react';
import { tournamentCoverSrc } from '@/lib/image-upload';

export function TournamentCover({ path, title, className = '' }: { path: string | null; title: string; className?: string }) {
  const src = tournamentCoverSrc(path);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return null;
  return <div className={`relative overflow-hidden bg-sunk ${className}`}><Image src={src} alt={`Ảnh bìa giải ${title}`} fill unoptimized className="object-cover" onError={() => setFailed(src)} /></div>;
}
