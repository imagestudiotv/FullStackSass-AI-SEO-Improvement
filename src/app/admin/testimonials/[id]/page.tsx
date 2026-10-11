import { notFound } from "next/navigation";

import { getTestimonialAdmin } from "@/lib/admin/testimonials";

import { TestimonialEditor } from "../testimonial-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit testimonial" };

export default async function AdminTestimonialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Guarded (requireAdmin) and UUID-checked: a malformed id is a 404.
  const card = await getTestimonialAdmin(id);
  if (!card) notFound();
  return <TestimonialEditor card={card} />;
}
