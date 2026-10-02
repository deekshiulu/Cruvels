import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { logAuditEvent } from '@/lib/audit/logger';
import { DriveSection } from '@/lib/db/types';

const CreateDriveResourceSchema = z.object({
  name: z.string().min(2, 'Name is required').max(150),
  description: z.string().max(500).optional(),
  section: z.enum(['my_files', 'shared_files', 'project_files', 'company_resources']),
  fileType: z.enum(['doc', 'sheet', 'slide', 'pdf', 'folder', 'archive', 'link']),
  externalUrl: z.string().url('Must be a valid URL'),
  groupId: z.string().optional(),
  isCompanyWide: z.boolean().optional(),
  sharedWithUserIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const section = (searchParams.get('section') as DriveSection) || undefined;

    const emp = await dataStore.getEmployeeByUserId(user.id);
    const isAdmin = user.role === 'admin' || user.role === 'manager';

    const resources = await dataStore.getDriveResources({
      userId: user.id,
      groupId: emp?.group_id || undefined,
      section,
      isAdmin,
    });

    return NextResponse.json({ success: true, resources });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const body = await req.json();
    const parsed = CreateDriveResourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid resource data.', success: false },
        { status: 400 }
      );
    }

    const { name, description, section, fileType, externalUrl, groupId, isCompanyWide, sharedWithUserIds } = parsed.data;
    const emp = await dataStore.getEmployeeByUserId(user.id);

    // Permissions check (§ 12.3)
    if (section === 'company_resources' && user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json(
        { error: 'Only administrators and managers can publish company-wide resources.', success: false },
        { status: 403 }
      );
    }

    let targetGroupId = groupId;
    let targetGroupName: string | undefined = undefined;

    if (section === 'project_files') {
      if (!targetGroupId && emp?.group_id) {
        targetGroupId = emp.group_id;
      }
      if (targetGroupId) {
        const grp = await dataStore.getGroupById(targetGroupId);
        if (grp) targetGroupName = grp.name;
      }
    }

    const resource = await dataStore.createDriveResource({
      name,
      description: description || '',
      section,
      file_type: fileType,
      external_url: externalUrl,
      owner_user_id: user.id,
      owner_name: user.name,
      group_id: targetGroupId,
      group_name: targetGroupName,
      is_company_wide: Boolean(isCompanyWide || section === 'company_resources'),
      shared_with_user_ids: sharedWithUserIds || [],
    });

    await logAuditEvent({
      userId: user.id,
      action: 'DRIVE_RESOURCE_LINKED',
      resourceType: 'DRIVE_RESOURCE',
      resourceId: resource.id,
      metadata: { name: resource.name, section: resource.section },
      req,
    });

    return NextResponse.json({ success: true, resource });
  } catch (err) {
    return handleApiError(err);
  }
}
