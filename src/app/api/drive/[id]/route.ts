import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser(req);
    const { id } = await context.params;

    const resource = await dataStore.getDriveResourceById(id);
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found.', success: false }, { status: 404 });
    }

    // Authorization: owner or admin/manager can delete
    const isOwner = resource.owner_user_id === user.id;
    const isAdmin = user.role === 'admin' || user.role === 'manager';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden. You can only remove resources you linked or have admin rights.', success: false },
        { status: 403 }
      );
    }

    const deleted = await dataStore.deleteDriveResource(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete resource.', success: false }, { status: 500 });
    }

    await logAuditEvent({
      userId: user.id,
      action: 'DRIVE_RESOURCE_REMOVED',
      resourceType: 'DRIVE_RESOURCE',
      resourceId: id,
      metadata: { name: resource.name },
      req,
    });

    return NextResponse.json({ success: true, message: 'Resource link removed.' });
  } catch (err) {
    return handleApiError(err);
  }
}
