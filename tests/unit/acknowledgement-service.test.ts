import { describe, it, expect, beforeEach } from 'vitest';
import { acknowledgementService } from '@/lib/services/acknowledgement-service';
import { dataStore } from '@/lib/db/store';

describe('Universal Acknowledgement System Unit Tests (Roadmap §§ 5, 6, 7, 8, 29)', () => {
  beforeEach(async () => {
    dataStore.resetAndSeed();
  });

  it('registers acknowledgement requirements for all active workforce (§ 5.1)', async () => {
    const res = await acknowledgementService.registerRequirement({
      itemType: 'policy',
      itemId: 'pol-001',
      itemTitle: 'Cruvels Workplace Code of Conduct 2026',
      targetAudience: 'all',
      dueAt: '2026-10-01T18:00:00Z',
      registeredByUserId: 'a0000000-0000-0000-0000-000000000001',
    });

    expect(res.count).toBeGreaterThan(0);
    const acks = await dataStore.getAcknowledgements({ itemType: 'policy', itemId: 'pol-001' });
    expect(acks.length).toBe(res.count);
    expect(acks.every((a) => a.status === 'pending')).toBe(true);
    expect(acks[0].item_title).toBe('Cruvels Workplace Code of Conduct 2026');
  });

  it('registers acknowledgement requirements specifically targeted to interns only (§ 8)', async () => {
    const res = await acknowledgementService.registerRequirement({
      itemType: 'notice',
      itemId: 'not-intern-01',
      itemTitle: 'Internship Performance Milestones',
      targetAudience: 'interns',
      registeredByUserId: 'a0000000-0000-0000-0000-000000000001',
    });

    const acks = await dataStore.getAcknowledgements({ itemType: 'notice', itemId: 'not-intern-01' });
    expect(acks.length).toBe(res.count);
    // Every recipient should have role 'intern'
    expect(acks.every((a) => a.recipient_role === 'intern')).toBe(true);
  });

  it('records employee acknowledgement and marks status as acknowledged (§ 5.3)', async () => {
    // 1. Register requirement for intern Rahul
    const rahulUserId = 'a0000000-0000-0000-0000-000000000007';
    await acknowledgementService.registerRequirement({
      itemType: 'notice',
      itemId: 'notice-abc',
      itemTitle: 'Security Briefing',
      targetAudience: 'custom',
      specificUserIds: [rahulUserId],
    });

    // Verify initial status is pending
    const initialAcks = await acknowledgementService.getUserAcknowledgements(rahulUserId);
    const targetAck = initialAcks.find((a) => a.item_id === 'notice-abc');
    expect(targetAck?.status).toBe('pending');
    expect(targetAck?.acknowledged_at).toBeUndefined();

    // 2. Rahul acknowledges
    const ackRes = await acknowledgementService.acknowledge({
      itemType: 'notice',
      itemId: 'notice-abc',
      userId: rahulUserId,
      ip: '192.168.1.55',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      notes: 'Reviewed and understood the security guidelines.',
    });

    expect(ackRes).toBeDefined();
    expect(ackRes?.status).toBe('acknowledged');
    expect(ackRes?.acknowledged_at).toBeDefined();
    expect(ackRes?.acknowledged_ip).toBe('192.168.1.55');

    // Verify persistence in store
    const updatedAcks = await acknowledgementService.getUserAcknowledgements(rahulUserId);
    const updatedItem = updatedAcks.find((a) => a.item_id === 'notice-abc');
    expect(updatedItem?.status).toBe('acknowledged');
  });

  it('is idempotent and prevents multiple identical acknowledgements from duplicating', async () => {
    const rahulUserId = 'a0000000-0000-0000-0000-000000000007';
    await acknowledgementService.registerRequirement({
      itemType: 'document',
      itemId: 'doc-handbook',
      itemTitle: 'Employee Handbook',
      targetAudience: 'custom',
      specificUserIds: [rahulUserId],
    });

    const firstAck = await acknowledgementService.acknowledge({
      itemType: 'document',
      itemId: 'doc-handbook',
      userId: rahulUserId,
    });

    const secondAck = await acknowledgementService.acknowledge({
      itemType: 'document',
      itemId: 'doc-handbook',
      userId: rahulUserId,
    });

    expect(firstAck?.id).toBe(secondAck?.id);
    const count = (await dataStore.getAcknowledgements({ itemType: 'document', itemId: 'doc-handbook' })).length;
    expect(count).toBe(1);
  });

  it('evaluates and flags items past due_at as overdue (§ 5.2)', async () => {
    const rahulUserId = 'a0000000-0000-0000-0000-000000000007';
    // Past date (yesterday)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    await acknowledgementService.registerRequirement({
      itemType: 'task',
      itemId: 'task-overdue-test',
      itemTitle: 'Review Critical Bug Patch',
      targetAudience: 'custom',
      specificUserIds: [rahulUserId],
      dueAt: yesterday,
    });

    const updatedOverdue = await acknowledgementService.evaluatePendingAndOverdue();
    expect(updatedOverdue).toBeGreaterThanOrEqual(1);

    const acks = await acknowledgementService.getUserAcknowledgements(rahulUserId);
    const item = acks.find((a) => a.item_id === 'task-overdue-test');
    expect(item?.status).toBe('overdue');
  });

  it('computes accurate summary statistics and compliance rate for an item (§ 6)', async () => {
    const user1 = 'a0000000-0000-0000-0000-000000000007';
    const user2 = 'a0000000-0000-0000-0000-000000000008';

    await acknowledgementService.registerRequirement({
      itemType: 'notice',
      itemId: 'notice-stats-test',
      itemTitle: 'Company Holiday Schedule',
      targetAudience: 'custom',
      specificUserIds: [user1, user2],
    });

    // Initially 0% compliance
    let summary = await acknowledgementService.getItemSummary('notice', 'notice-stats-test');
    expect(summary.totalRecipients).toBe(2);
    expect(summary.acknowledgedCount).toBe(0);
    expect(summary.pendingCount).toBe(2);
    expect(summary.complianceRate).toBe(0);

    // User 1 acknowledges
    await acknowledgementService.acknowledge({
      itemType: 'notice',
      itemId: 'notice-stats-test',
      userId: user1,
    });

    summary = await acknowledgementService.getItemSummary('notice', 'notice-stats-test');
    expect(summary.acknowledgedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.complianceRate).toBe(50);
    expect(summary.recipients.find((r) => r.userId === user1)?.status).toBe('acknowledged');
    expect(summary.recipients.find((r) => r.userId === user2)?.status).toBe('pending');
  });

  it('dispatches automated reminder notifications and enforces anti-spam safeguards (§ 7)', async () => {
    const user1 = 'a0000000-0000-0000-0000-000000000007';
    await acknowledgementService.registerRequirement({
      itemType: 'policy',
      itemId: 'pol-fire-drill',
      itemTitle: 'Fire Safety Evacuation Protocol',
      targetAudience: 'custom',
      specificUserIds: [user1],
    });

    // First reminder trigger
    const firstRun = await acknowledgementService.processReminders({
      itemType: 'policy',
      itemId: 'pol-fire-drill',
    });
    expect(firstRun.remindersSent).toBe(1);

    // Immediate second trigger should be throttled by 12h anti-spam safeguard
    const secondRun = await acknowledgementService.processReminders({
      itemType: 'policy',
      itemId: 'pol-fire-drill',
    });
    expect(secondRun.remindersSent).toBe(0);

    // User acknowledges: subsequent reminder runs do not touch acknowledged user
    await acknowledgementService.acknowledge({
      itemType: 'policy',
      itemId: 'pol-fire-drill',
      userId: user1,
    });

    const thirdRun = await acknowledgementService.processReminders({
      itemType: 'policy',
      itemId: 'pol-fire-drill',
    });
    expect(thirdRun.remindersSent).toBe(0);
  });

  it('aggregates global compliance metrics across the whole organization (§ 6)', async () => {
    await acknowledgementService.registerRequirement({
      itemType: 'notice',
      itemId: 'not-global-1',
      itemTitle: 'Global Notice 1',
      targetAudience: 'interns',
    });

    const metrics = await acknowledgementService.getGlobalMetrics();
    expect(metrics.totalRequirements).toBeGreaterThan(0);
    expect(metrics.totalRecipients).toBeGreaterThan(0);
    expect(metrics.items.length).toBeGreaterThan(0);
  });
});
