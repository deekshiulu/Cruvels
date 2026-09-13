import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  content: z.string().max(5000).optional(),
  category: z.string().max(30).optional(),
  color: z.enum(['blue', 'purple', 'amber', 'emerald', 'rose', 'slate']).optional(),
  is_pinned: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid note update.', success: false }, { status: 400 });
    }

    const { isPinned, ...rest } = parsed.data;
    const updated = await dataStore.updateNote(id, user.id, {
      ...rest,
      ...(typeof isPinned === 'boolean' ? { is_pinned: isPinned } : {}),
    });
    if (!updated) {
      return NextResponse.json({ error: 'Note not found or access denied', success: false }, { status: 404 });
    }

    return NextResponse.json({ success: true, note: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;

    const deleted = await dataStore.deleteNote(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: 'Note not found or access denied', success: false }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Note deleted.' });
  } catch (err) {
    return handleApiError(err);
  }
}
