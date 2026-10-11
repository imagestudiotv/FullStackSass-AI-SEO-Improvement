-- The homepage's testimonial cards, managed in Admin -> Testimonials
-- (client, 2026-10-11; lib/admin/testimonials.ts). A new table: nothing that
-- exists changes.
--
-- The twelve cards are the client's SAMPLE content from the design package:
-- unpublished drafts marked "sample", shown only on the admin design preview.
-- A sample cannot be published until its words, name or picture are replaced
-- with a real customer's approved ones.
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"quote" text NOT NULL,
	"avatar_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"permission_confirmed_by" text,
	"permission_confirmed_at" timestamp,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "testimonials_published_order_idx" ON "testimonials" USING btree ("published","sort_order");
--> statement-breakpoint
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO testimonials (name, role, quote, avatar_url, sort_order, published, sample, created_by) VALUES
  ('Image Studio', 'Photo & Film Studio', 'RepGet gave us a clear structure for content planning and improved our visibility across search. We now attract more qualified enquiries and have seen steady growth in our bookings.', '/preview/testimonials/sample-01.webp', 1, false, true, 'design package 2026-10-11'),
  ('Culiucs', 'Artist', 'RepGet helped me become more discoverable online and build a stronger presence around my work. The publishing flow is clear and consistent, and I am reaching a much wider audience.', '/preview/testimonials/sample-02.webp', 2, false, true, 'design package 2026-10-11'),
  ('Stefan Coetzer', 'Founder', 'RepGet helped us simplify content planning and link outreach, which led to stronger rankings, better visibility, and a more consistent pipeline of leads and sales opportunities.', '/preview/testimonials/sample-03.webp', 3, false, true, 'design package 2026-10-11'),
  ('Muhammad Imran', 'Agency Owner', 'One of the best tools we have used for scaling SEO execution. We publish faster, see steady organic traffic growth, and spend less time on manual work.', '/preview/testimonials/sample-04.webp', 4, false, true, 'design package 2026-10-11'),
  ('Oxford Magic Tours', 'Travel Brand', 'We wanted better visibility in Google and stronger authority around our key pages. RepGet gave us a clearer system, better momentum, and measurable growth in enquiries.', '/preview/testimonials/sample-05.webp', 5, false, true, 'design package 2026-10-11'),
  ('Tristan B.', 'Solo Founder', 'As a solo founder, I needed a way to reduce the time spent on SEO. RepGet automated the heavy lifting and helped me focus on closing clients while rankings kept improving.', '/preview/testimonials/sample-06.webp', 6, false, true, 'design package 2026-10-11'),
  ('Gasper B.', 'Hair Brand', 'We started seeing more discovery through search after improving our content workflow with RepGet. Traffic quality and local visibility have grown significantly.', '/preview/testimonials/sample-07.webp', 7, false, true, 'design package 2026-10-11'),
  ('Peter Chrzaniecki', 'Founder', 'RepGet made it easier to turn strategy into action. The workflow is practical, the publishing side is smooth, and we have seen better organic traction across our most important pages.', '/preview/testimonials/sample-08.webp', 8, false, true, 'design package 2026-10-11'),
  ('Patryk', 'Ecommerce Owner', 'Good product, clean process, and real results. RepGet helped us organise content production, improve authority, and grow both traffic and conversions.', '/preview/testimonials/sample-09.webp', 9, false, true, 'design package 2026-10-11'),
  ('Sofia Rinaldi', 'Growth Lead', 'What impressed me most was the speed. We moved from ideas to published content much faster, and that consistency translated into stronger brand visibility and more inbound interest.', '/preview/testimonials/sample-10.webp', 10, false, true, 'design package 2026-10-11'),
  ('GrowEco', 'Brand', 'RepGet supported our growth with a more structured SEO system. We improved publishing consistency, expanded our keyword reach, and generated more qualified visits to our commercial pages.', '/preview/testimonials/sample-11.webp', 11, false, true, 'design package 2026-10-11'),
  ('Lauren T.', 'Client', 'A very solid platform for teams that want real SEO momentum. It helped us stay consistent, reduce friction, and build a stronger presence that supports growth month after month.', '/preview/testimonials/sample-12.webp', 12, false, true, 'design package 2026-10-11');
