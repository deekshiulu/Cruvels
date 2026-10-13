import { dataStore, UnifiedDataStore } from '../src/lib/db/store';
import { hashPassword, verifyPassword } from '../src/lib/auth/password';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function main() {
  console.log('[RESET] Starting database cleanup and password reset...');

  if (dataStore instanceof UnifiedDataStore) {
    dataStore.resetAndSeed(false);

    const defaultPassword = 'Password123!';
    const defaultHash = hashPassword(defaultPassword, 'cruvels_static_dev_seed_salt_2026');

    console.log(`[RESET] Generated default hash for Password123!: ${defaultHash.substring(0, 30)}...`);

    // Reset every user to default password and clear must_change_password
    for (const [id, user] of dataStore.users.entries()) {
      dataStore.users.set(id, {
        ...user,
        password_hash: defaultHash,
        must_change_password: false,
      });
      console.log(`[RESET] User: ${user.username} (${user.role}) -> Password reset to "${defaultPassword}" (must_change_password: false)`);
    }

    // Verify all passwords
    for (const user of dataStore.users.values()) {
      const valid = verifyPassword(defaultPassword, user.password_hash);
      if (!valid) {
        throw new Error(`Verification failed for user ${user.username}`);
      }
    }
    console.log('[RESET] Password verification verified 100% for all users.');

    // Write to disk
    dataStore.persistToDisk();

    // Also explicitly verify file exists and write atomic copy to data and temp
    const data = {
      users: Array.from(dataStore.users.values()),
      aliases: Array.from(dataStore.aliases.values()),
      messages: dataStore.messages,
      attachments: dataStore.attachments,
      auditLogs: dataStore.auditLogs,
      checkpoints: Array.from(dataStore.checkpoints.values()),
      departments: dataStore.departments,
      groups: dataStore.groups,
      employees: dataStore.employees,
      attendanceRecords: dataStore.attendanceRecords,
      attendanceRules: dataStore.attendanceRules,
      systemSettings: dataStore.systemSettings,
      attendanceCorrections: dataStore.attendanceCorrections,
      acknowledgements: dataStore.acknowledgements,
      leaveRequests: dataStore.leaveRequests,
      notices: dataStore.notices,
      scheduleEvents: dataStore.scheduleEvents,
      notes: dataStore.notes,
      tasks: dataStore.tasks,
      driveResources: dataStore.driveResources,
      notifications: dataStore.notifications,
      notificationPreferences: Array.from(dataStore.notificationPreferences.entries()),
      pushSubscriptions: dataStore.pushSubscriptions,
      userCalendarIntegrations: dataStore.userCalendarIntegrations,
      vapidKeys: dataStore.vapidKeys,
      mailReminders: dataStore.mailReminders,
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const dataFile = path.join(process.cwd(), 'data', 'cruvels_db.json');
    const tempFile = path.join(os.tmpdir(), 'cruvels_db.json');

    fs.writeFileSync(dataFile, jsonStr, 'utf-8');
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');

    console.log(`[RESET] Successfully written clean database to:`);
    console.log(` - ${dataFile}`);
    console.log(` - ${tempFile}`);
    console.log(`[RESET] Total users: ${data.users.length}`);
    console.log(`[RESET] Demo messages: ${data.messages.length}`);
    console.log(`[RESET] Demo tasks: ${data.tasks.length}`);
    console.log(`[RESET] Demo schedule events: ${data.scheduleEvents.length}`);
    console.log(`[RESET] Demo attendance records: ${data.attendanceRecords.length}`);
  }
}

main().catch((err) => {
  console.error('[RESET ERROR]', err);
  process.exit(1);
});
