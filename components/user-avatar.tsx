'use client';

import Image from 'next/image';
import { useState } from 'react';
import { avatarSrc } from '@/lib/profile';

export function UserAvatar({ name, avatar, className = '' }: { name: string; avatar: string | null; className?: string }) {
  const src = avatarSrc(avatar);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-free-fill font-display font-bold text-pitch ${className}`}>
      {src && src !== failed
        ? <Image unoptimized src={src} alt={`Ảnh đại diện của ${name}`} fill className="object-cover" onError={() => setFailed(src)} />
        : <span aria-hidden="true">{(name.trim() || 'Bạn').slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}
