/**
 * Universal Acknowledgement System Service (Roadmap §§ 5, 6, 7, 8, 28, 29)
 * Reusable core engine managing acknowledgement requirements, recipient tracking,
 * status transitions (pending, acknowledged, overdue), automated reminders, and compliance audits.
 */

import { dataStore } from '@/lib/db/store';
import {
  UniversalAcknowledgement,
  AcknowledgementItemType,
  AcknowledgementStatus,
  AcknowledgementSummary,
  Employee,
  User,
} from '@/lib/db/types';
import { logAuditEvent } from '@/lib/audit/logger';

export interface RegisterAcknowledgementInput {
  itemType: AcknowledgementItemType;
  itemId: string;
  itemTitle: string;
  targetAudience?: 'all' | 'interns' | 'employees' | 'engineering' | 'squad' | 'custom';
  targetGroupId?: string;
  targetDepartmentId?: string;
  specificUserIds?: string[];
  dueAt?: string; // ISO date-time or YYYY-MM-DD
  metadata?: Record<string, any>;
  registeredByUserId?: string;
}

export interface RecordAcknowledgementInput {
  itemType: AcknowledgementItemType;
  itemId: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  notes?: string;
}

export class AcknowledgementService {
  /**
   * Registers acknowledgement requirements for an item across targeted workforce (§ 5.1, § 8).
   */
  public async registerRequirement(input: RegisterAcknowledgementInput): Promise<{
    count: number;
    acknowledgements: UniversalAcknowledgement[];
  }> {
    const activeEmployees = await dataStore.getEmployees({ status: 'ACTIVE' });
    const allUsers = await dataStore.listUsers();
    const userMap = new Map<string, User>(allUsers.map((u) => [u.id, u]));
    const empUserIds = new Set<string>();

    let targetEmployees: Employee[] = [];

    if (input.targetAudience === 'interns') {
      targetEmployees = activeEmployees.filter((e) => {
        const u = userMap.get(e.user_id);
        return u?.role === 'intern';
      });
    } else if (input.targetAudience === 'engineering') {
      targetEmployees = activeEmployees.filter(
        (e) => e.department_name.toLowerCase().includes('eng') || e.department_id === 'dep-001'
      );
    } else if (input.targetAudience === 'squad' && input.targetGroupId) {
      targetEmployees = activeEmployees.filter((e) => e.group_id === input.targetGroupId);
    } else if (input.targetAudience === 'custom' && input.specificUserIds && input.specificUserIds.length > 0) {
      const allowedSet = new Set(input.specificUserIds);
      targetEmployees = activeEmployees.filter((e) => allowedSet.has(e.user_id));
      for (const uid of input.specificUserIds) {
        empUserIds.add(uid);
      }
    } else {
      // 'all' or default
      targetEmployees = [...activeEmployees];
    }

    for (const e of targetEmployees) {
      empUserIds.add(e.user_id);
    }

    const recordsToCreate: Omit<UniversalAcknowledgement, 'id' | 'created_at' | 'updated_at'>[] = [];

    for (const userId of empUserIds) {
      const emp = activeEmployees.find((e) => e.user_id === userId);
      const user = userMap.get(userId);

      recordsToCreate.push({
        item_type: input.itemType,
        item_id: input.itemId,
        item_title: input.itemTitle,
        recipient_user_id: userId,
        recipient_name: emp?.name || user?.name || 'Team Member',
        recipient_role: user?.role || 'intern',
        recipient_email: emp?.email || user?.username || '',
        department_id: emp?.department_id,
        department_name: emp?.department_name || '',
        group_id: emp?.group_id || null,
        group_name: emp?.group_name || null,
        status: 'pending',
        due_at: input.dueAt,
        metadata: input.metadata || {},
      });
    }

    const created = await dataStore.createAcknowledgements(recordsToCreate);

    // Notify recipients of the acknowledgement requirement
    for (const ack of created) {
      await dataStore.createNotification({
        user_id: ack.recipient_user_id,
        type: 'notice',
        category: 'acknowledgement_required',
        title: `Acknowledgement Required: ${input.itemTitle}`,
        message: `Please review and acknowledge "${input.itemTitle}"${input.dueAt ? ` by ${new Date(input.dueAt).toLocaleDateString('en-GB')}` : ''}.`,
        link_url: input.itemType === 'notice' ? '/notices' : input.itemType === 'task' ? '/tasks' : '/admin/acknowledgements',
        metadata: {
          acknowledgementId: ack.id,
          itemId: input.itemId,
          itemType: input.itemType,
          dueAt: input.dueAt,
        },
      });
    }

    if (input.registeredByUserId) {
      await logAuditEvent({
        userId: input.registeredByUserId,
        action: 'ACKNOWLEDGEMENT_REQUIREMENT_REGISTERED',
        resourceType: input.itemType,
        resourceId: input.itemId,
        metadata: {
          itemTitle: input.itemTitle,
          recipientCount: created.length,
          targetAudience: input.targetAudience,
          dueAt: input.dueAt,
        },
      });
    }

    return { count: created.length, acknowledgements: created };
  }

