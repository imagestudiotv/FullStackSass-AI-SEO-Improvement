import { AdminListSkeleton } from "../_ui/states";

/** The blog's lists: one language's posts, with their search and category filter. */
export default function Loading() {
  return <AdminListSkeleton rows={6} columns={5} withToolbar />;
}
