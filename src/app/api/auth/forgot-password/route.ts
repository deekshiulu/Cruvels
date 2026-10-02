import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dataStore } from '@/lib/db/store';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logAuditEvent } from '@/lib/audit/logger';
import { dispatchNotification } from '@/lib/notifications/dispatch';
import { User } from '@/lib/db/types';

const ForgotPasswordSchema = z.object({
  email: z.string().min(2, 'Email or username is required').max(100),
  role: z.enum(['intern', 'employee', 'team_lead', 'manager', 'admin'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
  reason: z.string().max(300).optional(),
});

const ROLE_HIERARCHY: Record<string, number> = {
  intern: 1,
  employee: 2,
  team_lead: 3,
  manager: 4,
  admin: 5,
};

const ROLE_LABELS: Record<string, string> = {
  intern: 'Intern',
  employee: 'Employee',
  team_lead: 'Team Lead / Squad Lead',
  manager: 'Manager',
  admin: 'Administrator',
};

export async function POST(req: NextRequest) {
  const rawIp =
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1';
  const isIpValid = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-fA-F0-9:]+$/.test(rawIp);
  const ip = isIpValid ? rawIp : '127.0.0.1';

  // 1. Rate Limiting Check (5 attempts per 10 minutes per IP)
  const ipCheck = await checkRateLimit(`forgot-pwd:ip:${ip}`, 5, 600);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      {
        error: `Too many password reset requests. Please try again in ${ipCheck.resetInSec} seconds.`,
        success: false,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parseRes = ForgotPasswordSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        {
          error: parseRes.error.errors[0]?.message || 'Invalid request details submitted.',
          success: false,
        },
        { status: 400 }
      );
    }

    const { email: rawEmail, role, reason } = parseRes.data;
    const cleanIdent = rawEmail.trim();

    // 2. Rate Limiting by Identity (3 attempts per 10 minutes)
    const identCheck = await checkRateLimit(
      `forgot-pwd:ident:${cleanIdent.toLowerCase()}`,
      3,
      600
    );
    if (!identCheck.allowed) {
      return NextResponse.json(
        {
          error: `A password reset request was recently submitted for this account. Please wait ${identCheck.resetInSec} seconds before requesting again.`,
          success: false,
        },
        { status: 429 }
      );
    }

    // 3. Resolve requester user & employee profile
    let user = await dataStore.getUserByUsername(cleanIdent);
    if (!user) {
      user = await dataStore.getUserByEmail(cleanIdent);
    }

    const employee = user ? await dataStore.getEmployeeByUserId(user.id) : null;
    const requesterName = user?.name || employee?.name || cleanIdent.split('@')[0];
    const requesterLevel = ROLE_HIERARCHY[role.toLowerCase()] || 1;
    const roleLabel = ROLE_LABELS[role.toLowerCase()] || role;

    // 4. Identify higher officials (Hierarchically higher + Squad Leaders + Admins)
    const allUsers = await dataStore.listUsers();
    const higherOfficials: User[] = [];

    // 4a. If in a squad/group, add group leader if distinct from requester
    if (employee?.group_id) {
      const group = await dataStore.getGroupById(employee.group_id);
      if (group?.leader_id) {
        const leaderEmp = await dataStore.getEmployeeById(group.leader_id);
        if (leaderEmp?.user_id) {
          const leaderUser = await dataStore.getUserById(leaderEmp.user_id);
          if (leaderUser && leaderUser.id !== user?.id && leaderUser.status === 'active') {
            higherOfficials.push(leaderUser);
          }
        }
      }
    }

    // 4b. If in a department, add department head if distinct from requester
    if (employee?.department_id) {
      const dept = await dataStore.getDepartmentById(employee.department_id);
      if (dept?.head_id) {
        const headEmp = await dataStore.getEmployeeById(dept.head_id);
        if (headEmp?.user_id) {
          const headUser = await dataStore.getUserById(headEmp.user_id);
          if (
            headUser &&
            headUser.id !== user?.id &&
            headUser.status === 'active' &&
            !higherOfficials.some((h) => h.id === headUser.id)
          ) {
            higherOfficials.push(headUser);
          }
        }
      }
    }

    // 4c. Add users who have a higher hierarchy level than the requester, plus all system admins
    for (const u of allUsers) {
      if (u.id === user?.id || u.status !== 'active') continue;
      const uLevel = ROLE_HIERARCHY[u.role] || 1;
      if (uLevel > requesterLevel || u.role === 'admin') {
        if (!higherOfficials.some((h) => h.id === u.id)) {
          higherOfficials.push(u);
        }
      }
    }

    // 4d. Fallback: If no higher officials found (e.g. requester is Admin), notify Master Admin
    if (higherOfficials.length === 0) {
      const masterAdmin =
        allUsers.find((u) => u.username === 'admin' && u.status === 'active') ||
        allUsers.find((u) => u.role === 'admin' && u.status === 'active');
      if (masterAdmin && masterAdmin.id !== user?.id) {
        higherOfficials.push(masterAdmin);
      }
    }

    const indianTimestamp = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    // 5. Route alerts and dispatches to every higher official
    for (const official of higherOfficials) {
      // 5a. Create in-app high-priority notification with realtime dispatch
      try {
        const notif = await dataStore.createNotification({
          user_id: official.id,
          type: 'system',
          category: 'action_required',
          title: `Password Reset Request: ${requesterName}`,
          message: `${requesterName} (${cleanIdent}, Role: ${roleLabel}) requested a password reset. Reason: ${reason || 'Forgot password'}. Please review and update credentials.`,
          action_url: `/admin`,
          action_label: 'Manage in Admin',
          state: 'action_required',
          metadata: {
            requester_email: cleanIdent,
            requester_role: role,
            requester_name: requesterName,
            requester_user_id: user?.id,
            reason: reason || 'Forgot password',
            ip,
            requested_at: new Date().toISOString(),
          },
        });
        await dispatchNotification(notif);
      } catch (notifErr) {
        console.error('[FORGOT-PASSWORD] Notification dispatch error:', notifErr);
      }

      // 5b. Deposit an official internal email message into the higher official's inbox
      try {
        const aliases = await dataStore.getAliasesByUserId(official.id);
        const officialAlias =
          aliases.find((a) => a.is_active)?.email_address || `${official.username}@cruvels.com`;

        await dataStore.createMessage({
          owner_user_id: official.id,
          owner_alias_id: officialAlias,
          provider_message_id: `pwd_reset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          thread_id: `thread_pwd_reset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          from_address: 'security-gateway@cruvels.com',
          from_name: 'Cruvels Security Gateway',
          to_addresses: [officialAlias],
          subject: `[ACTION REQUIRED] Password Reset Request: ${requesterName} (${roleLabel})`,
          body_text: `Attention ${official.name},\n\nA password reset request has been lodged on the Cruvels Internal Workplace Portal.\n\nRequester Details:\n- Employee Name: ${requesterName}\n- Identity / Email: ${cleanIdent}\n- Declared Role: ${roleLabel}\n- Reason / Notes: ${reason || 'Forgot login password'}\n- Origin IP: ${ip}\n- Timestamp: ${indianTimestamp} IST\n\nAs an authorized higher supervisory official (${official.role.toUpperCase()}), this ticket has been routed to you. Please verify the requester's identity before updating or resetting their credentials in the Admin Portal.\n\nCruvels Zero-Trust Identity Gateway`,
          body_html: `<div class="email-card" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0A192F; line-height: 1.6; max-width: 600px; padding: 8px 0;">
            <div class="email-card-header" style="background: #0A192F; color: #FFFFFF; padding: 18px 24px; border-radius: 12px 12px 0 0;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #FFFFFF !important;">Cruvels Security Gateway</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94A3B8 !important;">Zero-Trust Password Reset Escalation</p>
            </div>
            <div class="email-card-body" style="background: #FFFFFF; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; margin-top: 0; color: #0A192F; font-weight: 500;">A password reset request has been routed to you as an authorized higher official:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 0; color: #64748B; width: 140px; font-weight: 600;">Employee Name:</td>
                  <td style="padding: 10px 0; color: #0A192F; font-weight: 700;">${requesterName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Account / Email:</td>
                  <td style="padding: 10px 0; color: #0A192F; font-family: monospace; font-weight: 600;">${cleanIdent}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Declared Role:</td>
                  <td style="padding: 10px 0; color: #0A369D; font-weight: 700;">${roleLabel}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Reason / Notes:</td>
                  <td style="padding: 10px 0; color: #0A192F;">${reason || 'Forgot login password'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Timestamp:</td>
                  <td style="padding: 10px 0; color: #0A192F;">${indianTimestamp} IST</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Origin IP:</td>
                  <td style="padding: 10px 0; color: #64748B; font-family: monospace;">${ip}</td>
                </tr>
              </table>
              <div style="margin-top: 24px; padding-top: 8px;">
                <a href="/admin" class="email-action-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #0A369D; color: #FFFFFF !important; text-decoration: none !important; padding: 11px 22px; border-radius: 9px; font-size: 13px; font-weight: 700; letter-spacing: 0.01em; box-shadow: 0 2px 8px rgba(10, 54, 157, 0.25);">
                  Open Admin Controls &rarr;
                </a>
              </div>
            </div>
          </div>`,
          snippet: `Password reset request received for ${requesterName} (${roleLabel}). Please review credentials in Admin.`,
          folder: 'inbox',
          is_read: false,
          is_starred: true,
          has_attachments: false,
          received_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        });
      } catch (mailErr) {
        console.error('[FORGOT-PASSWORD] Internal mail creation error:', mailErr);
      }
    }

    // 6. Log Audit Trail
    await logAuditEvent({
      userId: user?.id || null,
      action: 'PASSWORD_RESET_REQUESTED',
      resourceType: 'AUTH',
      resourceId: cleanIdent,
      metadata: {
        email: cleanIdent,
        declaredRole: role,
        reason: reason || 'Forgot password',
        officialsNotified: higherOfficials.map((o) => ({
          id: o.id,
          name: o.name,
          role: o.role,
        })),
        officialsCount: higherOfficials.length,
      },
      req,
    });

    const officialsSummary =
      higherOfficials.length > 0
        ? higherOfficials.map((o) => `${o.name} (${ROLE_LABELS[o.role] || o.role})`).join(', ')
        : 'Administration & Supervisory Team';

    return NextResponse.json({
      success: true,
      message: `Password reset request successfully dispatched to your higher officials (${officialsSummary}). They will verify your credentials and issue a reset.`,
      data: {
        requesterName,
        declaredRole: roleLabel,
        officialsNotifiedCount: higherOfficials.length,
        officialsSummary,
        timestamp: indianTimestamp,
      },
    });
  } catch (err) {
    console.error('[FORGOT-PASSWORD ERROR]', err);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while routing your password reset request. Please contact your administrator directly.',
        success: false,
      },
      { status: 500 }
    );
  }
}
