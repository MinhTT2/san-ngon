# Thiết lập môi trường phát triển

```bash
npm install
npm run setup:check
npm run db:login
npm run db:link
npm run db:dry
npm run db:push
npm run db:types
npm run vercel:login
npm run vercel:link
npm run env:pull
npm run ci
```

`supabase/migrations/` là nguồn thay đổi schema/RLS/functions mới. `04_seed.sql` và `05_cron.sql` là bước hậu triển khai thủ công, không chạy tự động khi `db push`.

Tài khoản demo: tạo hai Auth users trong Dashboard, thay email ở đầu `supabase/demo-roles.sql`, chạy file đó rồi seed sân demo. Không lưu mật khẩu vào repo.

MCP Supabase cần project scope:

```bash
codex mcp login supabase --scopes organizations:read,projects:read,projects:write,database:read,database:write
codex mcp login vercel
```

Dùng URL `https://mcp.supabase.com/mcp?project_ref=PROJECT_REF&features=database,docs`; không đưa `SUPABASE_SERVICE_ROLE_KEY` vào MCP. Mở phiên Codex mới sau khi đổi MCP.
