import fs from 'fs';
import path from 'path';

export function loadLocalEnv(cwd = process.cwd()) {
  const parsed: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    const full = path.join(cwd, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      parsed[trimmed.slice(0, eq)] = value;
    }
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();
