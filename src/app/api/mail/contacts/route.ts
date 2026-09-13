import { NextRequest, NextResponse } from 'next/server';
import { requireActiveUser, handleApiError } from '@/lib/security/authorization';
import { dataStore } from '@/lib/db/store';

export interface ContactSuggestion {
  name: string;
  email: string;
  designation?: string;
  department?: string;
  isCompany: boolean;
  frequency: number;
  lastInteractedAt?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser(req);
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('q') || '').trim().toLowerCase();

    // 1. Fetch organization members
    const [allEmployees, userMessages] = await Promise.all([
      dataStore.getEmployees(),
      dataStore.getMessagesByOwner(user.id, { limit: 1000 }),
    ]);

    const contactMap = new Map<string, ContactSuggestion>();

    // 2. Index organization employees
    for (const emp of allEmployees) {
      if (!emp.email) continue;
      const cleanEmail = emp.email.toLowerCase().trim();
      contactMap.set(cleanEmail, {
        name: emp.name,
        email: cleanEmail,
        designation: emp.designation,
        department: emp.department_name,
        isCompany: true,
        frequency: 1,
        lastInteractedAt: emp.joining_date || null,
      });
    }

    // 3. Scan user's sent & received messages to compute frequency & last interaction
    for (const msg of userMessages.messages) {
      // Inbound sender
      if (msg.from_address) {
        const email = msg.from_address.toLowerCase().trim();
        const existing = contactMap.get(email);
        if (existing) {
          existing.frequency += 2;
          if (msg.received_at && (!existing.lastInteractedAt || msg.received_at > existing.lastInteractedAt)) {
            existing.lastInteractedAt = msg.received_at;
          }
        } else {
          contactMap.set(email, {
            name: msg.from_name || email.split('@')[0],
            email,
            isCompany: email.endsWith('@cruvels.com'),
            frequency: 2,
            lastInteractedAt: msg.received_at || msg.created_at || null,
          });
        }
      }

      // Outbound recipients
      for (const to of msg.to_addresses || []) {
        const email = to.toLowerCase().trim();
        const existing = contactMap.get(email);
        if (existing) {
          existing.frequency += 3;
          if (msg.sent_at && (!existing.lastInteractedAt || msg.sent_at > existing.lastInteractedAt)) {
            existing.lastInteractedAt = msg.sent_at;
          }
        } else {
          contactMap.set(email, {
            name: email.split('@')[0],
            email,
            isCompany: email.endsWith('@cruvels.com'),
            frequency: 3,
            lastInteractedAt: msg.sent_at || msg.created_at || null,
          });
        }
      }
    }

    // 4. Filter by search query if provided
    let results = Array.from(contactMap.values());
    if (query) {
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          (c.designation && c.designation.toLowerCase().includes(query)) ||
          (c.department && c.department.toLowerCase().includes(query))
      );
    }

    // 5. Sort by interaction frequency descending, then company users, then alphabetical
    results.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      if (a.isCompany !== b.isCompany) return a.isCompany ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      contacts: results.slice(0, 30),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
