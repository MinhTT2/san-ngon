export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { skillLabels, type CommunityProfile } from '@/lib/community';
import { ActionForm } from '@/components/action-form';
import { Field, fieldClass } from '@/components/tournament-fields';
export const metadata = { title: 'Hồ sơ kết nối của tôi' };
export default async function Page() {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/ket-noi/ho-so');
  const [{ data, error }, { data: account }] = await Promise.all([db.rpc('get_community_profile',{ p_id: user.id }),db.from('profiles').select('full_name,phone').eq('id',user.id).maybeSingle()]);
  if (error) throw new Error('Không tải được hồ sơ kết nối.'); const p = data as CommunityProfile | null;
  return <main className="mx-auto max-w-3xl px-5 py-10"><Link href="/ket-noi" className="text-sm font-semibold text-pitch">← Kết nối</Link><h1 className="mb-4 mt-5 font-display text-3xl font-extrabold text-pitch">Hồ sơ kết nối của tôi</h1><p className="mb-7 text-sm leading-7 text-ink-secondary">Bạn tự chọn công khai thông tin để người khác liên hệ. Ảnh dùng ảnh đại diện tài khoản; <Link className="font-semibold text-pitch underline" href="/tai-khoan">đổi ảnh tại đây</Link>.</p>
    <section className="rounded-card border border-hairline bg-card p-6"><ActionForm endpoint="/api/community" label="Lưu hồ sơ kết nối"><div className="grid gap-4 sm:grid-cols-2"><Field label="Tên hiển thị"><input className={fieldClass} name="display_name" defaultValue={p?.display_name ?? account?.full_name ?? ''} required minLength={2} maxLength={100} /></Field><Field label="Số điện thoại liên hệ"><input className={fieldClass} name="phone" type="tel" defaultValue={p?.phone ?? account?.phone ?? ''} required maxLength={25} /></Field><Field label="Khu vực / vị trí"><input className={fieldClass} name="location" defaultValue={p?.location ?? ''} placeholder="Quận, thành phố" required minLength={2} maxLength={200} /></Field><Field label="Môn chơi"><select className={fieldClass} name="sport" defaultValue={p?.sport ?? 'badminton'}>{Object.entries(SPORT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field><Field label="Trình độ"><select className={fieldClass} name="skill_level" defaultValue={p?.skill_level ?? 'beginner'}>{Object.entries(skillLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field><Field label="Số Zalo (tùy chọn)"><input className={fieldClass} name="zalo_phone" type="tel" defaultValue={p?.zalo_phone ?? ''} maxLength={25} /></Field></div><Field label="Trang Facebook (tùy chọn)"><input className={fieldClass} type="url" name="facebook_url" defaultValue={p?.facebook_url ?? ''} maxLength={300} placeholder="https://facebook.com/ten-cua-ban" /></Field><Field label="Giới thiệu"><textarea className={fieldClass} name="bio" defaultValue={p?.bio ?? ''} maxLength={1000} rows={4} /></Field><label className="flex items-start gap-3 rounded-control bg-sunk p-4 text-sm leading-6"><input className="mt-1 size-4 shrink-0 accent-pitch" type="checkbox" name="is_public" defaultChecked={p?.is_public ?? false} />Tôi đồng ý công khai hồ sơ và thông tin liên hệ trên mục Kết nối. Bỏ chọn để ẩn hồ sơ bất cứ lúc nào.</label></ActionForm></section>
  </main>;
}
