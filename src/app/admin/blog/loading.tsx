import { AdminListSkeleton } from "../_ui/states";

/** The blog's lists: posts first (no search or filters on this page). */
export default function Loading() {
  return <AdminListSkeleton rows={6} columns={5} withToolbar={false} />;
}
