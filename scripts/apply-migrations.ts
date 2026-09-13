import '../src/lib/config/loadEnv';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

function requiredDbUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DIRECT_URL;
  if (!url || !url.startsWith('postgres')) {
    throw new Error(
      'DATABASE_URL is missing. In Supabase: Project Settings → Database → URI (copy the URI, replace [YOUR-PASSWORD]). Add it to .env.local as DATABASE_URL=postgresql://...'
    );
  }
  return url;
}

async function main() {
  const sqlFile = path.join(process.cwd(), 'supabase', 'RUN_IN_SQL_EDITOR.sql');
  const sqlText = fs.readFileSync(sqlFile, 'utf8');
  const sql = postgres(requiredDbUrl(), { max: 1, ssl: 'require' });
  try {
    await sql.unsafe(sqlText);
    console.log('Schema applied from supabase/RUN_IN_SQL_EDITOR.sql');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
