import { Eye, Plus, Quote } from "lucide-react";
import Link from "next/link";

import { initials } from "@/components/testimonial-card";
import { Button } from "@/components/ui/button";
import { listTestimonialsAdmin } from "@/lib/admin/testimonials";

import { AdminPage, AdminPageHeader } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { TestimonialRowActions } from "./testimonial-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Testimonials" };

/**
 * Admin -> Testimonials: the homepage's testimonial cards, in their homepage
 * order (lib/admin/testimonials.ts). Published cards are on the homepage and
 * the plan screen; drafts only on the design preview. Sample cards from the
 * client's design package wait for a real customer's approved words.
 */
export default async function AdminTestimonialsPage() {
  const cards = await listTestimonialsAdmin();
  const published = cards.filter((card) => card.published).length;

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Testimonials"
        description={
          published === 0
            ? "The cards for the homepage's testimonials section. None is published, so visitors don't see the section yet. The preview shows every card in the homepage's design."
            : `The cards for the homepage's testimonials section. ${published} published: visitors see ${published === 1 ? "it" : "them"} on the homepage and the plan screen, in this order.`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="lg" asChild>
              <a href="/preview/testimonials#testimonials" target="_blank" rel="noopener">
                <Eye aria-hidden="true" />
                Preview on the homepage
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </Button>
            <Button size="lg" asChild>
              <Link href="/admin/testimonials/new">
                <Plus aria-hidden="true" />
                New testimonial
              </Link>
            </Button>
          </div>
        }
      />

      {cards.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <AdminEmpty
            filtering={false}
            icon={Quote}
            noun="testimonials"
            title="No testimonials yet"
            description="Add a customer's quote, with their agreement to publish it."
          />
        </div>
      ) : (
        <ol className="space-y-3">
          {cards.map((card, index) => (
            <li key={card.id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start">
              <span className="w-6 shrink-0 pt-1 text-sm text-muted-foreground tabular-nums" aria-label={`Position ${index + 1}`}>
                {index + 1}
              </span>
              {card.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a stored 128px picture shown as it is
                <img src={card.avatarUrl} alt="" className="size-12 shrink-0 rounded-full bg-muted object-cover" />
              ) : (
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary-strong">
                  {initials(card.name)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/testimonials/${card.id}`} className="font-semibold underline-offset-4 wrap-anywhere hover:underline">
                    {card.name}
                  </Link>
                  {card.role ? <span className="text-sm text-muted-foreground wrap-anywhere">{card.role}</span> : null}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-foreground/75 wrap-anywhere">{card.quote}</p>
                <p className="mt-2 flex flex-wrap gap-2">
                  {card.published ? (
                    <AdminStatus tone="success" label="Published" title="On the homepage and the plan screen" />
                  ) : (
                    <AdminStatus tone="neutral" label="Draft" title="Only on the design preview" />
                  )}
                  {card.sample ? (
                    <AdminStatus
                      tone="warning"
                      label="Sample - replace before publishing"
                      title="From the design package: not a real customer's words. Edit the words, name or picture to make it a real card."
                    />
                  ) : null}
                </p>
              </div>
              <TestimonialRowActions id={card.id} name={card.name} first={index === 0} last={index === cards.length - 1} published={card.published} />
            </li>
          ))}
        </ol>
      )}
    </AdminPage>
  );
}
