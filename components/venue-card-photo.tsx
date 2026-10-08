'use client';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { PitchThumb } from './pitch-thumb';

export function VenueCardPhoto({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="relative aspect-[16/10] overflow-hidden bg-sunk">
    {src && failed !== src ? <Image src={src} alt={name} fill unoptimized sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]" onError={() => setFailed(src)} />
      : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-free-fill">
        <PitchThumb width={120} height={80} />
        <span className="flex items-center gap-1.5 text-xs text-ink-secondary"><ImageOff size={14} aria-hidden="true" />{src ? 'Ảnh đang được cập nhật' : 'Chưa có ảnh sân'}</span>
      </div>}
  </div>;
}
