import fs from 'fs';
import os from 'os';
import path from 'path';

const paths = [
  path.join(process.cwd(), 'data', 'cruvels_db.json'),
  path.join(os.tmpdir(), 'cruvels_db.json'),
  path.join('/tmp', 'cruvels_db.json')
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    try {
      const db = JSON.parse(fs.readFileSync(p, 'utf8'));
      let changed = false;
      if (db.messages && Array.isArray(db.messages)) {
        db.messages.forEach((m) => {
          if (m.subject && m.subject.includes('Password Reset Request') && m.body_html) {
            m.body_html = m.body_html
              .replace(/color:\s*#FFFFFF;(?!\s*!important)/g, 'color: #FFFFFF !important;')
              .replace(/Open Admin Controls(?! &rarr;)/g, 'Open Admin Controls &rarr;');
            if (!m.body_html.includes('class="email-action-btn"')) {
              m.body_html = m.body_html.replace('<a href="/admin"', '<a href="/admin" class="email-action-btn"');
            }
            changed = true;
          }
        });
      }
      if (changed) {
        fs.writeFileSync(p, JSON.stringify(db, null, 2), 'utf8');
        console.log('Updated existing reset messages in:', p);
      }
    } catch (err) {
      console.error('Error on', p, err.message);
    }
  }
}
