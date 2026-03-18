import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { kanbans, kanbanMembers } from "@/lib/db/schema";

/**
 * Check if user can access the kanban (creator or member).
 */
export async function canAccessKanban(
  kanbanId: string,
  userId: string
): Promise<boolean> {
  const [kanban] = await db
    .select({ userId: kanbans.userId })
    .from(kanbans)
    .where(eq(kanbans.id, kanbanId));
  if (!kanban) return false;
  if (kanban.userId === userId) return true;

  const [member] = await db
    .select()
    .from(kanbanMembers)
    .where(
      and(
        eq(kanbanMembers.kanbanId, kanbanId),
        eq(kanbanMembers.userId, userId)
      )
    );
  return !!member;
}

/**
 * Check if user is admin of the kanban (creator or admin role in kanban_members).
 */
export async function isKanbanAdmin(
  kanbanId: string,
  userId: string
): Promise<boolean> {
  const [kanban] = await db
    .select({ userId: kanbans.userId })
    .from(kanbans)
    .where(eq(kanbans.id, kanbanId));
  if (!kanban) return false;
  if (kanban.userId === userId) return true;

  const [member] = await db
    .select()
    .from(kanbanMembers)
    .where(
      and(
        eq(kanbanMembers.kanbanId, kanbanId),
        eq(kanbanMembers.userId, userId),
        eq(kanbanMembers.role, "admin")
      )
    );
  return !!member;
}
