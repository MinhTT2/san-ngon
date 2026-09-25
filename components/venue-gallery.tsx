'use client';

import Image from 'next/image';
import { useState } from 'react';

export function VenueGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const [displayed, setDisplayed] = useState(0);
  const [loaded, setLoaded] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  if (!images.length) return null;
  const url = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${path}`;
  return <section aria-label={`Ảnh ${name}`} className="mb-6">
    <div aria-busy={selected !== displayed && !failed} className="relative aspect-[16/9] overflow-hidden rounded-card bg-sunk sm:aspect-[5/2]">
      {/* Giữ các ảnh đã xem để fade chéo; chỉ tải ảnh lớn mới khi được chọn. */}
      {images.map((path, index) => (index === selected || index === displayed || loaded.includes(index)) && (
        <Image key={path} unoptimized fill priority={index === 0} loading={index === 0 ? undefined : 'eager'}
          src={url(path)} alt={index === displayed ? `${name} · ảnh ${index + 1}` : ''}
          aria-hidden={index !== displayed}
          onLoad={() => {
            setLoaded((previous) => previous.includes(index) ? previous : [...previous, index]);
            if (index === selected) setDisplayed(index);
          }}
          onError={() => { if (index === selected) setFailed(true); }}
          className={`pf-gallery-image object-contain ${index === displayed ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <span className="absolute bottom-3 right-3 rounded-pill bg-card px-3 py-1 text-xs">{displayed + 1} / {images.length}</span>
    </div>
    {failed && <p role="status" className="mt-2 text-sm text-ink-secondary">Chưa tải được ảnh này. Bạn thử chọn ảnh khác nhé.</p>}
    {images.length > 1 && (
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {images.map((path, index) => (
          <button key={path} type="button" aria-label={`Xem ảnh ${index + 1} của ${name}`} aria-pressed={selected === index}
            onClick={() => {
              if (index === selected) return;
              setSelected(index);
              setFailed(false);
              if (loaded.includes(index)) setDisplayed(index);
            }}
            className={`pf-gallery-thumb relative h-16 w-24 shrink-0 overflow-hidden rounded-control border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch ${selected === index ? 'border-pitch' : 'border-transparent hover:border-strong'}`}>
            <Image unoptimized fill src={url(path)} alt="" className="object-cover" />
          </button>
        ))}
      </div>
    )}
  </section>;
}
