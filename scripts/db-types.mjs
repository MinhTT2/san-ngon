import { spawnSync } from 'node:child_process';
import { writeFileSync, renameSync } from 'node:fs';
const result = spawnSync('supabase', ['gen', 'types', 'typescript', '--linked', '--schema', 'public'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (result.error || result.status !== 0 || !result.stdout?.includes('export type Database')) {
  console.error('Không sinh được database types. Kiểm tra Supabase login và db:link. File cũ được giữ nguyên.'); process.exit(1);
}
writeFileSync('lib/database.types.ts.tmp', result.stdout, { mode: 0o600 });
renameSync('lib/database.types.ts.tmp', 'lib/database.types.ts');
console.log('Đã sinh lib/database.types.ts từ database liên kết.');
