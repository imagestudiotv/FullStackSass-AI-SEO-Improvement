ALTER TABLE blog_posts ADD COLUMN seo_title text;
--> statement-breakpoint
ALTER TABLE blog_posts ADD COLUMN primary_keyword text;
--> statement-breakpoint
ALTER TABLE blog_posts ADD COLUMN secondary_keywords jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE blog_posts ADD COLUMN breadcrumb_label text;
