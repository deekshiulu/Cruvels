import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/session';
import { AuthSessionUser, INDIAN_HOLIDAYS_2026 } from '@/lib/db/types';

describe('Stage 4: Attendance Calendar & Mail Gateway Enhancements', () => {
  let user1: AuthSessionUser;
  let user2: AuthSessionUser;
  let emp1Id: string;
  let emp2Id: string;

  beforeEach(async () => {
    dataStore.resetAndSeed();

    const dept = await dataStore.createDepartment({
      name: 'Engineering & Tech',
      code: 'ENG',
      head_name: 'Lead Engineer',
    });

    // Setup test employees
    const emp1 = await dataStore.createEmployee({
      first_name: 'Deekshit',
      last_name: 'Developer',
      email: 'deekshit@cruvels.com',
      department_id: dept.id,
      department_name: dept.name,
      designation: 'Software Engineer',
    });
    emp1Id = emp1.id;

    const emp2 = await dataStore.createEmployee({
      first_name: 'Alex',
      last_name: 'Colleague',
      email: 'alex@cruvels.com',
      department_id: dept.id,
      department_name: dept.name,
      designation: 'Product Manager',
    });
    emp2Id = emp2.id;

    const u1 = await dataStore.createUser({
      name: 'Deekshit Developer',
      username: 'deekshit',
      password_hash: hashPassword('Password123!'),
      role: 'employee',
      status: 'active',
    });
    user1 = {
      id: u1.id,
      username: u1.username,
      name: u1.name,
      role: u1.role,
      status: u1.status,
      employeeId: emp1Id,
      assignedAliases: ['deekshit@cruvels.com', 'deekshit@internal.portal'],
      primaryAlias: 'deekshit@cruvels.com',
    };

    const u2 = await dataStore.createUser({
      name: 'Alex Colleague',
      username: 'alex',
      password_hash: hashPassword('Password123!'),
      role: 'employee',
      status: 'active',
    });
    user2 = {
      id: u2.id,
      username: u2.username,
      name: u2.name,
      role: u2.role,
      status: u2.status,
      employeeId: emp2Id,
      assignedAliases: ['alex@cruvels.com'],
      primaryAlias: 'alex@cruvels.com',
    };
  });

  describe('1. Attendance Calendar, Public Holidays, and Telemetry', () => {
    it('should provide pre-seeded Indian national and public holidays for 2026', () => {
      expect(INDIAN_HOLIDAYS_2026).toBeDefined();
      expect(INDIAN_HOLIDAYS_2026.length).toBeGreaterThanOrEqual(10);

      const republicDay = INDIAN_HOLIDAYS_2026.find((h) => h.date === '2026-01-26');
      expect(republicDay).toBeDefined();
      expect(republicDay?.name).toContain('Republic Day');

      const independenceDay = INDIAN_HOLIDAYS_2026.find((h) => h.date === '2026-08-15');
      expect(independenceDay).toBeDefined();
      expect(independenceDay?.name).toContain('Independence Day');

      const gandhiJayanti = INDIAN_HOLIDAYS_2026.find((h) => h.date === '2026-10-02');
      expect(gandhiJayanti).toBeDefined();
      expect(gandhiJayanti?.name).toContain('Gandhi Jayanti');
    });

    it('should allow adding custom company holidays and schedule events', async () => {
      const customHoliday = await dataStore.createScheduleEvent({
        title: 'Cruvels Annual Tech Symposium',
        description: 'All-hands engineering retreat and demo day',
        event_type: 'event',
        holiday_type: 'company',
        start_time: '2026-09-25T09:00:00Z',
        end_time: '2026-09-25T18:00:00Z',
        attendee_ids: [user1.id, user2.id],
        created_by: user1.id,
      });

      expect(customHoliday.id).toBeDefined();
      expect(customHoliday.holiday_type).toBe('company');
      expect(customHoliday.title).toBe('Cruvels Annual Tech Symposium');

      const events = await dataStore.getScheduleEvents();
      expect(events.some((e) => e.id === customHoliday.id)).toBe(true);
    });

    it('should record attendance punches and compute monthly telemetry stats accurately', async () => {
      await dataStore.markDailyAttendance({
        employee_id: emp1Id,
        employee_name: 'Deekshit Developer',
        date: '2026-09-01',
        status: 'PRESENT',
        punch_time: '09:05:00',
        notes: 'On time',
      });
      await dataStore.markDailyAttendance({
        employee_id: emp1Id,
        employee_name: 'Deekshit Developer',
        date: '2026-09-02',
        status: 'WORK_FROM_HOME',
        punch_time: '09:10:00',
        notes: 'Remote coding',
      });
      await dataStore.markDailyAttendance({
        employee_id: emp1Id,
        employee_name: 'Deekshit Developer',
        date: '2026-09-03',
        status: 'HALF_DAY',
        punch_time: '09:00:00',
        notes: 'Half day morning',
      });

      const records = await dataStore.getAttendanceRecords({
        employeeId: emp1Id,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });
      expect(records.length).toBe(3);

      const r1 = records.find((r) => r.date === '2026-09-01');
      expect(r1?.status).toBe('PRESENT');

      const r2 = records.find((r) => r.date === '2026-09-02');
      expect(r2?.status).toBe('WORK_FROM_HOME');

      const r3 = records.find((r) => r.date === '2026-09-03');
      expect(r3?.status).toBe('HALF_DAY');

      const presentCount = records.filter((r) => r.status === 'PRESENT' || r.status === 'WORK_FROM_HOME').length;
      const halfDayCount = records.filter((r) => r.status === 'HALF_DAY').length;
      const effectivePresent = presentCount + halfDayCount * 0.5; // 2 + 0.5 = 2.5
      expect(effectivePresent).toBe(2.5);
    });
  });

  describe('2. Threaded Mail and Counterpart Reply Resolution', () => {
    it('should aggregate all conversation messages chronologically by thread_id', async () => {
      const threadId = 'thread_arch_review_9988';

      const msg1 = await dataStore.createMessage({
        provider_message_id: 'msg_prov_001',
        thread_id: threadId,
        owner_user_id: user1.id,
        owner_alias_id: 'alias_001',
        folder: 'inbox',
        from_address: 'alex@cruvels.com',
        from_name: 'Alex Colleague',
        to_addresses: ['deekshit@cruvels.com'],
        subject: 'Architecture Review: Internal Portal Mail Gateway',
        snippet: 'Can we review the RFC this Thursday?',
        body_text: 'Hey Deekshit, Can we review the RFC this Thursday at 2 PM?',
        body_html: '<p>Hey Deekshit, Can we review the RFC this Thursday at 2 PM?</p>',
        is_read: true,
        is_starred: false,
        has_attachments: false,
        received_at: '2026-09-17T10:00:00Z',
        sent_at: '2026-09-17T10:00:00Z',
      });

      const msg2 = await dataStore.createMessage({
        provider_message_id: 'msg_prov_002',
        thread_id: threadId,
        owner_user_id: user1.id,
        owner_alias_id: 'alias_001',
        folder: 'sent',
        from_address: 'deekshit@cruvels.com',
        from_name: 'Deekshit Developer',
        to_addresses: ['alex@cruvels.com'],
        subject: 'Re: Architecture Review: Internal Portal Mail Gateway',
        snippet: 'Sounds good, let us do 2 PM.',
        body_text: 'Sounds good, let us do 2 PM. I have prepared the slides.',
        body_html: '<p>Sounds good, let us do 2 PM. I have prepared the slides.</p>',
        is_read: true,
        is_starred: false,
        has_attachments: false,
        received_at: null,
        sent_at: '2026-09-17T10:15:00Z',
      });

      const msg3 = await dataStore.createMessage({
        provider_message_id: 'msg_prov_003',
        thread_id: threadId,
        owner_user_id: user1.id,
        owner_alias_id: 'alias_001',
        folder: 'inbox',
        from_address: 'alex@cruvels.com',
        from_name: 'Alex Colleague',
        to_addresses: ['deekshit@cruvels.com'],
        subject: 'Re: Architecture Review: Internal Portal Mail Gateway',
        snippet: 'Calendar invite sent!',
        body_text: 'Awesome, invite sent. See you there.',
        body_html: '<p>Awesome, invite sent. See you there.</p>',
        is_read: false,
        is_starred: true,
        has_attachments: false,
        received_at: '2026-09-17T10:30:00Z',
        sent_at: '2026-09-17T10:30:00Z',
      });

      const threadMessages = await dataStore.getMessagesByThreadId(user1.id, threadId);
      expect(threadMessages.length).toBe(3);

      expect(threadMessages[0].id).toBe(msg1.id);
      expect(threadMessages[1].id).toBe(msg2.id);
      expect(threadMessages[2].id).toBe(msg3.id);
    });

    it('should resolve reply counterpart correctly when replying from Sent or Outbound email', () => {
      const userAliases = ['deekshit@cruvels.com', 'deekshit@internal.portal'];

      const inboundMsg = {
        from_address: 'alex@cruvels.com',
        to_addresses: ['deekshit@cruvels.com'],
      };

      const isFromSelfA = userAliases.some((a) => a.toLowerCase() === inboundMsg.from_address.toLowerCase());
      expect(isFromSelfA).toBe(false);

      const recipientA = isFromSelfA
        ? (inboundMsg.to_addresses.find((addr) => !userAliases.some((a) => a.toLowerCase() === addr.toLowerCase())) || inboundMsg.to_addresses[0])
        : inboundMsg.from_address;

      expect(recipientA).toBe('alex@cruvels.com');

      const sentMsg = {
        from_address: 'deekshit@cruvels.com',
        to_addresses: ['alex@cruvels.com'],
      };

      const isFromSelfB = userAliases.some((a) => a.toLowerCase() === sentMsg.from_address.toLowerCase());
      expect(isFromSelfB).toBe(true);

      const recipientB = isFromSelfB
        ? (sentMsg.to_addresses.find((addr) => !userAliases.some((a) => a.toLowerCase() === addr.toLowerCase())) || sentMsg.to_addresses[0])
        : sentMsg.from_address;

      expect(recipientB).toBe('alex@cruvels.com');
      expect(recipientB).not.toBe('deekshit@cruvels.com');
    });
  });

  describe('3. Spam Quarantine & Security Threat Management', () => {
    it('should mark message as spam, isolate to spam folder, and remove from inbox', async () => {
      const suspiciousMsg = await dataStore.createMessage({
        provider_message_id: 'msg_spam_001',
        thread_id: 'thread_phish_001',
        owner_user_id: user1.id,
        owner_alias_id: 'alias_001',
        folder: 'inbox',
        from_address: 'spammer@malicious-domain.xyz',
        from_name: 'Claim Your Bonus Prize',
        to_addresses: ['deekshit@cruvels.com'],
        subject: 'URGENT: Click to claim your lottery payout wire transfer',
        snippet: 'Click link immediately to verify crypto wallet...',
        body_text: 'Click link immediately to verify crypto wallet and bank credentials.',
        body_html: '<p>Click link immediately to verify crypto wallet and bank credentials.</p>',
        is_read: false,
        is_starred: false,
        has_attachments: false,
        received_at: '2026-09-17T11:00:00Z',
        sent_at: '2026-09-17T11:00:00Z',
        is_spam: false,
      });

      const initialInbox = await dataStore.getMessagesByOwner(user1.id, { folder: 'inbox' });
      expect(initialInbox.messages.some((m) => m.id === suspiciousMsg.id)).toBe(true);

      const quarantined = await dataStore.markMessageAsSpam(user1.id, suspiciousMsg.id);
      expect(quarantined).toBeDefined();
      expect(quarantined?.folder).toBe('spam');
      expect(quarantined?.is_spam).toBe(true);

      const updatedInbox = await dataStore.getMessagesByOwner(user1.id, { folder: 'inbox' });
      expect(updatedInbox.messages.some((m) => m.id === suspiciousMsg.id)).toBe(false);

      const spamFolder = await dataStore.getMessagesByOwner(user1.id, { folder: 'spam' });
      expect(spamFolder.messages.some((m) => m.id === suspiciousMsg.id)).toBe(true);

      const restored = await dataStore.unmarkMessageSpam(user1.id, suspiciousMsg.id);
      expect(restored).toBeDefined();
      expect(restored?.folder).toBe('inbox');
      expect(restored?.is_spam).toBe(false);

      const restoredInbox = await dataStore.getMessagesByOwner(user1.id, { folder: 'inbox' });
      expect(restoredInbox.messages.some((m) => m.id === suspiciousMsg.id)).toBe(true);
    });
  });
});
