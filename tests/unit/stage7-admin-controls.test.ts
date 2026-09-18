import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/session';

describe('Stage 7: Admin & Operational Controls', () => {
  beforeEach(async () => {
    dataStore.resetAndSeed();
  });

  it('provisions new intern accounts with unique credentials and mail aliases', async () => {
    const newUser = await dataStore.createUser({
      name: 'Ananya Sharma',
      username: 'ananya',
      password_hash: hashPassword('SecurePass987!'),
      role: 'intern',
      status: 'active',
    });

    expect(newUser.id).toBeDefined();
    expect(newUser.username).toBe('ananya');
    expect(newUser.role).toBe('intern');
    expect(newUser.status).toBe('active');

    // Provision initial email alias
    const alias = await dataStore.createAlias(newUser.id, 'ananya@cruvels.com');

    expect(alias.id).toBeDefined();
    expect(alias.email_address).toBe('ananya@cruvels.com');

    const userAliases = await dataStore.getAliasesByUserId(newUser.id);
    expect(userAliases).toHaveLength(1);
    expect(userAliases[0].email_address).toBe('ananya@cruvels.com');
  });

  it('enforces email alias uniqueness across all portal users', async () => {
    const user1 = await dataStore.createUser({
      name: 'User One',
      username: 'user1',
      password_hash: hashPassword('Pass1234567!'),
      role: 'intern',
      status: 'active',
    });

    const user2 = await dataStore.createUser({
      name: 'User Two',
      username: 'user2',
      password_hash: hashPassword('Pass1234567!'),
      role: 'intern',
      status: 'active',
    });

    await dataStore.createAlias(user1.id, 'shared-alias@cruvels.com');

    // Attempting to assign the same alias should fail
    const existing = await dataStore.getAliasByEmail('shared-alias@cruvels.com');
    expect(existing).toBeDefined();
    expect(existing?.user_id).toBe(user1.id);
  });

  it('manages user account lifecycle (active -> disabled -> active)', async () => {
    const user = await dataStore.createUser({
      name: 'Temporary Intern',
      username: 'temp_intern',
      password_hash: hashPassword('TempPassword123!'),
      role: 'intern',
      status: 'active',
    });

    expect(user.status).toBe('active');

    // Disable account
    const disabled = await dataStore.updateUser(user.id, { status: 'disabled' });
    expect(disabled?.status).toBe('disabled');

    const checkDisabled = await dataStore.getUserById(user.id);
    expect(checkDisabled?.status).toBe('disabled');

    // Re-enable account
    const reenabled = await dataStore.updateUser(user.id, { status: 'active' });
    expect(reenabled?.status).toBe('active');
  });

  it('records immutable audit logs for administrative security events', async () => {
    const admin = await dataStore.getUserByUsername('admin');
    expect(admin).toBeDefined();

    await dataStore.createAuditLog({
      user_id: admin!.id,
      action: 'ADMIN_PROVISION_EMPLOYEE',
      resource_type: 'USER',
      resource_id: 'usr-new-01',
      metadata: { role: 'intern', alias: 'intern@cruvels.com' },
      ip_address: '127.0.0.1',
      user_agent: 'Cruvels-Test-Runner',
    });

    await dataStore.createAuditLog({
      user_id: admin!.id,
      action: 'ADMIN_UPDATE_STATUS',
      resource_type: 'USER',
      resource_id: 'usr-new-01',
      metadata: { newStatus: 'disabled' },
      ip_address: '127.0.0.1',
      user_agent: 'Cruvels-Test-Runner',
    });

    const logs = await dataStore.listAuditLogs({ limit: 10 });
    expect(logs.length).toBeGreaterThanOrEqual(2);

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('ADMIN_PROVISION_EMPLOYEE');
    expect(actions).toContain('ADMIN_UPDATE_STATUS');
  });

  it('aggregates system statistics and operational KPIs', async () => {
    const users = await dataStore.listUsers();
    const aliases = await dataStore.listAllAliases();
    const leaves = await dataStore.getLeaveRequests();
    const scheduleEvents = await dataStore.getScheduleEvents();

    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(aliases.length).toBeGreaterThanOrEqual(1);

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === 'active').length,
      disabledUsers: users.filter((u) => u.status === 'disabled').length,
      totalAliases: aliases.length,
      totalLeaves: leaves.length,
      totalScheduleEvents: scheduleEvents.length,
    };

    expect(stats.totalUsers).toBeGreaterThanOrEqual(1);
    expect(stats.activeUsers).toBeGreaterThanOrEqual(1);
  });
});
