import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, parseCookies, verifySessionToken } from '../auth/session';
import { AuthSessionUser, Message, Attachment } from '../db/types';
import { dataStore } from '../db/store';
import { logAuditEvent } from '../audit/logger';

export class AuthError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function getAuthenticatedSession(req: NextRequest | Request): Promise<AuthSessionUser | null> {
  let token: string | undefined;
  if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
    token = (req as any).cookies.get(AUTH_COOKIE_NAME)?.value;
  }
  if (!token) {
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = parseCookies(cookieHeader);
    token = cookies[AUTH_COOKIE_NAME] || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  }

  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireActiveUser(req: NextRequest | Request): Promise<AuthSessionUser> {
  const session = await getAuthenticatedSession(req);
  if (!session) {
    throw new AuthError('Authentication required. Please log in.', 401);
  }

  if (session.status !== 'active') {
    throw new AuthError('Your account has been disabled or suspended. Please contact your administrator.', 403);
  }

  return session;
}

export async function requireAdmin(req: NextRequest | Request): Promise<AuthSessionUser> {
  const user = await requireActiveUser(req);
  if (user.role !== 'admin') {
    await logAuditEvent({
      userId: user.id,
      action: 'ADMIN_ACCESS_DENIED',
      resourceType: 'ADMIN_ROUTE',
      metadata: { attemptedRole: user.role },
      req,
    });
    throw new AuthError('Forbidden. Administrative privileges required.', 403);
  }
  return user;
}

/**
 * Asserts that a message exists and is owned by the authenticated user.
 * Prevents IDOR/BOLA attacks.
 */
export async function assertMessageOwnership(
  user: AuthSessionUser,
  messageId: string
): Promise<Message> {
  if (!messageId) {
    throw new AuthError('Invalid message ID', 400);
  }

  const message = await dataStore.getMessageById(messageId);
  if (!message) {
    throw new AuthError('Message not found.', 404);
  }

  if (message.owner_user_id !== user.id) {
    await logAuditEvent({
      userId: user.id,
      action: 'UNAUTHORIZED_MESSAGE_ACCESS_ATTEMPT',
      resourceType: 'MESSAGE',
      resourceId: messageId,
      metadata: { attemptedBy: user.username, realOwner: message.owner_user_id },
    });
    throw new AuthError('Access denied to requested message.', 403);
  }

  return message;
}

export function isCompanyManager(user: AuthSessionUser): boolean {
  return user.role === 'admin' || user.role === 'manager';
}

export function canViewEmployee360(user: AuthSessionUser, employee: { user_id: string }): boolean {
  return isCompanyManager(user) || employee.user_id === user.id;
}

export async function canViewEmployeeDirectory(
  user: AuthSessionUser,
  employeeId: string
): Promise<boolean> {
  if (isCompanyManager(user)) return true;
  const employee = await dataStore.getEmployeeById(employeeId);
  if (!employee) return false;
  if (employee.user_id === user.id) return true;
  if (employee.created_by_id === user.id) return true;
  const myEmp = await dataStore.getEmployeeByUserId(user.id);
  if (!myEmp) return false;
  if (myEmp.group_id && myEmp.group_id === employee.group_id) return true;
  if (await dataStore.isGroupLeaderFor(myEmp.id, employee.id)) return true;
  return false;
}

export async function canViewEmployeeProfile(
  user: AuthSessionUser,
  employeeId: string
): Promise<boolean> {
  return canViewEmployeeDirectory(user, employeeId);
}

export async function assertEmployeeProfileAccess(user: AuthSessionUser, employeeId: string) {
  const allowed = await canViewEmployeeProfile(user, employeeId);
  if (!allowed) {
    throw new AuthError('Access denied to this employee profile.', 403);
  }
}

export type TaskAccessLevel = 'none' | 'read' | 'status' | 'full';

export async function getTaskAccessLevel(
  user: AuthSessionUser,
  task: { created_by_id: string; assigned_to_id: string }
): Promise<TaskAccessLevel> {
  if (user.role === 'admin') return 'full';
  if (task.created_by_id === user.id) return 'full';
  const emp = await dataStore.getEmployeeByUserId(user.id);
  if (emp && task.assigned_to_id === emp.id) return 'status';
  return 'none';
}

export async function canManageGroup(user: AuthSessionUser, groupId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const group = await dataStore.getGroupById(groupId);
  if (!group) return false;
  if (group.created_by_id && group.created_by_id === user.id) return true;
  const emp = await dataStore.getEmployeeByUserId(user.id);
  if (emp && group.leader_id === emp.id) return true;
  return false;
}

export async function canMarkAttendanceFor(
  user: AuthSessionUser,
  targetEmployeeId: string
): Promise<boolean> {
  if (isCompanyManager(user)) return true;
  const target = await dataStore.getEmployeeById(targetEmployeeId);
  if (!target) return false;
  if (target.user_id === user.id) return true;
  if (target.created_by_id && target.created_by_id === user.id) return true;
  const myEmp = await dataStore.getEmployeeByUserId(user.id);
  if (myEmp && (await dataStore.isGroupLeaderFor(myEmp.id, target.id))) return true;
  return false;
}

/**
 * Asserts that an attachment exists, belongs to the specified message,
 * and the message is owned by the authenticated user.
 */
export async function assertAttachmentOwnership(
  user: AuthSessionUser,
  messageId: string,
  attachmentId: string
): Promise<{ message: Message; attachment: Attachment }> {
  const message = await assertMessageOwnership(user, messageId);

  const attachment = await dataStore.getAttachmentById(attachmentId);
  if (!attachment || attachment.message_id !== message.id) {
    throw new AuthError('Attachment not found or does not belong to this message.', 404);
  }

  return { message, attachment };
}

/**
 * Strict validation against CRLF header injection and email formatting
 */
export function validateEmailString(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Disallow CRLF or control characters
  if (/[\r\n\0\t]/.test(email)) return false;
  // Standard RFC 5322 regex approximation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

export function validateSafeHeader(text: string): string {
  if (!text) return '';
  // Strip dangerous CRLF injection characters
  return text.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Standard API error response generator
 */
export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    if (err.statusCode >= 500) {
      console.error('[API AUTH ERROR]', err);
    }
    const res = NextResponse.json(
      { error: err.message, success: false },
      { status: err.statusCode }
    );
    if (err.statusCode === 401) {
      res.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
    }
    return res;
  }

  console.error('[API ERROR]', err);
  const isProd = process.env.NODE_ENV === 'production';
  const message =
    !isProd && err instanceof Error ? err.message : 'An unexpected internal error occurred.';
  return NextResponse.json(
    { error: message, success: false },
    { status: 500 }
  );
}
