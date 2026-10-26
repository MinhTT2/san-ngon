import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Run the installed Node CLI directly; Windows cannot spawn the .cmd shim.
const pkg = JSON.parse(readFileSync(new URL('../node_modules/supabase/package.json', import.meta.url), 'utf8'));
const cli = fileURLToPath(new URL('../node_modules/supabase/' + (typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.supabase), import.meta.url));
const result = spawnSync(process.execPath, [cli, 'gen', 'types', 'typescript', '--linked', '--schema', 'public'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (result.error || result.status !== 0 || !result.stdout?.includes('export type Database')) {
  console.error('Không sinh được database types. Kiểm tra Supabase login và db:link. File cũ được giữ nguyên.'); process.exit(1);
}
writeFileSync('lib/database.types.ts.tmp', result.stdout, { mode: 0o600 });
renameSync('lib/database.types.ts.tmp', 'lib/database.types.ts');
console.log('Đã sinh lib/database.types.ts từ database liên kết.');
