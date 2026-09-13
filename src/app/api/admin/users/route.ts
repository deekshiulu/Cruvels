import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, handleApiError, validateEmailString } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';
import { hashPassword } from '@/lib/auth/session';
import { getPasswordPolicyError } from '@/lib/auth/password-policy';
import { logAuditEvent } from '@/lib/audit/logger';

const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Username must contain only letters, numbers, dots, and hyphens'),
  password: z.string().min(10, 'Password must be at least 10 characters long'),
  role: z.enum(['admin', 'manager', 'team_lead', 'employee', 'intern']).default('intern'),
  initialAlias: z.string().min(3).max(100),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const users = await dataStore.listUsers();
    const allAliases = await dataStore.listAllAliases();

    const usersWithAliases = users.map((u) => {
      const userAliases = allAliases.filter((a) => a.user_id === u.id);
      return {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        status: u.status,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        aliases: userAliases.map((a) => ({
          id: a.id,
          email_address: a.email_address,
          is_active: a.is_active,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      users: usersWithAliases,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();

    const parseRes = CreateUserSchema.safeParse(body);
    if (!parseRes.success) {
      return NextResponse.json(
        { error: parseRes.error.errors[0]?.message || 'Invalid user data.', success: false },
        { status: 400 }
      );
    }

    const { name, username, password, role, initialAlias } = parseRes.data;

    // Check existing username
    const existingUser = await dataStore.getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { error: `Username "${username}" is already in use.`, success: false },
        { status: 409 }
      );
    }

    // Validate alias format
    const cleanAlias = initialAlias.toLowerCase().trim();
    if (!validateEmailString(cleanAlias)) {
      return NextResponse.json(
        { error: 'Invalid email alias format.', success: false },
        { status: 400 }
      );
    }

    // Check existing alias
    const existingAlias = await dataStore.getAliasByEmail(cleanAlias);
    if (existingAlias) {
      return NextResponse.json(
        { error: `Alias "${cleanAlias}" is already assigned to another user.`, success: false },
        { status: 409 }
      );
    }

    const policyError = getPasswordPolicyError(password);
    if (policyError) {
      return NextResponse.json({ error: policyError, success: false }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const newUser = await dataStore.createUser({
      name,
      username,
      role,
      status: 'active',
      password_hash: passwordHash,
      must_change_password: true,
    });

    const newAlias = await dataStore.createAlias(newUser.id, cleanAlias);

    await logAuditEvent({
      userId: admin.id,
      action: 'ADMIN_CREATE_USER',
      resourceType: 'USER',
      resourceId: newUser.id,
      metadata: { username, role, initialAlias: cleanAlias },
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'User and alias created successfully.',
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role,
        status: newUser.status,
        alias: newAlias.email_address,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
