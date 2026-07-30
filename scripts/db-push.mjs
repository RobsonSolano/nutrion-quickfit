/**
 * Aplica as migrations no Supabase remoto SEM `supabase link`.
 *
 * O `link` exige um personal access token do dashboard, que não temos. O
 * `--db-url` não exige nada além da senha do banco, que está no `.env.local`.
 *
 * Este wrapper existe para a senha não passar pelo histórico do shell: monta a
 * connection string em memória e entrega ao CLI via argv.
 *
 * Rota: conexão DIRETA (`db.<ref>.supabase.co`), que neste projeto resolve só
 * em IPv6 — os poolers `aws-0-*` recusaram a conexão. Se um dia a máquina
 * perder IPv6, o caminho é ativar o add-on de IPv4 ou descobrir a região certa
 * do pooler.
 */
import { execFileSync } from 'node:child_process';

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!pw || !ref) {
  console.error('Faltam SUPABASE_DB_PASSWORD e SUPABASE_PROJECT_REF no .env.local');
  process.exit(1);
}

const url = `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres`;
const args = ['supabase', 'db', 'push', '--db-url', url, ...process.argv.slice(2)];

try {
  execFileSync('npx', args, { stdio: 'inherit' });
} catch {
  process.exit(1);
}
