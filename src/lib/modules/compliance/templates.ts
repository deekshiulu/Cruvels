/**
 * Standardized Compliance Communication Templates (Roadmap § 4)
 * Configurable templates with parameter interpolation for compliance events.
 */

export interface ComplianceTemplate {
  id: string;
  category: 'attendance' | 'task' | 'acknowledgement' | 'policy';
  title: string;
  bodyTemplate: string;
  severity: 'info' | 'warning' | 'critical';
  actionUrl?: string;
  actionLabel?: string;
}

export const COMPLIANCE_TEMPLATES: Record<string, ComplianceTemplate> = {
  ATTENDANCE_NOT_MARKED_MORNING: {
    id: 'ATTENDANCE_NOT_MARKED_MORNING',
    category: 'attendance',
    title: 'Daily Attendance Reminder',
    bodyTemplate: 'Good morning {{userName}}, your attendance for today ({{date}}) has not been recorded yet. Please punch in before the {{deadline}} deadline.',
    severity: 'info',
    actionUrl: '/attendance',
    actionLabel: 'Mark Attendance',
  },
  ATTENDANCE_NOT_MARKED_DEADLINE: {
    id: 'ATTENDANCE_NOT_MARKED_DEADLINE',
    category: 'attendance',
    title: 'Attendance Deadline Passed',
    bodyTemplate: 'Attention {{userName}}: The attendance marking deadline ({{deadline}}) has passed. Your record is currently marked as Not Marked. Please mark your attendance immediately to avoid a non-compliance record.',
    severity: 'warning',
    actionUrl: '/attendance',
    actionLabel: 'Mark Attendance Now',
  },
  ATTENDANCE_MARKED_LATE: {
    id: 'ATTENDANCE_MARKED_LATE',
    category: 'attendance',
    title: 'Late Attendance Notice',
    bodyTemplate: 'Hello {{userName}}, your attendance for {{date}} was recorded at {{punchTime}}, which is past the {{deadline}} deadline. This will be tracked in your monthly compliance record.',
    severity: 'warning',
    actionUrl: '/attendance',
    actionLabel: 'View Attendance',
  },
  ATTENDANCE_CORRECTION_SUBMITTED: {
    id: 'ATTENDANCE_CORRECTION_SUBMITTED',
    category: 'attendance',
    title: 'Attendance Correction Submitted',
    bodyTemplate: 'Your attendance correction request for {{date}} (Requested: {{requestedStatus}}) has been submitted and is pending review by your supervisor.',
    severity: 'info',
    actionUrl: '/attendance',
    actionLabel: 'Check Status',
  },
  ATTENDANCE_CORRECTION_APPROVED: {
    id: 'ATTENDANCE_CORRECTION_APPROVED',
    category: 'attendance',
    title: 'Attendance Correction Approved',
    bodyTemplate: 'Your correction request for {{date}} has been approved by {{reviewerName}}. Your status has been updated to {{requestedStatus}}.',
    severity: 'info',
    actionUrl: '/attendance',
    actionLabel: 'View Record',
  },
  ATTENDANCE_CORRECTION_REJECTED: {
    id: 'ATTENDANCE_CORRECTION_REJECTED',
    category: 'attendance',
    title: 'Attendance Correction Rejected',
    bodyTemplate: 'Your correction request for {{date}} was reviewed by {{reviewerName}} and rejected. Reason: {{reviewNotes}}',
    severity: 'critical',
    actionUrl: '/attendance',
    actionLabel: 'View Details',
  },
  ATTENDANCE_CORRECTION_PENDING_REVIEWER: {
    id: 'ATTENDANCE_CORRECTION_PENDING_REVIEWER',
    category: 'attendance',
    title: 'Pending Attendance Correction Review',
    bodyTemplate: '{{employeeName}} has requested an attendance correction for {{date}} (from {{currentStatus}} to {{requestedStatus}}). Please review the justification: "{{reason}}"',
    severity: 'warning',
    actionUrl: '/admin/attendance-compliance',
    actionLabel: 'Review Request',
  },
};

/**
 * Format a template with variable substitutions.
 */
export function formatComplianceMessage(
  templateKey: string,
  variables: Record<string, string | number>
): { title: string; body: string; severity: 'info' | 'warning' | 'critical'; actionUrl?: string; actionLabel?: string } {
  const template = COMPLIANCE_TEMPLATES[templateKey];
  if (!template) {
    return {
      title: 'Compliance Notification',
      body: String(variables.body || 'You have a compliance alert.'),
      severity: 'info',
      actionUrl: variables.actionUrl ? String(variables.actionUrl) : undefined,
      actionLabel: variables.actionLabel ? String(variables.actionLabel) : undefined,
    };
  }

  let body = template.bodyTemplate;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    body = body.replace(regex, String(val));
  }

  return {
    title: template.title,
    body,
    severity: template.severity,
    actionUrl: template.actionUrl,
    actionLabel: template.actionLabel,
  };
}
