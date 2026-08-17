import { spawn, spawnSync } from 'node:child_process';

const container = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_pwa';
const psqlArgs = ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1'];
const periodSql = "date_trunc('month', now() AT TIME ZONE 'UTC')::date";

function runSql(sql) {
  const result = spawnSync('docker', [...psqlArgs, '-Atc', sql], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'psql failed');
  return result.stdout.trim();
}

function runConcurrentReservation() {
  return new Promise((resolve) => {
    const child = spawn('docker', [...psqlArgs, '-Atc',
      "BEGIN; SELECT public.reserve_r2_operation_budget('A', 1); SELECT pg_sleep(1); COMMIT;",
    ]);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

runSql(`
  INSERT INTO private.r2_monthly_operation_usage (period_start, operation_class, operation_count)
  VALUES (${periodSql}, 'A', 799999)
  ON CONFLICT (period_start, operation_class) DO UPDATE SET operation_count = 799999;
`);

const results = await Promise.all([runConcurrentReservation(), runConcurrentReservation()]);
const successes = results.filter(({ code }) => code === 0);
const rejections = results.filter(({ code, stderr }) =>
  code !== 0 && stderr.includes('R2_FREE_TIER_OPERATION_GUARDRAIL'));

if (successes.length !== 1 || rejections.length !== 1) {
  throw new Error(`Résultat concurrent inattendu: ${JSON.stringify(results)}`);
}

const finalCount = runSql(`
  SELECT operation_count
  FROM private.r2_monthly_operation_usage
  WHERE period_start = ${periodSql} AND operation_class = 'A';
`);
if (finalCount !== '800000') throw new Error(`Compteur Class A final inattendu: ${finalCount}`);

console.log('[cloudflare-free-tier] Réservation concurrente atomique validée localement.');
