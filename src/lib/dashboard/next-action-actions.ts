"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextActionPreferences } from "@/lib/db/schema";
import { requireEditor } from "@/lib/websites/require-editor";
import { getNextActions } from "./next-actions";

export async function snoozeNextAction(websiteId: string, form: FormData): Promise<void> {
  const guard = await requireEditor(z.string().uuid().parse(websiteId));
  if (!guard.ok) throw new Error(guard.error);
  const id = z.string().max(80).parse(form.get("taskId"));
  const actions = await getNextActions(websiteId, guard.context.ownerOrgId, true, { includeSnoozed: true });
  if (!actions.some(a => a.id === id)) return;
  await db.insert(nextActionPreferences).values({
    websiteId, taskKey: id, actorId: guard.context.userId, snoozedUntil: new Date(Date.now() + 7 * 86400000),
  }).onConflictDoUpdate({
    target: [nextActionPreferences.websiteId, nextActionPreferences.taskKey],
    set: { snoozedUntil: new Date(Date.now() + 7 * 86400000), actorId: guard.context.userId },
  });
  revalidatePath("/dashboard");
}

export async function restoreNextActions(websiteId: string): Promise<void> {
  const guard = await requireEditor(z.string().uuid().parse(websiteId));
  if (!guard.ok) throw new Error(guard.error);
  await db.delete(nextActionPreferences).where(eq(nextActionPreferences.websiteId, websiteId));
  revalidatePath("/dashboard");
}
