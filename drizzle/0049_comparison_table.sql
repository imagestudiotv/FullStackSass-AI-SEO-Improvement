-- Article Settings: "Comparison table" (client request, 2026-10-02). Writes one
-- comparison table into each article ("Videography vs Cinematography at a
-- Glance"). Additive: one column, which a build older than this migration
-- ignores. DEFAULT true fills existing websites too - the client wants it on
-- every site - and a build that predates it never writes tables. Apply BEFORE
-- deploying the code that reads it: that code selects the column.
ALTER TABLE "websites" ADD COLUMN "comparison_table" boolean DEFAULT true NOT NULL;
