import { Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ApplicationForm } from "@/components/partners/application-form";
import { VerifyEmail } from "@/components/partners/verify-email";
import { isLocale, localePath } from "@/lib/i18n/config";
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
 * Applying, with the signed-in account, in Daniel's centred design
 * (2026-11-07). In order: a proven address (or the code to prove it), then
 * the application's status if there is one, then the form - unless
 * applications are closed. A partner goes to the portal.
 */
export default async function PartnerApplyPage() {
  const { viewer, copy, locale } = await portalContext();
  const t = copy.portal;
  if (viewer.state === "partner") redirect("/partner");
  if (viewer.state === "signed_out") redirect("/sign-in?next=/partner/apply");
  const program = localePath(isLocale(locale) ? locale : "en", "/partners");

  return (
    <div className="mx-auto max-w-[620px] pt-10 sm:pt-16">
      <section className="mb-7 text-center" aria-labelledby="partner-apply-title">
        <p className="mb-3.5 text-[11px] font-extrabold tracking-[1.45px] text-primary uppercase">{t.apply.eyebrow}</p>
        <h1 id="partner-apply-title" className="mb-3 text-[clamp(32px,4.9vw,43px)] leading-[1.15] font-extrabold tracking-[-1.6px] sm:tracking-[-2px]">
          {t.apply.heading}
        </h1>
        <p className="mx-auto max-w-[520px] text-[13.5px] leading-relaxed text-muted-foreground sm:text-[15px]">{t.apply.intro}</p>
      </section>
      {viewer.state === "unverified" ? (
        <VerifyEmail email={viewer.email} copy={t.verify} />
      ) : (
        <ApplicationState applicant={viewer.applicant} locale={locale} program={program} copy={t} />
      )}
      <p className="mx-auto mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        {t.apply.questions}{" "}
        <Link href={program} className="font-bold hover:text-primary">
          {t.apply.questionsLink}
        </Link>
      </p>
    </div>
  );
}

async function ApplicationState({
  applicant,
  locale,
  program,
  copy,
}: {
  applicant: { userId: string; email: string; name: string; kind: "applicant" };
  locale: string;
  program: string;
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
      <ApplicationForm copy={copy.apply} countries={countryNames(deps.settings.payoutCountries(), locale)} termsHref={program} />
    </div>
  );
}

function Notice({ icon: Icon, title, body }: { icon: typeof Clock; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-[20px] border bg-card p-6" role="status">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        {body ? <p className="mt-1 text-sm text-muted-foreground">{body}</p> : null}
      </div>
    </div>
  );
}
