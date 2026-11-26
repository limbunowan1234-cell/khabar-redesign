// Moderation audit trail (table moderation_log). Every admin/reporter action
// that removes or hides someone else's content, or limits an account, is
// written here so there is a record of who did what and when.
import type { AppUser } from './auth';

export async function logModeration(
  db: D1Database,
  admin: AppUser,
  action: string,
  targetType: string,
  targetId: string,
  note?: string | null
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO moderation_log (id, admin_id, admin_name, action, target_type, target_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(crypto.randomUUID(), admin.$id, admin.name || null, action, targetType, targetId, note ? String(note).slice(0, 500) : null)
    .run();
}

// Publishing limits for ordinary accounts (staff are not limited). New
// accounts get lower limits for their first day, which makes throwaway
// spam accounts much less useful.
export const PUBLISH_LIMITS = {
  story: { perDay: 5, firstDay: 2 },
  flash: { perDay: 10, firstDay: 5 },
} as const;
