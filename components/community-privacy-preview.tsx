'use client';
import { useEffect, useRef, useState } from 'react';
import { SPORT_LABELS } from '@/lib/constants';

/** Show the draft exactly as its selected public contact switches allow. */
export function CommunityPrivacyPreview() {
  const host = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ public: boolean; name: string; location: string; sport: string; contacts: string[] } | null>(null);
  useEffect(() => {
    const form = host.current?.closest('form');
    if (!form) return;
    const value = (name: string) => String(new FormData(form).get(name) ?? '').trim();
    const checked = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.checked === true;
    const sync = () => setPreview({ public: checked('is_public'), name: value('display_name'), location: value('location'), sport: value('sport'), contacts: [['show_phone', 'phone', 'Điện thoại'], ['show_zalo', 'zalo_phone', 'Zalo'], ['show_facebook', 'facebook_url', 'Facebook']].filter(([switchName, field]) => checked(switchName) && value(field)).map(([, field, label]) => label + ': ' + value(field)) });
    sync(); form.addEventListener('input', sync); form.addEventListener('change', sync);
    return () => { form.removeEventListener('input', sync); form.removeEventListener('change', sync); };
  }, []);
  return <div ref={host} aria-label="Xem trước quyền công khai" className="rounded-control border border-strong bg-free-fill p-4 text-sm leading-6">
    <h3 className="font-semibold text-pitch">Người khác sẽ thấy gì sau khi lưu?</h3>
    {!preview ? <p className="mt-2 text-ink-secondary">Chỉ các kênh được chọn công khai mới hiện với người khác.</p> : !preview.public ? <p role="status" className="mt-2 text-ink-secondary">Hồ sơ đang chọn ẩn. Người khác không thấy hồ sơ và các kênh liên hệ.</p> : <div className="mt-2 space-y-1"><p className="break-words font-semibold">{preview.name || 'Tên hiển thị của bạn'}</p><p>{SPORT_LABELS[preview.sport] ?? preview.sport} · {preview.location || 'Khu vực chơi'}</p>{preview.contacts.length ? <ul className="space-y-1">{preview.contacts.map(contact => <li key={contact} className="break-all">{contact}</li>)}</ul> : <p>Ẩn toàn bộ kênh liên hệ.</p>}<p className="pt-2 text-xs text-ink-secondary">Đây là bản xem trước. Bấm Lưu hồ sơ kết nối để áp dụng.</p></div>}
  </div>;
}
