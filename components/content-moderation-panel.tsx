import { createClient } from '@/lib/supabase/server';
import { reportedContent, type Moderation } from '@/lib/content-moderation';
import { QueryError } from './query-error';
import { ContentModerationForm } from './content-moderation-form';
export async function ContentModerationPanel({ path }: { path: string | null }) {
  const target = reportedContent(path); if (!target) return null;
  const db = await createClient(); const { data, error } = await db.rpc('get_content_moderation', { p_kind: target.kind, p_id: target.id });
  if (error) return <QueryError title="Chưa tải được trạng thái nội dung" />;
  if (!data) return <p className="mt-4 text-sm text-ink-secondary">Nội dung được báo cáo không còn tồn tại.</p>;
  const content = data as unknown as Moderation;
  return <ContentModerationForm key={content.updated_at} content={content} />;
}
