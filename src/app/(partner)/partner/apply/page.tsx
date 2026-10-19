import { Clock, XCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { ApplicationForm } from "@/components/partners/application-form";
import { VerifyEmail } from "@/components/partners/verify-email";
import { applicationStatus } from "@/lib/partners/application/use-cases/submit-application";
import { fill } from "@/lib/partners/presentation/copy";
import { partnerDeps } from "@/lib/partners/server";

import { countryNames, portalContext } from "../portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await portalContext();
  return { title: copy.portal.apply.title };
}

/**
 * Applying, with the signed-in account. In order: a proven address (or the
 * code to prove it), then the application's status if there is one, then the
 * form - unless applications are closed.
 */
export default async function PartnerApplyPage() {
  const { viewer, copy, locale } = await portalContext();
  const t = copy.portal;
  if (viewer.state === "partner") redirect("/partner");
  if (viewer.state === "signed_out") redirect("/sign-in?next=/partner/apply");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.apply.title}</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">{t.apply.intro}</p>
      </div>
      {viewer.state === "unverified" ? (
        <VerifyEmail email={viewer.email} copy={t.verify} />
      ) : (
        <ApplicationState applicant={viewer.applicant} locale={locale} copy={t} />
      )}
    </div>
  );
}

async function ApplicationState({
  applicant,
  locale,
  copy,
}: {
  applicant: { userId: string; email: string; name: string; kind: "applicant" };
  locale: string;
  copy: Awaited<ReturnType<typeof portalContext>>["copy"]["portal"];
}) {
  const deps = partnerDeps();
  const status = await applicationStatus(deps, applicant);
  if (status.latest?.status === "submitted") {
    return (
      <Notice icon={Clock} title={copy.apply.pendingTitle} body={fill(copy.apply.pendingBody, { email: applicant.email })} />
    );
  }
  if (!status.programOpen) return <Notice icon={Clock} title={copy.apply.closed} body="" />;
  return (
    <div className="space-y-6">
      {status.latest?.status === "rejected" ? <Notice icon={XCircle} title={copy.apply.rejectedTitle} body={copy.apply.rejectedBody} /> : null}
      <ApplicationForm copy={copy.apply} countries={countryNames(deps.settings.payoutCountries(), locale)} />
    </div>
  );
}

function Notice({ icon: Icon, title, body }: { icon: typeof Clock; title: string; body: string }) {
  return (
    <div className="flex max-w-xl gap-3 rounded-xl border bg-card p-5" role="status">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">{title}</p>
        {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
      </div>
    </div>
  );
}
