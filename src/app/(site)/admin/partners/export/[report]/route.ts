import { isAdmin, requireAdmin } from "@/lib/admin/guard";
import { adminExport, EXPORT_REPORTS, type ExportReport } from "@/lib/partners/application/queries/admin-reports";
import { toCsv } from "@/lib/partners/presentation/csv";
import { idSchema, reportPeriod } from "@/lib/partners/presentation/validation";
import { partnerDeps } from "@/lib/partners/server";

/**
 * Admin -> partner CSV exports: commissions, settlements or the ledger, for
 * one partner (?partner=<id>) or everyone. Administrators only - to anyone
 * else this address does not exist, like the rest of /admin. Exports carry
 * no secret, no bank detail and no customer name or email (adminExport).
 */

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  if (!(await isAdmin())) return notFound();
  const who = await requireAdmin();
  const { report } = await params;
  if (!(EXPORT_REPORTS as readonly string[]).includes(report)) return notFound();
  const query = new URL(request.url).searchParams;
  const partner = query.get("partner");
  if (partner !== null && !idSchema.safeParse(partner).success) return notFound();
  const period = reportPeriod(query.get("from"), query.get("to"));

  const result = await adminExport(partnerDeps(), { kind: "admin", userId: who.userId, email: who.email }, { report: report as ExportReport, partnerId: partner ?? undefined, from: period.from, to: period.to });
  if (!result) return new Response("Stripe is not configured on this deployment.", { status: 409, headers: { "cache-control": "no-store" } });

  const stamp = new Date().toISOString().slice(0, 10);
  const range = period.fromText || period.toText ? `-${period.fromText ?? "start"}_to_${period.toText ?? stamp}` : "";
  const name = `repget-partner-${report}-${result.environment}${partner ? `-${partner.slice(0, 8)}` : ""}${range}-${stamp}.csv`;
  return new Response(toCsv(result.header, result.rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...(result.truncated ? { "x-export-truncated": "true" } : {}),
    },
  });
}
