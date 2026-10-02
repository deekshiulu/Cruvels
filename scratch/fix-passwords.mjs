import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

function hashPassword(password, customSalt) {
  const iterations = 100000;
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return `$pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  if (storedHash.startsWith('$pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length === 5) {
      const iterations = parseInt(parts[2], 10) || 100000;
      const salt = parts[3];
      const expectedHash = parts[4];
      const calculatedHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
      const bufA = Buffer.from(calculatedHash, 'hex');
      const bufB = Buffer.from(expectedHash, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    }
  }
  return false;
}

const standardHash = hashPassword('Password123!', 'cruvels_static_dev_seed_salt_2026');
console.log('Generated standard hash:', standardHash);
console.log('Self-verification test:', verifyPassword('Password123!', standardHash));

const targets = [
  path.join(process.cwd(), 'data', 'cruvels_db.json'),
  path.join(os.tmpdir(), 'cruvels_db.json'),
  path.join('/tmp', 'cruvels_db.json')
];

for (const p of targets) {
  if (fs.existsSync(p)) {
    try {
      const db = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (db.users && Array.isArray(db.users)) {
        db.users.forEach((u) => {
          u.password_hash = standardHash;
          u.must_change_password = false;
        });
      }
      fs.writeFileSync(p, JSON.stringify(db, null, 2), 'utf8');
      console.log('Updated users in:', p);
    } catch (err) {
      console.error('Error updating', p, err.message);
    }
  }
}