  /**
   * Records that an employee has reviewed and acknowledged an item (§ 5.3).
   */
  public async acknowledge(input: RecordAcknowledgementInput): Promise<UniversalAcknowledgement | null> {
    const record = await dataStore.recordAcknowledgement({
      itemType: input.itemType,
      itemId: input.itemId,
      userId: input.userId,
      ip: input.ip,
      userAgent: input.userAgent,
      notes: input.notes,
    });

    if (record) {
      await logAuditEvent({
        userId: input.userId,
        action: 'ITEM_ACKNOWLEDGED',
        resourceType: input.itemType,
        resourceId: input.itemId,
        metadata: {
          acknowledgementId: record.id,
          itemTitle: record.item_title,
          acknowledgedAt: record.acknowledged_at,
          ip: input.ip,
        },
      });

      // Clear/Mark action-required notifications for this item
      const notifications = await dataStore.getNotifications(input.userId, { isRead: false });
      for (const n of notifications) {
        if (n.metadata?.itemId === input.itemId && n.metadata?.itemType === input.itemType) {
          await dataStore.markNotificationAsRead(n.id, input.userId);
        }
      }
    }

    return record;
  }

  /**
   * Retrieves all acknowledgements assigned to a specific user (§ 5.2).
   */
  public async getUserAcknowledgements(
    userId: string,
    filterStatus?: AcknowledgementStatus
  ): Promise<UniversalAcknowledgement[]> {
    return dataStore.getAcknowledgements({
      recipientUserId: userId,
      status: filterStatus,
    });
  }

  /**
   * Retrieves summary analytics and recipient audit breakdown for an item (§ 6).
   */
  public async getItemSummary(
    itemType: AcknowledgementItemType,
    itemId: string
  ): Promise<AcknowledgementSummary> {
    // First update any overdue items if due_at has passed
    await this.evaluatePendingAndOverdue();
    return dataStore.getItemAcknowledgementSummary(itemType, itemId);
  }

