import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

const CreateNoteSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().max(5000).default(''),
  category: z.string().max(30).default('Personal'),
  color: z.enum(['blue', 'purple', 'amber', 'emerald', 'rose', 'slate']).default('blue'),
  isPinned: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const notes = await dataStore.getNotes(user.id);
    return NextResponse.json({ success: true, notes });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parseRes = CreateNoteSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json({ error: 'Invalid note data.', success: false }, { status: 400 });
    }

    const { title, content, category, color, isPinned } = parseRes.data;
    const note = await dataStore.createNote({
      user_id: user.id,
      title,
      content,
      category,
      color,
      is_pinned: isPinned,
    });

    return NextResponse.json({ success: true, note });
  } catch (err) {
    return handleApiError(err);
  }
}
