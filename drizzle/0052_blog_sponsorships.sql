CREATE TABLE blog_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug text NOT NULL,
  email text NOT NULL,
  website_url text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  checkout_id text CONSTRAINT blog_sponsorships_checkout_id_unique UNIQUE,
  checkout_url text,
  paid_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE blog_sponsorships ENABLE ROW LEVEL SECURITY;
