import '../src/lib/config/loadEnv';
import { startMailSyncLoop } from './mail-sync-loop';

async function main() {
  console.log('====================================================');
  console.log('  CRUVELS MAIL WORKER  (Gmail-style incremental IMAP)');
  console.log('====================================================');
  await startMailSyncLoop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
