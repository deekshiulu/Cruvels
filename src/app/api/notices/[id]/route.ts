import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

const UpdateNoticeSchema = z.object({
  title: z.string().min(3).max(150).optional(),
  content: z.string().min(5).max(2000).optional(),
  category: z.enum(['General', 'Urgent', 'Event', 'Policy', 'Engineering']).optional(),
  is_pinned: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireActiveUser(req);
    const { id } = await context.params;
    const notice = await dataStore.getNoticeById(id);
    if (!notice) {
      return NextResponse.json({ error: 'Notice not found.', success: false }, { status: 404 });
    }
    return NextResponse.json({ success: true, notice });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Only Managers and Admins can update notices.', success: false }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateNoticeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Invalid parameters.', success: false }, { status: 400 });
    }

    const updated = await dataStore.updateNotice(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Notice not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'NOTICE_UPDATED',
      resourceType: 'NOTICE',
      resourceId: id,
      metadata: { title: updated.title, isPinned: updated.is_pinned },
      req,
    });

    return NextResponse.json({ success: true, notice: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Only Managers and Admins can delete notices.', success: false }, { status: 403 });
    }

    const { id } = await context.params;
    const deleted = await dataStore.deleteNotice(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Notice not found.', success: false }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'NOTICE_DELETED',
      resourceType: 'NOTICE',
      resourceId: id,
      req,
    });

    return NextResponse.json({ success: true, message: 'Notice deleted successfully.' });
  } catch (err) {
    return handleApiError(err);
  }
}
