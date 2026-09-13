import '../src/lib/config/loadEnv';
import http from 'http';
import { startMailSyncLoop } from './mail-sync-loop';

const port = parseInt(process.env.PORT || '10000', 10);

async function main() {
  console.log('====================================================');
  console.log('  CRUVELS MAIL SYNC  (Render free web service)');
  console.log('====================================================');

  await startMailSyncLoop();

  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    res.setHeader('Content-Type', 'application/json');
    if (url === '/health' || url === '/' || url === '/healthz') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, service: 'cruvels-mail-sync', ts: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ ok: false }));
  });

  server.listen(port, () => {
    console.log(`[Worker] HTTP health server on port ${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
