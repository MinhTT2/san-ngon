import { createClient } from '@supabase/supabase-js';

/**
 * Bỏ qua toàn bộ RLS. CHỈ dùng trong route SePay phía server (/api/sepay/* và /api/webhooks/sepay).
 * Không bao giờ import file này vào component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
