'use client';

import Image from 'next/image';
import { useState } from 'react';

export function VenueGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  if (!images.length) return null;
  const url = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${path}`;
  return <section aria-label={`Ảnh ${name}`} className="mb-6">
    <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-sunk sm:aspect-[5/2]">
      <Image unoptimized fill priority src={url(images[selected])} alt={`${name} · ảnh ${selected + 1}`} className="object-contain" />
      <span className="absolute bottom-3 right-3 rounded-pill bg-card px-3 py-1 text-xs">{selected + 1} / {images.length}</span>
    </div>
    {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{images.map((path, index) => <button key={path} type="button" aria-label={`Xem ảnh ${index + 1} của ${name}`} aria-pressed={selected === index} onClick={() => setSelected(index)} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-control border-2 ${selected === index ? 'border-pitch' : 'border-transparent'}`}><Image unoptimized fill src={url(path)} alt="" className="object-cover" /></button>)}</div>}
  </section>;
}
