import { runIncrementalEmailSync } from '../src/lib/email/sync';
import { useSupabaseBackend } from '../src/lib/db/backend';

export async function startMailSyncLoop() {
  const intervalMs = parseInt(process.env.SYNC_INTERVAL_SECONDS || '30', 10) * 1000;
  console.log(`[Worker] Polling every ${intervalMs / 1000}s`);
  console.log(`[Worker] Data backend: ${useSupabaseBackend() ? 'Supabase' : 'JSON file (not for production)'}`);

  if (process.env.NODE_ENV === 'production' && !useSupabaseBackend()) {
    throw new Error('Refusing to start in production without Supabase.');
  }

  let isRunning = false;
  const tick = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const result = await runIncrementalEmailSync(false);
      if (result.provider !== 'Cooldown' && result.provider !== 'SyncLock') {
        console.log(
          `[Worker][${new Date().toISOString()}] success=${result.success} fetched=${result.fetchedCount} ingested=${result.ingestedCount} users=${result.matchedUsersCount}${result.error ? ` error=${result.error}` : ''}`
        );
      }
    } catch (err) {
      console.error('[Worker] tick error:', err);
    } finally {
      isRunning = false;
    }
  };

  await tick();
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}
