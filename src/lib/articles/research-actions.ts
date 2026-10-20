"use server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { requireEditor } from "@/lib/websites/require-editor";
import { lockForEdit } from "@/lib/publishing/dispatch";
import { reviewHashSql } from "./review";

export async function approveArticleResearch(websiteId: string, articleId: string, form: FormData): Promise<void> {
  const guard = await requireEditor(z.string().uuid().parse(websiteId));
  if (!guard.ok) throw new Error(guard.error);
  z.string().uuid().parse(articleId);
  const expectedHash = z.string().regex(/^[a-f0-9]{64}$/).parse(form.get("revision"));
  if (form.get("reviewed") !== "yes") throw new Error("Review the article and its sources before approving.");
  await db.transaction(async tx => {
    const [owned] = await tx.select({ id: articles.id }).from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId))).limit(1);
    if (!owned) throw new Error("Article not found");
    await lockForEdit(tx, articleId);
    const saved = await tx.update(articles).set({
      researchApprovedHash: expectedHash, researchApprovedBy: guard.context.userId, researchApprovedAt: new Date(),
    }).where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId),
      inArray(articles.status, ["draft", "published"]), eq(articles.researchReviewRequired, true),
      sql`${reviewHashSql} = ${expectedHash}`)).returning({ id: articles.id });
    if (!saved.length) throw new Error("The article changed. Refresh and review the latest saved version.");
  });
  revalidatePath(`/websites/${websiteId}/articles/${articleId}`);
  revalidatePath("/dashboard");
}
