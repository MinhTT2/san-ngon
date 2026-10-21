export function reportedContent(path: string | null) {
  const match = /^\/(ket-noi|giai-dau)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.exec(path || '');
  return match ? { kind: match[1] === 'ket-noi' ? 'community' : 'tournament', id: match[2] } : null;
}
export type Moderation = { kind: string; id: string; title: string; hidden: boolean; reason: string | null; updated_at: string | null };