  /**
   * Evaluates pending acknowledgements against deadlines and marks past due items as 'overdue' (§ 5.2).
   */
  public async evaluatePendingAndOverdue(nowIso: string = new Date().toISOString()): Promise<number> {
    const allPending = await dataStore.getAcknowledgements({ status: 'pending' });
    let updatedCount = 0;

    for (const item of allPending) {
      if (item.due_at && item.due_at < nowIso) {
        await dataStore.updateAcknowledgementStatus(item.id, 'overdue');
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Dispatches automated, non-spam reminder notifications for pending or overdue acknowledgements (§ 7).
   */
  public async processReminders(options?: {
    itemType?: AcknowledgementItemType;
    itemId?: string;
  }): Promise<{ remindersSent: number }> {
    await this.evaluatePendingAndOverdue();

    const pendingAndOverdue = await dataStore.getAcknowledgements({
      itemType: options?.itemType,
      itemId: options?.itemId,
    });

    const activeItems = pendingAndOverdue.filter(
      (a) => a.status === 'pending' || a.status === 'overdue'
    );

    let remindersSent = 0;
    const now = Date.now();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    for (const ack of activeItems) {
      // Check for anti-spam: has user received an acknowledgement reminder for this item in the last 12 hours?
      const userNotifs = await dataStore.getNotifications(ack.recipient_user_id, { limit: 20 });
      const recentReminder = userNotifs.find(
        (n) =>
          n.category === 'acknowledgement_reminder' &&
          n.metadata?.acknowledgementId === ack.id &&
          now - new Date(n.created_at).getTime() < TWELVE_HOURS_MS
      );

      if (recentReminder) continue;

      const isOverdue = ack.status === 'overdue';
      const title = isOverdue
        ? `⚠️ OVERDUE: Acknowledgement Required for "${ack.item_title}"`
        : `Reminder: Please Acknowledge "${ack.item_title}"`;

      const message = isOverdue
        ? `Your acknowledgement for "${ack.item_title}" was due on ${ack.due_at ? new Date(ack.due_at).toLocaleDateString('en-GB') : 'an earlier date'}. Please review and confirm receipt immediately.`
        : `This is a reminder to review and confirm receipt of "${ack.item_title}".`;

      await dataStore.createNotification({
        user_id: ack.recipient_user_id,
        type: 'notice',
        category: 'acknowledgement_reminder',
        title,
        message,
        link_url: ack.item_type === 'notice' ? '/notices' : ack.item_type === 'task' ? '/tasks' : '/admin/acknowledgements',
        metadata: {
          acknowledgementId: ack.id,
          itemId: ack.item_id,
          itemType: ack.item_type,
          status: ack.status,
          dueAt: ack.due_at,
        },
      });

      remindersSent++;
    }

    if (remindersSent > 0) {
      await logAuditEvent({
        action: 'ACKNOWLEDGEMENT_REMINDERS_DISPATCHED',
        resourceType: options?.itemType || 'universal_acknowledgement',
        resourceId: options?.itemId || 'batch',
        metadata: {
          remindersSent,
          totalPendingOrOverdue: activeItems.length,
        },
      });
    }

    return { remindersSent };
  }

  /**
   * Retrieves high-level dashboard metrics for all platform acknowledgements (Admin Console § 6).
   */
  public async getGlobalMetrics(): Promise<{
    totalRequirements: number;
    totalRecipients: number;
    acknowledgedCount: number;
    pendingCount: number;
    overdueCount: number;
    complianceRate: number;
    items: Array<{
      itemId: string;
      itemType: AcknowledgementItemType;
      itemTitle: string;
      total: number;
      acknowledged: number;
      pending: number;
      overdue: number;
      rate: number;
      dueAt?: string;
    }>;
  }> {
    await this.evaluatePendingAndOverdue();
    const allAcks = await dataStore.getAcknowledgements();

    // Group by (item_type, item_id)
    const groups = new Map<string, UniversalAcknowledgement[]>();
    for (const ack of allAcks) {
      const key = `${ack.item_type}::${ack.item_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ack);
    }

    const itemsSummary: Array<{
      itemId: string;
      itemType: AcknowledgementItemType;
      itemTitle: string;
      total: number;
      acknowledged: number;
      pending: number;
      overdue: number;
      rate: number;
      dueAt?: string;
    }> = [];

    let totalRecipients = 0;
    let totalAcknowledged = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    for (const [_, acks] of groups) {
      const total = acks.length;
      const acknowledged = acks.filter((a) => a.status === 'acknowledged').length;
      const overdue = acks.filter((a) => a.status === 'overdue').length;
      const pending = acks.filter((a) => a.status === 'pending').length;
      const rate = total > 0 ? Math.round((acknowledged / total) * 100) : 100;

      totalRecipients += total;
      totalAcknowledged += acknowledged;
      totalPending += pending;
      totalOverdue += overdue;

      itemsSummary.push({
        itemId: acks[0].item_id,
        itemType: acks[0].item_type,
        itemTitle: acks[0].item_title,
        total,
        acknowledged,
        pending,
        overdue,
        rate,
        dueAt: acks[0].due_at,
      });
    }

    const overallRate = totalRecipients > 0 ? Math.round((totalAcknowledged / totalRecipients) * 100) : 100;

    return {
      totalRequirements: groups.size,
      totalRecipients,
      acknowledgedCount: totalAcknowledged,
      pendingCount: totalPending,
      overdueCount: totalOverdue,
      complianceRate: overallRate,
      items: itemsSummary,
    };
  }
}

export const acknowledgementService = new AcknowledgementService();
