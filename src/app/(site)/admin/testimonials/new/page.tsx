import { requireAdmin } from "@/lib/admin/guard";

import { TestimonialEditor } from "../testimonial-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "New testimonial" };

/** A blank card; its first save creates it, last in the homepage order. */
export default async function AdminNewTestimonialPage() {
  await requireAdmin();
  return <TestimonialEditor card={null} />;
}
