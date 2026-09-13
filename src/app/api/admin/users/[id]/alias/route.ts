import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleApiError, validateEmailString } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const AssignAliasSchema = z.object({
  emailAddress: z.string().min(3).max(100),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await context.params;

    const user = await dataStore.getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found.', success: false }, { status: 404 });
    }

    const body = await req.json();
    const parseRes = AssignAliasSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: 'Invalid email address format.', success: false }, { status: 400 });
    }

    const cleanEmail = parseRes.data.emailAddress.toLowerCase().trim();
    if (!validateEmailString(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid email format.', success: false }, { status: 400 });
    }

    // Check if assigned elsewhere
    const existing = await dataStore.getAliasByEmail(cleanEmail);
    if (existing) {
      if (existing.user_id === user.id) {
        return NextResponse.json({ error: 'Alias is already assigned to this user.', success: false }, { status: 400 });
      }
      return NextResponse.json({ error: 'Alias is already assigned to another user.', success: false }, { status: 409 });
    }

    const createdAlias = await dataStore.createAlias(user.id, cleanEmail);

    await logAuditEvent({
      userId: admin.id,
      action: 'ADMIN_ASSIGN_ALIAS',
      resourceType: 'ALIAS',
      resourceId: createdAlias.id,
      metadata: { targetUserId: user.id, username: user.username, alias: cleanEmail },
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Alias assigned successfully.',
      alias: createdAlias,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
