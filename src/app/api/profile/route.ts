import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, applySessionCookie } from '@/lib/auth/session';
import { getPasswordPolicyError } from '@/lib/auth/password-policy';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateProfileSchema = z.object({
  phone: z.string().min(5).max(25).optional(),
  personalEmail: z.string().email('Valid personal email is required').optional().or(z.literal('')),
  tagline: z.string().max(120, 'Tagline max length is 120 characters').optional(),
  currentPassword: z.string().max(100).optional(),
  newPassword: z.string().max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const employee = await dataStore.getEmployeeByUserId(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        primaryAlias: user.primaryAlias,
        assignedAliases: user.assignedAliases,
        mustChangePassword: Boolean(user.mustChangePassword),
      },
      employee: employee || null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid profile update data.', success: false },
        { status: 400 }
      );
    }

    const { phone, personalEmail, tagline, currentPassword, newPassword } = parsed.data;

    // Handle password change if requested
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to set a new password.', success: false },
          { status: 400 }
        );
      }

      const policyError = getPasswordPolicyError(newPassword);
      if (policyError) {
        return NextResponse.json({ error: policyError, success: false }, { status: 400 });
      }

      const passRes = await dataStore.changeUserPassword(user.id, currentPassword, newPassword);
      if (!passRes.success) {
        return NextResponse.json({ error: passRes.error || 'Password update failed.', success: false }, { status: 400 });
      }

      await logAuditEvent({
        userId: user.id,
        action: 'PASSWORD_CHANGED',
        resourceType: 'USER',
        resourceId: user.id,
        req,
      });
    }

    // Update profile metadata
    const updatedEmp = await dataStore.updateEmployeeProfile(user.id, {
      phone: phone || undefined,
      personal_email: personalEmail || undefined,
      tagline: tagline || undefined,
    });

    await logAuditEvent({
      userId: user.id,
      action: 'PROFILE_UPDATED',
      resourceType: 'EMPLOYEE',
      resourceId: updatedEmp?.id || user.id,
      metadata: { phone, personalEmail, tagline },
      req,
    });

    const response = NextResponse.json({
      success: true,
      message: newPassword
        ? 'Password updated. Your session has been renewed.'
        : 'Profile updated successfully.',
      employee: updatedEmp,
      mustChangePassword: false,
    });

    if (newPassword) {
      const dbUser = await dataStore.getUserById(user.id);
      if (dbUser) {
        const aliases = await dataStore.getAliasesByUserId(user.id);
        const token = await createSessionToken(
          dbUser,
          aliases.filter((a) => a.is_active).map((a) => a.email_address)
        );
        applySessionCookie(response, token);
      }
    }

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
