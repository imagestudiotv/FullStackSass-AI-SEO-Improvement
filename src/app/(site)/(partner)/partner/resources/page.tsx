import { notFound } from "next/navigation";

import { ResourcesView, type ResourceFile } from "@/components/partners/dashboard-views";
import { partnerLink } from "@/lib/partners/application/queries/partner-dashboard";
import { fill } from "@/lib/partners/presentation/copy";
import { partnerDeps } from "@/lib/partners/server";

import { requirePartnerPage } from "../portal";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { copy } = await requirePartnerPage();
  return { title: copy.portal.resources.title };
}

const BANNER_SIZES = [
  { width: 728, height: 90 },
  { width: 300, height: 250 },
  { width: 1200, height: 628 },
] as const;

/**
 * Promotional resources: the brand files as shipped (public/images), banners
 * in the partner's language (public/partners/banners) and ready-made texts
 * with the partner's own link filled in. No figures, testimonials or
 * performance claims anywhere.
 */
export default async function PartnerResourcesPage() {
  const { access, copy, locale } = await requirePartnerPage();
  const link = await partnerLink(partnerDeps(), access.context);
  if (!link) notFound();
  const r = copy.portal.resources;

  const logos: ResourceFile[] = [
    { href: "/images/repget-logo.png", preview: "/images/repget-logo.png", name: r.files.logo, detail: "PNG · 2757 × 690", width: 2757, height: 690, previewClassName: "bg-white" },
    {
      href: "/images/repget-logo-light.png",
      preview: "/images/repget-logo-light.png",
      name: r.files.logoLight,
      detail: "PNG · 2757 × 690",
      width: 2757,
      height: 690,
      previewClassName: "bg-neutral-900",
    },
    { href: "/images/repget-mark.png", preview: "/images/repget-mark.png", name: r.files.mark, detail: "PNG · 256 × 256", width: 256, height: 256, previewClassName: "bg-white" },
  ];
  const banners: ResourceFile[] = BANNER_SIZES.map(({ width, height }) => {
    const href = `/partners/banners/repget-${locale}-${width}x${height}.png`;
    return { href, preview: href, name: fill(r.files.banner, { size: `${width} × ${height}` }), detail: "PNG", width, height, previewClassName: "bg-muted/40" };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{r.intro}</p>
      </div>
      <ResourcesView copy={copy.portal} logos={logos} banners={banners} templates={r.templates.map((template) => ({ title: template.title, body: fill(template.body, { link }) }))} />
    </div>
  );
}
